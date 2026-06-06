const equipmentConfigs = {
  etch: {
    title: 'ETCH',
    metadata: '../data/etch_metadata.csv',
    data: '../data/etch_output.csv'
  },
  photo: {
    title: 'PHOTO',
    metadata: '../data/photo_metadata.csv',
    data: '../data/photo_output.csv'
  },
  transfer: {
    title: 'TRANSFER',
    metadata: '../data/transfer_metadata.csv',
    data: '../data/transfer_output.csv'
  }
};

const fieldLabels = {
  equipmentId: '설비 번호',
  chuckTemp: '척 온도',
  processPressure: '공정 압력',
  recipeName: 'RECIPE',
  lotId: 'LOT ID',
  alarmCode: '알람 번호',
  waferCount: '웨이퍼 수',
  exposureDose: '노광량',
  focusOffset: '초점 보정값',
  maskName: 'MASK',
  robotName: '로봇 이름',
  axisNo: '축 번호',
  motorRpm: '모터 회전수',
  carrierId: 'FOUP ID',
  errorCount: '오류 횟수'
};

const state = {
  current: 'etch',
  fields: [],
  originalRows: [],
  rows: [],
  sortField: null,
  sortDirection: 'asc'
};

function parseCsv(text) {
  return text.trim().split(/\r?\n/).map((line) => line.split(','));
}

async function loadCsv(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`CSV load failed: ${path}`);
  }

  return parseCsv(await response.text());
}

function parseMetadata(rows) {
  return rows.slice(1).map(([name, type, size]) => ({
    name,
    type,
    size: Number(size)
  }));
}

function parseData(rows) {
  const headers = rows[0];

  return rows.slice(1).map((values) => {
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
}

function formatValue(field, value) {
  if (field.type === 'CHAR_ARRAY') {
    return value;
  }

  const number = Number(value);
  return Number.isFinite(number) ? String(number) : value;
}

function isNumberField(field) {
  return field.type !== 'CHAR_ARRAY';
}

function sortRows(field) {
  if (state.sortField === field.name) {
    if (state.sortDirection === 'asc') {
      state.sortDirection = 'desc';
    } else {
      state.sortField = null;
      state.sortDirection = 'asc';
      state.rows = [...state.originalRows];
      return;
    }
  } else {
    state.sortField = field.name;
    state.sortDirection = 'asc';
  }

  const direction = state.sortDirection === 'asc' ? 1 : -1;

  state.rows.sort((a, b) => {
    const left = a[field.name] ?? '';
    const right = b[field.name] ?? '';

    if (isNumberField(field)) {
      return (Number(left) - Number(right)) * direction;
    }

    return left.localeCompare(right, 'ko', {numeric: true}) * direction;
  });
}

function sortMark(field) {
  if (state.sortField !== field.name) {
    return '';
  }

  return state.sortDirection === 'asc' ? ' ▲' : ' ▼';
}

function getNumericFields() {
  return state.fields.filter((field) => isNumberField(field));
}

function getSeries(field) {
  return state.originalRows
    .map((row) => Number(row[field.name]))
    .filter((value) => Number.isFinite(value));
}

function formatMetric(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildLinePath(values, width, height) {
  if (values.length === 0) {
    return '';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function renderDashboard() {
  const dashboard = document.getElementById('dashboard');
  const fields = getNumericFields().slice(0, 4);

  dashboard.innerHTML = fields.map((field) => {
    const values = getSeries(field);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const points = buildLinePath(values, 260, 88);

    return `
      <article class="metric-card">
        <div class="metric-top">
          <div>
            <strong>${fieldLabels[field.name] ?? field.name}</strong>
            <span>${field.type} · ${field.size}B</span>
          </div>
          <b>${formatMetric(avg)}</b>
        </div>
        <svg class="metric-chart" viewBox="0 0 260 88" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${points}" />
        </svg>
        <div class="metric-range">
          <span>MIN ${formatMetric(min)}</span>
          <span>MAX ${formatMetric(max)}</span>
        </div>
      </article>
    `;
  }).join('');
}

function renderTable() {
  const head = document.getElementById('tableHead');
  const body = document.getElementById('tableBody');

  head.innerHTML = `
    <tr>
      <th>#</th>
      ${state.fields.map((field) => `
        <th>
          <button class="sort-button" data-field="${field.name}">
            ${fieldLabels[field.name] ?? field.name}${sortMark(field)}
          </button>
        </th>
      `).join('')}
    </tr>
  `;

  body.innerHTML = state.rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      ${state.fields.map((field) => `<td>${formatValue(field, row[field.name])}</td>`).join('')}
    </tr>
  `).join('');

  head.querySelectorAll('.sort-button').forEach((button) => {
    button.addEventListener('click', () => {
      const field = state.fields.find((item) => item.name === button.dataset.field);
      sortRows(field);
      renderTable();
    });
  });
}

function renderSummary() {
  const recordSize = state.fields.reduce((sum, field) => sum + field.size, 0);

  document.getElementById('recordSize').textContent = `${recordSize}B`;
  document.getElementById('rowCount').textContent = `${state.rows.length}개`;
}

async function loadEquipment(name) {
  const config = equipmentConfigs[name];
  const status = document.getElementById('status');

  state.current = name;
  state.sortField = null;
  state.sortDirection = 'asc';
  document.getElementById('equipmentTitle').textContent = config.title;
  status.textContent = '불러오는 중';
  status.classList.remove('error');

  try {
    const [metadataRows, dataRows] = await Promise.all([
      loadCsv(config.metadata),
      loadCsv(config.data)
    ]);

    state.fields = parseMetadata(metadataRows);
    state.originalRows = parseData(dataRows);
    state.rows = [...state.originalRows];

    renderDashboard();
    renderTable();
    renderSummary();

    status.textContent = '불러오기 완료';
  } catch (error) {
    console.error('[loadEquipment] 실패:', error);
    status.textContent = '파일을 불러오지 못했습니다';
    status.classList.add('error');
  }
}

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    button.classList.add('active');
    loadEquipment(button.dataset.equipment);
  });
});

loadEquipment(state.current);

const helpBtn = document.getElementById('helpBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const sliderImg = document.getElementById('sliderImg');
const modalTitle = document.getElementById('modalTitle');
const sliderDots = document.querySelectorAll('.slider-dot');

const slides = [
  { src: 'problem.png', label: 'Problem' },
  { src: 'solve.png',   label: 'Solve'   }
];
let slideIndex = 0;

function goToSlide(index) {
  slideIndex = (index + slides.length) % slides.length;
  sliderImg.style.opacity = '0';
  setTimeout(() => {
    sliderImg.src = slides[slideIndex].src;
    sliderImg.alt = slides[slideIndex].label;
    modalTitle.textContent = slides[slideIndex].label;
    sliderImg.style.opacity = '1';
  }, 150);
  sliderDots.forEach((dot, i) => dot.classList.toggle('active', i === slideIndex));
}

helpBtn.addEventListener('click', () => {
  slideIndex = 0;
  goToSlide(0);
  modalOverlay.hidden = false;
});

document.getElementById('sliderPrev').addEventListener('click', () => goToSlide(slideIndex - 1));
document.getElementById('sliderNext').addEventListener('click', () => goToSlide(slideIndex + 1));

sliderDots.forEach((dot) => {
  dot.addEventListener('click', () => goToSlide(Number(dot.dataset.index)));
});

modalClose.addEventListener('click', () => {
  modalOverlay.hidden = true;
});

modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) {
    modalOverlay.hidden = true;
  }
});

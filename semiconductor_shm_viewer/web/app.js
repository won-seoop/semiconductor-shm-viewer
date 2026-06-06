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

const testSnapshot = {
  loaded: false,
  fields: [],
  originalRows: [],
  rows: [],
  sortField: null,
  sortDirection: 'asc'
};

function parseCsv(text) {
  return text.trim().split(/\r?\n/).map((line) => line.split(','));
}

async function fetchText(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`fetch failed: ${path}`);
  }

  return response.text();
}

function cppParseMetadata(metaText) {
  return JSON.parse(wasmModule.ccall('parseMetadataCsv', 'string', ['string'], [metaText]));
}

function cppParseData(metaText, dataText) {
  return JSON.parse(wasmModule.ccall('parseDataCsv', 'string', ['string', 'string'], [metaText, dataText]));
}

// shm_parser 로직: 원시 바이너리 버퍼를 메타데이터 기반 포인터 파싱으로 읽기
function cppParseShmBuffer(arrayBuffer, metaText) {
  const bytes = new Uint8Array(arrayBuffer);
  const ptr = wasmModule._malloc(bytes.length);
  wasmModule.HEAPU8.set(bytes, ptr);
  const json = wasmModule.ccall('parseShmBuffer', 'string', ['number', 'number', 'string'], [ptr, bytes.length, metaText]);
  wasmModule._free(ptr);
  return JSON.parse(json);
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
    const [metaText, dataText] = await Promise.all([
      fetchText(config.metadata),
      fetchText(config.data)
    ]);

    state.fields = cppParseMetadata(metaText);
    state.originalRows = cppParseData(metaText, dataText);
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

let wasmModule = null;

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.equipment === 'test') {
      document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
      button.classList.add('active');
      document.getElementById('equipmentTitle').textContent = 'TEST';
      const status = document.getElementById('status');
      status.classList.remove('error');
      if (testSnapshot.loaded) {
        state.fields = testSnapshot.fields;
        state.originalRows = testSnapshot.originalRows;
        state.rows = testSnapshot.rows;
        state.sortField = testSnapshot.sortField;
        state.sortDirection = testSnapshot.sortDirection;
        renderDashboard();
        renderTable();
        renderSummary();
        status.textContent = '불러오기 완료';
      } else {
        status.textContent = 'CSV를 업로드해 주세요';
        document.getElementById('dashboard').innerHTML = '';
        document.getElementById('tableHead').innerHTML = '';
        document.getElementById('tableBody').innerHTML = '';
        document.getElementById('recordSize').textContent = '-';
        document.getElementById('rowCount').textContent = '-';
      }
      return;
    }
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    button.classList.add('active');
    loadEquipment(button.dataset.equipment);
  });
});

ViewerModule().then((mod) => {
  wasmModule = mod;
  loadEquipment(state.current);
  openModal('help');
});

const VALID_TYPES = new Set(['UINT8', 'UINT16', 'UINT32', 'INT8', 'INT16', 'INT32', 'FLOAT', 'DOUBLE', 'CHAR_ARRAY']);

function validateCsvFormat(metaText, dataText) {
  const errors = [];

  const metaRows = parseCsv(metaText);
  const dataRows = parseCsv(dataText);

  // --- 메타데이터 검증 ---
  const metaHeader = metaRows[0].map((c) => c.trim().toLowerCase());
  const metaHeaderOk = metaHeader[0] === 'name' && metaHeader[1] === 'type' && metaHeader[2] === 'size';
  const metaRowsOk = metaRows.length >= 2 && metaRows.slice(1).every((row) => {
    if (row.length < 3) return false;
    const [name, type, sizeStr] = row.map((c) => c.trim());
    return name && VALID_TYPES.has(type) && Number.isInteger(Number(sizeStr)) && Number(sizeStr) > 0;
  });

  if (!metaHeaderOk || !metaRowsOk) {
    errors.push('메타데이터의 포맷이 맞지 않습니다. (형식: name,type,size / type은 UINT8·UINT16 등)');
  }

  // --- 데이터 검증 ---
  const metaFields = metaRows.slice(1).map((row) => row[0].trim());
  const dataHeader = dataRows[0].map((c) => c.trim());
  const dataOk = dataRows.length >= 2
    && dataHeader.length === metaFields.length
    && metaFields.every((name) => dataHeader.includes(name));

  if (!dataOk) {
    errors.push('데이터의 포맷이 맞지 않습니다. (열 이름이 메타데이터와 일치해야 합니다)');
  }

  return errors;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsText(file);
  });
}

const uploadMeta = document.getElementById('uploadMeta');
const uploadData = document.getElementById('uploadData');
const uploadApply = document.getElementById('uploadApply');
const uploadErrors = document.getElementById('uploadErrors');

function showUploadErrors(errors) {
  if (errors.length === 0) {
    uploadErrors.hidden = true;
    return;
  }
  uploadErrors.innerHTML = `<strong>포맷 오류 ${errors.length}건</strong><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>`;
  uploadErrors.hidden = false;
}

uploadApply.addEventListener('click', async () => {
  const metaFile = uploadMeta.files[0];
  const dataFile = uploadData.files[0];

  if (!metaFile || !dataFile) {
    alert('메타데이터와 데이터 CSV를 모두 선택해 주세요.');
    return;
  }

  const status = document.getElementById('status');
  uploadApply.disabled = true;
  status.textContent = '불러오는 중';
  status.classList.remove('error');

  try {
    const [metaText, dataText] = await Promise.all([
      readFileAsText(metaFile),
      readFileAsText(dataFile)
    ]);

    const errors = validateCsvFormat(metaText, dataText);
    if (errors.length > 0) {
      showUploadErrors(errors);
      status.textContent = '포맷 오류';
      status.classList.add('error');
      return;
    }
    showUploadErrors([]);

    state.sortField = null;
    state.sortDirection = 'asc';

    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    document.querySelector('.tab[data-equipment="test"]').classList.add('active');
    document.getElementById('equipmentTitle').textContent = 'TEST';

    state.fields = cppParseMetadata(metaText);
    state.originalRows = cppParseData(metaText, dataText);
    state.rows = [...state.originalRows];

    renderDashboard();
    renderTable();
    renderSummary();

    testSnapshot.loaded = true;
    testSnapshot.fields = state.fields;
    testSnapshot.originalRows = state.originalRows;
    testSnapshot.rows = [...state.rows];
    testSnapshot.sortField = state.sortField;
    testSnapshot.sortDirection = state.sortDirection;

    status.textContent = '불러오기 완료';
  } catch (error) {
    console.error('[uploadApply]', error);
    status.textContent = '파일을 불러오지 못했습니다';
    status.classList.add('error');
  } finally {
    uploadApply.disabled = false;
  }
});

const helpBtn = document.getElementById('helpBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const sliderImg = document.getElementById('sliderImg');
const modalTitle = document.getElementById('modalTitle');

const slideSets = {
  help: [
    { src: 'process/problem.png',                   label: 'Problem' },
    { src: 'process/solve.png',                     label: 'Solve' },
    { src: 'process/common_data_parsing_logic.png', label: 'Common Data Parsing Logic' },
    { src: 'process/shared_memory_read_logic.png',  label: 'Shared Memory Read Logic' }
  ],
  guide: [
    { src: 'guide/1.png', label: 'Guide 1' },
    { src: 'guide/2.png', label: 'Guide 2' },
    { src: 'guide/3.png', label: 'Guide 3' },
    { src: 'guide/4.png', label: 'Guide 4' },
    { src: 'guide/5.png', label: 'Guide 5' }
  ],
  csv: [
    { src: 'metadate_format.png', label: '메타데이터 포맷' },
    { src: 'data_format.png',     label: '데이터 포맷'     }
  ]
};

let slides = slideSets.help;
let slideIndex = 0;

const sliderDotsContainer = document.getElementById('sliderDots');

function buildDots() {
  sliderDotsContainer.innerHTML = slides.map((_, i) =>
    `<span class="slider-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`
  ).join('');
  sliderDotsContainer.querySelectorAll('.slider-dot').forEach((dot) => {
    dot.addEventListener('click', () => goToSlide(Number(dot.dataset.index)));
  });
}

function goToSlide(index) {
  slideIndex = (index + slides.length) % slides.length;
  sliderImg.style.opacity = '0';
  setTimeout(() => {
    sliderImg.src = slides[slideIndex].src;
    sliderImg.alt = slides[slideIndex].label;
    modalTitle.textContent = slides[slideIndex].label;
    sliderImg.style.opacity = '1';
  }, 150);
  sliderDotsContainer.querySelectorAll('.slider-dot').forEach((dot, i) =>
    dot.classList.toggle('active', i === slideIndex)
  );
}

function openModal(setKey) {
  slides = slideSets[setKey];
  slideIndex = 0;
  buildDots();
  goToSlide(0);
  modalOverlay.hidden = false;
}

helpBtn.addEventListener('click', () => openModal('help'));
document.getElementById('guideBtn').addEventListener('click', () => openModal('guide'));
document.getElementById('csvHelpBtn').addEventListener('click', () => openModal('csv'));

document.getElementById('sliderPrev').addEventListener('click', () => goToSlide(slideIndex - 1));
document.getElementById('sliderNext').addEventListener('click', () => goToSlide(slideIndex + 1));


modalClose.addEventListener('click', () => {
  modalOverlay.hidden = true;
});

modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) {
    modalOverlay.hidden = true;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    modalOverlay.hidden = true;
  }
});

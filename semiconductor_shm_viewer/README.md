# 반도체 설비 출력 뷰어

설비 공유 메모리 데이터를 메타데이터 기반으로 파싱하여 웹 브라우저에서 시각화하는 프로젝트입니다.

---

## 문제 상황

![Problem](web/process/problem.png)

설비마다 데이터 구조와 메모리 주소가 달라, 각각 전용 모니터링 도구를 개발해야 했습니다.
공통 로직으로 읽을 수 없어 유지보수 비용과 개발 시간이 증가하는 문제가 있었습니다.

---

## 해결 방법

![Solve](web/process/solve.png)

공유 메모리의 시작 주소와 메타데이터 CSV를 공통 방식으로 처리하여,
하나의 도구로 모든 설비 데이터를 읽고 시각화합니다.

---

## 핵심 로직

### 공유 메모리 읽기

![Shared Memory Read Logic](web/process/shared_memory_read_logic.png)

Windows `OpenFileMappingW` 로 공유 메모리를 열고, `MapViewOfFile` 로 시작 포인터를 획득한 뒤
공통 파싱 엔진(`parseShm`)에 전달합니다.

```
공유메모리 열기 → 메모리 매핑 → 시작 포인터 획득 → parseShm 전달 → 레코드 수행
```

### 공통 데이터 파싱 로직

![Common Data Parsing Logic](web/process/common_data_parsing_logic.png)

메타데이터에 정의된 타입 정보를 기준으로 포인터를 이동하며 각 필드를 해석합니다.

```cpp
*reinterpret_cast<const uint16_t*>(ptr)  // UINT16
*reinterpret_cast<const double*>(ptr)    // DOUBLE
*reinterpret_cast<const float*>(ptr)     // FLOAT
cursor += field.size;                    // 다음 필드로 이동
```

---

## 프로젝트 구조

```
semiconductor_shm_viewer/
├── src/
│   ├── main.cpp              # 진입점
│   ├── viewer.cpp/h          # CSV 기반 터미널 뷰어
│   ├── shm_parser.cpp/h      # 공통 파싱 로직 (포인터 이동 + 타입 캐스팅)
│   ├── field.cpp/h           # 필드 타입 정의
│   ├── csv.cpp/h             # CSV 파싱
│   └── wasm_bindings.cpp     # WebAssembly 바인딩
├── web/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── viewer.js / viewer.wasm  # C++ → WASM 컴파일 결과
│   ├── guide/                   # 사용 가이드 이미지
│   └── process/                 # 문제/해결/로직 이미지
├── data/
│   ├── *_metadata.csv        # 필드 정의 (name, type, size)
│   └── *_output.csv          # 설비 출력 데이터
├── build_wasm.sh             # WASM 빌드 스크립트
└── shm_demo/
    └── shm_reader.cpp        # 공유 메모리 읽기 데모 (Windows)
```

---

## 실행 방법

### 터미널 뷰어 (C++)

```bash
g++ -std=c++17 src/csv.cpp src/field.cpp src/shm_parser.cpp src/viewer.cpp src/main.cpp -o shm_viewer
./shm_viewer
```

### 웹 뷰어

```bash
python3 -m http.server 4173
```

브라우저에서 접속합니다.

```
http://localhost:4173/web/
```

### WASM 재빌드 (C++ 수정 시)

```bash
bash build_wasm.sh
```

---

## 웹 뷰어 사용 가이드

### Step 1 — 설비 선택

![Guide 1](web/guide/1.png)

ETCH / PHOTO / TRANSFER 중 설비를 선택하면 해당 데이터가 로드됩니다.
TEST를 선택하면 직접 CSV를 업로드할 수 있습니다.

### Step 2 — TEST 모드 선택

![Guide 2](web/guide/2.png)

TEST 탭을 선택하면 사이드바 하단에 CSV 직접 업로드 섹션이 활성화됩니다.

### Step 3 — 메타데이터 CSV 업로드

![Guide 3](web/guide/3.png)

`name, type, size` 형식의 메타데이터 CSV를 선택합니다.

```csv
name,type,size
equipmentId,UINT16,2
chuckTemp,DOUBLE,8
```

### Step 4 — 데이터 CSV 업로드 및 적용

![Guide 4](web/guide/4.png)

실제 데이터 CSV를 선택한 뒤 **적용** 버튼을 누릅니다.
포맷이 맞지 않으면 오류 메시지가 표시되고 적용되지 않습니다.

### Step 5 — 결과 확인

![Guide 5](web/guide/5.png)

상단 대시보드에서 주요 지표 추이를 확인하고,
하단 테이블에서 전체 레코드를 조회합니다. 컬럼 헤더를 클릭하면 정렬됩니다.

---

## 메타데이터 포맷

| 컬럼 | 설명 | 예시 |
|------|------|------|
| name | 필드 이름 | `chuckTemp` |
| type | 데이터 타입 | `UINT8` `UINT16` `UINT32` `INT8` `INT16` `INT32` `FLOAT` `DOUBLE` `CHAR_ARRAY` |
| size | 바이트 크기 | `8` |

# 반도체 설비 출력 뷰어

설비별 데이터 구성 파일과 출력 데이터 파일을 읽어서 화면에 보여주는 예제입니다.

## 구조

```text
src/main.cpp
data/*_metadata.csv
data/*_output.csv
```

## 실행

```bash
g++ -std=c++17 src/*.cpp -o shm_viewer
./shm_viewer
```

## 웹 뷰어 실행

```bash
python3 -m http.server 4173
```

브라우저에서 엽니다.

```text
http://localhost:4173/web/
```

## 데이터 구성 파일

```csv
name,type,size
equipmentId,UINT16,2
chuckTemp,DOUBLE,8
lotId,CHAR_ARRAY,12
```

## 설비 출력 파일

```csv
equipmentId,chuckTemp,lotId
101,36.5,LOT-E001
```

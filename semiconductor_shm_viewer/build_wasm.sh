#!/bin/bash
# C++ → WebAssembly 빌드 스크립트
# 실행: bash build_wasm.sh

PATH="/opt/homebrew/opt/python@3.14/bin:$PATH"

emcc \
  src/csv.cpp src/field.cpp src/shm_parser.cpp src/wasm_bindings.cpp \
  -o web/viewer.js \
  -s EXPORTED_FUNCTIONS='["_parseMetadataCsv","_parseDataCsv","_parseShmBuffer","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","HEAPU8"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=ViewerModule \
  -s ENVIRONMENT=web \
  -O2

echo "빌드 완료: web/viewer.js, web/viewer.wasm"

#include <emscripten.h>
#include "csv.h"
#include "field.h"
#include "shm_parser.h"
#include <cstdint>
#include <sstream>
#include <string>
#include <vector>

// 메타데이터 CSV 텍스트 → Field 벡터 (내부 공용)
static std::vector<Field> parseFieldsFromCsv(const char *metaCsvText)
{
    std::vector<Field> fields;
    std::istringstream ss(metaCsvText);
    std::string line;
    std::getline(ss, line); // skip header
    while (std::getline(ss, line))
    {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) continue;
        auto cols = splitCsv(line);
        if (cols.size() < 3) continue;
        try { fields.push_back({cols[0], parseType(cols[1]), std::stoi(cols[2])}); }
        catch (...) {}
    }
    return fields;
}

static std::string jsonEscape(const std::string &s)
{
    std::string out;
    for (char c : s)
    {
        if (c == '"')       out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else                out += c;
    }
    return out;
}

extern "C"
{

// Returns JSON array: [{"name":"x","type":"UINT16","size":2}, ...]
EMSCRIPTEN_KEEPALIVE
const char *parseMetadataCsv(const char *csvText)
{
    static std::string result;
    std::istringstream ss(csvText);
    std::string line;
    std::getline(ss, line); // skip header

    std::string json = "[";
    bool first = true;

    while (std::getline(ss, line))
    {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) continue;

        auto cols = splitCsv(line);
        if (cols.size() < 3) continue;

        if (!first) json += ",";
        json += "{\"name\":\"" + jsonEscape(cols[0]) + "\","
                "\"type\":\"" + jsonEscape(cols[1]) + "\","
                "\"size\":"  + cols[2] + "}";
        first = false;
    }
    json += "]";

    result = json;
    return result.c_str();
}

// Returns JSON array of row objects: [{"field1":"val","field2":123}, ...]
EMSCRIPTEN_KEEPALIVE
const char *parseDataCsv(const char *metaCsvText, const char *dataCsvText)
{
    static std::string result;

    std::vector<Field> fields = parseFieldsFromCsv(metaCsvText);

    // Parse data rows
    std::istringstream ss(dataCsvText);
    std::string line;
    std::getline(ss, line);
    if (!line.empty() && line.back() == '\r') line.pop_back();
    auto headers = splitCsv(line);

    // Pre-compute column indices
    std::vector<int> colIdx;
    for (const auto &field : fields)
    {
        int idx = -1;
        for (int i = 0; i < (int)headers.size(); i++)
            if (headers[i] == field.name) { idx = i; break; }
        colIdx.push_back(idx);
    }

    std::string json = "[";
    bool firstRow = true;

    while (std::getline(ss, line))
    {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) continue;

        auto vals = splitCsv(line);

        if (!firstRow) json += ",";
        json += "{";

        for (size_t i = 0; i < fields.size(); i++)
        {
            if (i > 0) json += ",";
            const Field &f = fields[i];
            int ci = colIdx[i];
            std::string val = (ci >= 0 && ci < (int)vals.size()) ? vals[ci] : "";

            json += "\"" + jsonEscape(f.name) + "\":";
            if (f.type == CHAR_ARRAY)
                json += "\"" + jsonEscape(val) + "\"";
            else
                json += val.empty() ? "null" : val;
        }
        json += "}";
        firstRow = false;
    }
    json += "]";

    result = json;
    return result.c_str();
}

// 원시 바이너리 버퍼(SHM 덤프)를 메타데이터 기반 포인터 파싱으로 읽어 JSON 반환
// shm_parser.cpp 의 readField / parseShm 로직 사용
EMSCRIPTEN_KEEPALIVE
const char *parseShmBuffer(const uint8_t *buf, int bufLen, const char *metaCsvText)
{
    static std::string result;

    std::vector<Field> fields = parseFieldsFromCsv(metaCsvText);

    // 버퍼 크기 검증
    int required = 0;
    for (const auto &f : fields) required += f.size;
    if (bufLen < required)
    {
        result = "{\"error\":\"buffer too small\"}";
        return result.c_str();
    }

    // shm_parser 의 parseShm 으로 포인터 이동하며 읽기
    std::vector<Record> records = parseShm(buf, fields);

    std::string json = "{";
    for (size_t i = 0; i < records.size(); i++)
    {
        if (i > 0) json += ",";
        const Field &f = fields[i];
        json += "\"" + jsonEscape(records[i].name) + "\":";
        if (f.type == CHAR_ARRAY)
            json += "\"" + jsonEscape(records[i].value) + "\"";
        else
            json += records[i].value;
    }
    json += "}";

    result = json;
    return result.c_str();
}

} // extern "C"

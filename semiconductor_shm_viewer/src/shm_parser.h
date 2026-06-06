#ifndef SHM_PARSER_H
#define SHM_PARSER_H

#include "field.h"

#include <string>
#include <vector>

struct Record
{
    std::string name;
    std::string value;
};

// 공유 메모리 포인터를 메타데이터 기반으로 순서대로 읽어 레코드 반환
std::vector<Record> parseShm(const void* ptr, const std::vector<Field>& fields);

// 단일 필드 하나를 포인터 위치에서 읽어 문자열로 반환
std::string readField(const void* ptr, const Field& field);

#endif

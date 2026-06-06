#include "shm_parser.h"

#include <cstdint>
#include <cstring>
#include <sstream>
#include <stdexcept>

std::string readField(const void* ptr, const Field& field)
{
    std::ostringstream oss;

    switch (field.type)
    {
        case UINT8:
            oss << *reinterpret_cast<const uint8_t*>(ptr);
            break;

        case INT16:
            oss << *reinterpret_cast<const int16_t*>(ptr);
            break;

        case UINT16:
            oss << *reinterpret_cast<const uint16_t*>(ptr);
            break;

        case INT32:
            oss << *reinterpret_cast<const int32_t*>(ptr);
            break;

        case UINT32:
            oss << *reinterpret_cast<const uint32_t*>(ptr);
            break;

        case FLOAT:
            oss << *reinterpret_cast<const float*>(ptr);
            break;

        case DOUBLE:
            oss << *reinterpret_cast<const double*>(ptr);
            break;

        case CHAR_ARRAY:
        {
            // null terminator 안전하게 처리
            char buf[256] = {};
            std::memcpy(buf, ptr, std::min(field.size, 255));
            oss << buf;
            break;
        }

        default:
            throw std::runtime_error("unknown field type: " + field.name);
    }

    return oss.str();
}

std::vector<Record> parseShm(const void* ptr, const std::vector<Field>& fields)
{
    std::vector<Record> records;
    const char* cursor = reinterpret_cast<const char*>(ptr);

    for (const Field& field : fields)
    {
        records.push_back({ field.name, readField(cursor, field) });
        cursor += field.size;  // 포인터를 필드 크기만큼 이동
    }

    return records;
}

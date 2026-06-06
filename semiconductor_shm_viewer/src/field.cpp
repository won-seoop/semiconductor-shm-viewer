#include "field.h"

#include <stdexcept>

Type parseType(const std::string &type)
{
    if (type == "UINT8")
        return UINT8;
    if (type == "INT16")
        return INT16;
    if (type == "UINT16")
        return UINT16;
    if (type == "INT32")
        return INT32;
    if (type == "UINT32")
        return UINT32;
    if (type == "FLOAT")
        return FLOAT;
    if (type == "DOUBLE")
        return DOUBLE;
    if (type == "CHAR_ARRAY")
        return CHAR_ARRAY;

    throw std::runtime_error("unknown type: " + type);
}

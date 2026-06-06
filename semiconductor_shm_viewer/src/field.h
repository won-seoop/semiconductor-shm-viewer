#ifndef FIELD_H
#define FIELD_H

#include <string>

enum Type
{
    UINT8,
    INT16,
    UINT16,
    INT32,
    UINT32,
    FLOAT,
    DOUBLE,
    CHAR_ARRAY
};

struct Field
{
    std::string name;
    Type type;
    int size;
};

Type parseType(const std::string &type);

#endif

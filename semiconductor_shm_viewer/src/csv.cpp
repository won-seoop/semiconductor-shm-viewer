#include "csv.h"

#include <sstream>

std::vector<std::string> splitCsv(const std::string &line)
{
    std::vector<std::string> values;
    std::string value;
    std::stringstream ss(line);

    while (std::getline(ss, value, ','))
    {
        values.push_back(value);
    }

    return values;
}

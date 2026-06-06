#include "viewer.h"

#include "csv.h"

#include <fstream>
#include <iostream>
#include <stdexcept>

int SharedMemoryOutputViewer::findColumn(const std::vector<std::string> &headers, const std::string &name)
{
    for (int i = 0; i < (int)headers.size(); i++)
    {
        if (headers[i] == name)
            return i;
    }

    return -1;
}

void SharedMemoryOutputViewer::printValue(const Field &field, const std::string &value)
{
    std::cout << "  " << field.name << " (" << field.size << "B): ";

    if (field.type == CHAR_ARRAY)
        std::cout << value << std::endl;
    else if (field.type == FLOAT || field.type == DOUBLE)
        std::cout << std::stod(value) << std::endl;
    else
        std::cout << std::stoll(value) << std::endl;
}

void SharedMemoryOutputViewer::loadMetadata(const std::string &metadataPath)
{
    std::ifstream file(metadataPath);
    std::string line;

    if (!file)
        throw std::runtime_error("metadata open failed: " + metadataPath);

    std::getline(file, line);

    while (std::getline(file, line))
    {
        std::vector<std::string> columns = splitCsv(line);

        if (columns.size() != 3)
            throw std::runtime_error("invalid metadata line: " + line);

        fields.push_back({
            columns[0],
            parseType(columns[1]),
            std::stoi(columns[2])
        });
    }
}

void SharedMemoryOutputViewer::render(const std::string &dataPath)
{
    std::ifstream file(dataPath);
    std::string line;
    int row = 1;

    if (!file)
        throw std::runtime_error("data open failed: " + dataPath);

    std::getline(file, line);
    std::vector<std::string> headers = splitCsv(line);

    while (std::getline(file, line))
    {
        std::vector<std::string> values = splitCsv(line);

        std::cout << "record #" << row++ << std::endl;

        for (const Field &field : fields)
        {
            int column = findColumn(headers, field.name);

            if (column < 0 || column >= (int)values.size())
                throw std::runtime_error("missing column: " + field.name);

            printValue(field, values[column]);
        }

        std::cout << std::endl;
    }
}

void renderEquipment(const std::string &equipmentName, const std::string &metadataPath, const std::string &dataPath)
{
    SharedMemoryOutputViewer viewer;

    std::cout << "===== " << equipmentName << " shared memory output =====" << std::endl;
    viewer.loadMetadata(metadataPath);
    viewer.render(dataPath);
}

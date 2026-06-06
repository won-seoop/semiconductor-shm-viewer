#ifndef VIEWER_H
#define VIEWER_H

#include "field.h"

#include <string>
#include <vector>

class SharedMemoryOutputViewer
{
private:
    std::vector<Field> fields;

    int findColumn(const std::vector<std::string> &headers, const std::string &name);
    void printValue(const Field &field, const std::string &value);

public:
    void loadMetadata(const std::string &metadataPath);
    void render(const std::string &dataPath);
};

void renderEquipment(const std::string &equipmentName, const std::string &metadataPath, const std::string &dataPath);

#endif

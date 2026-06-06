#include "viewer.h"

#include <exception>
#include <iostream>

int main()
{
    try
    {
        renderEquipment("ETCH", "data/etch_metadata.csv", "data/etch_output.csv");
        renderEquipment("PHOTO", "data/photo_metadata.csv", "data/photo_output.csv");
        renderEquipment("TRANSFER", "data/transfer_metadata.csv", "data/transfer_output.csv");
    }
    catch (const std::exception &e)
    {
        std::cerr << "error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}

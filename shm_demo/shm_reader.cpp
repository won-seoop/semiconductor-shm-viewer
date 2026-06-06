#include <windows.h>
#include <iostream>
#include <fstream>
#include <string>
#include <vector>

// 공통 파서 로직 — semiconductor_shm_viewer/src 와 동일한 코드 참조
#include "../semiconductor_shm_viewer/src/field.h"
#include "../semiconductor_shm_viewer/src/csv.h"
#include "../semiconductor_shm_viewer/src/shm_parser.h"

constexpr const wchar_t* SHM_NAME = L"Local\\KMDgitechEquipmentData";

int main()
{
    // 1. 메타데이터 CSV 로드 → 필드 정의 파싱
    std::vector<Field> fields;
    {
        std::ifstream file("../semiconductor_shm_viewer/data/etch_metadata.csv");
        if (!file)
        {
            std::cerr << "메타데이터 파일을 열 수 없습니다." << std::endl;
            return 1;
        }

        std::string line;
        std::getline(file, line); // 헤더 스킵

        while (std::getline(file, line))
        {
            if (line.empty()) continue;
            auto cols = splitCsv(line);
            if (cols.size() < 3) continue;
            fields.push_back({ cols[0], parseType(cols[1]), std::stoi(cols[2]) });
        }
    }

    // 레코드 총 크기 계산
    int recordSize = 0;
    for (const auto& f : fields) recordSize += f.size;

    // 2. Windows 공유 메모리 열기
    HANDLE mapping = OpenFileMappingW(
        FILE_MAP_READ,
        FALSE,
        SHM_NAME
    );

    if (mapping == nullptr)
    {
        std::cerr << "OpenFileMappingW 실패: " << GetLastError() << std::endl;
        std::cerr << "공유 메모리가 아직 생성되지 않았습니다." << std::endl;
        return 1;
    }

    // 3. 공유 메모리를 프로세스 주소 공간에 매핑 → 시작 포인터 획득
    void* view = MapViewOfFile(
        mapping,
        FILE_MAP_READ,
        0,
        0,
        recordSize
    );

    if (view == nullptr)
    {
        std::cerr << "MapViewOfFile 실패: " << GetLastError() << std::endl;
        CloseHandle(mapping);
        return 1;
    }

    // 4. shm_parser 의 parseShm() 으로 포인터 이동하며 각 필드 읽기
    //    내부적으로: cursor += field.size 로 포인터 이동
    //               *reinterpret_cast<uint16_t*>(cursor) 등으로 타입 캐스팅
    std::vector<Record> records = parseShm(view, fields);

    // 5. 결과 출력
    std::cout << "===== 공유 메모리 읽기 결과 =====" << std::endl;
    for (const auto& r : records)
    {
        std::cout << "  " << r.name << " : " << r.value << std::endl;
    }

    // 6. 정리
    UnmapViewOfFile(view);
    CloseHandle(mapping);

    return 0;
}

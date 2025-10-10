import os

def get_filenames_from_dir(directory_path):
    """
    지정된 디렉토리에서 파일 확장자를 제외한 파일명 리스트를 반환합니다.
    결과는 알파벳 순으로 정렬됩니다.
    """
    try:
        all_items = os.listdir(directory_path)
        # 디렉토리가 아닌 파일만 대상으로 하고, 확장자를 제거합니다.
        filenames = [os.path.splitext(f)[0] for f in all_items if os.path.isfile(os.path.join(directory_path, f))]
        return sorted(filenames)
    except FileNotFoundError:
        print(f"오류: '{directory_path}' 디렉토리를 찾을 수 없습니다.")
        return []
    except Exception as e:
        print(f"파일 목록을 읽는 중 오류가 발생했습니다: {e}")
        return []

def main():
    print("Hello from adc-list!")

    us_aircraft_path = 'assets/dt/us'
    us_aircraft_list = get_filenames_from_dir(us_aircraft_path)

    if us_aircraft_list:
        print(f"\n--- US 항공기 목록 ({us_aircraft_path}) ---")
        print(us_aircraft_list)

if __name__ == "__main__":
    main()

"""
PDF 목차에서 규칙번호 → 페이지 번호 매핑을 추출하여 toc_map.json으로 저장.
목차는 PDF 페이지 2~4 (0-indexed: 1~3)에 위치.
"""

import json
import re
import pdfplumber

PDF_PATH = "[KOR]air_armor v1.1.pdf"
TOC_PAGES = [1, 2, 3]  # 0-indexed
OUTPUT = "toc_map.json"

# [X.Y] 제목 ........ 페이지 패턴
# 점(.)이 2개 이상 이어진 뒤 숫자로 끝나는 줄
ENTRY_RE = re.compile(
    r'\[(\d+(?:\.\d+)*)\]\s+(.+?)\s*\.{2,}\s*(\d+)'
)

def extract_toc():
    mapping = {}  # "1.0" -> {"title": "서론", "page": 5}

    with pdfplumber.open(PDF_PATH) as pdf:
        for page_idx in TOC_PAGES:
            text = pdf.pages[page_idx].extract_text() or ""
            for line in text.splitlines():
                line = line.strip()
                # 한 줄에 여러 항목이 있을 수 있으므로 findall 사용
                for m in ENTRY_RE.finditer(line):
                    rule_id = m.group(1)
                    title = m.group(2).strip()
                    title = deduplicate_korean(title)
                    page_num = int(m.group(3))
                    # 페이지 번호가 비정상적으로 크면 중복 글자 → 정상값으로 교정
                    if page_num > 150:
                        page_str = str(page_num)
                        half = len(page_str) // 2
                        if page_str[:half] == page_str[half:]:
                            page_num = int(page_str[:half])
                    mapping[rule_id] = {"title": title, "page": page_num}

    return mapping


def deduplicate_korean(s: str) -> str:
    """
    pdfplumber가 때때로 한글을 두 번 출력하는 경우를 처리.
    ex: "서서론론" -> "서론"
    연속으로 같은 글자가 짝수 개 반복되면 절반으로 줄임.
    """
    # 단순 반복 패턴 감지: 전체 문자열이 자신을 반으로 나눈 것의 반복인지
    n = len(s)
    if n % 2 == 0:
        half = s[: n // 2]
        if half == s[n // 2 :]:
            return half
    # 글자 단위 중복 제거 (서서론론 → 서론)
    result = []
    i = 0
    while i < len(s):
        result.append(s[i])
        # 바로 다음 글자가 같으면 skip
        if i + 1 < len(s) and s[i] == s[i + 1]:
            i += 2
        else:
            i += 1
    return "".join(result)


def fill_missing_from_children(mapping: dict, needed: list[str]) -> dict:
    """
    목차에 없는 X.0 항목을 하위 절(X.1 등)의 페이지로 채움.
    """
    for ref in needed:
        if ref in mapping:
            continue
        parts = ref.split(".")
        major = parts[0]
        # X.1, X.2 ... 중 가장 작은 것의 페이지 사용
        children = sorted(
            [k for k in mapping if k.startswith(major + ".") and k != ref],
            key=lambda k: [int(p) for p in k.split(".")]
        )
        if children:
            child = mapping[children[0]]
            mapping[ref] = {"title": child["title"], "page": child["page"]}
    return mapping


if __name__ == "__main__":
    mapping = extract_toc()

    # sop.json의 refs 중 toc에 없는 항목을 하위 절로 채움
    import pathlib
    sop_path = pathlib.Path(__file__).parent / "sop.json"
    if sop_path.exists():
        import json as _json
        sop = _json.loads(sop_path.read_text())
        all_refs = set()
        for phase in sop["phases"]:
            for step in phase["steps"]:
                for r in (step.get("refs") or []):
                    all_refs.add(r)
        # 목차에도 하위 절에도 없는 항목 수동 패치
        MANUAL = {
            "33.0": {"title": "공병", "page": 120},
            "46.6": {"title": "시나리오 증원 규칙", "page": 27},
        }
        for k, v in MANUAL.items():
            if k not in mapping:
                mapping[k] = v

        missing = sorted(all_refs - set(mapping.keys()))
        if missing:
            mapping = fill_missing_from_children(mapping, missing)
            still_missing = sorted(all_refs - set(mapping.keys()))
            print(f"보완 후 미매핑: {still_missing}" if still_missing else "모든 refs 매핑 완료")
        else:
            print("모든 refs 매핑 완료")

    # 정렬: 규칙번호 기준
    def sort_key(k):
        parts = k.split(".")
        return [int(p) for p in parts]

    sorted_mapping = dict(sorted(mapping.items(), key=lambda x: sort_key(x[0])))

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(sorted_mapping, f, ensure_ascii=False, indent=2)

    print(f"총 {len(sorted_mapping)}개 항목 추출 → {OUTPUT}")
    for k, v in list(sorted_mapping.items())[:10]:
        print(f"  [{k}] {v['title']} → p.{v['page']}")
    print("  ...")

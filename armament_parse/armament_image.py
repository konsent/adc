"""
Hornet Leader - weapon.pdf 파싱 스크립트
기체별 무장 카운터 이미지 추출 및 JSON 매핑 생성
"""

import os
import json
import re
from collections import defaultdict
from difflib import SequenceMatcher

import fitz  # PyMuPDF
import numpy as np
from PIL import Image, ImageEnhance
import cv2
import easyocr

# ── 설정 ──────────────────────────────────────────────
PDF_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weapon.pdf")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
DPI = 300
SCALE = DPI / 72
DPI_HI = 1200
SCALE_HI = DPI_HI / 72

CARD_MIN_WIDTH = 100
COUNTER_MIN_WIDTH = 20
COUNTER_MAX_WIDTH = 60
ROW_Y_TOLERANCE = 10

KNOWN_AIRCRAFT = [
    "A-6E", "A-7E", "AV-8B", "E-2C", "EA-6B",
    "F-14", "F/A-18C", "F/A-18E", "F/A-18F",
    "F-35C", "EA-18G",
]

KNOWN_WEAPONS = [
    "Mk.20", "Mk.82", "Mk.83", "Mk.84",
    "AGM-62", "AGM-65", "AGM-84", "AGM-88", "AGM-130", "AGM-154",
    "GBU-10", "GBU-12", "GBU-16",
    "GBU-31", "GBU-32", "GBU-38",
    "AIM-7", "AIM-9", "AIM-54", "AIM-120",
    "Rockets", "ECM Pod", "Fuel Tank",
    "CBU-59", "CBU-87", "SLAM", "Walleye",
    "HARM", "Harpoon", "FLIR Pod",
    "AIM-9M", "AIM-7M", "AIM-7F",
]

# 페이지별 기체 순서 (OCR 폴백용 - 좌→우, 위→아래)
AIRCRAFT_ORDER = {
    0: ["A-6E", "A-7E", "F-14", "AV-8B", "F-35C"],
    1: ["F/A-18C", "F/A-18E", "F/A-18F", "E-2C", "EA-6B", "EA-18G"],
}


# ── 유틸리티 ──────────────────────────────────────────

def fuzzy_match(text: str, candidates: list[str], threshold: float = 0.45) -> str | None:
    """텍스트와 가장 유사한 후보를 반환."""
    if not text or not text.strip():
        return None
    text_clean = text.upper().replace(" ", "").replace("-", "").replace("/", "").replace(".", "")
    best_score = 0
    best_match = None
    for c in candidates:
        c_clean = c.upper().replace(" ", "").replace("-", "").replace("/", "").replace(".", "")
        if c_clean in text_clean or text_clean in c_clean:
            return c
        score = SequenceMatcher(None, text_clean, c_clean).ratio()
        if score > best_score:
            best_score = score
            best_match = c
    return best_match if best_score >= threshold else None


def group_by_y(items: list[dict], tolerance: float = ROW_Y_TOLERANCE) -> list[list[dict]]:
    """y좌표 기준으로 항목들을 행으로 그룹핑."""
    if not items:
        return []
    sorted_items = sorted(items, key=lambda c: c["bbox"][1])
    rows = []
    current_row = [sorted_items[0]]
    current_y = sorted_items[0]["bbox"][1]
    for item in sorted_items[1:]:
        if abs(item["bbox"][1] - current_y) <= tolerance:
            current_row.append(item)
        else:
            rows.append(sorted(current_row, key=lambda c: c["bbox"][0]))
            current_row = [item]
            current_y = item["bbox"][1]
    if current_row:
        rows.append(sorted(current_row, key=lambda c: c["bbox"][0]))
    return rows


def safe_filename(name: str) -> str:
    """파일명으로 안전한 문자열 변환."""
    return re.sub(r'[<>:"/\\|?*]', '-', name).replace(" ", "_").strip("_-.")


# ── Step 1: PDF 로드 및 렌더링 ───────────────────────

def load_pdf(pdf_path: str):
    doc = fitz.open(pdf_path)
    pages = []
    for page in doc:
        mat = fitz.Matrix(SCALE, SCALE)
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        pages.append((page, img))
    return doc, pages


# ── Step 2: 이미지 위치 추출 및 분류 ─────────────────

def get_page_elements(page):
    image_info = page.get_image_info(xrefs=True)
    pw = page.rect.width

    seen = set()
    cards = []
    counters = []

    for img in image_info:
        bbox = tuple(round(v, 1) for v in img["bbox"])
        key = (round(bbox[0]), round(bbox[1]), round(bbox[2]), round(bbox[3]))
        if key in seen:
            continue
        seen.add(key)

        x0, y0, x1, y1 = bbox
        if x0 < 0 or x1 > pw:
            continue

        w = x1 - x0
        if w > CARD_MIN_WIDTH:
            cards.append({"bbox": bbox, "xref": img["xref"]})
        elif COUNTER_MIN_WIDTH < w < COUNTER_MAX_WIDTH:
            counters.append({"bbox": bbox, "xref": img["xref"]})

    # 카드 중복 제거
    unique_cards = []
    card_positions = set()
    for c in cards:
        pos = (round(c["bbox"][0]), round(c["bbox"][1]))
        if pos not in card_positions:
            card_positions.add(pos)
            unique_cards.append(c)

    unique_cards.sort(key=lambda c: (c["bbox"][1], c["bbox"][0]))
    return unique_cards, counters


# ── Step 3: 카운터를 기체별로 그룹핑 ─────────────────

def assign_counters_to_aircraft(cards: list, counters: list, page_height: float):
    if not cards:
        return []

    card_rows = []
    current_row = [cards[0]]
    for card in cards[1:]:
        if card["bbox"][1] - current_row[0]["bbox"][1] > 100:
            card_rows.append(current_row)
            current_row = [card]
        else:
            current_row.append(card)
    card_rows.append(current_row)

    assignments = []
    pw = 612.0

    for row_idx, card_row in enumerate(card_rows):
        card_row.sort(key=lambda c: c["bbox"][0])
        y_start = max(c["bbox"][3] for c in card_row)
        if row_idx + 1 < len(card_rows):
            y_end = card_rows[row_idx + 1][0]["bbox"][1]
        else:
            y_end = page_height

        col_boundaries = [0]
        for i in range(len(card_row) - 1):
            mid = (card_row[i]["bbox"][2] + card_row[i + 1]["bbox"][0]) / 2
            col_boundaries.append(mid)
        col_boundaries.append(pw)

        for ci, card in enumerate(card_row):
            col_left = col_boundaries[ci]
            col_right = col_boundaries[ci + 1]
            my_counters = [
                c for c in counters
                if c["bbox"][1] >= y_start - 5
                and c["bbox"][1] < y_end
                and c["bbox"][0] >= col_left - 5
                and c["bbox"][2] <= col_right + 5
            ]
            rows = group_by_y(my_counters)
            assignments.append({
                "card": card,
                "counters": my_counters,
                "rows": rows,
                "col_bounds": (col_left, col_right),
            })

    return assignments


# ── Step 4: OCR - 기체 코드명 ────────────────────────

def ocr_aircraft_name(page_img: Image.Image, card_bbox: tuple, reader) -> str:
    """기체 카드 왼쪽 배너에서 코드명을 OCR로 읽기."""
    x0, y0, x1, y1 = [int(v * SCALE) for v in card_bbox]
    w = x1 - x0
    h = y1 - y0

    # 왼쪽 배너 (너비의 15%, 높이의 상위 70%)
    banner = page_img.crop((x0, y0, x0 + int(w * 0.15), y0 + int(h * 0.7)))

    # 시계 방향 90도 회전 (아래→위 텍스트를 좌→우로)
    rotated = banner.rotate(-90, expand=True)

    # 대비 향상
    img_np = np.array(rotated)
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
    binary_rgb = cv2.cvtColor(binary, cv2.COLOR_GRAY2RGB)

    results = reader.readtext(binary_rgb, detail=1)
    full_text = " ".join([r[1] for r in results])

    matched = fuzzy_match(full_text, KNOWN_AIRCRAFT)
    return matched or full_text.strip()


# ── Step 5: OCR - 카운터 내 무장 이름 ────────────────

def ocr_weapon_name(page_img: Image.Image, counter_bbox: tuple, reader) -> str:
    """개별 카운터 이미지의 왼쪽 세로 텍스트에서 무장 이름 읽기."""
    x0, y0, x1, y1 = [int(v * SCALE) for v in counter_bbox]
    w = x1 - x0

    # 왼쪽 30% 영역 (무장 이름이 있는 세로 스트립)
    strip = page_img.crop((x0, y0, x0 + int(w * 0.32), y1))

    # 시계 방향 90도 회전 (아래→위 텍스트 → 좌→우)
    rotated = strip.rotate(-90, expand=True)

    # 확대 (작은 텍스트 인식률 향상)
    scale_factor = 3
    rw, rh = rotated.size
    enlarged = rotated.resize((rw * scale_factor, rh * scale_factor), Image.LANCZOS)

    # 대비 향상 + 이진화
    img_np = np.array(enlarged)
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    binary_rgb = cv2.cvtColor(binary, cv2.COLOR_GRAY2RGB)

    results = reader.readtext(binary_rgb, detail=1)
    raw_text = " ".join([r[1] for r in results])

    matched = fuzzy_match(raw_text, KNOWN_WEAPONS)
    return matched or raw_text.strip() or "unknown"


# ── Step 5b: WP 템플릿 구축 및 매칭 ──────────────

# Page 1의 알려진 WP 값 (bbox in PDF points, WP value)
WP_REFERENCE = [
    ((30.4, 207.2, 74.4, 254.2), 1),    # Mk.20
    ((74.4, 207.2, 118.4, 254.2), 1),    # Mk.82
    ((118.4, 207.2, 162.4, 254.2), 2),   # Mk.83
    ((162.4, 207.2, 206.4, 254.2), 3),   # Mk.84
    ((52.4, 254.2, 96.4, 301.2), 2),     # AGM-62
    ((96.4, 254.2, 140.4, 301.2), 2),    # AGM-65
    ((52.4, 301.2, 96.4, 348.2), 2),     # AGM-84
    ((96.4, 301.2, 140.4, 348.2), 1),    # AGM-88
    ((140.4, 301.2, 184.4, 348.2), 4),   # AGM-130
    ((52.4, 348.2, 96.4, 395.2), 3),     # GBU-10
    ((96.4, 348.2, 140.4, 395.2), 1),    # GBU-12
    ((140.4, 348.2, 184.4, 395.2), 2),   # GBU-16
    ((74.4, 395.2, 118.4, 442.2), 1),    # Rockets
    ((118.4, 395.2, 162.4, 442.2), 1),   # ECM Pod
    ((426.4, 207.2, 470.4, 254.2), 1),   # AIM-7
    ((470.4, 207.2, 514.4, 254.2), 1),   # AIM-9
    ((514.4, 207.2, 558.4, 254.2), 1),   # AIM-54
    ((426.4, 254.2, 470.4, 301.2), 1),   # Mk.20 (F-14)
    ((470.4, 254.2, 514.4, 301.2), 1),   # Mk.82 (F-14)
    ((514.4, 254.2, 558.4, 301.2), 2),   # Mk.83 (F-14)
    ((558.4, 254.2, 602.4, 301.2), 3),   # Mk.84 (F-14) -- may be off-page
    ((426.4, 301.2, 470.4, 348.2), 3),   # GBU-10 (F-14)
    ((470.4, 301.2, 514.4, 348.2), 1),   # GBU-12 (F-14)
    ((514.4, 301.2, 558.4, 348.2), 2),   # GBU-16 (F-14)
    ((426.4, 348.2, 470.4, 395.2), 3),   # GBU-31 (F-14)
    ((470.4, 348.2, 514.4, 395.2), 2),   # GBU-32 (F-14)
    ((514.4, 348.2, 558.4, 395.2), 1),   # GBU-38 (F-14)
    ((470.4, 395.2, 514.4, 442.2), 1),   # ECM Pod (F-14)
]


def _extract_wp_mask(page_img_hi: Image.Image, bbox: tuple) -> np.ndarray | None:
    """1200 DPI 이미지에서 WP 박스의 흰색 텍스트 마스크 추출."""
    x0, y0, x1, y1 = [int(v * SCALE_HI) for v in bbox]
    if x0 < 0 or y0 < 0:
        return None
    pw, ph = page_img_hi.size
    if x1 > pw or y1 > ph:
        return None
    counter = page_img_hi.crop((x0, y0, x1, y1))
    w, h = counter.size
    wp_crop = counter.crop((int(w * 0.10), int(h * 0.03), int(w * 0.26), int(h * 0.18)))
    arr = np.array(wp_crop)
    hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
    white_mask = cv2.inRange(hsv, np.array([0, 0, 180]), np.array([180, 50, 255]))
    kernel = np.ones((2, 2), np.uint8)
    white_mask = cv2.morphologyEx(white_mask, cv2.MORPH_CLOSE, kernel)
    resized = cv2.resize(white_mask, (30, 40))
    return resized


def build_wp_templates(page_img_hi: Image.Image) -> dict[int, np.ndarray]:
    """Page 1의 알려진 카운터로 WP 템플릿(1~4) 구축."""
    samples: dict[int, list] = {1: [], 2: [], 3: [], 4: []}
    for bbox, wp in WP_REFERENCE:
        mask = _extract_wp_mask(page_img_hi, bbox)
        if mask is not None and np.sum(mask) > 0:
            samples[wp].append(mask.astype(np.float32))
    templates = {}
    for wp, masks in samples.items():
        if masks:
            templates[wp] = np.mean(masks, axis=0)
    return templates


def detect_wp(page_img_hi: Image.Image, bbox: tuple, templates: dict) -> int | None:
    """카운터의 WP 값을 템플릿 매칭으로 감지."""
    mask = _extract_wp_mask(page_img_hi, bbox)
    if mask is None or np.sum(mask) == 0:
        return None
    mask_f = mask.astype(np.float32)
    if np.std(mask_f) == 0:
        return None
    best_wp = None
    best_score = -2
    for wp, tmpl in templates.items():
        if np.std(tmpl) == 0:
            continue
        score = float(np.corrcoef(mask_f.flatten(), tmpl.flatten())[0, 1])
        if score > best_score:
            best_score = score
            best_wp = wp
    return best_wp if best_score > 0.5 else None


# ── Step 5c: Attack 값 파싱 ──────────────────────

def parse_attack(page_img: Image.Image, counter_bbox: tuple, reader) -> list[int]:
    """카운터 상단 우측에서 공격값(슬래시 구분 숫자)을 OCR로 읽기."""
    x0, y0, x1, y1 = [int(v * SCALE) for v in counter_bbox]
    w = x1 - x0
    h = y1 - y0
    # 상단 우측 영역 (WP 박스 다음부터)
    atk_crop = page_img.crop((x0 + int(w * 0.42), y0, x1, y0 + int(h * 0.25)))
    aw, ah = atk_crop.size
    atk_big = atk_crop.resize((aw * 4, ah * 4), Image.LANCZOS)
    results = reader.readtext(np.array(atk_big), detail=1, allowlist="0123456789/")
    raw = "".join([r[1] for r in results])
    # 슬래시로 분리하여 개별 숫자 추출 (각 값은 0~11 범위)
    parts = raw.split("/")
    nums = []
    for p in parts:
        digits = re.findall(r"\d+", p)
        for d in digits:
            val = int(d)
            if val <= 20:  # 합리적 범위 필터
                nums.append(val)
    return nums


# ── Step 5d: 고도(H/L) 감지 ─────────────────────

def detect_altitude(page_img: Image.Image, counter_bbox: tuple) -> list[str]:
    """카운터 우하단의 빨강(H)/초록(L) 색상으로 고도 감지."""
    x0, y0, x1, y1 = [int(v * SCALE) for v in counter_bbox]
    w = x1 - x0
    h = y1 - y0
    bot = page_img.crop((x0 + int(w * 0.55), y0 + int(h * 0.65), x1, y1))
    hsv = cv2.cvtColor(np.array(bot), cv2.COLOR_RGB2HSV)
    red1 = cv2.inRange(hsv, np.array([0, 80, 80]), np.array([10, 255, 255]))
    red2 = cv2.inRange(hsv, np.array([170, 80, 80]), np.array([180, 255, 255]))
    red_px = cv2.countNonZero(red1 | red2)
    green_mask = cv2.inRange(hsv, np.array([35, 80, 80]), np.array([85, 255, 255]))
    green_px = cv2.countNonZero(green_mask)
    altitude = []
    if red_px > 100:
        altitude.append("H")
    if green_px > 150:
        altitude.append("L")
    return altitude


# ── Step 6: 카운터 이미지 저장 ───────────────────────

def save_counter_image(
    page_img: Image.Image,
    counter_bbox: tuple,
    aircraft_name: str,
    weapon_name: str,
    output_dir: str,
    index: int = 0,
) -> str:
    """개별 카운터를 PNG로 저장."""
    safe_aircraft = safe_filename(aircraft_name)
    safe_weapon = safe_filename(weapon_name)
    dir_path = os.path.join(output_dir, safe_aircraft)
    os.makedirs(dir_path, exist_ok=True)

    x0, y0, x1, y1 = [int(v * SCALE) for v in counter_bbox]
    crop = page_img.crop((x0, y0, x1, y1))

    # 같은 무장이 여러 개일 경우 인덱스 추가
    if index > 0:
        filename = f"{safe_weapon}_{index + 1}.png"
    else:
        filename = f"{safe_weapon}.png"

    filepath = os.path.join(dir_path, filename)
    # 이미 같은 이름 파일이 있으면 인덱스 추가
    if os.path.exists(filepath) and index == 0:
        i = 2
        while True:
            filename = f"{safe_weapon}_{i}.png"
            filepath = os.path.join(dir_path, filename)
            if not os.path.exists(filepath):
                break
            i += 1

    crop.save(filepath)
    return filename


# ── Step 7: JSON 생성 ────────────────────────────────

def generate_json(all_aircraft: dict, output_dir: str):
    json_path = os.path.join(output_dir, "armaments.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_aircraft, f, indent=2, ensure_ascii=False)
    print(f"JSON saved: {json_path}")


# ── 메인 ─────────────────────────────────────────────

def main():
    print("Loading PDF...")
    doc, pages = load_pdf(PDF_PATH)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1200 DPI 페이지 렌더링 (WP 감지용)
    print("Rendering pages at 1200 DPI for WP detection...")
    pages_hi = []
    for page_obj, _ in pages:
        mat_hi = fitz.Matrix(SCALE_HI, SCALE_HI)
        pix_hi = page_obj.get_pixmap(matrix=mat_hi)
        img_hi = Image.frombytes("RGB", [pix_hi.width, pix_hi.height], pix_hi.samples)
        pages_hi.append(img_hi)

    # WP 템플릿 구축 (Page 1 기준)
    print("Building WP templates...")
    wp_templates = build_wp_templates(pages_hi[0])
    print(f"  Templates built for WP values: {list(wp_templates.keys())}")

    print("Initializing EasyOCR...")
    reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    all_aircraft = {}

    for page_idx, (page, page_img) in enumerate(pages):
        print(f"\n=== Page {page_idx + 1} ===")
        page_img_hi = pages_hi[page_idx]
        cards, counters = get_page_elements(page)
        assignments = assign_counters_to_aircraft(cards, counters, page.rect.height)

        fallback_names = AIRCRAFT_ORDER.get(page_idx, [])

        for ai, assignment in enumerate(assignments):
            card = assignment["card"]
            rows = assignment["rows"]

            # OCR 기체명
            aircraft_name = ocr_aircraft_name(page_img, card["bbox"], reader)
            print(f"\n  Aircraft OCR: '{aircraft_name}'")

            if aircraft_name not in KNOWN_AIRCRAFT:
                if ai < len(fallback_names):
                    aircraft_name = fallback_names[ai]
                    print(f"  -> Fallback: '{aircraft_name}'")

            if not rows:
                print(f"  {aircraft_name}: no weapon counters")
                all_aircraft[aircraft_name] = {"weapons": []}
                continue

            weapons_list = []
            weapon_count = defaultdict(int)

            for ri, row in enumerate(rows):
                for counter in row:
                    weapon_name = ocr_weapon_name(page_img, counter["bbox"], reader)
                    weapon_count[weapon_name] += 1
                    idx = weapon_count[weapon_name] - 1

                    filename = save_counter_image(
                        page_img, counter["bbox"],
                        aircraft_name, weapon_name, OUTPUT_DIR, idx
                    )

                    # 스탯 파싱
                    wp = detect_wp(page_img_hi, counter["bbox"], wp_templates)
                    attack = parse_attack(page_img, counter["bbox"], reader)
                    altitude = detect_altitude(page_img, counter["bbox"])

                    weapons_list.append({
                        "weapon": weapon_name,
                        "file": filename,
                        "stats": {
                            "wp": wp,
                            "attack": attack,
                            "altitude": altitude,
                        },
                    })
                    print(f"    {weapon_name}: WP={wp} Atk={attack} Alt={altitude} -> {filename}")

            # 무장 종류별 요약
            summary = {}
            for w in weapons_list:
                name = w["weapon"]
                if name not in summary:
                    summary[name] = {
                        "count": 0,
                        "files": [],
                        "stats": w["stats"],
                    }
                summary[name]["count"] += 1
                summary[name]["files"].append(w["file"])

            all_aircraft[aircraft_name] = {
                "weapons": summary,
                "total_counters": len(weapons_list),
            }

    generate_json(all_aircraft, OUTPUT_DIR)
    print("\nDone!")


if __name__ == "__main__":
    main()

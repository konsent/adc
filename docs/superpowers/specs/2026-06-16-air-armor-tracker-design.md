# Air & Armor 포인트 트래커 — 설계 문서

## 배경

Air & Armor(보드게임) Tracks Card(`air_armor/assets/nato_track.png`, `wp_track.png`)에는 NATO/바르샤바 조약군(WP) 각 진영이 매 턴 추적해야 하는 여러 포인트 트랙이 인쇄되어 있다. 종이 마커로 관리하던 것을 웹 앱으로 대체해, 보드 옆에 펼쳐두고 클릭만으로 포인트를 갱신할 수 있게 한다.

룰북(`rules.json`) 근거 절: 4.1.4.1~4.1.4.3(CP/RP/지휘범위), 12.0~12.7(지휘 및 통제), 20.0~20.2(정찰), 23.5(ADM 타격), 34.0(군용 교량), 37.0(지뢰), 44.0(독가스), 46.4.1(전투 지원 포인트 일반 규정).

## 범위

포함:
- NATO/WP 각 HQ의 RP(정찰 포인트), CP(지휘 포인트) 트랙
- NATO 군단 / WP 군 단위 Offmap CP, Offmap RP 트랙
- 전투 지원 포인트(CSP): Mine, ADM, Gas-Persistent, Gas-Non-Persistent, Air Point, Bridge
- VP(승리 포인트) 카운터
- SAM Strength Track

제외 (이번 범위 아님):
- Helicopter Track (Ready / Rearm&Refuel / Recovery)

## 데이터 모델

### NATO 진영

HQ별 RP/CP 트랙 (트랙 카드에 인쇄된 최대값 그대로, 칸 클릭형):

| HQ | RP 범위 | CP 범위 |
|---|---|---|
| 3rd Inf Div (US) | 0–2 | 0–2 |
| 12th Pz Div (서독) | 0–2 | 0–2 |
| 4CMBG (캐나다) | 0–2 | 0–2 |
| 54Hsb (서독) | 0–2 | 0–2 |
| 26LL (서독) | 0–2 | 0–2 |

VII Corps Offmap 트랙 (칸 클릭형):
- Offmap CP: 0–2
- Offmap RP: 0–2

CSP (전투 지원 포인트, +/- 버튼형), 국가별로 별도 카운터: **US / 서독 / 캐나다** 3개 국적 세트
- Mine, ADM, Air Point, Bridge → 각 국적마다 독립 카운터
- Gas-Persistent, Gas-Non-Persistent → 국적별 분리 없이 시나리오 규정상 미군만 보유하지만, 입력 편의상 국적별 카운터로 동일하게 제공 (값 0으로 두면 미보유와 동일)

VP: +/- 버튼형, 단일 카운터

SAM Strength: 칸 클릭형, 트랙 카드 인쇄값 그대로 1–4 (칸: 1/3/4)

### WP 진영 (바르샤바 조약군)

HQ별 RP/CP 트랙 없음 — 군(8th Guards Army) 단위 Offmap 트랙만 관리 (칸 클릭형):
- Offmap CP: 0–3
- Offmap RP: 0–2

CSP: 국적 구분 없이 WP 단일 풀, +/- 버튼형
- Mine, ADM, Gas-Persistent, Gas-Non-Persistent, Air Point, Bridge

VP: +/- 버튼형, 단일 카운터

SAM Strength: 칸 클릭형, 트랙 카드 인쇄값 그대로 1–4 (칸: 1/3/4)

### 공통 동작

- 각 카운터에는 시나리오별 초기값을 다시 세팅할 수 있는 수단이 필요하지만, 이번 범위에서는 "전체 리셋(0)" 버튼 하나로 충분 (시나리오별 프리셋 저장/불러오기는 범위 밖)
- "RP/CP/Offmap 리셋" 버튼: RP/CP/Offmap CP/Offmap RP 트랙만 0으로 되돌림 (매 턴 갱신되는 룰 반영). CSP/VP/SAM Strength는 영향받지 않음 (CSP/VP는 소모성 풀, SAM Strength는 손실로만 줄어드는 값이라 턴 갱신 대상이 아님)

## UI 구성

- 가로 분할 2열: 좌측 NATO 패널(황색 강조), 우측 WP 패널(적색 강조) — 기존 SOP 뷰어(`index.html`)의 냉전 테마(올리브/카키 배경, NATO 황색 `#d4ae55`, WP 적색 `#8b1a1a`)를 그대로 계승
- 대상 기기: PC/태블릿 가로 화면 기준 (반응형 모바일 대응은 범위 밖)
- HQ별 RP/CP, Offmap CP/RP: 트랙 칸을 가로로 나열한 클릭형 위젯. 현재 값 칸이 강조 표시되고, 다른 칸을 클릭하면 그 값으로 즉시 이동 (보드게임 마커 이동과 동일한 멘탈 모델)
- CSP, VP: `−` `값` `+` 형태의 인라인 카운터. 0 미만으로 내려가지 않음 (상한 없음, 단 음수 방지)
- 상단에 "RP/CP/Offmap 리셋" 버튼 1개 배치

## 데이터 영속성

- 별도 서버/로그인 없이 브라우저 `localStorage`에 저장
- 페이지를 새로고침하거나 다시 열어도 마지막 입력값 유지
- 저장 스키마는 진영/HQ/포인트종류별 키-값 구조로, 추후 항목 추가 시 마이그레이션 없이 확장 가능하게 단순한 JSON 객체 하나로 관리

## 에러 처리

- 카운터 값은 항상 0 이상으로 클램프 (− 버튼이 0에서 비활성화 또는 무동작)
- 트랙 칸 클릭형 위젯은 정의된 범위 내의 값만 존재하므로 범위 밖 입력 자체가 불가능 (별도 검증 불필요)

## 테스트 관점

- 각 카운터의 클릭/증감 동작이 올바른 값으로 갱신되는지
- localStorage 저장 후 새로고침 시 값이 복원되는지
- "RP/CP/Offmap 리셋" 클릭 시 해당 트랙만 0이 되고 CSP/VP는 유지되는지
- 0에서 `-` 버튼 클릭 시 음수로 내려가지 않는지

# Air Power — Gun Combat / Damage Reference

## 1. Gun Combat Modifiers

모든 보정치는 누적한다.

| 조건 | 보정 |
|---|---:|
| Snap Shooting (Half Burst) | +2 |
| Gunsight / Turn Rate | Rule 9.E 값 적용 |
| 공격기가 L 피해 상태 | +1 |
| 공격기가 2L 피해 상태 | +2 |
| 공격기가 H 피해 상태 | +3 |
| Target Size (Advanced) | Rule 9.G 값 적용 |
| SSGT Line에서 비행한 매 2 FP (Advanced) | -1 |
| RE Radar Ranging + Lock-On (Advanced) | -1 |
| CA Radar Ranging + Lock-On (Advanced) | -2 |
| IG Radar Ranging + Lock-On (Advanced) | -3 |

### Angle-Off Modifier

| Angle-Off | 보정 |
|---|---:|
| 0° Line | -2 |
| 30° Arc | 0 |
| 60° Arc | +2 |
| 90° Arc | +4 |
| 120° Arc | +4 |
| 150° Arc | +4 |
| 180° Arc | +3 |
| 180° Line | +2 |

---

## 2. Damage Table (10.A)

### Damage 판정 보정

- 목표 항공기의 **Vulnerability Rating을 주사위에 적용**한다.
- 목표 항공기가 **이미 피해를 입은 상태라면 Attack Rating을 오른쪽으로 1열 이동**한다.
- **Missile Hit의 Damage Roll은 -2**를 적용한다.
- 수정된 주사위 결과가 `0 이하`이면 `0-` 행을 사용한다.
- 수정된 주사위 결과가 `10 이상`이면 `10+` 행을 사용한다.
- Attack Rating이 `10 이상`이면 `10+` 열을 사용한다.

### Damage Table

| 수정 Die Roll | AR 1 | AR 2 | AR 3 | AR 4 | AR 5 | AR 6 | AR 7 | AR 8 | AR 9 | AR 10+ |
|---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0- | * | * | * | * | * | * | * | * | * | * |
| 1 | C | C | * | * | * | * | * | * | * | * |
| 2 | H | H | C | * | * | * | * | * | * | * |
| 3 | L | H | H | C | * | * | * | * | * | * |
| 4 | L | L | H | H | C | C | * | * | * | * |
| 5 | L | L | 2L | H | C | C | C | * | * | * |
| 6 | L | L | L | H | H | C | C | C | * | * |
| 7 | - | L | L | L | H | H | C | C | C | * |
| 8 | - | - | L | L | H | H | H | H | C | C |
| 9 | - | - | - | L | L | 2L | H | H | C | C |
| 10+ | - | - | - | - | L | L | 2L | H | H | C |

### 결과 코드

| 결과 | 의미 |
|---|---|
| `-` | 효과 없음 |
| `L` | Light Damage |
| `2L` | Double Light Damage |
| `H` | Heavy Damage |
| `C` | Critical Damage |
| `*` | 항공기 격추 |

---

## 3. Damage Effects

### L / 2L

- BT 및 ET Turn 불가
- Gun Attack 보정:
  - L: +1
  - 2L: +2

### H

- HT 이상의 Turn 불가
- Rolling Maneuver 불가
- A/B 및 Mil Power의 Acceleration Points 1/2
- Climb Chart 결과 1/2
- Gun Attack +3

### C

- EZ Turn만 가능
- Slide Maneuver만 가능
- A/B Power 사용 불가
- Mil Power의 Acceleration Points 1/2
- Climb Chart 결과 1/4
- 공격 불가
- Drop Tank 및 Gun Pod 투하

### *

- 항공기 격추

---

## 4. Cumulative Hits

| 누적 피해 | 최종 결과 |
|---|---|
| L + L + L | H |
| H + H | C |
| C + C | * |
| C + H | * |

---

## 5. Progressive Damage (Advanced Rule 10.C)

| 현재 피해 | 주사위 결과 | 피해 증가 |
|---|---:|---|
| L 또는 2L | 2 이하 | H |
| H | 3 이하 | C |
| C | 4 이하 | * |
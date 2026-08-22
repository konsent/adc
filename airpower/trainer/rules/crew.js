// Crew Quality Chart의 공통 DRM. 지정이 없으면 Regular(0)로 기존 동작을 보존한다.
const QUALITY = {
  Veteran: { initiative: 1, sighting: -1, radar: -1, launch: -1, attack: -1 },
  Regular: { initiative: 0, sighting: 0, radar: 0, launch: 0, attack: 0 },
  Novice: { initiative: -1, sighting: 1, radar: 1, launch: 0, attack: 1 },
  Green: { initiative: -2, sighting: 2, radar: 2, launch: 1, attack: 2 },
};

export function crewDrm(unit, action) {
  return QUALITY[unit.crewQuality ?? 'Regular']?.[action] ?? 0;
}

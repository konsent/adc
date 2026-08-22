// MDT (ruleset/mdt.json)에서 현재 T-4가 장착한 미사일만 정규화한다.
export const MDT_MISSILES = {
  aim4a: { label: 'AIM-4A Falcon', seeker: 'RH', launch: 7, directHit: 5, rating: 6, countermeasure: 'chaff', envelopes: [[0, 60, 4, 15], [61, 120, 6, 15], [121, 180, 9, 18]], requiresRadar: true },
  aim4b: { label: 'AIM-4B Falcon', seeker: 'E', launch: 7, directHit: 5, rating: 6, countermeasure: 'flare', envelopes: [[0, 60, 2, 12]], requiresRadar: false },
};

export function missileEnvelope(missile, aspect) {
  const entry = missile.envelopes.find(([min, max]) => aspect >= min && aspect <= max);
  return entry ? { min: entry[2], max: entry[3] } : null;
}

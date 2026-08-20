// Every local ADC card is a selectable Speed of Heat aircraft. Cards remain
// the source of truth; a counter is selected from the supplied art by family.
const CARD_FILES = [
  'A-10A_Thunderbolt_II_ADC.json', 'A-10_NAW_Thunderbolt_II_ADC.json', 'A-4H_Skyhawk_ADC.json', 'A-6F_Advanced_Intruder_ADC.json', 'A-7F_Corsair_Plus_ADC.json', 'A4M_Skyhawk_II_ADC.json', 'A4N_Skyhawk_ADC.json',
  'AV-8B_Harrier_II-Harrier_GR.5_ADC.json', 'Alpha_Jet_A_German_ADC.json', 'Alpha_Jet_Lancier_ADC.json', 'BAC-167_Strikemaster_ADC.json', 'BAC_Lightning_F.1-F.2_ADC.json', 'BAC_Lightning_F.3-F.6_ADC.json', 'BAE_Buccaneer_S.MK.2B_ADC.json', 'CM-170_Magister_ADC.json', 'Embraer_AMX_ADC.json', 'Etendard_IVM_ADC.json',
  'F-104G_Starfighter_ADC.json', 'F-104S_Starfighter_ADC.json', 'F-111D_Aardvark_ADC.json', 'F-111F_Aardvark_ADC.json', 'F-14A_plus_Tomcat_ADC.json', 'F-14D_Tomcat_ADC.json', 'F-15A_Eagle_ADC.json', 'F-15E_Strike_Eagle_ADC.json', 'F-16A_Fighting_Falcon_ADC.json', 'F-16C_Fighting_Falcon_ADC.json', 'F-4D-N_Phantom_II_ADC.json', 'F-4E_Phantom_II_slatted_wings_ADC.json', 'F-4F_Phantom_II_ADC.json', 'F-4F_plus_I.C.E._Phantom_II_ADC.json', 'F-4K-M_Phantom_II_ADC.json', 'F-4S_Phantom_II_ADC.json', 'F-5E_Tiger_II_ADC.json', 'F-7M_Airguard_ADC.json', 'F-84C-D_Thunderjet_ADC.json', 'F-84F_Thunderstreak_ADC.json', 'F-86D-L_Sabre-Dog_ADC.json', 'F-86F_Sabre_ADC.json', 'F-94A-B_Starfire_ADC.json', 'F-94C_Starfire_ADC.json', 'F-A-18A-C_Hornet_ADC.json',
  'Fiat_G91R_ADC.json', 'Fiat_G91Y_ADC.json', 'Harrier_AV-8A-C_ADC.json', 'Harrier_GR.1-GR.3_ADC.json', 'Hawk_200_Strike_Jet_ADC.json', 'Hawk_MK.1-Hawk_MK.50_ADC.json', 'IAI_Kfir_C1-C2_ADC.json', 'IAI_Kfir_C7_ADC.json', 'IAI_Kurnass_Phantom_2000_ADC.json', 'IAI_Nesher_Argentine_Dagger_ADC.json', 'J-7_II_Fishbed_ADC.json', 'JAS-39_Gripen_ADC.json', 'MB-326K-Impala_II_ADC.json', 'MD.450_Ouragan_ADC.json', 'MRCA_IDS_Tornado_ADC.json', 'MRCA_Tornado_F.3_ADC.json', 'Meteor_F.8_ADC.json',
  'MiG-15_Fagot_ADC_v2.json', 'MiG-17-17P_Fresco-A-B_ADC.json', 'MiG-19S_Early_Farmer-C_ADC.json', 'MiG-21bis_Fishbed-N_ADC.json', 'MiG-23BN_Flogger-F_ADC.json', 'MiG-23M-MS_Flogger-B-E_ADC.json', 'MiG-23MF_Flogger-G_ADC.json', 'MiG-25PFM_Foxbat-E_ADC.json', 'MiG-25P_Foxbat-A_ADC.json', 'MiG-27F_Flogger-D-J_ADC.json', 'MiG-29_Fulcrum-A_ADC.json', 'MiG-31_Foxhound-A_ADC.json', 'Mirage_2000N_ADC.json', 'Mirage_2000_ADC.json', 'Mirage_F-1A_ADC.json', 'Mirage_F-1C_ADC.json', 'Mirage_F-1E_ADC.json', 'Mirage_IIICJ_ADC.json', 'Mirage_V_ADC.json',
  'NF-5A_Freedom_Fighter_ADC.json', 'P-80A_Shooting_Star_ADC.json', 'RF-84F_Thunderflash_ADC.json', 'Rafale-B_ADC.json', 'SAAB_A-32A_Lansen_ADC.json', 'SAAB_J-32B_Lansen_ADC.json', 'SD.4050_Vatour_IIA-B-N_ADC.json', 'SOKO_IAR-93B-ORAO-2_ADC.json', 'Saab_AJ-37_Viggen_ADC.json', 'Saab_F-35_Draken_ADC.json', 'Saab_J-35F-J_Draken_ADC.json', 'Saab_JA-37_Viggen_ADC.json', 'Sea_Harrier_FRS._1_ADC.json', 'Sea_Harrier_FRS._2_ADC.json', 'Sepecat_Jaguar_A-S_ADC.json',
  'Su-15_Flagon-A_ADC.json', 'Su-15_Flagon-D_ADC.json', 'Su-15_Flagon-F_ADC.json', 'Su-17-20_Fitter-C_ADC.json', 'Su-22_Fitter-H-J-K_ADC.json', 'Su-24_Fencer-C-D_ADC.json', 'Su-25_Frogfoot-A_ADC.json', 'Su-27_Flanker-B_ADC.json', 'Super_Etendard_ADC.json', 'Vampire_FB.35-SE.535_Mistral_ADC.json', 'Vampire_FB.5-FB.9_ADC.json',
];

CARD_FILES.push('F-102A_Delta_Dagger_ADC.json', 'Tu-95M_Bear_A_ADC.json', 'EF-105F-G_Wild_Weasel_ADC.json');

function aircraftId(file) {
  if (file === 'F-4E_Phantom_II_slatted_wings_ADC.json') return 'SPOH-F4E';
  return `SPOH-${file.replace(/_ADC(?:_v2)?\.json$/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase()}`;
}

function counterFor(title) {
  const name = title.toLowerCase();
  if (name.includes('a-1') || name.includes('skyraider')) return 'spoh/A-1.gif';
  if (name.includes('f-14')) return 'f-14d-super-tomcat.jpg';
  if (name.includes('f-15')) return 'f-15c-eagle.jpg';
  if (name.includes('f-16')) return 'f-16c-fighting-falcon.jpg';
  if (name.includes('f-4') || name.includes('phantom')) return 'f-4e-phantom-ii.jpg';
  if (name.includes('f-105')) return 'spoh/F105WW.gif';
  if (name.includes('f-104')) return 'spoh/F104.gif';
  if (name.includes('f-102')) return 'spoh/F102.gif';
  if (name.includes('tu-95')) return 'spoh/TU95.gif';
  if (name.includes('f-111')) return 'spoh/F111.gif';
  if (name.includes('f-84') || name.includes('rf-84')) return 'spoh/F84.gif';
  if (name.includes('f-86')) return 'spoh/F86.gif';
  if (name.includes('f-94')) return 'spoh/F89.gif';
  if (name.includes('f-5') || name.includes('f-7') || name.includes('j-7')) return 'spoh/F5.gif';
  if (name.includes('f/a-18')) return 'fa-18a-hornet.jpg';
  if (name.includes('p-80')) return 'spoh/F80.gif';
  if (name.includes('a4') || name.includes('a-4')) return 'spoh/A-4.gif';
  if (name.includes('a-6')) return 'spoh/A6.gif';
  if (name.includes('a-7')) return 'spoh/A-7.gif';
  if (name.includes('mig-31') || name.includes('mig-25')) return 'mig-31a-foxhound.jpg';
  if (name.includes('mig-29')) return 'mig-29-fulcrum-a.jpg';
  if (name.includes('mig-27') || name.includes('mig-23')) return 'mig-23mf-flogger.jpg';
  if (name.includes('mig-21')) return 'mig-21bis-fishbed-n.jpg';
  if (name.includes('mig-19')) return 'spoh/MiG19.gif';
  if (name.includes('mig-17')) return 'spoh/MiG-17.gif';
  if (name.includes('mig-15')) return 'spoh/MiG15.gif';
  if (name.includes('mirage 2000')) return 'mirage-2000.jpg';
  if (name.includes('mirage f-1')) return 'mirage-f-1c.jpg';
  if (name.includes('mirage')) return 'mirage-iiie.jpg';
  if (name.includes('tornado')) return 'mrca-tornado-f3.jpg';
  if (name.includes('viggen')) return 'ja-37-viggen.jpg';
  if (name.includes('draken')) return 'f-35-draken.jpg';
  if (name.includes('su-15')) return 'su-15-flagon-f.jpg';
  if (name.includes('su-17')) return 'su-17-fittter.jpg';
  if (name.includes('su-22')) return 'su-22-fitter.jpg';
  if (name.includes('su-24') || name.includes('su-25') || name.includes('su-27')) return 'su-27-flanker-a.jpg';
  if (name.includes('ouragan')) return 'spoh/Ouragan.gif';
  // No family art exists for this ADC; use the supplied generic jet counter.
  return 'f-20a-tigershark.gif';
}

function number(value, fallback = 0) {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function firstNumber(value) {
  return String(value ?? '').includes('-') ? null : number(value, null);
}

function bandName(value) {
  return value === 'EH+' ? 'EH' : value;
}

function powerRow(rows, name) {
  return rows.find(row => row.Power === name)?.CL;
}

function traits(notes) {
  const text = notes.join(' ').toLowerCase();
  return {
    hpr: text.includes('high pitch rate'),
    rollRate: text.includes('low roll rate') ? 'low' : 'normal',
    ssm: text.includes('good supersonic maneuver') ? 'good' : 'normal',
    rapidAccel: text.includes('rapid acceleration'),
    rapidPowerResponse: text.includes('rapid power response'),
    canard: text.includes('canard'),
    bleedRate: 'normal',
    slats: text.includes('slat'),
    viff: text.includes('viff'),
    highAoA: text.includes('high angle of attack'),
    verified: true,
  };
}

function normalize(id, card, source) {
  if (card.Aircraft === 'Tu-95M Bear A') {
    return { id, title: card.Aircraft, cruise: 4.5, climbSpeed: 2.5,
      power: { AB: [0, 0, 0], MIL: [0.5, 0.5, 0.5], Norm: [0, 0, 0], Idle: [1.5, 1.5, 1.5], Spbr: [2, 2, 2] },
      velocity: { LO: { min: 1.5, max: 4, dive: 4 }, ML: { min: 1.5, max: 5, dive: 4.5 }, MH: { min: 1.5, max: 5.5, dive: 5.5 }, HI: { min: 2, max: 6, dive: 6 }, VH: { min: 2, max: 5.5, dive: 5.5 }, EH: { min: 2, max: 5.5, dive: 5.5 } },
      climb: { LO: 1, ML: 1, MH: 1, HI: 0, VH: 0, EH: 0 }, drag: { TT: 1, HT: 2, BT: 3, ET: null }, dragHighSpeed: { TT: 1, HT: 2, BT: 3, ET: null }, dragThreshold: null,
      roll: { fp: 0, decel: 0 }, verticalRoll: { fp: 0, decel: 0 }, traits: { hpr: false, rollRate: 'low', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false, canard: false, bleedRate: 'low', slats: false, viff: false, highAoA: false, verified: true }, spoh: true, source: `spoh_adc/${source}` };
  }
  const velocity = {};
  const climb = {};
  const dive = new Map(card.Climb_Capability_Chart.map(row => [bandName(row['Alt. Band']), number(row['Dive Vel.'], 0)]));
  for (const row of card.Minimum_Maximum_Velocity_Chart) {
    const band = bandName(row['Alt. Band']);
    const min = firstNumber(row.CL?.Min);
    const max = firstNumber(row.CL?.Max);
    if (min === null || max === null) continue;
    velocity[band] = { min, max, dive: dive.get(band) ?? max };
  }
  for (const row of card.Climb_Capability_Chart) {
    const band = bandName(row['Alt. Band']);
    climb[band] = number(row['CL AB'], number(row['CL Other'], 0));
  }

  const drag = Object.fromEntries(card.Turn_Drag_Chart_Decel.map(row => [row.Turn, firstNumber(row.CL)]));
  const [rollFp, rollDecel] = String(card.Air_Power['Lag/Displ. Rolls']).split('/').map(value => number(value));
  const [verticalFp, verticalDecel] = String(card.Air_Power['Vertical Rolls']).split('/').map(value => number(value));
  const power = {
    AB: number(powerRow(card.Power_Chart_Accel, 'Aft. Bur.')),
    MIL: number(powerRow(card.Power_Chart_Accel, 'Military')),
    Norm: number(powerRow(card.Power_Chart_Accel, 'Normal')),
    Idle: number(powerRow(card.Power_Chart_Accel, 'Idle')),
    Spbr: number(powerRow(card.Power_Chart_Accel, 'Spbr')),
  };
  // The trainer's power API is band-based; Speed of Heat ADCs specify it by
  // configuration. Repeat the clean (CL) value across the three band slots.
  for (const setting of Object.keys(power)) power[setting] = [power[setting], power[setting], power[setting]];

  return {
    id,
    title: card.Aircraft,
    cruise: number(card.Aircraft_Characteristics['Cruise Speed']),
    climbSpeed: number(card.Aircraft_Characteristics['Climb Speed']),
    power,
    velocity,
    climb,
    drag,
    dragHighSpeed: { ...drag },
    dragThreshold: null,
    roll: { fp: rollFp, decel: rollDecel },
    verticalRoll: { fp: verticalFp, decel: verticalDecel },
    traits: traits(card.Notes_and_Variants ?? []),
    spoh: true,
    source: `spoh_adc/${source}`,
  };
}

async function loadSpohAircraft() {
  if (typeof window === 'undefined') return { aircraft: {}, counters: {} };
  const entries = await Promise.all(CARD_FILES.map(async file => {
    const response = await fetch(new URL(`../spoh_adc/${file}`, import.meta.url));
    if (!response.ok) throw new Error(`Speed of Heat ADC를 읽을 수 없습니다: ${file}`);
    const id = aircraftId(file);
    const card = await response.json();
    return [id, normalize(id, card, file), counterFor(card.Aircraft)];
  }));
  const aircraft = Object.fromEntries(entries.map(([id, item]) => [id, item]));
  const counters = Object.fromEntries(entries.map(([id, , counter]) => [id, counter]));
  // The supplied ADC collection has no F-84E card. Keep the scenario's
  // historical designation while explicitly using the closest available C/D data.
  const f84cd = aircraft['SPOH-F-84C-D-THUNDERJET'];
  if (f84cd) {
    aircraft['SPOH-F-84E-THUNDERJET'] = {
      ...f84cd,
      id: 'SPOH-F-84E-THUNDERJET',
      title: 'F-84E Thunderjet',
      source: `${f84cd.source} (F-84E 대체)`,
    };
    counters['SPOH-F-84E-THUNDERJET'] = counters['SPOH-F-84C-D-THUNDERJET'];
  }
  const f86f = aircraft['SPOH-F-86F-SABRE'];
  if (f86f) {
    aircraft['SPOH-F-86E-SABRE'] = { ...f86f, id: 'SPOH-F-86E-SABRE', title: 'F-86E Sabre', source: `${f86f.source} (F-86E 대체)` };
    counters['SPOH-F-86E-SABRE'] = counters['SPOH-F-86F-SABRE'];
  }
  // The supplied ADC scans omit the historical A-1H used by T-5.
  aircraft['SPOH-A-1H-SKYRAIDER'] = {
    id: 'SPOH-A-1H-SKYRAIDER', title: 'A-1H Skyraider', cruise: 2.5, climbSpeed: 2.5,
    power: { AB: [0, 0, 0], MIL: [1, 0.5, 0], Norm: [0, 0, 0], Idle: [1, 1, 1], Spbr: [2, 2, 2] },
    velocity: { LO: { min: 1.5, max: 4, dive: 5 }, ML: { min: 2, max: 4.5, dive: 5 }, MH: { min: 2, max: 5, dive: 5.5 }, HI: { min: 2.5, max: 5, dive: 5.5 }, VH: { min: 2.5, max: 4.5, dive: 5 }, EH: { min: 3, max: 4, dive: 4.5 } },
    climb: { LO: 2, ML: 2, MH: 1, HI: 1, VH: 0, EH: 0 }, drag: { TT: 1, HT: 2, BT: 3, ET: null }, dragHighSpeed: { TT: 1, HT: 2, BT: 3, ET: null }, dragThreshold: null,
    roll: { fp: 1, decel: 1 }, verticalRoll: { fp: 0, decel: 0 }, traits: { hpr: false, rollRate: 'low', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false, canard: false, bleedRate: 'normal', slats: false, viff: false, highAoA: false, verified: false }, spoh: true, source: 'T-5 scenario data',
  };
  counters['SPOH-A-1H-SKYRAIDER'] = 'spoh/A-1.gif';
  // T-6의 두 F-105 변형은 EF-105F/G 와일드 위즐 ADC 카드를 그대로 따른다.
  const weasel = aircraft['SPOH-EF-105F-G-WILD-WEASEL'];
  if (weasel) {
    aircraft['SPOH-F-105G-WILD-WEASEL'] = {
      ...weasel, id: 'SPOH-F-105G-WILD-WEASEL', title: 'F-105G Wild Weasel',
      // Rule 26.2: APR-38 RHAW 탑재 기체는 급강하 방위각 측정(Fix) 기동을 면제받는다.
      hts: true, rwr: 'D',
    };
    counters['SPOH-F-105G-WILD-WEASEL'] = 'spoh/F105WW.gif';
    // F-105D는 전용 카드가 없어 같은 기골의 위즐 카드를 쓰되 RHAW 장비만 뺀다.
    aircraft['SPOH-F-105D-THUNDERCHIEF'] = {
      ...weasel, id: 'SPOH-F-105D-THUNDERCHIEF', title: 'F-105D Thunderchief',
      hts: false, rwr: 'B', source: `${weasel.source} (F-105D 대체)`,
    };
    counters['SPOH-F-105D-THUNDERCHIEF'] = 'spoh/F105.gif';
  }
  return { aircraft, counters };
}

const loaded = await loadSpohAircraft();
export const SPOH_AIRCRAFT = loaded.aircraft;
export const SPOH_COUNTERS = loaded.counters;

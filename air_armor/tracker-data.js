// air_armor/tracker-data.js
const TRACKER_DATA = {
  nato: {
    label: 'NATO',
    hqs: [
      { id: 'us_3rd_inf', name: '3rd Inf Div', nation: 'us', rpMax: 2, cpMax: 2 },
      { id: 'wg_12th_pz', name: '12th Pz Div', nation: 'wg', rpMax: 2, cpMax: 2 },
      { id: 'ca_4cmbg', name: '4CMBG', nation: 'ca', rpMax: 2, cpMax: 2 },
      { id: 'wg_54hsb', name: '54Hsb', nation: 'wg', rpMax: 2, cpMax: 2 },
      { id: 'wg_26ll', name: '26LL', nation: 'wg', rpMax: 2, cpMax: 2 }
    ],
    offmap: { cpMax: 2, rpMax: 2, label: 'VII Corps' },
    nations: [
      { id: 'us', label: 'US' },
      { id: 'wg', label: '서독' },
      { id: 'ca', label: '캐나다' }
    ],
    csTypes: ['mine', 'adm', 'gasPersistent', 'gasNonPersistent', 'airPoint', 'bridge'],
    samMax: 4
  },
  wp: {
    label: 'WP (바르샤바 조약군)',
    hqs: [],
    offmap: { cpMax: 3, rpMax: 2, label: '8th Guards Army' },
    nations: [
      { id: 'wp', label: 'WP' }
    ],
    csTypes: ['mine', 'adm', 'gasPersistent', 'gasNonPersistent', 'airPoint', 'bridge'],
    samMax: 4
  }
};

const CS_TYPE_LABELS = {
  mine: 'Mine',
  adm: 'ADM',
  gasPersistent: 'Gas (지속성)',
  gasNonPersistent: 'Gas (비지속성)',
  airPoint: 'Air Point',
  bridge: 'Bridge'
};

// air_armor/tracker-data.js
const TRACKER_DATA = {
  nato: {
    label: 'NATO',
    hqs: [
      { id: 'ca_4cmbg', name: '4CMBG', nation: 'ca', rpMax: 2, cpMax: 2 },
      { id: 'wg_54hsb', name: '54Hsb', nation: 'wg', rpMax: 2, cpMax: 2 },
      { id: 'wg_26ll', name: '26LL', nation: 'wg', rpMax: 2, cpMax: 2 }
    ],
    divisions: [
      {
        id: 'us_3rd_inf',
        name: '3rd Inf Div',
        nation: 'us',
        units: [
          { id: 'fwd', name: 'Fwd HQ', rpMax: 1, cpMax: 1, cpOnly: true },
          { id: 'mn', name: 'Mn HQ', rpMax: 1, cpMax: 1 },
          { id: 'b1_3', name: '1/3', rpMax: 1, cpMax: 1, indent: true },
          { id: 'b2_3', name: '2/3', rpMax: 1, cpMax: 1, indent: true },
          { id: 'b3_3', name: '3/3', rpMax: 1, cpMax: 1, indent: true },
          { id: 'acr_2_11', name: '2/11 ACR', rpMax: 1, cpMax: 1, indent: true }
        ]
      },
      {
        id: 'wg_12th_pz',
        name: '12th Pz Div',
        nation: 'wg',
        units: [
          { id: 'mn', name: 'Mn HQ', rpMax: 2, cpMax: 2 },
          { id: 'b34_12', name: '34/12', rpMax: 2, cpMax: 2, indent: true },
          { id: 'b35_12', name: '35/12', rpMax: 2, cpMax: 2, indent: true },
          { id: 'b36_12', name: '36/12', rpMax: 2, cpMax: 2, indent: true }
        ]
      }
    ],
    offmap: { cpMax: 2, rpMax: 2, label: 'VII Corps' },
    nations: [
      { id: 'nato', label: 'NATO' }
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

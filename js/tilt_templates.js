window.NEXUSTiltTemplates = {
  STANDARD: {
    id: 'STANDARD',
    name: 'Standard Pre-Torque TILT Test',
    description: 'Standard 10-point pre-torque TILT matrix used for three-phase equipment.',
    matrixName: 'Pre Torque Tilt Test',
    tests: [
      { id: 'PP_AB', matrixKey: 'AB', group: 'Phase to Phase', label: 'A-B', from: 'A', to: 'B', expected: 'TRANSFORMER_OK' },
      { id: 'PP_AC', matrixKey: 'AC', group: 'Phase to Phase', label: 'A-C', from: 'A', to: 'C', expected: 'TRANSFORMER_OK' },
      { id: 'PP_BC', matrixKey: 'BC', group: 'Phase to Phase', label: 'B-C', from: 'B', to: 'C', expected: 'TRANSFORMER_OK' },
      { id: 'PG_AG', matrixKey: 'AG', group: 'Phase to Ground', label: 'A-G', from: 'A', to: 'G', expected: 'TRANSFORMER_OK' },
      { id: 'PG_BG', matrixKey: 'BG', group: 'Phase to Ground', label: 'B-G', from: 'B', to: 'G', expected: 'TRANSFORMER_OK' },
      { id: 'PG_CG', matrixKey: 'CG', group: 'Phase to Ground', label: 'C-G', from: 'C', to: 'G', expected: 'TRANSFORMER_OK' },
      { id: 'PN_AN', matrixKey: 'AN', group: 'Phase to Neutral', label: 'A-N', from: 'A', to: 'N', expected: 'TRANSFORMER_OK' },
      { id: 'PN_BN', matrixKey: 'BN', group: 'Phase to Neutral', label: 'B-N', from: 'B', to: 'N', expected: 'TRANSFORMER_OK' },
      { id: 'PN_CN', matrixKey: 'CN', group: 'Phase to Neutral', label: 'C-N', from: 'C', to: 'N', expected: 'TRANSFORMER_OK' },
      { id: 'NG_NG', matrixKey: 'NG', group: 'Neutral to Ground', label: 'N-G', from: 'N', to: 'G', expected: 'TRANSFORMER_OK' }
    ]
  },

  cloneTests(templateId = 'STANDARD') {
    const template = this[templateId] || this.STANDARD;
    return template.tests.map((test, index) => ({ ...test, order: index + 1 }));
  }
};

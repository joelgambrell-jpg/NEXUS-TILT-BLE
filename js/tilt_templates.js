window.NEXUSTiltTemplates = {
  STANDARD: {
    id: 'STANDARD',
    name: 'Standard Canned TILT Test',
    description: 'Standard field TILT test sequence for three-phase equipment.',
    tests: [
      { id: 'PP_AB', group: 'Phase to Phase', label: 'A-B', from: 'A', to: 'B', expected: 'TRANSFORMER_OK' },
      { id: 'PP_AC', group: 'Phase to Phase', label: 'A-C', from: 'A', to: 'C', expected: 'TRANSFORMER_OK' },
      { id: 'PP_BC', group: 'Phase to Phase', label: 'B-C', from: 'B', to: 'C', expected: 'TRANSFORMER_OK' },
      { id: 'PG_AG', group: 'Phase to Ground', label: 'A-G', from: 'A', to: 'G', expected: 'TRANSFORMER_OK' },
      { id: 'PG_BG', group: 'Phase to Ground', label: 'B-G', from: 'B', to: 'G', expected: 'TRANSFORMER_OK' },
      { id: 'PG_CG', group: 'Phase to Ground', label: 'C-G', from: 'C', to: 'G', expected: 'TRANSFORMER_OK' },
      { id: 'PN_AN', group: 'Phase to Neutral', label: 'A-N', from: 'A', to: 'N', expected: 'TRANSFORMER_OK' },
      { id: 'PN_BN', group: 'Phase to Neutral', label: 'B-N', from: 'B', to: 'N', expected: 'TRANSFORMER_OK' },
      { id: 'PN_CN', group: 'Phase to Neutral', label: 'C-N', from: 'C', to: 'N', expected: 'TRANSFORMER_OK' },
      { id: 'NG_NG', group: 'Neutral to Ground', label: 'N-G', from: 'N', to: 'G', expected: 'TRANSFORMER_OK' }
    ]
  },

  cloneTests(templateId = 'STANDARD') {
    const template = this[templateId] || this.STANDARD;
    return template.tests.map((test, index) => ({ ...test, order: index + 1 }));
  }
};

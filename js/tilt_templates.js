window.NEXUSTiltTemplates = {
  STANDARD: {
    id: 'STANDARD',
    name: 'Standard Canned TILT Test',
    tests: [
      { id: 'T1', label: 'X1 → X2', from: 'X1', to: 'X2', expected: 'TRANSFORMER_OK' },
      { id: 'T2', label: 'X2 → X3', from: 'X2', to: 'X3', expected: 'TRANSFORMER_OK' },
      { id: 'T3', label: 'X1 → X3', from: 'X1', to: 'X3', expected: 'TRANSFORMER_OK' },
      { id: 'T4', label: 'X1 → X0', from: 'X1', to: 'X0', expected: 'TRANSFORMER_OK' },
      { id: 'T5', label: 'X2 → X0', from: 'X2', to: 'X0', expected: 'TRANSFORMER_OK' },
      { id: 'T6', label: 'X3 → X0', from: 'X3', to: 'X0', expected: 'TRANSFORMER_OK' }
    ]
  },
  cloneTests(templateId = 'STANDARD') {
    const template = this[templateId] || this.STANDARD;
    return template.tests.map(t => ({ ...t }));
  },
  buildScope(scope = 'FULL', templateId = 'STANDARD') {
    const tests = this.cloneTests(templateId);
    if (scope === 'HALF') return tests.slice(0, Math.ceil(tests.length / 2));
    return tests;
  }
};

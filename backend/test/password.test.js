const test = require('node:test');
const assert = require('node:assert');
const { validatePasswordStrength } = require('../src/services/securityService/password');

test('rejects short passwords', () => {
  const r = validatePasswordStrength('Ab1');
  assert.strictEqual(r.valid, false);
});

test('rejects passwords missing uppercase', () => {
  const r = validatePasswordStrength('lowercase1');
  assert.strictEqual(r.valid, false);
});

test('rejects passwords missing a number', () => {
  const r = validatePasswordStrength('NoNumberHere');
  assert.strictEqual(r.valid, false);
});

test('accepts a strong password', () => {
  const r = validatePasswordStrength('Demo@1234');
  assert.strictEqual(r.valid, true);
});

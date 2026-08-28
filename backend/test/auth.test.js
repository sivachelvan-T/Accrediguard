const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

test('rejects requests with no Authorization header', () => {
  const { authenticate } = require('../src/middleware/auth');
  const req = { headers: {} };
  let calledWithError = null;
  authenticate(req, {}, (err) => { calledWithError = err; });
  assert.ok(calledWithError);
  assert.strictEqual(calledWithError.status, 401);
});

test('rejects an invalid/garbage token', () => {
  const { authenticate } = require('../src/middleware/auth');
  const req = { headers: { authorization: 'Bearer not-a-real-token' } };
  let calledWithError = null;
  authenticate(req, {}, (err) => { calledWithError = err; });
  assert.ok(calledWithError);
  assert.strictEqual(calledWithError.status, 401);
});

test('authorize() blocks a role not in the allow-list', () => {
  const { authorize } = require('../src/middleware/auth');
  const mw = authorize('SUPER_ADMIN');
  const req = { user: { role: 'STUDENT' } };
  let calledWithError = null;
  mw(req, {}, (err) => { calledWithError = err; });
  assert.ok(calledWithError);
  assert.strictEqual(calledWithError.status, 403);
});

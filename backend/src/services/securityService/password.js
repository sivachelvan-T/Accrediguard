const MIN_LENGTH = 8;

function validatePasswordStrength(password) {
  const errors = [];
  if (!password || password.length < MIN_LENGTH) errors.push(`Password must be at least ${MIN_LENGTH} characters.`);
  if (!/[a-z]/.test(password || '')) errors.push('Password must include a lowercase letter.');
  if (!/[A-Z]/.test(password || '')) errors.push('Password must include an uppercase letter.');
  if (!/[0-9]/.test(password || '')) errors.push('Password must include a number.');
  return { valid: errors.length === 0, errors };
}

module.exports = { validatePasswordStrength };

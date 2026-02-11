const crypto = require('crypto');

// Unambiguous characters (no O/0/I/1/L)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a license key in format: MBPRO-XXXX-XXXX-XXXX-XXXX
 * Uses crypto.randomBytes for secure randomness.
 * @returns {string}
 */
function generateLicenseKey() {
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let group = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      group += CHARS[bytes[i] % CHARS.length];
    }
    groups.push(group);
  }
  return 'MBPRO-' + groups.join('-');
}

module.exports = { generateLicenseKey };

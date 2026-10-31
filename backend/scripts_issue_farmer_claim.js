'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const crypto = require('crypto');
const db = require('./config/db');

(async () => {
  const farmerId = Number(process.argv[2]);
  const days = Number(process.argv[3] || 2);

  if (!Number.isSafeInteger(farmerId) || farmerId <= 0 ||
      !Number.isInteger(days) || days < 1 || days > 7) {
    console.error('Usage: node scripts_issue_farmer_claim.js <farmer_id> [expiry_days 1-7]');
    process.exitCode = 1;
    return;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [farmers] = await conn.query(
      'SELECT farmer_id, name FROM farmers WHERE farmer_id = ? FOR UPDATE',
      [farmerId]
    );
    if (!farmers.length) throw new Error('Farmer profile not found.');

    const [links] = await conn.query(
      'SELECT user_id FROM farmer_accounts WHERE farmer_id = ? LIMIT 1',
      [farmerId]
    );
    if (links.length) throw new Error('This farmer profile is already linked.');

    const code = crypto.randomBytes(24).toString('base64url');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    await conn.query(
      `INSERT INTO farmer_claim_codes (farmer_id, code_hash, expires_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
      [farmerId, codeHash, days]
    );

    await conn.commit();

    console.log('\nFarmer profile:', farmers[0].name, '(ID', farmerId + ')');
    console.log('One-time claim code:', code);
    console.log('Expires in', days, 'day(s).');
    console.log('Give this code only to the verified owner of this farmer profile.');
    console.log('The code cannot be displayed again after this command exits.\n');
  } catch (error) {
    await conn.rollback();
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end?.();
  }
})().catch(error => {
  console.error('Claim-code issuance failed:', error.message);
  process.exitCode = 1;
});

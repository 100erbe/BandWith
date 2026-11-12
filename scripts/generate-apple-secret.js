/**
 * Generate the Sign in with Apple client secret (an ES256 JWT) for
 * Supabase → Auth → Providers → Apple.
 *
 * Nothing secret lives in this file: the IDs and the .p8 private key are read
 * from the environment, and the .p8 must stay outside the repo (*.p8 is
 * gitignored).
 *
 *   APPLE_TEAM_ID=… APPLE_KEY_ID=… APPLE_SERVICE_ID=… \
 *   APPLE_P8_PATH=~/secure/AuthKey_XXXX.p8 node scripts/generate-apple-secret.js
 *
 * Apple caps the secret at 6 months: regenerate it before it expires.
 */

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const env = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. See the usage at the top of this file.`);
    process.exit(1);
  }
  return value;
};

const TEAM_ID = env('APPLE_TEAM_ID');
const KEY_ID = env('APPLE_KEY_ID');
const SERVICE_ID = env('APPLE_SERVICE_ID');
const P8_PATH = env('APPLE_P8_PATH').replace(/^~(?=\/)/, homedir());

const privateKey = createPrivateKey(readFileSync(P8_PATH, 'utf8'));

const now = Math.floor(Date.now() / 1000);
const expiry = now + 180 * 24 * 60 * 60; // 180 days, Apple's maximum

const b64url = (input) => Buffer.from(input).toString('base64url');
const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
const payload = b64url(
  JSON.stringify({ iss: TEAM_ID, iat: now, exp: expiry, aud: 'https://appleid.apple.com', sub: SERVICE_ID }),
);
const signingInput = `${header}.${payload}`;
// ES256 JWTs need the raw r||s signature, not DER.
const signature = sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });

console.log('Apple Sign-In client secret (paste it into Supabase, do not commit it):\n');
console.log(`${signingInput}.${signature.toString('base64url')}`);
console.log(`\nExpires: ${new Date(expiry * 1000).toISOString()}`);

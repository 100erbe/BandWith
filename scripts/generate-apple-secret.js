/**
 * Generate Apple Sign-In Secret Key (JWT)
 * Run with: node scripts/generate-apple-secret.js
 */

import { createSign } from 'crypto';

// Apple Developer Account details
const TEAM_ID = 'EXXP64DV5K';
const KEY_ID = '39Y5SSTUTM';
const SERVICE_ID = 'com.bandwith.app.auth';

// Private key from .p8 file
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgLLfOMUQ9IcNlGL76
ps1XLjx5GcUfUbjxfz6sJz8gy0KgCgYIKoZIzj0DAQehRANCAARh00wTGNuFRy1t
j7MDY49sJNkaT5+R504b9+qX3U4WtYDqNe4cubtRBzUATfJDzfOVYFbnkEY2TyJa
VIf0PB5x
-----END PRIVATE KEY-----`;

// JWT expires in 6 months (maximum allowed by Apple)
const now = Math.floor(Date.now() / 1000);
const expiry = now + (180 * 24 * 60 * 60); // 180 days

// Create JWT header and payload
const header = {
  alg: 'ES256',
  kid: KEY_ID,
  typ: 'JWT'
};

const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: expiry,
  aud: 'https://appleid.apple.com',
  sub: SERVICE_ID
};

// Base64URL encode
function base64UrlEncode(data) {
  const json = JSON.stringify(data);
  const base64 = Buffer.from(json).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create signature
function signJWT(header, payload, privateKey) {
  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  
  const sign = createSign('SHA256');
  sign.update(signatureInput);
  sign.end();
  
  const signature = sign.sign(privateKey);
  
  // Convert DER signature to raw R+S format for ES256
  // DER format: 0x30 [length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  let offset = 3;
  const rLength = signature[offset];
  offset += 1;
  let r = signature.slice(offset, offset + rLength);
  offset += rLength + 1;
  const sLength = signature[offset];
  offset += 1;
  let s = signature.slice(offset, offset + sLength);
  
  // Ensure R and S are exactly 32 bytes each
  if (r.length > 32) r = r.slice(-32);
  if (s.length > 32) s = s.slice(-32);
  if (r.length < 32) r = Buffer.concat([Buffer.alloc(32 - r.length), r]);
  if (s.length < 32) s = Buffer.concat([Buffer.alloc(32 - s.length), s]);
  
  const rawSignature = Buffer.concat([r, s]);
  const signatureEncoded = rawSignature.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return `${signatureInput}.${signatureEncoded}`;
}

const jwt = signJWT(header, payload, PRIVATE_KEY);

console.log('\n========================================');
console.log('Apple Sign-In Secret Key (JWT)');
console.log('========================================\n');
console.log('Copy this entire string to Supabase:\n');
console.log(jwt);
console.log('\n========================================');
console.log(`Expires: ${new Date(expiry * 1000).toISOString()}`);
console.log('========================================\n');

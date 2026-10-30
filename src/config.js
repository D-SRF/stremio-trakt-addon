import { randomBytes } from 'node:crypto';
export const config = {
  port: Number(process.env.PORT || 7000),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:7000').replace(/\/$/, ''),
  clientId: process.env.TRAKT_CLIENT_ID || '',
  clientSecret: process.env.TRAKT_CLIENT_SECRET || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  dbPath: process.env.DB_PATH || './data/addon.sqlite'
};
export function validateConfig() {
  for (const key of ['clientId','clientSecret','sessionSecret','encryptionKey']) if (!config[key]) throw Error(`Missing config ${key}; see .env.example`);
  if (!/^[a-f0-9]{64}$/i.test(config.encryptionKey)) throw Error('ENCRYPTION_KEY must be 64 hex chars');
  if (Buffer.byteLength(config.sessionSecret) < 32) throw Error('SESSION_SECRET must be at least 32 bytes');
  if (!/^https:\/\//.test(config.publicUrl) && !/^http:\/\/localhost(?::\d+)?$/.test(config.publicUrl)) throw Error('PUBLIC_URL must be HTTPS outside localhost');
}
export function randomToken() { return randomBytes(32).toString('base64url'); }

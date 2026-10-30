import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { config } from './config.js';
mkdirSync(dirname(config.dbPath), { recursive:true });
export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, token TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);`);
const key = Buffer.from(config.encryptionKey,'hex');
export function encrypt(value) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
}
export function decrypt(value) {
  const buf=Buffer.from(value,'base64'); const decipher=createDecipheriv('aes-256-gcm',key,buf.subarray(0,12));
  decipher.setAuthTag(buf.subarray(12,28)); return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)),decipher.final()]).toString());
}
export function getUser(id) { const r=db.prepare('SELECT * FROM users WHERE id=?').get(id); return r ? {...r,token:decrypt(r.token)} : null; }
export function putUser(id,token) { db.prepare('INSERT INTO users(id,token,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token').run(id,encrypt(token),Date.now()); }
export function deleteUser(id) { db.prepare('DELETE FROM users WHERE id=?').run(id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); }
export function hashSecret(s) { return createHash('sha256').update(s).digest('hex'); }
export function cleanup() { db.prepare('DELETE FROM oauth_states WHERE expires_at<?').run(Date.now()); db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now()); }

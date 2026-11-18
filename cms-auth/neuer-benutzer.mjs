// Legt einen Benutzer an (oder setzt ein neues Passwort) und schreibt USERS direkt als Worker-Secret.
// Aufruf: node neuer-benutzer.mjs leon "Leon Iseler"   (bestehende Nutzer liest es aus users.local.json)
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [name, anzeige] = process.argv.slice(2);
if (!name) { console.error('Aufruf: node neuer-benutzer.mjs <name> "<Anzeigename>"'); process.exit(1); }
const file = new URL('./users.local.json', import.meta.url);
const users = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const rnd = crypto.getRandomValues(new Uint8Array(20));
const pw = [...rnd].map((b) => alphabet[b % alphabet.length]).join('').replace(/(.{5})(?!$)/g, '$1-');

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
const id = name.toLowerCase();
users[id] = { name: anzeige || users[id]?.name || name, salt: Buffer.from(salt).toString('base64'), hash: Buffer.from(bits).toString('base64'), v: (users[id]?.v || 0) + 1 };
writeFileSync(file, JSON.stringify(users, null, 2));
execFileSync('wrangler', ['secret', 'put', 'USERS'], { input: JSON.stringify(users), stdio: ['pipe', 'inherit', 'inherit'], cwd: new URL('.', import.meta.url).pathname });
console.log(`\nBenutzer: ${id}\nPasswort: ${pw}`);

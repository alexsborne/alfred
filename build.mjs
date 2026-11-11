// Encrypts data.json with the password and writes docs/index.html.
// Usage: ALFRED_PASSWORD=... node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const password = process.env.ALFRED_PASSWORD;
if (!password) throw new Error('Defina ALFRED_PASSWORD');

const iterations = 600000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const aes = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
  key, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
// A aba SEFAZ-DF é lida do projeto de estudos a cada build (ver sefaz.mjs).
const { mergeSefaz } = await import('./sefaz.mjs');
// A aba Finanças recebe o resumo da fatura mais recente em ./financas/ (ver financas.mjs).
const { mergeFinancas } = await import('./financas.mjs');
// A aba Engenharia de IA vem do resumo da trilha (ver trilha.mjs).
const { mergeTrilha } = await import('./trilha.mjs');
const painel = mergeTrilha(mergeFinancas(mergeSefaz(JSON.parse(readFileSync('data.json', 'utf8')))));
writeFileSync('data.json', JSON.stringify(painel, null, 2) + '\n');
const plain = new TextEncoder().encode(JSON.stringify(painel));
const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, plain));

const b64 = u => Buffer.from(u).toString('base64');
const payload = JSON.stringify({ iterations, salt: b64(salt), iv: b64(iv), data: b64(data) });

const html = readFileSync('template.html', 'utf8').replace('/*PAYLOAD*/null', payload);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/index.html', html);
writeFileSync('docs/.nojekyll', '');
console.log('docs/index.html gerado');

import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const key = process.env.GEMINI_API_KEY;
console.log('chave local presente:', !!key, key ? `(${key.length} chars)` : '');
if (!key) process.exit(1);

const pdf = readFileSync(process.argv[2]).toString('base64');
const modelo = process.argv[3] ?? 'gemini-2.0-flash';

const r = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: pdf } },
          { text: 'Liste em JSON os exames e valores deste laudo. Formato: {"valores":[{"nome":"","valor":""}]}' },
        ],
      }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 2048 },
    }),
  },
);
const corpo = await r.text();
console.log(`modelo ${modelo} -> HTTP ${r.status}`);
console.log(corpo.slice(0, 600));

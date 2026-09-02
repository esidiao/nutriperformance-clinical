// Lista os modelos que a chave do Gemini enxerga.
// Le a chave de GEMINI_API_KEY no ambiente — nao imprime a chave.
const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Defina GEMINI_API_KEY no ambiente antes de rodar.');
  console.error('Ex.: GEMINI_API_KEY=... node apps/api/scripts/modelos-gemini.mjs');
  process.exit(1);
}
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
if (!r.ok) {
  console.log(`HTTP ${r.status} :: ${(await r.text()).slice(0, 300)}`);
  process.exit(1);
}
const { models = [] } = await r.json();
const uteis = models
  .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
  .map((m) => m.name.replace('models/', ''));
console.log(`${uteis.length} modelos disponiveis para generateContent:\n`);
for (const m of uteis) console.log('  ' + m);
console.log('\nSugestao: use o flash mais recente (menor custo e latencia).');

/**
 * Fase 5 — Popular rag_chunks com embeddings dos alimentos (TACO) já na base.
 * Pré: `npm run build` (usa dist da rag-chunk.util). Executar via railway run
 * (precisa DATABASE_URL + GEMINI_API_KEY).
 *
 *   cd apps/api && npm run build && railway run node scripts/embed-rag-foods.js
 *
 * Idempotente: upsert por (fonte, fonte_ref). Pode reexecutar para atualizar.
 */
const { Client } = require('pg');

let util;
try { util = require('../dist/src/modules/rag/rag-chunk.util.js'); }
catch { util = require('../dist/modules/rag/rag-chunk.util.js'); }

const EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

async function embed(text, key) {
  const res = await fetch(`${EMBED_URL}?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
  });
  if (!res.ok) throw new Error(`embed HTTP ${res.status}`);
  const d = await res.json();
  const v = d?.embedding?.values ?? [];
  if (!v.length) throw new Error('embedding vazio');
  return util.normalize(v);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const key = process.env.GEMINI_API_KEY;
  if (!connectionString || !key) { console.error('DATABASE_URL e GEMINI_API_KEY necessários (use railway run).'); process.exit(1); }
  const ssl = process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString, ssl });
  await client.connect();

  let ok = 0, fail = 0;
  try {
    const { rows: foods } = await client.query(
      `SELECT id, nome_padronizado, grupo_alimentar, porcao_padrao_g, energia_kcal, proteinas_g,
              carboidratos_g, lipidios_g, fibras_g, sodio_mg, ferro_mg, calcio_mg, potassio_mg, magnesio_mg, zinco_mg, fonte
       FROM foods WHERE ativo = true AND confiabilidade <> 'pendente'`,
    );
    console.log(`Alimentos a vetorizar: ${foods.length}`);

    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      const food = {
        nomePadronizado: f.nome_padronizado, grupoAlimentar: f.grupo_alimentar, porcaoPadraoG: f.porcao_padrao_g,
        energiaKcal: f.energia_kcal, proteinasG: f.proteinas_g, carboidratosG: f.carboidratos_g, lipidiosG: f.lipidios_g,
        fibrasG: f.fibras_g, sodioMg: f.sodio_mg, ferroMg: f.ferro_mg, calcioMg: f.calcio_mg,
        potassioMg: f.potassio_mg, magnesioMg: f.magnesio_mg, zincoMg: f.zinco_mg, fonte: f.fonte,
      };
      const texto = util.buildFoodChunkText(food);
      try {
        const vec = await embed(texto, key);
        const lit = util.toVectorLiteral(vec);
        await client.query(
          `INSERT INTO rag_chunks (texto, fonte, fonte_ref, confiabilidade, metadata, embedding)
           VALUES ($1,$2,$3,'alta',$4,$5::vector)
           ON CONFLICT (fonte, fonte_ref) DO UPDATE SET texto=EXCLUDED.texto, embedding=EXCLUDED.embedding`,
          [texto, 'taco', f.id, JSON.stringify({ nome: f.nome_padronizado }), lit],
        );
        ok++;
      } catch (e) {
        fail++;
        if (fail <= 10) console.warn(`falha em "${f.nome_padronizado}": ${e.message}`);
      }
      if (i % 50 === 0) { console.log(`  ${i}/${foods.length}...`); }
      await sleep(300); // respeita rate limit de embeddings
    }
    console.log(`Concluído — embeddings ok: ${ok} | falhas: ${fail}`);
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error('Falha:', e.message); process.exit(1); });

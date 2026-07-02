/**
 * Amplia o RAG: indexa interações de alta evidência (constante da API) e os
 * produtos industrializados já cacheados (Open Food Facts).
 * Pré: `npm run build`. Executar via railway run (DATABASE_URL + GEMINI_API_KEY).
 *
 *   cd apps/api && npm run build && railway run node scripts/embed-rag-extra.js
 *
 * Idempotente: upsert por (fonte, fonte_ref).
 */
const { Client } = require('pg');

function req(p) { try { return require('../dist/src/' + p); } catch { return require('../dist/' + p); } }
const util = req('modules/rag/rag-chunk.util.js');
const { HIGH_EVIDENCE_INTERACTIONS } = req('modules/interactions/interaction.service.js');

const EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function upsert(client, key, fonte, fonteRef, conf, texto, meta) {
  const vec = await embed(texto, key);
  await client.query(
    `INSERT INTO rag_chunks (texto, fonte, fonte_ref, confiabilidade, metadata, embedding)
     VALUES ($1,$2,$3,$4,$5,$6::vector)
     ON CONFLICT (fonte, fonte_ref) DO UPDATE SET texto=EXCLUDED.texto, embedding=EXCLUDED.embedding, confiabilidade=EXCLUDED.confiabilidade`,
    [texto, fonte, fonteRef, conf, JSON.stringify(meta || {}), util.toVectorLiteral(vec)],
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const key = process.env.GEMINI_API_KEY;
  if (!connectionString || !key) { console.error('DATABASE_URL e GEMINI_API_KEY necessários (railway run).'); process.exit(1); }
  const ssl = process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString, ssl });
  await client.connect();
  let ok = 0, fail = 0;
  try {
    // 1) Interações de alta evidência
    for (let i = 0; i < HIGH_EVIDENCE_INTERACTIONS.length; i++) {
      const it = HIGH_EVIDENCE_INTERACTIONS[i];
      const texto = util.buildInteractionChunkText(it);
      const ref = `${it.entityA}__${it.entityB}`;
      try { await upsert(client, key, 'interacoes', ref, it.confidenceLevel || 'media', texto, { entityA: it.entityA, entityB: it.entityB }); ok++; }
      catch (e) { fail++; console.warn(`falha interação ${ref}: ${e.message}`); }
      await sleep(300);
    }
    // 2) Produtos cacheados (Open Food Facts)
    const { rows: prods } = await client.query(
      `SELECT codigo_barras, nome_comercial, marca, nutri_score, nova_classificacao, tabela_nutricional, alerta_nutricional, alergenos
       FROM industrialized_products`,
    );
    for (const p of prods) {
      const texto = util.buildProductChunkText({
        nomeComercial: p.nome_comercial, marca: p.marca, nutriScore: p.nutri_score,
        novaClassificacao: p.nova_classificacao, tabelaNutricional: p.tabela_nutricional,
        alertaNutricional: p.alerta_nutricional, alergenos: p.alergenos,
      });
      try { await upsert(client, key, 'openfoodfacts', p.codigo_barras, 'media', texto, { ean: p.codigo_barras }); ok++; }
      catch (e) { fail++; console.warn(`falha produto ${p.codigo_barras}: ${e.message}`); }
      await sleep(300);
    }
    console.log(`Ampliação RAG concluída — interações: ${HIGH_EVIDENCE_INTERACTIONS.length}, produtos: ${prods.length} | ok: ${ok} | falhas: ${fail}`);
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error('Falha:', e.message); process.exit(1); });

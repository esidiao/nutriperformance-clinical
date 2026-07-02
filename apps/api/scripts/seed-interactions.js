/**
 * Migra as 40 interações do frontend (apps/web/lib/evidence/evidence-base.ts) para
 * a tabela interactions_base e re-indexa no RAG (fonte='interacoes').
 * Lê o arquivo real (não transcreve/inventa). Pré: `npm run build`.
 *   cd apps/api && npm run build && railway run node scripts/seed-interactions.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function req(p) { try { return require('../dist/src/' + p); } catch { return require('../dist/' + p); } }
const util = req('modules/rag/rag-chunk.util.js');
const EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embed(text, key) {
  const res = await fetch(`${EMBED_URL}?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }) });
  if (!res.ok) throw new Error('embed HTTP ' + res.status);
  const d = await res.json();
  return util.normalize(d.embedding.values);
}

/** Extrai o array EVIDENCE_BASE balanceando colchetes, e avalia (arquivo local confiável). */
function extractEvidence(src) {
  const marker = src.indexOf('EVIDENCE_BASE');
  const eq = src.indexOf('=', marker);     // pula a anotação de tipo "EvidenceEntry[]"
  const start = src.indexOf('[', eq);
  let depth = 0, end = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  const arrText = src.slice(start, end + 1);
  // eslint-disable-next-line no-eval
  return eval(arrText);
}

async function main() {
  const cs = process.env.DATABASE_URL, key = process.env.GEMINI_API_KEY;
  if (!cs || !key) { console.error('DATABASE_URL e GEMINI_API_KEY necessários (railway run).'); process.exit(1); }
  const file = path.resolve(__dirname, '../../web/lib/evidence/evidence-base.ts');
  const entries = extractEvidence(fs.readFileSync(file, 'utf8'));
  console.log('Interações lidas do frontend:', entries.length);

  const client = new Client({ connectionString: cs, ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false });
  await client.connect();
  let ok = 0, fail = 0;
  try {
    // tabela canônica
    for (const e of entries) {
      await client.query(
        `INSERT INTO interactions_base (id, entity_a, entity_a_type, entity_b, entity_b_type, risk_level, mechanism, recommendation, confidence, evidence_type, references_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET entity_a=EXCLUDED.entity_a, entity_b=EXCLUDED.entity_b, risk_level=EXCLUDED.risk_level,
           mechanism=EXCLUDED.mechanism, recommendation=EXCLUDED.recommendation, confidence=EXCLUDED.confidence,
           evidence_type=EXCLUDED.evidence_type, references_text=EXCLUDED.references_text`,
        [e.id, e.entityA, e.entityAType, e.entityB, e.entityBType, e.riskLevel, e.mechanism, e.recommendation, e.confidence, e.evidenceType, e.references],
      );
    }
    // re-indexa no RAG: limpa interações antigas e reinsere as canônicas
    await client.query("DELETE FROM rag_chunks WHERE fonte='interacoes'");
    for (const e of entries) {
      const texto = util.buildInteractionChunkText({
        entityA: e.entityA, entityB: e.entityB, riskLevel: e.riskLevel,
        mechanism: e.mechanism, recommendation: e.recommendation,
        evidenceQuality: e.evidenceType, confidenceLevel: e.confidence,
      }) + (e.references ? ` Referência: ${e.references}.` : '');
      try {
        const vec = util.toVectorLiteral(await embed(texto, key));
        await client.query(
          `INSERT INTO rag_chunks (texto, fonte, fonte_ref, confiabilidade, metadata, embedding)
           VALUES ($1,'interacoes',$2,$3,$4,$5::vector)
           ON CONFLICT (fonte, fonte_ref) DO UPDATE SET texto=EXCLUDED.texto, embedding=EXCLUDED.embedding`,
          [texto, e.id, e.confidence === 'high' ? 'alta' : e.confidence === 'moderate' ? 'media' : 'baixa',
           JSON.stringify({ a: e.entityA, b: e.entityB, ref: e.references }), vec],
        );
        ok++;
      } catch (err) { fail++; console.warn(`falha ${e.id}: ${err.message}`); }
      await sleep(300);
    }
    console.log(`Concluído — tabela: ${entries.length} | RAG ok: ${ok} | falhas: ${fail}`);
  } finally { await client.end(); }
}
main().catch((e) => { console.error('Falha:', e.message); process.exit(1); });

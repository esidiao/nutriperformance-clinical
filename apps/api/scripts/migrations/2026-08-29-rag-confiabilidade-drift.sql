-- =============================================================================
-- 2026-08-29 — Correção: confiabilidade carimbada em rag_chunks
--
-- ATENÇÃO: seções 1–3 são SELECTs (leitura pura). A seção 4 é DML e está
-- COMENTADA de propósito — só rodar após revisão humana dos SELECTs, e sempre
-- via `railway run node <script>` / console do Supabase, nunca `db push`.
--
-- Contexto: até o ciclo de 2026-08-29, TRÊS caminhos de indexação gravavam a
-- confiabilidade do chunk como constante, ignorando a coluna da origem:
--   - RagSyncService.syncMissingFoods  -> 'alta'  (query filtra só `<> 'pendente'`)
--   - CurationService.updateFood       -> 'alta'  (mesmo liberando como 'baixa')
--   - ProductsService.indexInRag       -> 'media'
--
-- Efeito: RagService.search devolve `confiabilidade` do chunk, e o prompt do
-- assistente monta "[FONTE · confiabilidade alta]". Alimento classificado
-- 'media'/'baixa' pela curadoria aparecia ao profissional como alta — a
-- proveniência exibida na resposta clínica não era a real.
--
-- O código já foi corrigido (passa a coluna da origem). Este script mede e
-- corrige o resíduo dos chunks gravados antes disso.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Quantos chunks de alimento estão com confiabilidade divergente de foods
-- -----------------------------------------------------------------------------
SELECT r.confiabilidade AS confiabilidade_no_chunk,
       f.confiabilidade AS confiabilidade_real,
       count(*)::int    AS chunks
  FROM rag_chunks r
  JOIN foods f ON f.fonte = r.fonte AND f.id::text = r.fonte_ref
 WHERE r.confiabilidade IS DISTINCT FROM f.confiabilidade
 GROUP BY 1, 2
 ORDER BY chunks DESC;


-- -----------------------------------------------------------------------------
-- 2. O caso clinicamente relevante: chunk diz 'alta', o alimento não é 'alta'.
--    É o que aparece ao profissional como evidência mais forte do que é.
-- -----------------------------------------------------------------------------
SELECT r.fonte, r.fonte_ref, f.nome_padronizado, f.confiabilidade AS real
  FROM rag_chunks r
  JOIN foods f ON f.fonte = r.fonte AND f.id::text = r.fonte_ref
 WHERE r.confiabilidade = 'alta'
   AND f.confiabilidade <> 'alta'
 ORDER BY f.nome_padronizado
 LIMIT 200;


-- -----------------------------------------------------------------------------
-- 3. Mesma divergência no catálogo de produtos (fonte = 'openfoodfacts',
--    fonte_ref = EAN). Aqui o carimbo fixo era 'media'.
-- -----------------------------------------------------------------------------
SELECT r.confiabilidade AS confiabilidade_no_chunk,
       p.confiabilidade AS confiabilidade_real,
       count(*)::int    AS chunks
  FROM rag_chunks r
  JOIN industrialized_products p ON p.codigo_barras = r.fonte_ref
 WHERE r.fonte = 'openfoodfacts'
   AND r.confiabilidade IS DISTINCT FROM p.confiabilidade
 GROUP BY 1, 2
 ORDER BY chunks DESC;


-- -----------------------------------------------------------------------------
-- 4. DML — COMENTADO. Alinha o chunk à origem. Não recalcula embedding: o
--    texto do chunk não muda, só o metadado de proveniência.
--    Rodar depois de conferir as contagens acima.
-- -----------------------------------------------------------------------------
-- BEGIN;
--
-- UPDATE rag_chunks r
--    SET confiabilidade = f.confiabilidade
--   FROM foods f
--  WHERE f.fonte = r.fonte
--    AND f.id::text = r.fonte_ref
--    AND r.confiabilidade IS DISTINCT FROM f.confiabilidade;
--
-- UPDATE rag_chunks r
--    SET confiabilidade = p.confiabilidade
--   FROM industrialized_products p
--  WHERE r.fonte = 'openfoodfacts'
--    AND p.codigo_barras = r.fonte_ref
--    AND r.confiabilidade IS DISTINCT FROM p.confiabilidade;
--
-- -- Confirmar que a seção 1 zerou ANTES do COMMIT.
-- -- ROLLBACK;
-- COMMIT;

-- =============================================================================
-- 2026-08-10 — Diagnóstico: órfãos no RAG e invariante clínica do catálogo
--
-- ATENÇÃO: arquivo de DIAGNÓSTICO. As seções 1–5 são SELECTs (leitura pura).
-- A seção 6 contém DML e está COMENTADA de propósito — só rodar após revisão
-- humana dos SELECTs, e sempre via `railway run node <script>` (nunca
-- `db push` / `migrate deploy` direto).
--
-- Contexto: `rag_chunks` é populado por caminhos independentes —
--   (a) RagSyncService, incremental, para `foods`     (fonte = foods.fonte, fonte_ref = foods.id)
--   (b) ProductsService.indexInRag, fire-and-forget   (fonte = 'openfoodfacts', fonte_ref = EAN)
--   (c) scripts/embed-rag-*.js, carga manual
--
-- O fluxo de curadoria pela aplicação JÁ é consistente: CurationService.updateFood
-- apaga o chunk ao bloquear um alimento e re-indexa ao liberar. O que este
-- diagnóstico cobre são os caminhos que NÃO passam por lá — carga manual pelos
-- scripts, edição direta no banco e importações em massa —, além do resíduo
-- anterior à existência daquela lógica. Se as seções 2 e 3 vierem zeradas, é
-- exatamente o esperado.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Cobertura: alimentos publicáveis que ainda não têm chunk
--    (é o mesmo predicado do RagSyncService — mede o backlog do cron)
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (WHERE r.id IS NULL) AS sem_chunk,
  COUNT(*) FILTER (WHERE r.id IS NOT NULL) AS com_chunk,
  COUNT(*) AS total_publicavel
FROM foods f
LEFT JOIN rag_chunks r ON r.fonte = f.fonte AND r.fonte_ref = f.id::text
WHERE f.ativo = true AND f.confiabilidade <> 'pendente';


-- -----------------------------------------------------------------------------
-- 2. Chunks ZUMBI: o alimento existe, mas não é mais publicável
--
-- Estes são os mais relevantes clinicamente. `rag.service.ts` filtra por
-- `ativo = true AND confiabilidade <> 'pendente'` nas COLUNAS DE rag_chunks,
-- que são uma cópia congelada no momento da indexação — se a curadoria
-- despublicar o alimento depois, o chunk não acompanha.
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS chunks_zumbi,
  COUNT(*) FILTER (WHERE f.ativo = false) AS por_inativacao,
  COUNT(*) FILTER (WHERE f.confiabilidade = 'pendente') AS por_rependencia
FROM rag_chunks r
JOIN foods f ON f.id::text = r.fonte_ref AND f.fonte = r.fonte
WHERE f.ativo = false OR f.confiabilidade = 'pendente';


-- Amostra para conferência manual antes de qualquer limpeza.
SELECT r.id, r.fonte, r.fonte_ref, r.confiabilidade AS conf_chunk,
       f.nome_padronizado, f.ativo AS food_ativo, f.confiabilidade AS conf_food
FROM rag_chunks r
JOIN foods f ON f.id::text = r.fonte_ref AND f.fonte = r.fonte
WHERE f.ativo = false OR f.confiabilidade = 'pendente'
ORDER BY f.nome_padronizado
LIMIT 30;


-- -----------------------------------------------------------------------------
-- 3. Órfãos reais: chunk cujo registro de origem sumiu
--    `fonte_ref` é texto livre e guarda UUID (foods) ou EAN (produtos), então o
--    casting só é aplicado onde a fonte garante o formato.
-- -----------------------------------------------------------------------------
SELECT r.fonte, COUNT(*) AS orfaos
FROM rag_chunks r
WHERE r.fonte <> 'openfoodfacts'
  AND r.fonte_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND NOT EXISTS (SELECT 1 FROM foods f WHERE f.id::text = r.fonte_ref AND f.fonte = r.fonte)
GROUP BY r.fonte
ORDER BY orfaos DESC;

SELECT COUNT(*) AS produtos_orfaos
FROM rag_chunks r
WHERE r.fonte = 'openfoodfacts'
  AND NOT EXISTS (SELECT 1 FROM industrialized_products p WHERE p.codigo_barras = r.fonte_ref);


-- -----------------------------------------------------------------------------
-- 4. Higiene do índice vetorial: chunk sem embedding nunca é recuperado
--    (a busca exige `embedding IS NOT NULL`), então só ocupa espaço.
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS total_chunks,
  COUNT(*) FILTER (WHERE embedding IS NULL) AS sem_embedding,
  COUNT(*) FILTER (WHERE confiabilidade = 'pendente') AS pendentes,
  COUNT(*) FILTER (WHERE ativo = false) AS inativos
FROM rag_chunks;


-- -----------------------------------------------------------------------------
-- 5. Catálogo de suplementos: itens que a busca passou a esconder
--    O fallback de cache do SupplementsCatalogService agora filtra
--    `confiabilidade <> 'pendente'` (antes não filtrava). Confere quantos itens
--    o filtro remove — se for alto, há backlog de curadoria a tratar.
-- -----------------------------------------------------------------------------
SELECT confiabilidade, COUNT(*) AS n
FROM supplements_catalog
GROUP BY confiabilidade
ORDER BY n DESC;


-- =============================================================================
-- 6. LIMPEZA — COMENTADA. Revisar os SELECTs acima antes de habilitar.
--
-- Ordem recomendada: primeiro sincronizar o estado (6a), que é reversível
-- reindexando; só depois apagar os órfãos (6b), que não é.
-- =============================================================================

-- 6a. Propaga a despublicação do alimento para o chunk. Preferível ao DELETE:
--     a busca já ignora `ativo = false`, e o chunk volta sozinho se a curadoria
--     republicar o alimento — sem custo de reembedding no Gemini.
-- UPDATE rag_chunks r
--    SET ativo = false
--   FROM foods f
--  WHERE f.id::text = r.fonte_ref
--    AND f.fonte = r.fonte
--    AND (f.ativo = false OR f.confiabilidade = 'pendente')
--    AND r.ativo = true;

-- 6b. Remove chunks cuja origem não existe mais. Irreversível: reindexar exige
--     nova chamada de embedding.
-- DELETE FROM rag_chunks r
--  WHERE r.fonte <> 'openfoodfacts'
--    AND r.fonte_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
--    AND NOT EXISTS (SELECT 1 FROM foods f WHERE f.id::text = r.fonte_ref AND f.fonte = r.fonte);

-- =============================================================================
-- 2026-08-09 — Diagnóstico de integridade: trilha de auditoria e cobertura RAG
--
-- ATENÇÃO: este arquivo é de DIAGNÓSTICO. As seções 1–4 são SELECTs (leitura).
-- As seções 5 e 6 contêm DDL/DML e estão COMENTADAS de propósito — só devem ser
-- executadas após revisão humana dos resultados dos SELECTs, e sempre via
-- `railway run node <script>` (nunca `db push` / `migrate deploy` direto).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Trilha de auditoria: registros sem usuário correspondente
--
-- `audit_logs.user_id` guarda o UID do Supabase (req.user.sub), que corresponde
-- a `users.auth_id` — NÃO a `users.id`. A tela /admin/audit passou a fazer esse
-- JOIN; registros abaixo aparecerão sem e-mail do usuário.
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*)                                              AS total_logs,
  COUNT(*) FILTER (WHERE l.user_id IS NULL)             AS sem_user_id,
  COUNT(*) FILTER (WHERE l.user_id IS NOT NULL
                     AND u.auth_id IS NULL)             AS user_id_orfao,
  MIN(l.created_at)                                     AS log_mais_antigo,
  MAX(l.created_at)                                     AS log_mais_recente
FROM audit_logs l
LEFT JOIN users u ON u.auth_id = l.user_id;


-- Amostra dos UIDs órfãos (usuários removidos ou logs de ambiente antigo).
SELECT l.user_id, COUNT(*) AS n, MIN(l.created_at) AS primeiro, MAX(l.created_at) AS ultimo
FROM audit_logs l
LEFT JOIN users u ON u.auth_id = l.user_id
WHERE l.user_id IS NOT NULL AND u.auth_id IS NULL
GROUP BY l.user_id
ORDER BY n DESC
LIMIT 20;


-- -----------------------------------------------------------------------------
-- 2. Cobertura do RAG: alimentos publicáveis ainda não indexados
--
-- Invariante clínica: só entra no RAG o que está ativo e com confiabilidade
-- diferente de 'pendente'.
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS foods_publicaveis_sem_chunk
FROM foods f
WHERE f.ativo = true
  AND f.confiabilidade <> 'pendente'
  AND NOT EXISTS (
    SELECT 1 FROM rag_chunks c
    WHERE c.fonte = 'foods' AND c.fonte_ref = f.id::text
  );


-- Quebra por fonte, para dimensionar o backlog do RagSyncService.
SELECT f.fonte, COUNT(*) AS pendentes
FROM foods f
WHERE f.ativo = true
  AND f.confiabilidade <> 'pendente'
  AND NOT EXISTS (
    SELECT 1 FROM rag_chunks c
    WHERE c.fonte = 'foods' AND c.fonte_ref = f.id::text
  )
GROUP BY f.fonte
ORDER BY pendentes DESC;


-- -----------------------------------------------------------------------------
-- 3. Chunks órfãos: apontam para alimentos que já não existem
-- -----------------------------------------------------------------------------
SELECT c.id, c.fonte, c.fonte_ref, c.confiabilidade, c.ativo
FROM rag_chunks c
WHERE c.fonte = 'foods'
  AND NOT EXISTS (SELECT 1 FROM foods f WHERE f.id::text = c.fonte_ref)
ORDER BY c.id
LIMIT 50;


-- -----------------------------------------------------------------------------
-- 4. Chunks que violam a invariante de busca (não deveriam ser retornáveis)
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (WHERE c.embedding IS NULL)                 AS sem_embedding,
  COUNT(*) FILTER (WHERE c.confiabilidade = 'pendente')       AS pendentes,
  COUNT(*) FILTER (WHERE c.ativo = false)                     AS inativos,
  COUNT(*)                                                    AS total
FROM rag_chunks c;


-- Chunks cuja confiabilidade divergiu da do alimento de origem (curadoria
-- alterou o food mas o chunk não foi re-sincronizado).
SELECT c.id, c.fonte_ref, c.confiabilidade AS chunk_conf, f.confiabilidade AS food_conf, f.ativo
FROM rag_chunks c
JOIN foods f ON f.id::text = c.fonte_ref
WHERE c.fonte = 'foods'
  AND (c.confiabilidade IS DISTINCT FROM f.confiabilidade OR c.ativo IS DISTINCT FROM f.ativo)
LIMIT 50;


-- -----------------------------------------------------------------------------
-- 5. LIMPEZA — NÃO EXECUTAR SEM REVISAR AS SEÇÕES 3 e 4 ACIMA
-- -----------------------------------------------------------------------------
-- Desativa (não apaga) chunks órfãos, preservando histórico:
--
-- UPDATE rag_chunks c
--    SET ativo = false
--  WHERE c.fonte = 'foods'
--    AND NOT EXISTS (SELECT 1 FROM foods f WHERE f.id::text = c.fonte_ref);
--
-- Realinha confiabilidade/ativo dos chunks com o alimento de origem:
--
-- UPDATE rag_chunks c
--    SET confiabilidade = f.confiabilidade,
--        ativo          = f.ativo
--   FROM foods f
--  WHERE f.id::text = c.fonte_ref
--    AND c.fonte = 'foods'
--    AND (c.confiabilidade IS DISTINCT FROM f.confiabilidade
--         OR c.ativo IS DISTINCT FROM f.ativo);


-- -----------------------------------------------------------------------------
-- 6. ÍNDICES SUGERIDOS — NÃO EXECUTAR SEM MEDIR (ver seção 1)
--
-- A tela /admin/audit filtra por workspace_id, user_id e resource, sempre
-- ordenando por created_at DESC. Se a seção 1 mostrar volume relevante
-- (> ~100k linhas), estes índices passam a valer o custo de escrita.
-- CONCURRENTLY evita lock de escrita, mas não pode rodar dentro de transação.
-- -----------------------------------------------------------------------------
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at_desc
--   ON audit_logs (created_at DESC);
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_workspace_created
--   ON audit_logs (workspace_id, created_at DESC);
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created
--   ON audit_logs (user_id, created_at DESC);
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_created
--   ON audit_logs (resource, created_at DESC);
--
-- Suporta o JOIN users.auth_id = audit_logs.user_id da tela de auditoria:
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_id
--   ON users (auth_id);

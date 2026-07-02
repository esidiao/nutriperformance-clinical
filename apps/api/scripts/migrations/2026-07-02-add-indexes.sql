-- ============================================================================
-- NutriPerformance Clinical — Índices de performance
-- Gerado no ciclo semanal de evolução em 2026-07-02
--
-- OBJETIVO: eliminar full table scans nas colunas mais filtradas em produção.
--
-- SEGURANÇA / COMO EXECUTAR (NÃO rodar db push / migrate deploy):
--   Execute cada statement individualmente em produção via:
--     railway run node -e "..."   (ou psql conectado à instância correta sa-east-1)
--   Todos usam CREATE INDEX CONCURRENTLY + IF NOT EXISTS:
--     - CONCURRENTLY: não bloqueia escritas na tabela durante a criação (DB clínico ativo).
--     - IF NOT EXISTS: idempotente, seguro re-executar.
--   IMPORTANTE: CONCURRENTLY NÃO pode rodar dentro de um bloco de transação.
--   Rode fora de BEGIN/COMMIT (um statement por vez).
-- ============================================================================

-- foods: busca pública filtra sempre ativo = true AND confiabilidade <> 'pendente'
-- (foods.service.search / findById / RagSyncService.syncMissingFoods)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foods_ativo_confiabilidade
  ON foods (ativo, confiabilidade);

-- industrialized_products: busca pública filtra ativo + confiabilidade (products.service.search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_ativo_confiabilidade
  ON industrialized_products (ativo, confiabilidade);

-- patients: listagem por workspace (multi-tenant; clínicas com muitos pacientes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_workspace
  ON patients (workspace_id);

-- clinical_alerts: alertas por paciente (getPatientAlerts filtra patient_id + is_resolved)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clinical_alerts_patient_resolved
  ON clinical_alerts (patient_id, is_resolved);

-- clinical_alerts: painel do dashboard filtra workspace_id + is_resolved
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clinical_alerts_workspace_resolved
  ON clinical_alerts (workspace_id, is_resolved);

-- patient_supplementations: consulta por (workspace_id, patient_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patient_suppl_workspace_patient
  ON patient_supplementations (workspace_id, patient_id);

-- interaction_analyses: histórico por paciente
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interaction_analyses_patient
  ON interaction_analyses (patient_id);

-- rag_chunks: LEFT JOIN do RagSyncService por (fonte, fonte_ref) para achar chunks faltantes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_chunks_fonte_ref
  ON rag_chunks (fonte, fonte_ref);

-- OPCIONAL (busca textual ILIKE '%termo%' em nome_padronizado / nome_comercial):
-- Requer a extensão pg_trgm. Avaliar custo/benefício antes de habilitar em prod.
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foods_nome_trgm
--     ON foods USING gin (nome_padronizado gin_trgm_ops);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_nome_trgm
--     ON industrialized_products USING gin (nome_comercial gin_trgm_ops);

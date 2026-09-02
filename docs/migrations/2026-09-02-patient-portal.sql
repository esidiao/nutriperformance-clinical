-- =============================================================
-- Portal do paciente — lacuna 2 do benchmark competitivo
--
-- TERCEIRA superfície pública, e a de MAIOR exposição:
--   anamnese  -> não devolve dado nenhum; pergunta
--   diário    -> devolve o que o próprio paciente enviou
--   portal    -> devolve CONTEÚDO CLÍNICO PRESCRITO
--
-- Por isso: validade menor, revogação a qualquer momento, e registro do último
-- acesso para a profissional saber se o link está em uso.
--
-- Não há conta de paciente. É escolha, não atalho: conta traz cadastro, senha,
-- recuperação e consentimento — superfície que não se justifica antes de a
-- plataforma ser testada.
--
-- Idempotente.
-- =============================================================

CREATE TABLE IF NOT EXISTS patient_portal_links (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  created_by        UUID NOT NULL,

  token_hash        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'ativo',
  expira_em         TIMESTAMPTZ NOT NULL,
  ultimo_acesso_em  TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT patient_portal_status_check CHECK (status IN ('ativo', 'revogado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_portal_token
  ON patient_portal_links (token_hash);

CREATE INDEX IF NOT EXISTS idx_patient_portal_paciente
  ON patient_portal_links (workspace_id, patient_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE patient_portal_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_portal_select ON patient_portal_links;
CREATE POLICY patient_portal_select ON patient_portal_links
  FOR SELECT USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS patient_portal_insert ON patient_portal_links;
CREATE POLICY patient_portal_insert ON patient_portal_links
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS patient_portal_update ON patient_portal_links;
CREATE POLICY patient_portal_update ON patient_portal_links
  FOR UPDATE USING (workspace_id = auth_workspace_id());

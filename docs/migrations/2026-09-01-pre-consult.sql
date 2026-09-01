-- =============================================================
-- Anamnese pré-consulta — lacuna 8 do benchmark competitivo
--
-- PRIMEIRA superfície pública do sistema: o paciente responde por link, sem
-- login. As decisões de segurança estão nas colunas abaixo.
--
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================

CREATE TABLE IF NOT EXISTS pre_consult_forms (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id         UUID NOT NULL REFERENCES workspaces(id),
  patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  appointment_id       UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_by           UUID NOT NULL,

  -- HASH do token (SHA-256), nunca o token em claro. Vazamento do banco não
  -- entrega acesso a formulário nenhum — mesmo raciocínio de senha.
  token_hash           TEXT NOT NULL,

  status               TEXT NOT NULL DEFAULT 'pendente',

  -- Todo link expira. Link de anamnese sem prazo vira porta permanente para
  -- dado de saúde, muito depois de a consulta ter acontecido.
  expira_em            TIMESTAMPTZ NOT NULL,

  -- Versão do questionário no envio. Sem ela, resposta de hoje seria lida
  -- amanhã contra perguntas diferentes — adulteração silenciosa de registro.
  versao_questionario  INTEGER NOT NULL DEFAULT 1,

  respostas            JSONB,
  respondido_em        TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pre_consult_status_check CHECK (status IN (
    'pendente', 'respondido', 'cancelado'
  )),
  -- Respondido sem resposta e sem data é registro que ninguém audita depois.
  CONSTRAINT pre_consult_respondido_coerente CHECK (
    status <> 'respondido' OR (respostas IS NOT NULL AND respondido_em IS NOT NULL)
  )
);

-- Único: é o caminho de leitura da rota pública e não pode colidir.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pre_consult_token
  ON pre_consult_forms (token_hash);

CREATE INDEX IF NOT EXISTS idx_pre_consult_paciente
  ON pre_consult_forms (workspace_id, patient_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Vale para o acesso autenticado. A rota pública roda pela conexão da API, que
-- localiza o registro pelo hash do token — o token É a autorização ali.
ALTER TABLE pre_consult_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pre_consult_select ON pre_consult_forms;
CREATE POLICY pre_consult_select ON pre_consult_forms
  FOR SELECT USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS pre_consult_insert ON pre_consult_forms;
CREATE POLICY pre_consult_insert ON pre_consult_forms
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS pre_consult_update ON pre_consult_forms;
CREATE POLICY pre_consult_update ON pre_consult_forms
  FOR UPDATE USING (workspace_id = auth_workspace_id());

-- Sem DELETE: resposta de anamnese e registro clinico. Cancela-se o link,
-- nao se apaga o que o paciente respondeu.

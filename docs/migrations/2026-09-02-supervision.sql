-- =============================================================
-- Fluxo de supervisão — lacuna 15 do benchmark competitivo
--
-- O papel `supervised_student` já existia e podia criar plano alimentar como
-- qualquer profissional. Faltava o ato que dá sentido ao estágio: alguém
-- habilitado revisar antes de aquilo chegar ao paciente.
--
-- Idempotente.
-- =============================================================

CREATE TABLE IF NOT EXISTS supervision_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id),

  recurso       TEXT NOT NULL,
  recurso_id    UUID NOT NULL,

  -- Sem FK para users: guardam o UUID do Supabase Auth, que é a identidade
  -- que chega no token.
  estudante_id  UUID NOT NULL,
  supervisor_id UUID,

  status        TEXT NOT NULL DEFAULT 'pendente',
  parecer       TEXT,
  decidido_em   TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT supervision_recurso_check CHECK (recurso IN (
    'meal_plan', 'nutritional_assessment', 'physical_assessment'
  )),
  CONSTRAINT supervision_status_check CHECK (status IN (
    'pendente', 'aprovado', 'ajustes_solicitados'
  )),
  -- Decidido sem quem decidiu e quando é registro que ninguem audita depois —
  -- e aqui o que se audita e responsabilidade profissional.
  CONSTRAINT supervision_decisao_coerente CHECK (
    status = 'pendente'
    OR (supervisor_id IS NOT NULL AND decidido_em IS NOT NULL)
  ),
  -- "Ajustes solicitados" sem parecer nao ensina nada, e estagio e lugar de
  -- ensinar. O servico ja exige; o banco garante.
  CONSTRAINT supervision_parecer_check CHECK (
    status <> 'ajustes_solicitados' OR parecer IS NOT NULL
  ),
  -- Ninguem supervisiona o proprio trabalho.
  CONSTRAINT supervision_nao_autoaprovacao CHECK (
    supervisor_id IS NULL OR supervisor_id <> estudante_id
  )
);

-- Fila do supervisor.
CREATE INDEX IF NOT EXISTS idx_supervision_fila
  ON supervision_requests (workspace_id, status, created_at);

-- Situação de um trabalho específico.
CREATE INDEX IF NOT EXISTS idx_supervision_recurso
  ON supervision_requests (workspace_id, recurso, recurso_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE supervision_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supervision_select ON supervision_requests;
CREATE POLICY supervision_select ON supervision_requests
  FOR SELECT USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS supervision_insert ON supervision_requests;
CREATE POLICY supervision_insert ON supervision_requests
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS supervision_update ON supervision_requests;
CREATE POLICY supervision_update ON supervision_requests
  FOR UPDATE USING (workspace_id = auth_workspace_id());

-- =============================================================
-- Agenda de consultas — lacuna 3 do benchmark competitivo
--
-- Aplicar com:
--   PGURL=... node scripts/aplicar-sql.mjs docs/migrations/2026-09-01-appointments.sql
-- ou colando no editor SQL do Supabase.
--
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================

CREATE TABLE IF NOT EXISTS appointments (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id         UUID NOT NULL REFERENCES workspaces(id),
  patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,

  -- Dono da agenda. Numa clínica com várias profissionais, o conflito de
  -- horário é de cada uma — não do workspace inteiro. Sem FK para users
  -- porque a coluna guarda o UUID do Supabase Auth, que é a identidade que
  -- chega no token.
  profissional_id      UUID NOT NULL,
  created_by           UUID NOT NULL,

  -- timestamptz e não timestamp: o servidor roda em UTC e a profissional pensa
  -- em horário de Brasília. Sem fuso, a consulta das 14h apareceria às 17h.
  inicio               TIMESTAMPTZ NOT NULL,
  fim                  TIMESTAMPTZ NOT NULL,

  tipo                 TEXT NOT NULL DEFAULT 'retorno',
  status               TEXT NOT NULL DEFAULT 'agendada',

  observacoes          TEXT,
  motivo_cancelamento  TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT appointments_tipo_check CHECK (tipo IN (
    'primeira_consulta', 'retorno', 'avaliacao', 'online'
  )),
  CONSTRAINT appointments_status_check CHECK (status IN (
    'agendada', 'confirmada', 'realizada', 'faltou', 'cancelada'
  )),
  -- Uma consulta que termina antes de começar é dado corrompido, não regra de
  -- negócio: o banco recusa mesmo que a aplicação falhe.
  CONSTRAINT appointments_janela_check CHECK (fim > inicio)
);

-- Consulta quente: agenda de um profissional num intervalo.
CREATE INDEX IF NOT EXISTS idx_appointments_agenda
  ON appointments (workspace_id, profissional_id, inicio);

-- Histórico de consultas de um paciente.
CREATE INDEX IF NOT EXISTS idx_appointments_paciente
  ON appointments (workspace_id, patient_id, inicio DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_select ON appointments;
CREATE POLICY appointments_select ON appointments
  FOR SELECT USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS appointments_insert ON appointments;
CREATE POLICY appointments_insert ON appointments
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS appointments_update ON appointments;
CREATE POLICY appointments_update ON appointments
  FOR UPDATE USING (workspace_id = auth_workspace_id());

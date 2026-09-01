-- =============================================================
-- Controle financeiro — lacuna 4 do benchmark competitivo
--
-- Registro de recebimento por paciente. NÃO é meio de pagamento: não há
-- gateway, cobrança nem dado de cartão. É o contas-a-receber da profissional.
--
-- Aplicar com:
--   PGURL=... node scripts/aplicar-sql.mjs docs/migrations/2026-09-01-charges.sql
-- ou colando no editor SQL do Supabase.
--
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================

CREATE TABLE IF NOT EXISTS charges (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id         UUID NOT NULL REFERENCES workspaces(id),
  patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,

  -- Consulta de origem, quando houver. Nulo é caso legítimo: pacote fechado,
  -- avulso e taxa de retorno não nascem de uma consulta.
  appointment_id       UUID REFERENCES appointments(id) ON DELETE SET NULL,

  -- A quem a receita pertence. Sem FK para users: guarda o UUID do Supabase
  -- Auth, que é a identidade que chega no token.
  profissional_id      UUID NOT NULL,
  created_by           UUID NOT NULL,

  descricao            TEXT NOT NULL,

  -- CENTAVOS inteiros, não NUMERIC/FLOAT. Ponto flutuante acumula erro ao somar
  -- centenas de lançamentos e o fechamento do mês passa a divergir sem que a
  -- profissional consiga rastrear a origem. Inteiro fecha exato.
  valor_centavos       INTEGER NOT NULL,

  -- Recebido, separado do cobrado: desconto e pagamento parcial existem, e
  -- forçar igualdade obrigaria a registrar mentira.
  valor_pago_centavos  INTEGER,

  status               TEXT NOT NULL DEFAULT 'pendente',
  vencimento           DATE NOT NULL,
  pago_em              TIMESTAMPTZ,
  forma_pagamento      TEXT,

  observacoes          TEXT,
  motivo_cancelamento  TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Cobrança de zero ou negativa é dado corrompido. Isenção tem status
  -- próprio ('isento'), não valor zero: atendimento gratuito não é receita
  -- recebida, e confundir os dois distorce o faturamento.
  CONSTRAINT charges_valor_check CHECK (valor_centavos > 0),
  CONSTRAINT charges_valor_pago_check CHECK (
    valor_pago_centavos IS NULL OR valor_pago_centavos >= 0
  ),
  CONSTRAINT charges_status_check CHECK (status IN (
    'pendente', 'pago', 'isento', 'cancelado'
  )),
  CONSTRAINT charges_forma_check CHECK (forma_pagamento IS NULL OR forma_pagamento IN (
    'dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'convenio', 'outro'
  )),
  -- Um lançamento pago sem data e sem valor recebido é um pago que ninguém
  -- consegue auditar depois.
  CONSTRAINT charges_pago_coerente CHECK (
    status <> 'pago' OR (pago_em IS NOT NULL AND valor_pago_centavos IS NOT NULL)
  )
);

-- Consulta quente: contas a receber por vencimento.
CREATE INDEX IF NOT EXISTS idx_charges_vencimento
  ON charges (workspace_id, status, vencimento);

-- Extrato de um paciente.
CREATE INDEX IF NOT EXISTS idx_charges_paciente
  ON charges (workspace_id, patient_id, vencimento DESC);

-- Fechamento por profissional.
CREATE INDEX IF NOT EXISTS idx_charges_profissional
  ON charges (workspace_id, profissional_id, pago_em);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS charges_select ON charges;
CREATE POLICY charges_select ON charges
  FOR SELECT USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS charges_insert ON charges;
CREATE POLICY charges_insert ON charges
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS charges_update ON charges;
CREATE POLICY charges_update ON charges
  FOR UPDATE USING (workspace_id = auth_workspace_id());

-- Sem policy de DELETE, de propósito: lançamento financeiro não se apaga, se
-- cancela com motivo. Apagar destrói a trilha de auditoria do faturamento.

-- =============================================================
-- Plano alimentar — lacuna nº 1 do benchmark competitivo
--
-- Aplicar em produção com:
--   railway run node scripts/apply-sql.js docs/migrations/2026-08-31-meal-plans.sql
-- ou, no psql do Supabase, colar o conteúdo abaixo.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- =============================================================

-- ── MEAL_PLANS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  workspace_id        UUID NOT NULL REFERENCES workspaces(id),
  created_by          UUID NOT NULL,

  nome                TEXT NOT NULL,
  objetivo            TEXT,

  data_inicio         DATE,
  data_fim            DATE,

  -- Metas copiadas da avaliação nutricional no momento da prescrição.
  -- Não são lidas da avaliação a cada consulta: ela pode ser refeita depois, e
  -- o plano entregue precisa seguir mostrando a meta que o justificou.
  meta_kcal           NUMERIC(8,2),
  meta_proteinas_g    NUMERIC(7,2),
  meta_carboidratos_g NUMERIC(7,2),
  meta_lipidios_g     NUMERIC(7,2),

  observacoes         TEXT,
  orientacoes_gerais  TEXT,

  is_draft            BOOLEAN NOT NULL DEFAULT TRUE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Listagem por paciente é a consulta quente da tela; o filtro is_active entra
-- no índice porque planos removidos logicamente nunca são listados.
CREATE INDEX IF NOT EXISTS idx_meal_plans_patient
  ON meal_plans (workspace_id, patient_id, created_at DESC)
  WHERE is_active;

-- ── MEAL_PLAN_ITEMS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plan_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id     UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  workspace_id     UUID NOT NULL REFERENCES workspaces(id),

  refeicao         TEXT NOT NULL,
  horario          TEXT,
  ordem            INTEGER NOT NULL DEFAULT 0,

  -- Procedência do dado. Sem FK para foods de propósito: um alimento pode ser
  -- desativado pela curadoria, e o item do plano precisa sobreviver a isso.
  food_id          UUID,
  fonte            TEXT,

  alimento_nome    TEXT NOT NULL,
  quantidade_g     NUMERIC(8,2) NOT NULL CHECK (quantidade_g > 0),
  medida_caseira   TEXT,

  -- Cópia nutricional já multiplicada pela quantidade do item. Ver nota acima:
  -- o plano é registro clínico e não pode mudar quando a base muda.
  kcal             NUMERIC(8,2) NOT NULL DEFAULT 0,
  proteinas_g      NUMERIC(7,2) NOT NULL DEFAULT 0,
  carboidratos_g   NUMERIC(7,2) NOT NULL DEFAULT 0,
  lipidios_g       NUMERIC(7,2) NOT NULL DEFAULT 0,
  fibras_g         NUMERIC(7,2) NOT NULL DEFAULT 0,
  sodio_mg         NUMERIC(8,2) NOT NULL DEFAULT 0,

  substituicoes    JSONB NOT NULL DEFAULT '[]',
  observacao       TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT meal_plan_items_refeicao_check CHECK (refeicao IN (
    'cafe_manha', 'lanche_manha', 'almoco', 'lanche_tarde',
    'jantar', 'ceia', 'pre_treino', 'pos_treino'
  ))
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_items_plano
  ON meal_plan_items (meal_plan_id, refeicao, ordem);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Mesmo padrão das demais tabelas clínicas: isolamento por workspace direto no
-- banco, para que um erro na camada de aplicação não vaze dados entre clínicas.
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_plans_select ON meal_plans;
CREATE POLICY meal_plans_select ON meal_plans
  FOR SELECT USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS meal_plans_insert ON meal_plans;
CREATE POLICY meal_plans_insert ON meal_plans
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS meal_plans_update ON meal_plans;
CREATE POLICY meal_plans_update ON meal_plans
  FOR UPDATE USING (workspace_id = auth_workspace_id());

ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_plan_items_select ON meal_plan_items;
CREATE POLICY meal_plan_items_select ON meal_plan_items
  FOR SELECT USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS meal_plan_items_insert ON meal_plan_items;
CREATE POLICY meal_plan_items_insert ON meal_plan_items
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS meal_plan_items_update ON meal_plan_items;
CREATE POLICY meal_plan_items_update ON meal_plan_items
  FOR UPDATE USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS meal_plan_items_delete ON meal_plan_items;
CREATE POLICY meal_plan_items_delete ON meal_plan_items
  FOR DELETE USING (workspace_id = auth_workspace_id());

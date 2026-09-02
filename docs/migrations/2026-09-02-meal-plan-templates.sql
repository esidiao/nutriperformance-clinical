-- =============================================================
-- Modelos de plano alimentar — lacuna 10 do benchmark competitivo
--
-- Um modelo é um plano sem paciente: mesma estrutura (refeições, itens,
-- metas), reutilizável em qualquer atendimento do workspace.
--
-- Vive na MESMA tabela dos planos de propósito. Tabela separada duplicaria
-- toda a lógica de itens, e as duas cópias divergiriam na primeira mudança.
--
-- Idempotente.
-- =============================================================

ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

-- Modelo não tem paciente. Precisa afrouxar o NOT NULL para permitir isso.
ALTER TABLE meal_plans
  ALTER COLUMN patient_id DROP NOT NULL;

-- A CHECK devolve o rigor que o NOT NULL dava, agora condicionado:
--   modelo  => patient_id É nulo
--   plano   => patient_id NÃO é nulo
--
-- Sem ela, afrouxar o NOT NULL abriria espaço para um plano de paciente ficar
-- órfão por engano — e um plano alimentar sem dono é registro clínico que não
-- pertence a prontuário nenhum.
--
-- As linhas existentes passam: todas têm paciente e is_template = false.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meal_plans_template_check'
  ) THEN
    ALTER TABLE meal_plans
      ADD CONSTRAINT meal_plans_template_check CHECK (
        (is_template AND patient_id IS NULL)
        OR (NOT is_template AND patient_id IS NOT NULL)
      );
  END IF;
END $$;

-- Listagem de modelos do workspace.
CREATE INDEX IF NOT EXISTS idx_meal_plans_modelos
  ON meal_plans (workspace_id, is_template, is_active);

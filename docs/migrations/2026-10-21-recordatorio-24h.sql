-- Recordatorio alimentar de 24 horas.
--
-- POR QUE EM TABELA PROPRIA, e nao reaproveitando `meal_plans`
--
-- Sao instrumentos clinicos OPOSTOS:
--   plano alimentar = o que foi PRESCRITO; documento assinado, entregue ao
--                     paciente, ato privativo do nutricionista
--   recordatorio    = o que o paciente RELATOU ter comido; instrumento de
--                     avaliacao de consumo, nao se assina nem se entrega
--
-- Guardar os dois na mesma tabela com um campo `tipo` economizaria codigo e
-- criaria o risco que importa: um recordatorio sair impresso como prescricao,
-- ou entrar na lista de planos do paciente. A separacao e a protecao.
--
-- O que E compartilhado e a CONTA: os itens guardam os mesmos campos
-- nutricionais de `meal_plan_items`, com a mesma escala por 100 g e a mesma
-- semantica de ausencia. Assim o relatorio de adequacao serve aos dois sem
-- nenhuma conversao.
--
-- ADITIVA: nada existente muda.
--
-- ORDEM: aplicar ANTES de subir a API.
--
-- Idempotente.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS dietary_recall_items;
--   DROP TABLE IF EXISTS dietary_recalls;

CREATE TABLE IF NOT EXISTS dietary_recalls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  patient_id      uuid NOT NULL,
  created_by      uuid NOT NULL,

  -- O DIA que o paciente esta recordando, que nao e o dia da consulta.
  -- Um recordatorio feito na segunda costuma cobrir o domingo, e domingo nao
  -- representa a rotina — por isso a data precisa ser explicita, nao inferida.
  data_referencia date NOT NULL,

  -- Dia util ou fim de semana. Muda a leitura do consumo e e a primeira coisa
  -- que se pergunta ao interpretar o resultado.
  tipo_de_dia     text,

  observacao      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dietary_recalls_paciente
  ON dietary_recalls (workspace_id, patient_id, data_referencia DESC);

CREATE TABLE IF NOT EXISTS dietary_recall_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_id       uuid NOT NULL REFERENCES dietary_recalls(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL,

  refeicao        text NOT NULL,
  horario         text,
  ordem           integer NOT NULL DEFAULT 0,

  -- Procedencia: de onde veio, nao de onde se le. Mesma razao de
  -- meal_plan_items — a curadoria pode mudar o alimento depois, e o registro
  -- precisa mostrar o que foi contabilizado na epoca.
  food_id         uuid,
  fonte           text,
  alimento_nome   text NOT NULL,

  quantidade_g    numeric(8,2) NOT NULL,
  medida_caseira  text,

  -- Copia nutricional, JA multiplicada pela quantidade.
  kcal            numeric(8,2) NOT NULL DEFAULT 0,
  proteinas_g     numeric(7,2) NOT NULL DEFAULT 0,
  carboidratos_g  numeric(7,2) NOT NULL DEFAULT 0,
  lipidios_g      numeric(7,2) NOT NULL DEFAULT 0,
  fibras_g        numeric(7,2) NOT NULL DEFAULT 0,
  sodio_mg        numeric(8,2) NOT NULL DEFAULT 0,

  -- Chave ausente = a base nao tem o dado; zero = o alimento nao fornece.
  -- A distincao sustenta o relatorio de adequacao e nao deve ser achatada.
  micronutrientes jsonb NOT NULL DEFAULT '{}'::jsonb,

  observacao      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dietary_recall_items_recall
  ON dietary_recall_items (recall_id, refeicao);

COMMENT ON TABLE dietary_recalls IS
  'Recordatorio de 24h: o que o paciente RELATOU ter comido. Instrumento de '
  'avaliacao de consumo — nao e prescricao e nao se assina.';

COMMENT ON COLUMN dietary_recalls.data_referencia IS
  'O dia recordado, nao o dia da consulta.';

COMMENT ON COLUMN dietary_recall_items.micronutrientes IS
  'Micronutrientes JA multiplicados pela quantidade. Chave ausente = sem dado '
  'na base; zero = o alimento nao fornece.';

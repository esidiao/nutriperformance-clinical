-- Medidas caseiras dos alimentos.
--
-- POR QUE EM TABELA PROPRIA
--
-- Um alimento tem VARIAS medidas: o arroz cozido pesa 25 g numa colher de
-- sopa, 45 g numa colher de servir, 100 g numa concha e 200 g num prato
-- fundo cheio. Guardar "a" medida numa coluna exigiria escolher uma e
-- descartar as outras -- e a que serve depende do que a paciente relatou,
-- que e justamente o que nao se sabe de antemao.
--
-- POR QUE ISTO IMPORTA CLINICAMENTE
--
-- Hoje a base tem 597 alimentos e NENHUM tem medida caseira. A lista de
-- substituicoes sai em gramas, e "87 g de batata" exige balanca. "2 colheres
-- de servir" e o que o paciente consegue seguir. Era a lacuna entre uma
-- lista que fecha a conta e uma lista que alguem usa.
--
-- A FONTE
--
-- IBGE, Pesquisa de Orcamentos Familiares 2008-2009, "Tabela de Medidas
-- Referidas para os Alimentos Consumidos no Brasil". Arquivo publico: o
-- proprio portal declara "Todos os arquivos aqui disponiveis sao publicos".
-- A procedencia fica gravada em `fonte`, porque a TACO nao tem medidas e
-- misturar as duas origens sem marca tornaria impossivel saber de onde veio
-- um numero que a profissional contestasse.
--
-- ADITIVA: nada existente muda.
--
-- Idempotente.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS food_measures;

CREATE TABLE IF NOT EXISTS food_measures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  food_id       uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,

  -- "colher de sopa", "concha", "fatia media". Como o paciente fala.
  medida        text NOT NULL,

  -- Quanto pesa UMA unidade dessa medida, em gramas.
  gramas        numeric(8,2) NOT NULL CHECK (gramas > 0),

  -- A medida de referencia daquele alimento na fonte. Serve para a tela
  -- oferecer primeiro a que faz sentido: para arroz e a colher de servir,
  -- para leite e o copo.
  padrao        boolean NOT NULL DEFAULT false,

  -- De onde veio. Mesma razao da coluna `fonte` em `foods`.
  fonte         text NOT NULL DEFAULT 'ibge_pof',
  fonte_versao  text,

  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Um alimento nao tem duas vezes a mesma medida. Sem isto, reexecutar a
  -- importacao duplicaria as 11.807 linhas em silencio.
  CONSTRAINT food_measures_unicas UNIQUE (food_id, medida)
);

CREATE INDEX IF NOT EXISTS idx_food_measures_alimento
  ON food_measures (food_id, padrao DESC);

COMMENT ON TABLE food_measures IS
  'Medidas caseiras por alimento. Um alimento tem varias: colher de sopa, '
  'concha, prato. A que serve depende do que o paciente relatou.';

COMMENT ON COLUMN food_measures.gramas IS
  'Peso de UMA unidade da medida. Nao e o peso da porcao prescrita.';

COMMENT ON COLUMN food_measures.padrao IS
  'A medida de referencia do alimento na fonte: a que a tela oferece '
  'primeiro.';

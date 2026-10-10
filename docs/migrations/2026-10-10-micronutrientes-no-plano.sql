-- Micronutrientes copiados para os itens do plano alimentar.
--
-- POR QUE
--
-- `meal_plan_items` guardava seis campos (kcal, proteina, carboidrato,
-- lipidio, fibra, sodio). O relatorio de adequacao pedido pela nutricionista
-- compara a dieta com a recomendacao diaria — e sem micronutriente no item nao
-- ha o que somar.
--
-- POR QUE JSONB E NAO 11 COLUNAS
--
-- A lista de nutrientes VAI mudar. A professora ja nomeou dez que faltam
-- (vitamina D, B12, folato, E, K, selenio, fosforo, cobre, manganes, iodo) e
-- que dependem de outra fonte de composicao alem da TACO. Com colunas, cada
-- nutriente novo seria uma migracao mais um deploy — e neste projeto o deploy
-- e justamente a etapa que mais falhou. Com jsonb, acrescentar nutriente e
-- mudanca de codigo.
--
-- A soma acontece em JavaScript (`MealPlansService.somar`), nao em SQL, entao
-- nao se perde nada em agregacao.
--
-- SEMANTICA QUE PRECISA SER PRESERVADA
--
-- Chave AUSENTE significa "a base nao tem esse dado para este alimento".
-- Valor ZERO significa "este alimento nao fornece esse nutriente". Sao coisas
-- diferentes, e o relatorio de adequacao depende da distincao: somar como zero
-- o que esta ausente produziria um total menor que parece numero real e levaria
-- a um "abaixo da recomendacao" falso.
--
-- Por isso o default e '{}' (nenhum dado), nunca um objeto com zeros.
--
-- ADITIVA e com default: linhas existentes ficam com '{}', que e exatamente o
-- que elas sao — itens gravados antes de existir copia de micronutriente.
--
-- ORDEM: aplicar ANTES de subir a API. O TypeORM faz SELECT de todas as
-- colunas da entidade.
--
-- Idempotente.
--
-- ROLLBACK:
--   ALTER TABLE meal_plan_items DROP COLUMN IF EXISTS micronutrientes;

ALTER TABLE meal_plan_items
  ADD COLUMN IF NOT EXISTS micronutrientes jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN meal_plan_items.micronutrientes IS
  'Micronutrientes do item, JA multiplicados pela quantidade. Chave ausente = '
  'a base nao tem o dado para este alimento; zero = o alimento nao fornece. A '
  'distincao e usada pelo relatorio de adequacao e nao deve ser achatada.';

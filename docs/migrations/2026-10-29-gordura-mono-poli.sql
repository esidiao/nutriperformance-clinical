-- Gordura monoinsaturada e poli-insaturada dos alimentos.
--
-- POR QUE DUAS COLUNAS, E NAO UMA DE "INSATURADA"
--
-- A tela mostra hoje uma "insaturada" DEDUZIDA por subtracao
-- (lipidio - saturada - trans). Ela e exata quando as tres parcelas sao
-- conhecidas, mas junta mono com poli -- e a nutricionista pediu os lipidios
-- SEPARADOS, porque a recomendacao clinica distingue os dois.
--
-- A planilha oficial do NEPA/UNICAMP publica os dois medidos, em colunas
-- proprias da aba `AGtaco3`. Guardar a soma jogaria fora a distincao que e
-- justamente o motivo de importar.
--
-- O QUE MUDA NA TELA
--
-- Com mono e poli conhecidos, o bloco de lipidios passa a mostrar valor
-- MEDIDO em vez de deduzido. Quando faltarem, a deducao continua valendo --
-- medido ganha de deduzido, deduzido ganha de nada.
--
-- A FONTE
--
-- TACO 4a edicao revisada e ampliada (NEPA/UNICAMP), planilha oficial:
-- nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/Taco-4a-Edicao.xlsx
-- Aba `AGtaco3`, colunas "Monoinsaturados (g)" e "Poliinsaturados (g)".
-- 423 dos 597 alimentos da TACO tem os dois.
--
-- A tabela do IBGE NAO publica mono e poli: os 1971 alimentos de la ficam
-- NULOS nestas colunas e continuam usando a deducao. Isso e esperado, nao
-- defeito -- e e por isso que a tela precisa saber conviver com os dois
-- casos.
--
-- SEGURANCA DESTA MIGRACAO
--
-- Aditiva e reversivel: duas colunas NULAVEIS, sem default, sem indice, sem
-- toque em linha existente. Nenhuma leitura atual quebra, porque nenhuma
-- consulta cita estas colunas antes de o codigo novo subir.
--
-- ORDEM: aplicar este SQL ANTES de subir o codigo que le as colunas. O
-- TypeORM faz SELECT das colunas declaradas na entidade -- se a entidade
-- subir antes da coluna existir, TODA consulta de alimento falha.
--
-- ROLLBACK:
--   ALTER TABLE foods
--     DROP COLUMN IF EXISTS gordura_monoinsaturada_g,
--     DROP COLUMN IF EXISTS gordura_poliinsaturada_g;

ALTER TABLE foods
  ADD COLUMN IF NOT EXISTS gordura_monoinsaturada_g numeric(6,3),
  ADD COLUMN IF NOT EXISTS gordura_poliinsaturada_g numeric(6,3);

COMMENT ON COLUMN foods.gordura_monoinsaturada_g IS
  'Acidos graxos monoinsaturados, g/100g. NULO = nao analisado pela fonte, '
  'que e diferente de 0. TACO: aba AGtaco3 da planilha oficial do NEPA. '
  'IBGE nao publica.';

COMMENT ON COLUMN foods.gordura_poliinsaturada_g IS
  'Acidos graxos poli-insaturados, g/100g. NULO = nao analisado pela fonte, '
  'que e diferente de 0. TACO: aba AGtaco3 da planilha oficial do NEPA. '
  'IBGE nao publica.';

-- Confere: as duas colunas existem e estao vazias (a carga e por script).
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'foods'
   AND column_name IN ('gordura_monoinsaturada_g', 'gordura_poliinsaturada_g')
 ORDER BY column_name;

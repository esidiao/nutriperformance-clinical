-- Alinha token_costs com as operacoes que o codigo realmente cobra.
--
-- Cinco operacoes consumiam tokens com custo fixo no codigo e nao tinham linha
-- nesta tabela. A consequencia nao era "rodar de graca" — era pior:
-- TokenBalanceGuard faz `if (!cost) return true`, entao o portao de saldo era
-- PULADO. A chamada ao Gemini acontecia, custava de verdade, e so depois o
-- consume() recusava por saldo insuficiente. A plataforma pagava a inferencia e
-- o usuario recebia um erro.
--
-- Os valores abaixo sao os mesmos que ja estavam fixos no codigo. Ninguem passa
-- a pagar mais nem menos por causa desta migracao — o que muda e que o saldo
-- passa a ser conferido ANTES da chamada paga, e que o preco passa a poder ser
-- editado pelo painel de admin.
--
-- Idempotente: pode rodar duas vezes.

BEGIN;

-- 1. `lab_analysis` e o nome ANTIGO de `laboratory_analysis`. Renomear em vez de
--    inserir uma linha nova: dois registros para a mesma operacao deixariam um
--    preco fantasma na lista publica, comprado por ninguem e editavel por
--    engano. Se `laboratory_analysis` ja existir, a linha velha e removida.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM token_costs WHERE operation = 'lab_analysis') THEN
    IF EXISTS (SELECT 1 FROM token_costs WHERE operation = 'laboratory_analysis') THEN
      DELETE FROM token_costs WHERE operation = 'lab_analysis';
    ELSE
      UPDATE token_costs
         SET operation = 'laboratory_analysis',
             description = 'Análise de exames laboratoriais com IA'
       WHERE operation = 'lab_analysis';
    END IF;
  END IF;
END $$;

-- 2. As operacoes que faltavam, com o custo que ja estava fixo no codigo.
INSERT INTO token_costs (operation, tokens_cost, description) VALUES
  ('laboratory_analysis',            10, 'Análise de exames laboratoriais com IA'),
  ('nutritional_assessment_summary',  8, 'Resumo da avaliação nutricional com IA'),
  ('assistant_query',                 5, 'Consulta ao assistente nutricional (RAG)'),
  ('nutritional_audio_intake',       15, 'Transcrição da consulta nutricional'),
  ('physical_audio_intake',          15, 'Transcrição da avaliação física')
ON CONFLICT (operation) DO NOTHING;

-- 3. Precos sem nenhum caminho no codigo. Removidos a pedido (03/09/2026),
--    com o produto ainda em testes.
--
--    Os valores ficam registrados AQUI para poderem ser recolocados sem
--    arqueologia quando os recursos existirem:
--
--      nutritional_assessment_ai   10  Avaliação nutricional com IA
--      physical_assessment_ai       5  Avaliação física com IA
--      goal_ai_suggestion           5  Sugestão de meta com IA
--      clinical_alert_processing    2  Processamento de alerta clínico
--
--    Sao apenas linhas de tarifa: nenhuma delas era cobrada, porque nenhuma
--    tem consume() no codigo. Remover nao cancela cobranca de ninguem nem
--    apaga historico — `token_transactions` e outra tabela e nao e tocada.
DELETE FROM token_costs
 WHERE operation IN (
   'nutritional_assessment_ai',
   'physical_assessment_ai',
   'goal_ai_suggestion',
   'clinical_alert_processing'
 );

COMMIT;

-- --------------------------------------------------------------------------
-- Fica registrado:
--
-- `laboratory_pdf_extraction` segue SEM preco de proposito. A extracao alimenta
-- o registro do exame, que ja custa 10 tokens em `laboratory_analysis`: cobrar
-- as duas seria cobrar duas vezes pelo mesmo ato clinico. O @RequiresTokens que
-- estava na rota foi removido, porque decorator que nao cobra nada engana quem
-- le. O limite de 6 chamadas por minuto continua sendo a protecao contra abuso.
-- --------------------------------------------------------------------------

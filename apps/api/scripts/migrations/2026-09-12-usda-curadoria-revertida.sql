-- ============================================================================
-- 2026-09-12 — Reparo: decisões de curadoria revertidas pela rota GET /foods/usda
-- ============================================================================
--
-- CONTEXTO
--
-- Até o ciclo de 2026-09-12, `FoodsService.searchUsda` gravava com um upsert que
-- sobrescrevia TODAS as colunas no conflito, inclusive `confiabilidade` e
-- `ativo`, sempre com `confiabilidade = 'alta'`:
--
--     repo.upsert({ ..., confiabilidade: 'alta' }, { conflictPaths: [...] })
--
-- Como `GET /foods/usda` é uma rota de LEITURA disponível a qualquer
-- ClinicalStaff, bastava alguém buscar o mesmo termo no USDA para um alimento
-- que a curadoria tinha rebaixado ('media'/'baixa'/'pendente') voltar sozinho a
-- 'alta'. A decisão do curador era revertida sem aviso e sem registro em
-- audit_logs — o `UPDATE` da curadoria é auditado, mas essa reversão não.
--
-- O mesmo fluxo indexava no RAG com `'alta'` fixa e sem checar `ativo`, então
-- chunks de alimentos bloqueados podem ter entrado em `rag_chunks` carimbados
-- como alta confiabilidade e chegado ao assistente clínico.
--
-- O código foi corrigido (as duas colunas saíram da lista de sobrescrita, a
-- releitura filtra a invariante e a indexação usa a confiabilidade real). Este
-- arquivo trata das linhas JÁ corrompidas.
--
-- ⚠️ NÃO EXECUTAR ÀS CEGAS. Rodar os diagnósticos, ler o resultado e só então
-- decidir. Em produção, sempre via:  cd apps/api && railway run psql ...
-- (o .env local aponta para a região ERRADA — eu-central-1 em vez de sa-east-1).
--
-- ⚠️ LIMITAÇÃO IMPORTANTE: não há como reconstruir automaticamente qual era a
-- confiabilidade original de um alimento revertido — o valor anterior foi
-- sobrescrito e a reversão não gerou audit_log. O que dá para fazer é LISTAR os
-- candidatos e devolver a decisão ao curador. Por isso a seção 3 é manual.
--
-- ============================================================================
-- 1. DIAGNÓSTICO — chunks de RAG que contradizem o alimento de origem
-- ============================================================================
--
-- `rag_chunks` guarda uma cópia CONGELADA de ativo/confiabilidade no momento da
-- indexação; ela não é propagada quando `foods` muda. Estes são os chunks que o
-- assistente ainda pode citar apesar de o alimento estar bloqueado, ou que
-- afirmam uma confiabilidade que o alimento não tem.

SELECT r.id            AS chunk_id,
       r.fonte,
       r.fonte_ref,
       r.confiabilidade AS conf_chunk,
       f.confiabilidade AS conf_alimento,
       f.ativo          AS alimento_ativo,
       f.nome_padronizado
  FROM rag_chunks r
  JOIN foods f ON f.fonte = r.fonte AND f.id::text = r.fonte_ref
 WHERE r.fonte = 'usda'
   AND (f.ativo = false
        OR f.confiabilidade = 'pendente'
        OR r.confiabilidade IS DISTINCT FROM f.confiabilidade)
 ORDER BY f.ativo, f.confiabilidade, f.nome_padronizado;

-- ============================================================================
-- 2. DIAGNÓSTICO — alimentos USDA que a curadoria tocou
-- ============================================================================
--
-- Todo alimento USDA que aparece em audit_logs com um UPDATE da curadoria mas
-- hoje está 'alta' e ativo é candidato a ter sido revertido pelo upsert.
-- `changes` guarda o que o curador pediu; comparar com o estado atual.

SELECT f.id,
       f.nome_padronizado,
       f.confiabilidade AS conf_atual,
       f.ativo          AS ativo_atual,
       a.changes        AS decisao_do_curador,
       a.created_at     AS decidido_em
  FROM foods f
  JOIN audit_logs a
    ON a.resource = 'foods' AND a.resource_id = f.id AND a.action = 'UPDATE'
 WHERE f.fonte = 'usda'
   AND f.confiabilidade = 'alta'
   AND f.ativo = true
   AND (a.changes ? 'confiabilidade' OR a.changes ? 'ativo')
 ORDER BY a.created_at DESC;

-- ============================================================================
-- 3. CORREÇÃO (MANUAL) — restaurar a decisão do curador
-- ============================================================================
--
-- Rodar a seção 2, conferir linha a linha com o curador e reaplicar só o que
-- ele confirmar. Não automatizar: a última decisão registrada em audit_logs não
-- é necessariamente a que ele quer hoje.
--
-- Modelo (um por alimento confirmado):
--
--   UPDATE foods
--      SET confiabilidade = '<valor confirmado>', ativo = <true|false>
--    WHERE id = '<uuid>' AND fonte = 'usda';

-- ============================================================================
-- 4. CORREÇÃO (SEGURA) — tirar do RAG o que está bloqueado
-- ============================================================================
--
-- Esta parte é segura e reversível: o chunk é derivado, não é dado de origem.
-- Um alimento removido daqui volta sozinho ao RAG no próximo RagSyncService se
-- e quando a curadoria o liberar (a query do cron filtra a invariante).
--
-- Rodar a seção 1 ANTES e conferir a contagem.
--
-- BEGIN;
--
-- DELETE FROM rag_chunks r
--  USING foods f
--  WHERE f.fonte = r.fonte
--    AND f.id::text = r.fonte_ref
--    AND r.fonte = 'usda'
--    AND (f.ativo = false OR f.confiabilidade = 'pendente');
--
-- -- Realinha a confiabilidade congelada dos que continuam válidos, para o
-- -- assistente parar de exibir "[FONTE · confiabilidade alta]" em cima de dado
-- -- que a curadoria classificou de outro jeito.
-- UPDATE rag_chunks r
--    SET confiabilidade = f.confiabilidade
--   FROM foods f
--  WHERE f.fonte = r.fonte
--    AND f.id::text = r.fonte_ref
--    AND r.fonte = 'usda'
--    AND r.confiabilidade IS DISTINCT FROM f.confiabilidade;
--
-- -- Conferir os dois resultados antes de confirmar.
-- -- COMMIT;  ou  ROLLBACK;

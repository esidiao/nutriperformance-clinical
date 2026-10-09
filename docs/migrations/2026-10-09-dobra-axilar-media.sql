-- Acrescenta a dobra AXILAR MEDIA a physical_assessments.
--
-- POR QUE
--
-- A tabela tem 6 dobras: triceps, subescapular, supra-iliaca, abdominal, coxa
-- e peitoral. O protocolo de Jackson & Pollock de 7 dobras usa justamente
-- essas 6 mais a AXILAR MEDIA. Faltando ela, o protocolo de 7 nao tem onde ser
-- gravado — e foi o pedido da nutricionista (09/10/2026) e o item 2 do
-- relatorio de testes (07/10/2026).
--
-- Esta migracao abre espaco; NAO escolhe protocolo. Quais equacoes entram
-- (Jackson & Pollock 7, Petroski, Guedes, Faulkner, Durnin-Womersley) e
-- decisao clinica da professora, e cada uma tem sitios e formula proprios.
--
-- ADITIVA e NULLABLE: nenhuma linha existente muda, nada passa a ser
-- obrigatorio. Em 09/10/2026 havia 6 avaliacoes, todas SEM dobra registrada
-- (conferido com scripts/dobras-afetadas.mjs), entao o impacto e zero.
--
-- ORDEM: aplicar ANTES de subir o codigo que le a coluna. O TypeORM faz
-- SELECT de todas as colunas da entidade; com a entidade na frente do banco,
-- toda consulta a physical_assessments quebra.
--
-- Idempotente: pode rodar duas vezes.
--
-- ROLLBACK:
--   ALTER TABLE physical_assessments DROP COLUMN IF EXISTS skinfold_midaxillary_mm;

ALTER TABLE physical_assessments
  ADD COLUMN IF NOT EXISTS skinfold_midaxillary_mm numeric(4,1);

COMMENT ON COLUMN physical_assessments.skinfold_midaxillary_mm IS
  'Dobra axilar media, em mm. Usada pelo protocolo de 7 dobras de Jackson & Pollock.';

-- `skinfold_protocol` ja existe e continua sendo o campo que diz QUAL
-- protocolo gerou os valores. Sem ele preenchido, um conjunto de dobras nao
-- se interpreta: os mesmos 3 sitios pertencem a equacoes diferentes conforme
-- o protocolo e o sexo.
COMMENT ON COLUMN physical_assessments.skinfold_protocol IS
  'Protocolo usado (ex: jackson_pollock_3, jackson_pollock_7). Sem ele os '
  'valores de dobra nao se interpretam: o mesmo sitio entra em equacoes '
  'diferentes conforme o protocolo e o sexo.';

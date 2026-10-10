-- Acrescenta a dobra do BICEPS a physical_assessments.
--
-- POR QUE
--
-- O protocolo de Durnin & Womersley (4 dobras) usa biceps, triceps,
-- subescapular e supra-iliaca. Os tres ultimos ja existiam; faltava o biceps.
-- Pedido em 10/10/2026, junto com a decisao de implementar esse protocolo.
--
-- ADITIVA e NULLABLE: nenhuma linha existente muda.
--
-- ORDEM: aplicar ANTES de subir o codigo. O TypeORM faz SELECT de todas as
-- colunas da entidade; com a entidade na frente do banco, toda consulta a
-- physical_assessments quebra.
--
-- Esta migracao e IRMA da 2026-10-09-dobra-axilar-media.sql. Se aquela ainda
-- nao foi aplicada, aplicar as duas na ordem das datas — as duas sao
-- idempotentes e podem ir na mesma janela.
--
-- ROLLBACK:
--   ALTER TABLE physical_assessments DROP COLUMN IF EXISTS skinfold_biceps_mm;

ALTER TABLE physical_assessments
  ADD COLUMN IF NOT EXISTS skinfold_biceps_mm numeric(4,1);

COMMENT ON COLUMN physical_assessments.skinfold_biceps_mm IS
  'Dobra do biceps, em mm. Usada pelo protocolo de Durnin & Womersley.';

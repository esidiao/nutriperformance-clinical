-- Acrescenta a dobra da PANTURRILHA MEDIAL a physical_assessments.
--
-- POR QUE
--
-- As equacoes de Petroski (1995) usam a panturrilha medial em todas as
-- variantes (3, 4 e 5 dobras). Era o ultimo sitio que faltava.
--
-- Com esta coluna, o cadastro passa a cobrir os sitios de:
--   Jackson & Pollock 3 e 7, Faulkner, Durnin & Womersley, Guedes 3 e
--   Petroski 3, 4 e 5.
--
-- ADITIVA e NULLABLE.
--
-- ORDEM: aplicar ANTES de subir a API.
--
-- IRMA das migracoes 2026-10-09 (axilar media), 2026-10-10 (biceps) e
-- 2026-10-10 (micronutrientes no plano). Todas idempotentes; podem ir na
-- mesma janela, em ordem de data.
--
-- ROLLBACK:
--   ALTER TABLE physical_assessments DROP COLUMN IF EXISTS skinfold_calf_mm;

ALTER TABLE physical_assessments
  ADD COLUMN IF NOT EXISTS skinfold_calf_mm numeric(4,1);

COMMENT ON COLUMN physical_assessments.skinfold_calf_mm IS
  'Dobra da panturrilha medial, em mm. Usada pelas equacoes de Petroski.';

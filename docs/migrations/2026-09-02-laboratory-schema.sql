-- =============================================================
-- Alinha laboratory_exams à entidade LaboratoryExam
--
-- BUG PRÉ-EXISTENTE, descoberto ao construir a lacuna 12: a tabela em produção
-- tem um schema antigo (recorded_by, exam_date, lab_name, results jsonb) que
-- NÃO corresponde à entidade do código (created_by, collection_date,
-- laboratory_name e ~40 marcadores tipados).
--
-- Efeito: POST /laboratory devolvia 500. O módulo de exames nunca funcionou em
-- produção — e ninguém percebeu porque a tabela tem ZERO linhas: ninguém
-- conseguiu usá-lo para reclamar.
--
-- ADITIVA de propósito. As colunas antigas continuam onde estão, sem dado
-- (a tabela está vazia). Só perdem o NOT NULL, que era o que travava a
-- inserção. Apagar coluna é irreversível e não é necessário para consertar.
--
-- Idempotente.
-- =============================================================

ALTER TABLE laboratory_exams
  -- Identificação
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS collection_date DATE,
  ADD COLUMN IF NOT EXISTS report_date DATE,
  ADD COLUMN IF NOT EXISTS laboratory_name TEXT,
  ADD COLUMN IF NOT EXISTS requesting_physician TEXT,

  -- Hemograma
  ADD COLUMN IF NOT EXISTS hemoglobin_g_dl NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS hematocrit_pct NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS mcv_fl NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS mchc_g_dl NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS leukocytes_ul NUMERIC(8, 0),
  ADD COLUMN IF NOT EXISTS platelets_ul NUMERIC(8, 0),

  -- Ferro
  ADD COLUMN IF NOT EXISTS ferritin_ng_ml NUMERIC(7, 2),
  ADD COLUMN IF NOT EXISTS serum_iron_ug_dl NUMERIC(6, 1),
  ADD COLUMN IF NOT EXISTS tibc_ug_dl NUMERIC(6, 1),
  ADD COLUMN IF NOT EXISTS transferrin_saturation_pct NUMERIC(5, 2),

  -- Vitaminas
  ADD COLUMN IF NOT EXISTS vitamin_d_ng_ml NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS vitamin_b12_pg_ml NUMERIC(7, 2),
  ADD COLUMN IF NOT EXISTS folic_acid_ng_ml NUMERIC(6, 2),

  -- Minerais
  ADD COLUMN IF NOT EXISTS zinc_ug_dl NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS magnesium_mg_dl NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS calcium_mg_dl NUMERIC(5, 2),

  -- Glicemia
  ADD COLUMN IF NOT EXISTS fasting_glucose_mg_dl NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS hba1c_pct NUMERIC(4, 2),
  ADD COLUMN IF NOT EXISTS insulin_uui_ml NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS homa_ir NUMERIC(5, 2),

  -- Lipídios
  ADD COLUMN IF NOT EXISTS total_cholesterol_mg_dl NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS hdl_mg_dl NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS ldl_mg_dl NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS vldl_mg_dl NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS triglycerides_mg_dl NUMERIC(5, 1),

  -- Renal
  ADD COLUMN IF NOT EXISTS creatinine_mg_dl NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS urea_mg_dl NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS uric_acid_mg_dl NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS egfr_ml_min NUMERIC(6, 1),

  -- Hepático
  ADD COLUMN IF NOT EXISTS alt_u_l NUMERIC(6, 1),
  ADD COLUMN IF NOT EXISTS ast_u_l NUMERIC(6, 1),
  ADD COLUMN IF NOT EXISTS ggt_u_l NUMERIC(6, 1),
  ADD COLUMN IF NOT EXISTS albumin_g_dl NUMERIC(4, 2),

  -- Hormônios
  ADD COLUMN IF NOT EXISTS tsh_uui_ml NUMERIC(6, 3),
  ADD COLUMN IF NOT EXISTS free_t4_ng_dl NUMERIC(5, 3),
  ADD COLUMN IF NOT EXISTS testosterone_ng_dl NUMERIC(7, 2),
  ADD COLUMN IF NOT EXISTS cortisol_ug_dl NUMERIC(6, 2),

  -- Inflamação
  ADD COLUMN IF NOT EXISTS crp_mg_l NUMERIC(6, 2),

  -- Marcadores fora do catálogo + rastreio da análise por IA
  ADD COLUMN IF NOT EXISTS custom_results JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_analysis_id UUID,
  ADD COLUMN IF NOT EXISTS tokens_consumed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flags TEXT[] DEFAULT '{}'::text[];

-- As colunas antigas eram NOT NULL e a entidade nunca as preenche — é isso que
-- fazia o POST devolver 500. Ficam na tabela, sem exigência.
ALTER TABLE laboratory_exams ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE laboratory_exams ALTER COLUMN exam_date   DROP NOT NULL;
ALTER TABLE laboratory_exams ALTER COLUMN results     DROP NOT NULL;

-- Consulta quente: exames de um paciente, do mais recente para o mais antigo.
CREATE INDEX IF NOT EXISTS idx_laboratory_exams_paciente
  ON laboratory_exams (workspace_id, patient_id, collection_date DESC);

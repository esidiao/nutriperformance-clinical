-- =============================================================
-- NutriPerformance Clinical — Schema PostgreSQL (Supabase)
-- Versão: 1.0.0
-- =============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- busca textual

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM (
  'admin',
  'nutritionist',
  'fitness_professional',
  'supervised_student',
  'clinic_manager',
  'institutional_manager'
);

CREATE TYPE subscription_plan AS ENUM (
  'free_trial',
  'individual_basic',
  'individual_pro',
  'clinic',
  'institutional'
);

CREATE TYPE token_operation AS ENUM (
  'purchase',
  'consumption',
  'refund',
  'bonus',
  'expiration',
  'admin_adjustment'
);

CREATE TYPE gender AS ENUM ('male', 'female', 'other', 'not_informed');

CREATE TYPE activity_level AS ENUM (
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extremely_active'
);

CREATE TYPE goal_type AS ENUM (
  'weight_loss',
  'hypertrophy',
  'body_recomposition',
  'metabolic_improvement',
  'performance_improvement',
  'endurance_gain',
  'general_health',
  'clinical_recovery',
  'lean_mass_maintenance',
  'gastrointestinal_improvement'
);

CREATE TYPE supplement_category AS ENUM (
  'protein',
  'amino_acids',
  'creatine',
  'pre_workout',
  'mass_gainer',
  'vitamins',
  'minerals',
  'omega3',
  'thermogenic',
  'probiotics',
  'fibers',
  'herbal',
  'recovery',
  'electrolytes',
  'caffeine',
  'adaptogen',
  'other'
);

CREATE TYPE risk_level AS ENUM ('low', 'moderate', 'high', 'contraindicated', 'insufficient_data');

CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'danger', 'critical');

CREATE TYPE report_type AS ENUM (
  'nutritional_assessment',
  'physical_assessment',
  'supplementation_analysis',
  'full_clinical',
  'evolution',
  'goals'
);

-- =============================================================
-- WORKSPACES (Clínicas, Consultórios, Equipes)
-- =============================================================

CREATE TABLE workspaces (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  cnpj            TEXT,
  logo_url        TEXT,
  plan            subscription_plan NOT NULL DEFAULT 'free_trial',
  token_balance   INTEGER NOT NULL DEFAULT 0,
  token_reserved  INTEGER NOT NULL DEFAULT 0, -- em processamento
  settings        JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  trial_ends_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- USUÁRIOS
-- =============================================================

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  auth_id             TEXT UNIQUE NOT NULL, -- Supabase Auth UID
  email               TEXT NOT NULL,
  full_name           TEXT NOT NULL,
  role                user_role NOT NULL,
  council_type        TEXT,          -- CFN, CONFEF, CRM, etc.
  council_number      TEXT,          -- CRN-X XXXXXX / CREF XXXXXX-X
  council_state       TEXT,
  phone               TEXT,
  avatar_url          TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_login_at       TIMESTAMPTZ,
  settings            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

-- =============================================================
-- PACIENTES (dados sensíveis — LGPD)
-- =============================================================

CREATE TABLE patients (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  -- Dados identificadores criptografados
  name_encrypted        BYTEA NOT NULL,
  email_encrypted       BYTEA,
  phone_encrypted       BYTEA,
  cpf_hash              TEXT,            -- hash para busca, sem revelar CPF
  -- Dados clínicos (não-identificadores)
  birth_date            DATE NOT NULL,
  gender                gender NOT NULL DEFAULT 'not_informed',
  is_pregnant           BOOLEAN DEFAULT false,
  is_breastfeeding      BOOLEAN DEFAULT false,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  lgpd_consent          BOOLEAN NOT NULL DEFAULT false,
  lgpd_consent_at       TIMESTAMPTZ,
  lgpd_consent_ip       TEXT,
  data_deletion_requested_at TIMESTAMPTZ,
  internal_code         TEXT,           -- código interno da clínica
  notes_encrypted       BYTEA,
  created_by            UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profissionais vinculados a um paciente
CREATE TABLE patient_professionals (
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          user_role NOT NULL,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (patient_id, user_id)
);

-- =============================================================
-- CONDIÇÕES CLÍNICAS DO PACIENTE
-- =============================================================

CREATE TABLE patient_clinical_conditions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition     TEXT NOT NULL,         -- CID ou descrição livre
  cid_code      TEXT,
  severity      TEXT,
  notes         TEXT,
  recorded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Medicamentos em uso pelo paciente
CREATE TABLE patient_medications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  active_principle TEXT,
  dose          TEXT,
  frequency     TEXT,
  start_date    DATE,
  end_date      DATE,
  is_continuous BOOLEAN DEFAULT false,
  notes         TEXT,
  recorded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alergias e intolerâncias
CREATE TABLE patient_allergies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  substance     TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('food_allergy','food_intolerance','drug_allergy','supplement_allergy','other')),
  severity      TEXT,
  notes         TEXT,
  recorded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- AVALIAÇÃO NUTRICIONAL
-- =============================================================

CREATE TABLE nutritional_assessments (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id                UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  workspace_id              UUID NOT NULL REFERENCES workspaces(id),
  created_by                UUID NOT NULL REFERENCES users(id),
  assessment_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Anamnese
  main_complaint            TEXT,
  food_history              TEXT,
  dietary_restrictions      TEXT[],
  meal_frequency            INTEGER,
  water_intake_ml           INTEGER,
  alcohol_consumption       TEXT,
  smoking                   BOOLEAN DEFAULT false,
  -- Hábitos intestinais
  bowel_habits              TEXT,
  gastrointestinal_symptoms TEXT[],
  -- Histórico familiar
  family_history            TEXT[],
  -- Dados bioquímicos resumidos
  last_lab_date             DATE,
  lab_notes                 TEXT,
  -- Cálculo energético
  basal_metabolic_rate      NUMERIC(8,2),  -- kcal/dia
  bmr_formula               TEXT,          -- Harris-Benedict, Mifflin, etc.
  total_energy_expenditure  NUMERIC(8,2),  -- kcal/dia
  pal_factor                NUMERIC(4,2),  -- fator atividade
  caloric_target            NUMERIC(8,2),
  protein_target_g          NUMERIC(6,2),
  carb_target_g             NUMERIC(6,2),
  fat_target_g              NUMERIC(6,2),
  -- Diagnóstico nutricional (texto, não automatizado)
  nutritional_diagnosis     TEXT,
  dietary_strategy          TEXT,
  professional_notes        TEXT,
  -- Controle
  ai_analysis_id            UUID,          -- ref à análise de IA gerada
  tokens_consumed           INTEGER DEFAULT 0,
  is_draft                  BOOLEAN DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- AVALIAÇÃO FÍSICA
-- =============================================================

CREATE TABLE physical_assessments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id),
  created_by            UUID NOT NULL REFERENCES users(id),
  assessment_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Medidas básicas
  weight_kg             NUMERIC(6,2),
  height_cm             NUMERIC(5,1),
  bmi                   NUMERIC(5,2),      -- calculado automaticamente
  -- Composição corporal
  body_fat_pct          NUMERIC(5,2),
  lean_mass_kg          NUMERIC(6,2),
  muscle_mass_kg        NUMERIC(6,2),
  bone_mass_kg          NUMERIC(5,2),
  body_water_pct        NUMERIC(5,2),
  visceral_fat_level    INTEGER,
  -- Método de avaliação
  assessment_method     TEXT,              -- dobras, bioimpedância, DEXA, etc.
  bioimpedance_brand    TEXT,
  -- Circunferências (cm)
  waist_cm              NUMERIC(5,1),
  hip_cm                NUMERIC(5,1),
  waist_hip_ratio       NUMERIC(4,3),
  neck_cm               NUMERIC(5,1),
  chest_cm              NUMERIC(5,1),
  abdomen_cm            NUMERIC(5,1),
  right_arm_cm          NUMERIC(5,1),
  left_arm_cm           NUMERIC(5,1),
  right_thigh_cm        NUMERIC(5,1),
  left_thigh_cm         NUMERIC(5,1),
  right_calf_cm         NUMERIC(5,1),
  left_calf_cm          NUMERIC(5,1),
  -- Dobras cutâneas (mm)
  triceps_fold_mm       NUMERIC(5,2),
  subscapular_fold_mm   NUMERIC(5,2),
  biceps_fold_mm        NUMERIC(5,2),
  chest_fold_mm         NUMERIC(5,2),
  midaxillary_fold_mm   NUMERIC(5,2),
  suprailiac_fold_mm    NUMERIC(5,2),
  abdominal_fold_mm     NUMERIC(5,2),
  thigh_fold_mm         NUMERIC(5,2),
  medial_calf_fold_mm   NUMERIC(5,2),
  -- Atividade física
  activity_level        activity_level,
  weekly_frequency      INTEGER,
  session_duration_min  INTEGER,
  sport_modality        TEXT,
  training_intensity    TEXT,             -- baixa, moderada, alta, máxima
  cardio_type           TEXT,
  strength_training     BOOLEAN DEFAULT false,
  -- Gasto energético
  resting_energy_kcal   NUMERIC(8,2),
  activity_energy_kcal  NUMERIC(8,2),
  tef_kcal              NUMERIC(8,2),     -- efeito térmico alimento
  total_energy_kcal     NUMERIC(8,2),
  -- Condicionamento funcional
  resting_heart_rate    INTEGER,
  blood_pressure        TEXT,             -- ex: "120/80"
  vo2_max               NUMERIC(6,2),
  functional_tests      JSONB,            -- testes livres em JSON
  -- Objetivo corporal
  primary_goal          goal_type,
  secondary_goals       goal_type[],
  target_weight_kg      NUMERIC(6,2),
  target_body_fat_pct   NUMERIC(5,2),
  target_date           DATE,
  -- Observações profissionais
  professional_notes    TEXT,
  ai_analysis_id        UUID,
  tokens_consumed       INTEGER DEFAULT 0,
  is_draft              BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- EXAMES LABORATORIAIS
-- =============================================================

CREATE TABLE laboratory_exams (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  workspace_id      UUID NOT NULL REFERENCES workspaces(id),
  recorded_by       UUID NOT NULL REFERENCES users(id),
  exam_date         DATE NOT NULL,
  lab_name          TEXT,
  -- Valores (armazenados como JSONB para flexibilidade)
  -- ex: {"hemoglobin": {"value": 12.5, "unit": "g/dL", "reference": "12-16", "status": "normal"}}
  results           JSONB NOT NULL DEFAULT '{}',
  file_url          TEXT,            -- PDF do exame (Storage)
  notes             TEXT,
  -- IMPORTANTE: interpretação é exclusivamente profissional
  professional_interpretation TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- BASE DE SUPLEMENTOS
-- =============================================================

CREATE TABLE supplements (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  generic_name          TEXT,
  category              supplement_category NOT NULL,
  description           TEXT,
  common_uses           TEXT[],
  active_compounds      TEXT[],
  evidence_level        TEXT,          -- meta-análise, ECA, observacional, etc.
  evidence_source       TEXT,
  -- Alertas e contraindicações (base científica)
  general_warnings      TEXT[],
  contraindicated_conditions TEXT[],
  drug_interactions     JSONB DEFAULT '[]',
  -- ex: [{"drug": "warfarin", "risk": "high", "mechanism": "...", "evidence": "..."}]
  supplement_interactions JSONB DEFAULT '[]',
  -- Biodisponibilidade
  bioavailability_notes TEXT,
  best_absorption_conditions TEXT,
  -- Meta
  is_active             BOOLEAN DEFAULT true,
  last_reviewed_at      DATE,
  reviewed_by_source    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- SUPLEMENTAÇÃO DO PACIENTE
-- =============================================================

CREATE TABLE patient_supplementation (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  workspace_id        UUID NOT NULL REFERENCES workspaces(id),
  recorded_by         UUID NOT NULL REFERENCES users(id),
  supplement_id       UUID REFERENCES supplements(id),
  supplement_name     TEXT NOT NULL,     -- nome livre (se não estiver na base)
  brand               TEXT,
  category            supplement_category,
  -- Protocolo
  dose                TEXT NOT NULL,     -- ex: "5g", "2 cápsulas"
  dose_numeric_g      NUMERIC(8,3),
  frequency           TEXT NOT NULL,
  timing              TEXT,              -- ex: "pré-treino", "ao acordar"
  with_meal           BOOLEAN,
  with_training       BOOLEAN,
  start_date          DATE,
  end_date            DATE,
  is_continuous       BOOLEAN DEFAULT false,
  is_active           BOOLEAN DEFAULT true,
  -- Objetivo de uso
  purpose             TEXT,
  -- Eventos adversos
  adverse_events      TEXT,
  -- Análise (resultado da IA — apenas sugestiva)
  risk_level          risk_level,
  ai_analysis_summary TEXT,
  ai_analysis_id      UUID,
  tokens_consumed     INTEGER DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ANÁLISE DE INTERAÇÕES
-- =============================================================

CREATE TABLE interaction_analyses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id),
  created_by            UUID NOT NULL REFERENCES users(id),
  analysis_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Contexto analisado
  supplements_analyzed  JSONB NOT NULL,     -- lista de suplementos
  medications_analyzed  JSONB NOT NULL,     -- lista de medicamentos
  conditions_analyzed   JSONB NOT NULL,     -- condições clínicas
  lab_results_context   JSONB,              -- exames relevantes
  -- Resultado da análise
  interactions_found    JSONB NOT NULL DEFAULT '[]',
  /*
    Estrutura de cada interação:
    {
      "type": "supplement_drug" | "supplement_supplement" | "supplement_condition" | "supplement_lab",
      "entity_a": "nome",
      "entity_b": "nome",
      "risk_level": "low|moderate|high|contraindicated|insufficient_data",
      "mechanism": "descrição do mecanismo",
      "clinical_significance": "texto",
      "confidence_level": "high|moderate|low",
      "evidence_quality": "meta-analysis|rct|observational|case_report|expert_opinion",
      "recommendation": "texto para o profissional",
      "requires_professional_validation": true,
      "source": "referência"
    }
  */
  overall_risk_level    risk_level NOT NULL DEFAULT 'insufficient_data',
  ai_disclaimer         TEXT NOT NULL DEFAULT 'Esta análise é uma ferramenta de apoio. Não substitui avaliação profissional individualizada. Valide com o profissional responsável.',
  requires_medical_review BOOLEAN DEFAULT false,
  tokens_consumed       INTEGER DEFAULT 0,
  professional_review   TEXT,         -- anotação do profissional após análise
  reviewed_by           UUID REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ANÁLISE DE BIODISPONIBILIDADE
-- =============================================================

CREATE TABLE bioavailability_analyses (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  workspace_id            UUID NOT NULL REFERENCES workspaces(id),
  created_by              UUID NOT NULL REFERENCES users(id),
  analysis_date           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Fatores avaliados
  nutrients_analyzed      TEXT[],
  supplements_analyzed    TEXT[],
  compromising_factors    JSONB NOT NULL DEFAULT '[]',
  /*
    Estrutura de cada fator:
    {
      "factor": "uso de omeprazol",
      "affected_nutrients": ["ferro", "B12", "vitamina C"],
      "mechanism": "redução de ácido gástrico compromete absorção",
      "risk_level": "moderate",
      "confidence": "high",
      "evidence": "referência"
    }
  */
  -- Condições do paciente consideradas
  gi_conditions           TEXT[],
  medications_considered  TEXT[],
  surgical_history        TEXT[],      -- ex: cirurgia bariátrica
  -- Resultado
  low_absorption_risks    JSONB NOT NULL DEFAULT '[]',
  investigation_suggestions TEXT[],
  referral_needed         BOOLEAN DEFAULT false,
  referral_reason         TEXT,
  overall_assessment      TEXT,
  ai_disclaimer           TEXT NOT NULL DEFAULT 'Análise de apoio. Não substitui avaliação clínica.',
  tokens_consumed         INTEGER DEFAULT 0,
  professional_notes      TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ALERTAS CLÍNICOS
-- =============================================================

CREATE TABLE clinical_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  triggered_by    TEXT NOT NULL,        -- módulo que gerou o alerta
  severity        alert_severity NOT NULL,
  category        TEXT NOT NULL,        -- nutrição, suplementação, treino, etc.
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  recommendation  TEXT,
  is_resolved     BOOLEAN DEFAULT false,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- METAS E EVOLUÇÃO
-- =============================================================

CREATE TABLE patient_goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  goal_type       goal_type NOT NULL,
  description     TEXT NOT NULL,
  target_value    NUMERIC(10,3),
  target_unit     TEXT,
  baseline_value  NUMERIC(10,3),
  start_date      DATE NOT NULL,
  target_date     DATE,
  is_achieved     BOOLEAN DEFAULT false,
  achieved_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checkpoints de evolução
CREATE TABLE goal_checkpoints (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id     UUID NOT NULL REFERENCES patient_goals(id) ON DELETE CASCADE,
  value       NUMERIC(10,3) NOT NULL,
  notes       TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID NOT NULL REFERENCES users(id)
);

-- =============================================================
-- RELATÓRIOS
-- =============================================================

CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  type            report_type NOT NULL,
  title           TEXT NOT NULL,
  -- Referências aos módulos incluídos
  includes        JSONB NOT NULL DEFAULT '{}',
  -- ex: {"nutritional_assessment_id": "...", "physical_assessment_id": "...", ...}
  content_hash    TEXT,             -- hash do conteúdo para integridade
  pdf_url         TEXT,             -- URL no Storage
  pdf_size_bytes  INTEGER,
  professional_signature TEXT,      -- nome + registro profissional
  legal_disclaimer TEXT NOT NULL DEFAULT 'Este relatório é uma ferramenta de apoio profissional e não constitui diagnóstico, prescrição ou tratamento médico. As informações contidas devem ser interpretadas por profissional habilitado.',
  tokens_consumed INTEGER DEFAULT 0,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_url_at  TIMESTAMPTZ       -- URL assinada expira
);

-- =============================================================
-- SISTEMA DE TOKENS
-- =============================================================

CREATE TABLE token_packages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  tokens          INTEGER NOT NULL,
  price_brl       NUMERIC(10,2) NOT NULL,
  price_usd       NUMERIC(10,2),
  is_subscription BOOLEAN DEFAULT false,
  billing_period  TEXT,              -- monthly, annual
  plan            subscription_plan,
  features        TEXT[],
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE token_transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id),
  user_id             UUID REFERENCES users(id),
  operation           token_operation NOT NULL,
  amount              INTEGER NOT NULL,          -- positivo = crédito, negativo = débito
  balance_after       INTEGER NOT NULL,
  description         TEXT NOT NULL,
  module              TEXT,                      -- qual módulo consumiu
  reference_id        UUID,                      -- ID da análise que consumiu
  payment_id          TEXT,                      -- ID Stripe/MercadoPago
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custos em tokens por operação
CREATE TABLE token_costs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation       TEXT UNIQUE NOT NULL,
  tokens_cost     INTEGER NOT NULL,
  description     TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO token_costs (operation, tokens_cost, description) VALUES
  ('nutritional_assessment_ai',    10, 'Análise nutricional com IA'),
  ('physical_assessment_ai',        5, 'Análise de avaliação física com IA'),
  ('interaction_analysis',         15, 'Análise de interações suplemento/medicamento'),
  ('bioavailability_analysis',     12, 'Análise de biodisponibilidade'),
  ('supplementation_analysis',      8, 'Análise de suplementação'),
  ('report_generation',             5, 'Geração de relatório PDF'),
  ('lab_analysis',                 10, 'Análise de exames laboratoriais'),
  ('clinical_alert_processing',     2, 'Processamento de alerta clínico'),
  ('goal_ai_suggestion',            5, 'Sugestão de meta com IA');

-- =============================================================
-- PAGAMENTOS
-- =============================================================

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id),
  gateway             TEXT NOT NULL CHECK (gateway IN ('stripe', 'mercadopago')),
  gateway_payment_id  TEXT UNIQUE NOT NULL,
  gateway_customer_id TEXT,
  amount_brl          NUMERIC(10,2),
  amount_usd          NUMERIC(10,2),
  currency            TEXT NOT NULL DEFAULT 'BRL',
  status              TEXT NOT NULL,
  tokens_granted      INTEGER,
  package_id          UUID REFERENCES token_packages(id),
  invoice_url         TEXT,
  metadata            JSONB DEFAULT '{}',
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id            UUID NOT NULL REFERENCES workspaces(id) UNIQUE,
  gateway                 TEXT NOT NULL,
  gateway_subscription_id TEXT UNIQUE NOT NULL,
  plan                    subscription_plan NOT NULL,
  status                  TEXT NOT NULL,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT false,
  tokens_per_period       INTEGER,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- BASE CIENTÍFICA ATUALIZÁVEL
-- =============================================================

CREATE TABLE scientific_references (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category        TEXT NOT NULL,         -- suplementação, nutrição, bioquímica, etc.
  title           TEXT NOT NULL,
  authors         TEXT,
  journal         TEXT,
  year            INTEGER,
  doi             TEXT,
  url             TEXT,
  evidence_type   TEXT,                  -- meta-análise, RCT, observacional
  summary         TEXT,
  tags            TEXT[],
  applies_to      TEXT[],                -- suplementos/nutrientes que afeta
  is_active       BOOLEAN DEFAULT true,
  last_reviewed   DATE,
  added_by        UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerta de base desatualizada
CREATE TABLE scientific_base_health (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category            TEXT UNIQUE NOT NULL,
  last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stale_threshold_days INTEGER NOT NULL DEFAULT 90,
  alert_sent_at       TIMESTAMPTZ
);

INSERT INTO scientific_base_health (category, stale_threshold_days) VALUES
  ('supplementation', 90),
  ('nutrition_guidelines', 90),
  ('bioavailability', 90),
  ('drug_interactions', 60),
  ('laboratory_values', 180);

-- =============================================================
-- LOGS DE AUDITORIA (LGPD)
-- =============================================================

CREATE TABLE audit_logs (
  id              BIGSERIAL,
  workspace_id    UUID REFERENCES workspaces(id),
  user_id         UUID REFERENCES users(id),
  patient_id      UUID REFERENCES patients(id),
  action          TEXT NOT NULL,        -- CREATE, READ, UPDATE, DELETE, EXPORT
  resource        TEXT NOT NULL,        -- nome da tabela/recurso
  resource_id     UUID,
  ip_address      INET,
  user_agent      TEXT,
  changes         JSONB,               -- diff das mudanças (sem dados sensíveis)
  success         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)         -- created_at obrigatório na PK de tabela particionada
) PARTITION BY RANGE (created_at);

-- Partições por ano
CREATE TABLE audit_logs_2025 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE audit_logs_2026 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE audit_logs_2027 PARTITION OF audit_logs
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

-- =============================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================

CREATE INDEX idx_patients_workspace ON patients(workspace_id);
CREATE INDEX idx_patients_cpf_hash ON patients(cpf_hash);
CREATE INDEX idx_users_workspace ON users(workspace_id);
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_nutritional_patient ON nutritional_assessments(patient_id);
CREATE INDEX idx_physical_patient ON physical_assessments(patient_id);
CREATE INDEX idx_lab_patient ON laboratory_exams(patient_id);
CREATE INDEX idx_supp_patient ON patient_supplementation(patient_id);
CREATE INDEX idx_interactions_patient ON interaction_analyses(patient_id);
CREATE INDEX idx_bioav_patient ON bioavailability_analyses(patient_id);
CREATE INDEX idx_alerts_patient ON clinical_alerts(patient_id, is_resolved);
CREATE INDEX idx_tokens_workspace ON token_transactions(workspace_id, created_at DESC);
CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_patient ON audit_logs(patient_id, created_at DESC);
CREATE INDEX idx_supplements_category ON supplements(category);
CREATE INDEX idx_supplements_name_trgm ON supplements USING GIN (name gin_trgm_ops);

-- =============================================================
-- ROW LEVEL SECURITY (Supabase RLS)
-- Princípio: isolamento por workspace em toda tabela sensível.
-- A função auxiliar abaixo evita subqueries repetidas e melhora performance.
-- =============================================================

-- Funções auxiliares (SECURITY DEFINER para evitar RLS loop)
CREATE OR REPLACE FUNCTION auth_workspace_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT workspace_id FROM users WHERE auth_id = auth.uid()::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_is_manager()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role IN ('admin', 'clinic_manager', 'institutional_manager')
  FROM users WHERE auth_id = auth.uid()::text LIMIT 1;
$$;

-- ── WORKSPACES ────────────────────────────────────────────────────────────────
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seu próprio workspace
CREATE POLICY workspaces_select ON workspaces
  FOR SELECT USING (id = auth_workspace_id());

-- Somente admin pode atualizar workspace
CREATE POLICY workspaces_update ON workspaces
  FOR UPDATE USING (id = auth_workspace_id() AND auth_user_role() = 'admin');

-- Ninguém deleta workspace via API (apenas serviço com service_role)
CREATE POLICY workspaces_no_delete ON workspaces
  FOR DELETE USING (false);

-- ── USERS ─────────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Usuários veem colegas do mesmo workspace
CREATE POLICY users_select ON users
  FOR SELECT USING (workspace_id = auth_workspace_id());

-- Usuário edita apenas seu próprio perfil; admin edita qualquer um no workspace
CREATE POLICY users_update ON users
  FOR UPDATE USING (
    workspace_id = auth_workspace_id()
    AND (auth_id = auth.uid()::text OR auth_is_manager())
  );

-- Admin/manager pode convidar novos usuários (INSERT)
CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (
    workspace_id = auth_workspace_id()
    AND auth_is_manager()
  );

-- Admin pode desativar usuários (soft-delete via is_active)
CREATE POLICY users_delete ON users
  FOR DELETE USING (
    workspace_id = auth_workspace_id()
    AND auth_user_role() = 'admin'
  );

-- ── PATIENTS ──────────────────────────────────────────────────────────────────
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Admin/manager vê todos os pacientes do workspace;
-- demais profissionais veem apenas pacientes vinculados a eles
CREATE POLICY patients_select ON patients
  FOR SELECT USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_is_manager()
      OR EXISTS (
        SELECT 1 FROM patient_professionals pp
        WHERE pp.patient_id = patients.id
          AND pp.user_id = auth_user_id()
      )
    )
  );

-- Qualquer profissional do workspace pode cadastrar paciente (com lgpd_consent)
CREATE POLICY patients_insert ON patients
  FOR INSERT WITH CHECK (
    workspace_id = auth_workspace_id()
    AND lgpd_consent = true
  );

-- Profissional vinculado ou manager pode atualizar
CREATE POLICY patients_update ON patients
  FOR UPDATE USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_is_manager()
      OR EXISTS (
        SELECT 1 FROM patient_professionals pp
        WHERE pp.patient_id = patients.id
          AND pp.user_id = auth_user_id()
      )
    )
  );

-- Deleção física bloqueada via RLS — usar data_deletion_requested_at
CREATE POLICY patients_no_delete ON patients
  FOR DELETE USING (false);

-- ── PATIENT_PROFESSIONALS ─────────────────────────────────────────────────────
ALTER TABLE patient_professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_professionals_select ON patient_professionals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_professionals.patient_id
        AND p.workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY patient_professionals_insert ON patient_professionals
  FOR INSERT WITH CHECK (
    auth_is_manager()
    OR user_id = auth_user_id()
  );

CREATE POLICY patient_professionals_delete ON patient_professionals
  FOR DELETE USING (auth_is_manager());

-- ── PATIENT_CLINICAL_CONDITIONS ───────────────────────────────────────────────
ALTER TABLE patient_clinical_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcc_select ON patient_clinical_conditions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_clinical_conditions.patient_id
        AND p.workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY pcc_insert ON patient_clinical_conditions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_clinical_conditions.patient_id
        AND p.workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY pcc_update ON patient_clinical_conditions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_clinical_conditions.patient_id
        AND p.workspace_id = auth_workspace_id()
    )
  );

-- ── PATIENT_MEDICATIONS ───────────────────────────────────────────────────────
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_medications_select ON patient_medications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_medications.patient_id
        AND p.workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY patient_medications_insert ON patient_medications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_medications.patient_id
        AND p.workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY patient_medications_update ON patient_medications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_medications.patient_id
        AND p.workspace_id = auth_workspace_id()
    )
  );

-- ── NUTRITIONAL_ASSESSMENTS ───────────────────────────────────────────────────
ALTER TABLE nutritional_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY nutritional_assessments_select ON nutritional_assessments
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY nutritional_assessments_insert ON nutritional_assessments
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY nutritional_assessments_update ON nutritional_assessments
  FOR UPDATE USING (workspace_id = auth_workspace_id());

-- ── PHYSICAL_ASSESSMENTS ──────────────────────────────────────────────────────
ALTER TABLE physical_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY physical_assessments_select ON physical_assessments
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY physical_assessments_insert ON physical_assessments
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY physical_assessments_update ON physical_assessments
  FOR UPDATE USING (workspace_id = auth_workspace_id());

-- ── LABORATORY_EXAMS ──────────────────────────────────────────────────────────
ALTER TABLE laboratory_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY laboratory_exams_select ON laboratory_exams
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY laboratory_exams_insert ON laboratory_exams
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY laboratory_exams_update ON laboratory_exams
  FOR UPDATE USING (workspace_id = auth_workspace_id());

-- ── PATIENT_SUPPLEMENTATION ───────────────────────────────────────────────────
ALTER TABLE patient_supplementation ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_supplementation_select ON patient_supplementation
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY patient_supplementation_insert ON patient_supplementation
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY patient_supplementation_update ON patient_supplementation
  FOR UPDATE USING (workspace_id = auth_workspace_id());

-- ── INTERACTION_ANALYSES ──────────────────────────────────────────────────────
ALTER TABLE interaction_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY interaction_analyses_select ON interaction_analyses
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY interaction_analyses_insert ON interaction_analyses
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

-- ── BIOAVAILABILITY_ANALYSES ──────────────────────────────────────────────────
ALTER TABLE bioavailability_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY bioavailability_analyses_select ON bioavailability_analyses
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY bioavailability_analyses_insert ON bioavailability_analyses
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

-- ── CLINICAL_ALERTS ───────────────────────────────────────────────────────────
ALTER TABLE clinical_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinical_alerts_select ON clinical_alerts
  FOR SELECT USING (workspace_id = auth_workspace_id());

-- Alertas são criados pelo service_role (backend), não diretamente pelo usuário
CREATE POLICY clinical_alerts_insert ON clinical_alerts
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

-- Profissionais do workspace podem resolver alertas
CREATE POLICY clinical_alerts_update ON clinical_alerts
  FOR UPDATE USING (workspace_id = auth_workspace_id());

-- ── PATIENT_GOALS ─────────────────────────────────────────────────────────────
ALTER TABLE patient_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_goals_select ON patient_goals
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY patient_goals_insert ON patient_goals
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY patient_goals_update ON patient_goals
  FOR UPDATE USING (workspace_id = auth_workspace_id());

CREATE POLICY patient_goals_delete ON patient_goals
  FOR DELETE USING (
    workspace_id = auth_workspace_id()
    AND auth_is_manager()
  );

-- ── GOAL_CHECKPOINTS ──────────────────────────────────────────────────────────
ALTER TABLE goal_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY goal_checkpoints_select ON goal_checkpoints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_goals g
      WHERE g.id = goal_checkpoints.goal_id
        AND g.workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY goal_checkpoints_insert ON goal_checkpoints
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patient_goals g
      WHERE g.id = goal_checkpoints.goal_id
        AND g.workspace_id = auth_workspace_id()
    )
  );

-- ── REPORTS ───────────────────────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_select ON reports
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY reports_insert ON reports
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

-- ── TOKEN_TRANSACTIONS ────────────────────────────────────────────────────────
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Membros do workspace veem o histórico; somente service_role escreve
CREATE POLICY token_transactions_select ON token_transactions
  FOR SELECT USING (workspace_id = auth_workspace_id());

-- Inserção apenas via service_role (backend com SUPABASE_SERVICE_ROLE_KEY)
-- RLS bloqueia insert direto do anon/authenticated
CREATE POLICY token_transactions_no_direct_insert ON token_transactions
  FOR INSERT WITH CHECK (false);

-- ── PAYMENTS / SUBSCRIPTIONS ──────────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select ON payments
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY payments_no_direct_write ON payments
  FOR INSERT WITH CHECK (false);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (workspace_id = auth_workspace_id());

CREATE POLICY subscriptions_no_direct_write ON subscriptions
  FOR INSERT WITH CHECK (false);

-- ── AUDIT_LOGS ────────────────────────────────────────────────────────────────
-- audit_logs é escrito apenas pelo service_role (backend).
-- Admins do workspace podem ler os logs do seu workspace.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (
    workspace_id = auth_workspace_id()
    AND auth_is_manager()
  );

-- Inserção apenas via service_role
CREATE POLICY audit_logs_no_direct_insert ON audit_logs
  FOR INSERT WITH CHECK (false);

-- ── SCIENTIFIC_REFERENCES ────────────────────────────────────────────────────
-- Base científica é leitura pública para todos os usuários autenticados;
-- escrita apenas por admin global (service_role).
ALTER TABLE scientific_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY scientific_references_select ON scientific_references
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY scientific_references_insert ON scientific_references
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY scientific_references_update ON scientific_references
  FOR UPDATE USING (auth_user_role() = 'admin');

-- ── SCIENTIFIC_BASE_HEALTH ───────────────────────────────────────────────────
ALTER TABLE scientific_base_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY scientific_base_health_select ON scientific_base_health
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY scientific_base_health_update ON scientific_base_health
  FOR UPDATE USING (auth_user_role() = 'admin');

-- ── SUPPLEMENTS (catálogo global) ────────────────────────────────────────────
ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;

-- Catálogo é leitura pública para usuários autenticados
CREATE POLICY supplements_select ON supplements
  FOR SELECT USING (auth.role() = 'authenticated');

-- Apenas admin pode enriquecer o catálogo
CREATE POLICY supplements_insert ON supplements
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY supplements_update ON supplements
  FOR UPDATE USING (auth_user_role() = 'admin');

-- =============================================================
-- GRANT: service_role bypassa RLS (comportamento padrão Supabase)
-- authenticated role usa as políticas acima
-- anon role não tem acesso a nenhuma tabela
-- =============================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

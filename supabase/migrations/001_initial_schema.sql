-- ============================================================
-- NutriPerformance Clinical — Migration 001: Initial Schema
-- ============================================================
-- Run via: supabase db push  OR  psql $DATABASE_URL -f this_file
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Workspaces ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'profissional'
                  CHECK (plan IN ('starter','profissional','clinica','institucional')),
  tokens_total  INTEGER NOT NULL DEFAULT 500,
  tokens_used   INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Profiles (extend auth.users) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'professional'
                  CHECK (role IN ('admin','professional','viewer')),
  council_type  TEXT CHECK (council_type IN ('CRN','CREF','CRM','other')),
  council_number TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Patients ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  internal_code       TEXT NOT NULL,
  -- Dados pessoais (pseudonimizados conforme LGPD)
  name                TEXT,  -- Armazenado apenas com consentimento
  birth_date          DATE,
  gender              TEXT CHECK (gender IN ('male','female','other','not_informed')),
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  emergency_contact   TEXT,
  -- Dados clínicos
  primary_goal        TEXT,
  medical_history     TEXT,
  current_medications TEXT,
  allergies           TEXT,
  dietary_restrictions TEXT[],
  lgpd_consent        BOOLEAN NOT NULL DEFAULT false,
  lgpd_consent_date   TIMESTAMPTZ,
  -- Status
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','archived')),
  -- Soft delete
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, internal_code)
);

-- ─── Assessments — Nutritional ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutritional_assessments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  professional_id       UUID REFERENCES profiles(id),
  -- Anamnese
  main_complaint        TEXT,
  dietary_restrictions  TEXT,
  meal_frequency        INTEGER,
  water_intake_ml       INTEGER,
  alcohol_consumption   TEXT,
  bowel_habits          TEXT,
  -- Antropometria
  weight_kg             DECIMAL(5,2),
  height_cm             DECIMAL(5,2),
  age                   INTEGER,
  gender                TEXT,
  -- Cálculo energético
  bmr_formula           TEXT DEFAULT 'mifflin',
  activity_level        TEXT,
  bmr_kcal              INTEGER,
  tee_kcal              INTEGER,
  bmi                   DECIMAL(4,1),
  -- Metas
  caloric_target        INTEGER,
  protein_target_g      DECIMAL(6,2),
  carb_target_g         DECIMAL(6,2),
  fat_target_g          DECIMAL(6,2),
  -- Diagnóstico (exclusivo nutricionista)
  nutritional_diagnosis TEXT,
  dietary_strategy      TEXT,
  professional_notes    TEXT,
  -- IA
  ai_summary            TEXT,
  ai_model              TEXT,
  tokens_used           INTEGER DEFAULT 0,
  -- Soft delete
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Assessments — Physical ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS physical_assessments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  professional_id       UUID REFERENCES profiles(id),
  -- Medidas básicas
  weight_kg             DECIMAL(5,2),
  height_cm             DECIMAL(5,2),
  bmi                   DECIMAL(4,1),
  body_fat_pct          DECIMAL(4,1),
  lean_mass_kg          DECIMAL(5,2),
  muscle_mass_kg        DECIMAL(5,2),
  bone_mass_kg          DECIMAL(4,2),
  assessment_method     TEXT,
  -- Circunferências (cm)
  waist_cm              DECIMAL(5,1),
  hip_cm                DECIMAL(5,1),
  neck_cm               DECIMAL(5,1),
  chest_cm              DECIMAL(5,1),
  right_arm_cm          DECIMAL(5,1),
  right_thigh_cm        DECIMAL(5,1),
  right_calf_cm         DECIMAL(5,1),
  whr                   DECIMAL(4,3),
  -- Atividade
  activity_level        TEXT,
  weekly_frequency      INTEGER,
  session_duration_min  INTEGER,
  sport_modality        TEXT,
  training_intensity    TEXT,
  resting_heart_rate    INTEGER,
  blood_pressure        TEXT,
  -- Objetivos
  primary_goal          TEXT,
  target_weight_kg      DECIMAL(5,2),
  target_body_fat_pct   DECIMAL(4,1),
  target_date           DATE,
  professional_notes    TEXT,
  -- Risk score (calculado)
  cardiometabolic_risk_score INTEGER,
  -- Soft delete
  deleted_at            TIMESTAMPTZ,
  tokens_used           INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Patient Supplements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_supplements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  supplement_name   TEXT NOT NULL,
  brand             TEXT,
  category          TEXT,
  dose              TEXT NOT NULL,
  frequency         TEXT NOT NULL,
  timing            TEXT,
  start_date        DATE,
  end_date          DATE,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  professional_notes TEXT,
  risk_level        TEXT DEFAULT 'low'
                      CHECK (risk_level IN ('low','moderate','high','contraindicated','insufficient_data')),
  -- Soft delete
  deleted_at        TIMESTAMPTZ,
  added_by          UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Interaction Analyses ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interaction_analyses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id),
  -- Input
  supplements_input  JSONB,
  medications_input  JSONB,
  conditions_input   TEXT[],
  patient_age        INTEGER,
  is_pregnant        BOOLEAN DEFAULT false,
  -- Output
  results         JSONB,
  overall_risk    TEXT,
  ai_analysis     TEXT,
  ai_model        TEXT,
  tokens_used     INTEGER DEFAULT 0,
  -- Soft delete
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Bioavailability Analyses ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bioavailability_analyses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id),
  nutrients_input TEXT[],
  medications_input TEXT[],
  gi_conditions   TEXT[],
  surgical_history TEXT[],
  dietary_factors TEXT[],
  results         JSONB,
  ai_assessment   TEXT,
  ai_model        TEXT,
  tokens_used     INTEGER DEFAULT 0,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Lab Exams ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_exams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id),
  exam_date       DATE NOT NULL,
  lab_name        TEXT,
  results         JSONB NOT NULL DEFAULT '[]',
  ai_context      TEXT,
  professional_interpretation TEXT,
  tokens_used     INTEGER DEFAULT 0,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Patient Goals ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id),
  goal_type       TEXT NOT NULL,
  description     TEXT NOT NULL,
  baseline_value  DECIMAL(10,2),
  target_value    DECIMAL(10,2),
  target_unit     TEXT,
  start_date      DATE,
  target_date     DATE,
  is_achieved     BOOLEAN NOT NULL DEFAULT false,
  achieved_at     TIMESTAMPTZ,
  checkpoints     JSONB NOT NULL DEFAULT '[]',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Reports ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id),
  report_type     TEXT NOT NULL,
  title           TEXT NOT NULL,
  modules         TEXT[],
  content_json    JSONB,
  pdf_url         TEXT,
  tokens_used     INTEGER DEFAULT 0,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Token Usage Log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_usage_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id),
  module          TEXT NOT NULL,
  action          TEXT NOT NULL,
  tokens_consumed INTEGER NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audit Log (LGPD) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_email      TEXT,
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  entity_label    TEXT,
  old_data        JSONB,
  new_data        JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Evidence Base (Interações) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_base (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_a        TEXT NOT NULL,
  entity_a_type   TEXT NOT NULL CHECK (entity_a_type IN ('supplement','medication','condition','nutrient')),
  entity_b        TEXT NOT NULL,
  entity_b_type   TEXT NOT NULL CHECK (entity_b_type IN ('supplement','medication','condition','nutrient')),
  risk_level      TEXT NOT NULL CHECK (risk_level IN ('low','moderate','high','contraindicated','insufficient_data')),
  mechanism       TEXT NOT NULL,
  recommendation  TEXT NOT NULL,
  confidence      TEXT NOT NULL CHECK (confidence IN ('high','moderate','low')),
  evidence_type   TEXT,
  references_text TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

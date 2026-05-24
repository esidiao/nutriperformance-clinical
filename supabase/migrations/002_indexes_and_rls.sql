-- ============================================================
-- NutriPerformance Clinical — Migration 002: Indexes + RLS
-- ============================================================

-- ─── Performance Indexes ─────────────────────────────────────────────────────

-- patients
CREATE INDEX IF NOT EXISTS idx_patients_workspace   ON patients(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_status       ON patients(workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_code         ON patients(workspace_id, internal_code);

-- assessments
CREATE INDEX IF NOT EXISTS idx_nutritional_patient   ON nutritional_assessments(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nutritional_workspace ON nutritional_assessments(workspace_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_physical_patient      ON physical_assessments(patient_id) WHERE deleted_at IS NULL;

-- supplements
CREATE INDEX IF NOT EXISTS idx_supplements_patient   ON patient_supplements(patient_id) WHERE deleted_at IS NULL AND is_active = true;

-- interaction analyses
CREATE INDEX IF NOT EXISTS idx_interactions_patient  ON interaction_analyses(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_workspace ON interaction_analyses(workspace_id, created_at DESC);

-- lab exams
CREATE INDEX IF NOT EXISTS idx_lab_patient           ON lab_exams(patient_id) WHERE deleted_at IS NULL;

-- audit logs
CREATE INDEX IF NOT EXISTS idx_audit_workspace       ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user            ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity          ON audit_logs(entity_type, entity_id);

-- token usage
CREATE INDEX IF NOT EXISTS idx_tokens_workspace      ON token_usage_log(workspace_id, created_at DESC);

-- evidence base
CREATE INDEX IF NOT EXISTS idx_evidence_a            ON evidence_base(lower(entity_a));
CREATE INDEX IF NOT EXISTS idx_evidence_b            ON evidence_base(lower(entity_b));
CREATE INDEX IF NOT EXISTS idx_evidence_risk         ON evidence_base(risk_level) WHERE is_active = true;

-- ─── Updated_at trigger function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workspaces','profiles','patients','nutritional_assessments',
    'physical_assessments','patient_supplements','lab_exams',
    'patient_goals','evidence_base'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at_%1$s ON %1$s;
       CREATE TRIGGER trg_updated_at_%1$s
       BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t
    );
  END LOOP;
END;
$$;

-- ─── Audit log trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_patient_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (workspace_id, entity_type, entity_id, entity_label, action, old_data)
    VALUES (OLD.workspace_id, 'patient', OLD.id, OLD.internal_code, 'DELETE', row_to_json(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (workspace_id, entity_type, entity_id, entity_label, action, old_data, new_data)
    VALUES (NEW.workspace_id, 'patient', NEW.id, NEW.internal_code, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (workspace_id, entity_type, entity_id, entity_label, action, new_data)
    VALUES (NEW.workspace_id, 'patient', NEW.id, NEW.internal_code, 'INSERT', row_to_json(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_patients
AFTER INSERT OR UPDATE OR DELETE ON patients
FOR EACH ROW EXECUTE FUNCTION log_patient_changes();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE workspaces          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutritional_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_assessments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_supplements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_analyses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bioavailability_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_exams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_base       ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's workspace_id
CREATE OR REPLACE FUNCTION current_workspace_id()
RETURNS UUID AS $$
  SELECT workspace_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Workspace: user sees only their own ──
CREATE POLICY workspace_own ON workspaces
  FOR ALL USING (id = current_workspace_id());

-- ── Profiles: user sees own workspace ──
CREATE POLICY profiles_own_workspace ON profiles
  FOR ALL USING (workspace_id = current_workspace_id() OR id = auth.uid());

-- ── Patients: workspace isolation + soft delete filter ──
CREATE POLICY patients_workspace ON patients
  FOR ALL USING (workspace_id = current_workspace_id() AND deleted_at IS NULL);

-- ── Assessments: follow patient's workspace ──
CREATE POLICY nutritional_workspace ON nutritional_assessments
  FOR ALL USING (workspace_id = current_workspace_id() AND deleted_at IS NULL);

CREATE POLICY physical_workspace ON physical_assessments
  FOR ALL USING (workspace_id = current_workspace_id() AND deleted_at IS NULL);

CREATE POLICY supplements_workspace ON patient_supplements
  FOR ALL USING (workspace_id = current_workspace_id() AND deleted_at IS NULL);

CREATE POLICY interactions_workspace ON interaction_analyses
  FOR ALL USING (workspace_id = current_workspace_id() AND deleted_at IS NULL);

CREATE POLICY bioavailability_workspace ON bioavailability_analyses
  FOR ALL USING (workspace_id = current_workspace_id() AND deleted_at IS NULL);

CREATE POLICY lab_workspace ON lab_exams
  FOR ALL USING (workspace_id = current_workspace_id() AND deleted_at IS NULL);

CREATE POLICY goals_workspace ON patient_goals
  FOR ALL USING (workspace_id = current_workspace_id() AND deleted_at IS NULL);

CREATE POLICY reports_workspace ON reports
  FOR ALL USING (workspace_id = current_workspace_id() AND deleted_at IS NULL);

CREATE POLICY tokens_workspace ON token_usage_log
  FOR ALL USING (workspace_id = current_workspace_id());

CREATE POLICY audit_workspace ON audit_logs
  FOR SELECT USING (workspace_id = current_workspace_id() OR is_admin());

-- Evidence base: read-only for all authenticated users
CREATE POLICY evidence_read ON evidence_base
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admin: full access via service role (bypasses RLS)
-- Service role key is used in NestJS backend only

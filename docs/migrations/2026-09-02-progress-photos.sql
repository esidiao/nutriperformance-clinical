-- =============================================================
-- Fotos de evolução corporal — lacuna 11 do benchmark competitivo
--
-- O QUE ESTE MÓDULO NÃO FAZ: estimar composição corporal a partir da imagem.
-- O benchmark descreve "estimativa por foto". Fazer isso com IA generalista
-- produziria um percentual de gordura que PARECE medida clínica, entraria no
-- prontuário ao lado da bioimpedância e viraria base de conduta — sem
-- validação. A tabela de avaliação física tem `body_composition_method`
-- justamente porque o método importa; "IA olhou a foto" não é método.
--
-- O QUE FAZ: registro fotográfico padronizado para comparação visual.
--
-- Idempotente.
-- =============================================================

CREATE TABLE IF NOT EXISTS progress_photos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id),
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  created_by    UUID NOT NULL,

  -- Obrigatorio: comparacao so vale entre fotos do mesmo ponto de vista. Sem
  -- ele, a tela poria lado a lado uma foto de frente e uma de costas e
  -- chamaria isso de evolucao.
  angulo        TEXT NOT NULL,

  -- CAMINHO no bucket privado, nunca URL. Assinatura e gerada na leitura.
  foto_path     TEXT NOT NULL,

  tirada_em     DATE NOT NULL,
  observacao    TEXT,
  removida_em   TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT progress_photos_angulo_check CHECK (angulo IN ('frente', 'perfil', 'costas'))
);

CREATE INDEX IF NOT EXISTS idx_progress_photos_paciente
  ON progress_photos (workspace_id, patient_id, tirada_em);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS progress_photos_select ON progress_photos;
CREATE POLICY progress_photos_select ON progress_photos
  FOR SELECT USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS progress_photos_insert ON progress_photos;
CREATE POLICY progress_photos_insert ON progress_photos
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS progress_photos_update ON progress_photos;
CREATE POLICY progress_photos_update ON progress_photos
  FOR UPDATE USING (workspace_id = auth_workspace_id());

-- COM policy de DELETE, diferente das outras tabelas: se a pessoa pede que a
-- imagem do corpo dela saia, guardar copia "inativa" atende a conveniencia do
-- sistema, nao o pedido dela.
DROP POLICY IF EXISTS progress_photos_delete ON progress_photos;
CREATE POLICY progress_photos_delete ON progress_photos
  FOR DELETE USING (workspace_id = auth_workspace_id());

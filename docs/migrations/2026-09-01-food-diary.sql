-- =============================================================
-- Diário alimentar por foto — lacuna 6 do benchmark competitivo
--
-- Segunda superfície pública. Difere da anamnese num ponto: o link é MULTIUSO,
-- porque o diário recebe fotos por semanas.
--
-- Idempotente.
-- =============================================================

CREATE TABLE IF NOT EXISTS food_diary_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id),
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  created_by    UUID NOT NULL,
  token_hash    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ativo',
  expira_em     TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_diary_links_status_check CHECK (status IN ('ativo', 'revogado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_diary_links_token
  ON food_diary_links (token_hash);
CREATE INDEX IF NOT EXISTS idx_food_diary_links_paciente
  ON food_diary_links (workspace_id, patient_id);

CREATE TABLE IF NOT EXISTS food_diary_entries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id),
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  link_id       UUID REFERENCES food_diary_links(id) ON DELETE SET NULL,

  refeicao      TEXT NOT NULL,
  descricao     TEXT,

  -- CAMINHO no bucket privado, nunca uma URL. URL assinada é gerada na leitura
  -- e expira; gravada, viraria link permanente para a foto do paciente.
  foto_path     TEXT,

  -- tomada_em = quando comeu. created_at = quando enviou. Quase todo mundo
  -- registra depois; juntar os dois faria a refeição das 12h aparecer às 22h.
  tomada_em     TIMESTAMPTZ NOT NULL,

  origem        TEXT NOT NULL DEFAULT 'paciente',
  comentario    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT food_diary_refeicao_check CHECK (refeicao IN (
    'cafe_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia'
  )),
  CONSTRAINT food_diary_origem_check CHECK (origem IN ('paciente', 'profissional')),
  -- Nem foto nem descricao nao e registro nenhum.
  CONSTRAINT food_diary_conteudo_check CHECK (
    descricao IS NOT NULL OR foto_path IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_food_diary_entries_paciente
  ON food_diary_entries (workspace_id, patient_id, tomada_em DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE food_diary_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_diary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS food_diary_links_select ON food_diary_links;
CREATE POLICY food_diary_links_select ON food_diary_links
  FOR SELECT USING (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS food_diary_links_insert ON food_diary_links;
CREATE POLICY food_diary_links_insert ON food_diary_links
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS food_diary_links_update ON food_diary_links;
CREATE POLICY food_diary_links_update ON food_diary_links
  FOR UPDATE USING (workspace_id = auth_workspace_id());

DROP POLICY IF EXISTS food_diary_entries_select ON food_diary_entries;
CREATE POLICY food_diary_entries_select ON food_diary_entries
  FOR SELECT USING (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS food_diary_entries_insert ON food_diary_entries;
CREATE POLICY food_diary_entries_insert ON food_diary_entries
  FOR INSERT WITH CHECK (workspace_id = auth_workspace_id());
DROP POLICY IF EXISTS food_diary_entries_update ON food_diary_entries;
CREATE POLICY food_diary_entries_update ON food_diary_entries
  FOR UPDATE USING (workspace_id = auth_workspace_id());

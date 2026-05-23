-- =============================================================
-- NutriPerformance Clinical — Dados Fictícios para Testes
-- IMPORTANTE: Todos os dados são fictícios. Não representam
-- pacientes, profissionais ou clínicas reais.
-- =============================================================

-- WORKSPACE DE TESTE
INSERT INTO workspaces (id, name, slug, plan, token_balance, is_active, trial_ends_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Clínica NutriTest Demo', 'nutritest-demo', 'individual_pro', 500, true, NOW() + INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000002', 'Academia PerformanceTest', 'performance-test', 'clinic', 2000, true, NULL);

-- USUÁRIOS DE TESTE (auth_id seria fornecido pelo Supabase Auth)
INSERT INTO users (id, workspace_id, auth_id, email, full_name, role, council_type, council_number, council_state) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'auth-nutri-001', 'dra.ana@nutritest.com', 'Dra. Ana Costa', 'nutritionist', 'CFN', 'CRN-3 12345', 'SP'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'auth-admin-001', 'admin@nutritest.com', 'Admin Nutritest', 'admin', NULL, NULL, NULL),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000002', 'auth-ef-001', 'prof.lucas@performance.com', 'Prof. Lucas Oliveira', 'fitness_professional', 'CONFEF', '054321-G/SP', 'SP'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', 'auth-student-001', 'estudante@nutritest.com', 'João Silva (Estudante)', 'supervised_student', 'CFN', 'CRN-3 EST-001', 'SP');

-- SUPLEMENTOS (base de conhecimento)
INSERT INTO supplements (id, name, category, description, common_uses, evidence_level, general_warnings, contraindicated_conditions, drug_interactions, bioavailability_notes) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'Creatina Monoidratada',
    'creatine',
    'Suplemento ergogênico mais estudado. Aumenta fosfocreatina intramuscular.',
    ARRAY['Ganho de força', 'Hipertrofia', 'Melhora de performance em exercícios de alta intensidade'],
    'Meta-análise (Cochrane)',
    ARRAY['Pode elevar creatinina sérica (não indica lesão renal em pessoas saudáveis)', 'Hidratação adequada recomendada'],
    ARRAY['Doença renal crônica avançada', 'Insuficiência renal'],
    '[{"drug": "nefrotóxicos", "risk": "moderate", "mechanism": "potencial sobrecarga renal", "evidence": "expert_opinion"}]',
    'Melhor absorção com carboidratos. Fase de saturação opcional. Monoidratada tem biodisponibilidade equivalente a formas mais caras.'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Whey Protein Concentrado',
    'protein',
    'Proteína do soro do leite. Alta concentração de BCAAs e leucina.',
    ARRAY['Hipertrofia', 'Recuperação muscular', 'Complementação proteica'],
    'Meta-análise',
    ARRAY['Contraindicado em alergia ao leite', 'Pode causar desconforto GI em intolerantes à lactose (preferir isolado)'],
    ARRAY['Alergia à proteína do leite'],
    '[]',
    'Absorção rápida (~2h). Ideal pós-treino. Isomer tem menor lactose.'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Cafeína Anidra',
    'caffeine',
    'Estimulante do SNC. Melhora alerta, foco e performance aeróbica.',
    ARRAY['Performance aeróbica', 'Foco e concentração', 'Pré-treino'],
    'Meta-análise (forte evidência)',
    ARRAY['Pode elevar PA transitoriamente', 'Insônia se consumida após 14h', 'Dependência e tolerância', 'Taquicardia em doses altas'],
    ARRAY['Arritmias cardíacas', 'Hipertensão não controlada', 'Ansiedade grave', 'Gestação (>200mg/dia)'],
    '[{"drug": "estimulantes", "risk": "high", "mechanism": "efeito aditivo no SNC e sistema cardiovascular", "evidence": "rct"}, {"drug": "anticoagulantes", "risk": "low", "mechanism": "pode afetar absorção", "evidence": "case_report"}]',
    'Absorção oral rápida (~45min). Pico em 1h. Meia-vida 3-5h.'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'Vitamina D3 (Colecalciferol)',
    'vitamins',
    'Vitamina lipossolúvel essencial para saúde óssea, imunidade e função muscular.',
    ARRAY['Deficiência de vitamina D', 'Saúde óssea', 'Imunidade', 'Função muscular'],
    'Meta-análise',
    ARRAY['Toxicidade em megadoses (>10.000 UI/dia por período prolongado)', 'Monitorar 25-OH vitamina D sérica'],
    ARRAY['Hipercalcemia', 'Sarcoidose'],
    '[{"drug": "digoxina", "risk": "moderate", "mechanism": "hipercalcemia pode potencializar toxicidade da digoxina", "evidence": "observational"}]',
    'Lipossolúvel — absorção aumentada com refeição gordurosa. Obesidade reduz biodisponibilidade. D3 > D2 em eficácia.'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'Sulfato Ferroso',
    'minerals',
    'Forma inorgânica de ferro. Amplamente utilizada para reposição de ferro.',
    ARRAY['Anemia ferropriva', 'Deficiência de ferro'],
    'Meta-análise',
    ARRAY['Pode causar náusea, constipação, fezes escuras', 'Interação com vários medicamentos e alimentos'],
    ARRAY['Hemocromatose', 'Anemia não-ferropriva'],
    '[{"drug": "omeprazol", "risk": "moderate", "mechanism": "IBPs reduzem absorção de ferro por elevar pH gástrico", "evidence": "observational"}, {"drug": "ciprofloxacino", "risk": "high", "mechanism": "ferro quelata fluoroquinolonas, reduzindo absorção do antibiótico", "evidence": "rct"}, {"drug": "levotiroxina", "risk": "moderate", "mechanism": "ferro reduz absorção de levotiroxina", "evidence": "rct"}]',
    'Melhor absorção em jejum com vitamina C. Inibida por cálcio, fitatos, taninos, IBPs. Ferro quelato tem melhor tolerância GI.'
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    'Ômega-3 (EPA+DHA)',
    'omega3',
    'Ácidos graxos poli-insaturados de cadeia longa. Ação anti-inflamatória.',
    ARRAY['Saúde cardiovascular', 'Inflamação', 'Saúde mental', 'Triglicerídeos elevados'],
    'Meta-análise',
    ARRAY['Em doses altas (>3g/dia): efeito anticoagulante relevante', 'Pode causar refluxo em algumas pessoas'],
    ARRAY[]::text[],
    '[{"drug": "warfarina", "risk": "moderate", "mechanism": "efeito aditivo anticoagulante em doses altas", "evidence": "observational"}, {"drug": "aspirina", "risk": "low", "mechanism": "efeito aditivo antiagregante", "evidence": "rct"}]',
    'Absorção aumentada com refeição. EPA e DHA têm melhor absorção que ALA. Forma triglicerídeo > forma etil éster.'
  ),
  (
    '10000000-0000-0000-0000-000000000007',
    'Hipericão (Hypericum perforatum)',
    'herbal',
    'Fitoterápico com atividade antidepressiva leve. Forte indutor de CYP3A4.',
    ARRAY['Depressão leve a moderada', 'Ansiedade leve'],
    'Meta-análise (para depressão leve)',
    ARRAY['FORTE INDUTOR de CYP3A4 — múltiplas interações medicamentosas relevantes', 'Fotossensibilidade', 'Síndrome serotoninérgica possível'],
    ARRAY['Em uso de qualquer medicamento metabolizado por CYP3A4 (verificar sempre)'],
    '[{"drug": "contraceptivos orais", "risk": "high", "mechanism": "indução CYP3A4 reduz concentração dos hormônios", "evidence": "rct"}, {"drug": "warfarina", "risk": "high", "mechanism": "reduz concentração de varfarina por indução enzimática", "evidence": "rct"}, {"drug": "antirretrovirais", "risk": "contraindicated", "mechanism": "reduz significativamente concentração de antiretrovirais", "evidence": "rct"}, {"drug": "imunossupressores", "risk": "contraindicated", "mechanism": "pode precipitar rejeição em transplantados", "evidence": "rct"}]',
    'Absorção oral adequada. Biodisponibilidade não é o fator limitante — o problema são as interações.'
  ),
  (
    '10000000-0000-0000-0000-000000000008',
    'Magnésio Quelato (Bisglicinato)',
    'minerals',
    'Magnésio complexado com glicina. Melhor tolerância GI que formas inorgânicas.',
    ARRAY['Deficiência de magnésio', 'Câimbras', 'Qualidade do sono', 'Saúde muscular'],
    'ECR',
    ARRAY['Em doses altas: diarreia (menos que óxido)', 'Excesso pode causar hipotensão'],
    ARRAY['Insuficiência renal grave'],
    '[{"drug": "antibioticos_tetraciclinas", "risk": "moderate", "mechanism": "magnésio pode quelar tetraciclinas, reduzindo absorção", "evidence": "observational"}]',
    'Bisglicinato tem melhor absorção e tolerância GI que óxido e citrato. Evitar com refeições ricas em fitatos.'
  );

-- PACIENTES FICTÍCIOS DE TESTE
-- NOTA: campos _encrypted aqui são texto simples para seed
-- Em produção, seriam criptografados via aplicação

-- Paciente 1: Mulher, 28 anos, objetivo de hipertrofia
INSERT INTO patients (id, workspace_id, name_encrypted, birth_date, gender, lgpd_consent, lgpd_consent_at, internal_code, created_by)
VALUES (
  'A0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'SEED_DADOS_TESTE_NAO_REAL'::bytea,
  '1997-03-15',
  'female',
  true,
  NOW(),
  'PAC-SEED-001',
  '00000000-0000-0000-0001-000000000001'
);

-- Vinculação profissional
INSERT INTO patient_professionals (patient_id, user_id, role)
VALUES ('A0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'nutritionist');

-- Condições clínicas da paciente 1
INSERT INTO patient_clinical_conditions (patient_id, condition, cid_code, recorded_by)
VALUES
  ('A0000000-0000-0000-0000-000000000001', 'Síndrome do Intestino Irritável', 'K58', '00000000-0000-0000-0001-000000000001'),
  ('A0000000-0000-0000-0000-000000000001', 'Deficiência de Vitamina D', 'E55.9', '00000000-0000-0000-0001-000000000001');

-- Medicamentos da paciente 1
INSERT INTO patient_medications (patient_id, name, active_principle, dose, frequency, is_continuous, recorded_by)
VALUES
  ('A0000000-0000-0000-0000-000000000001', 'Omeprazol 20mg', 'omeprazol', '20mg', '1x ao dia', true, '00000000-0000-0000-0001-000000000001');

-- Suplementação da paciente 1
INSERT INTO patient_supplementation (patient_id, workspace_id, recorded_by, supplement_id, supplement_name, brand, category, dose, dose_numeric_g, frequency, timing, with_meal, with_training, purpose, is_active)
VALUES
  ('A0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001',
   '10000000-0000-0000-0000-000000000001', 'Creatina Monoidratada', 'Optimum Nutrition', 'creatine',
   '5g', 5.0, 'Diária', 'Pós-treino', true, true, 'Hipertrofia e ganho de força', true),
  ('A0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001',
   '10000000-0000-0000-0000-000000000005', 'Sulfato Ferroso', 'Genérico', 'minerals',
   '40mg de ferro elementar', 0.04, 'Diária', 'Em jejum', false, false, 'Anemia ferropriva em investigação', true);

-- Avaliação física da paciente 1
INSERT INTO physical_assessments (patient_id, workspace_id, created_by, assessment_date, weight_kg, height_cm, bmi, body_fat_pct, lean_mass_kg, muscle_mass_kg, waist_cm, hip_cm, waist_hip_ratio, activity_level, weekly_frequency, session_duration_min, sport_modality, primary_goal, total_energy_kcal, is_draft)
VALUES (
  'A0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000001',
  CURRENT_DATE,
  65.5, 165.0, 24.1, 28.5, 46.8, 43.2, 72.0, 98.0, 0.735,
  'very_active', 5, 60, 'Musculação + HIIT',
  'hypertrophy', 2150.0, false
);

-- Avaliação nutricional da paciente 1
INSERT INTO nutritional_assessments (patient_id, workspace_id, created_by, assessment_date, basal_metabolic_rate, bmr_formula, total_energy_expenditure, pal_factor, caloric_target, protein_target_g, carb_target_g, fat_target_g, water_intake_ml, meal_frequency, dietary_strategy, nutritional_diagnosis, is_draft)
VALUES (
  'A0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000001',
  CURRENT_DATE,
  1520.0, 'Mifflin-St Jeor', 2280.0, 1.5, 2400.0, 147.0, 305.0, 69.0, 2500, 5,
  'Dieta hiperproteica moderada com periodização de carboidratos',
  'Estado nutricional limítrofe com necessidade de ajuste proteico e acompanhamento da absorção de ferro',
  false
);

-- Metas da paciente 1
INSERT INTO patient_goals (patient_id, workspace_id, created_by, goal_type, description, target_value, target_unit, baseline_value, start_date, target_date)
VALUES
  ('A0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001',
   'hypertrophy', 'Aumentar massa muscular', 47.0, 'kg', 43.2, CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months'),
  ('A0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001',
   'body_recomposition', 'Reduzir percentual de gordura', 23.0, '%', 28.5, CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months');

-- Histórico de tokens (workspace 1)
INSERT INTO token_transactions (workspace_id, user_id, operation, amount, balance_after, description, module)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'purchase', 600, 600, 'Recarga — Plano Profissional', 'billing'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'consumption', -10, 590, 'Avaliação nutricional com IA', 'nutritional_assessment_ai'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'consumption', -5, 585, 'Avaliação física com IA', 'physical_assessment_ai'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'consumption', -15, 570, 'Análise de interações', 'interaction_analysis'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'consumption', -5, 565, 'Relatório PDF', 'report_generation'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'consumption', -8, 557, 'Análise de suplementação', 'supplementation_analysis');

-- Referências científicas de exemplo
INSERT INTO scientific_references (category, title, authors, journal, year, evidence_type, summary, tags, applies_to, last_reviewed)
VALUES
  ('supplementation', 'International Society of Sports Nutrition position stand: creatine supplementation and exercise',
   'Kreider RB et al.', 'Journal of the International Society of Sports Nutrition', 2017,
   'meta-analysis', 'Creatina é o suplemento ergogênico mais eficaz e seguro para aumentar capacidade de exercício de alta intensidade. Segura em pessoas saudáveis.',
   ARRAY['creatina', 'performance', 'segurança'], ARRAY['creatina', 'creatine'], '2023-01-15'),

  ('drug_interactions', 'Herbal supplement-drug interactions: scientific and regulatory perspectives',
   'Izzo AA, Ernst E', 'Trends in Pharmacological Sciences', 2009,
   'review', 'Hipericão tem múltiplas interações clinicamente relevantes via indução de CYP3A4.',
   ARRAY['hipericão', 'interação', 'CYP3A4'], ARRAY['hipericão', 'hypericum perforatum', 'st john wort'], '2022-06-01'),

  ('bioavailability', 'Iron absorption: factors, limitations, and improvement methods',
   'Abbaspour N et al.', 'Journal of Research in Medical Sciences', 2014,
   'review', 'IBPs, fitatos, cálcio e taninos reduzem absorção de ferro. Vitamina C e ácido cítrico aumentam absorção de ferro não-heme.',
   ARRAY['ferro', 'absorção', 'biodisponibilidade', 'IBP'], ARRAY['ferro', 'sulfato ferroso', 'iron'], '2023-03-10');

-- Atualizar saúde da base científica
UPDATE scientific_base_health SET last_updated_at = NOW() WHERE category IN ('supplementation', 'drug_interactions', 'bioavailability');

-- =============================================================
-- SUMÁRIO DOS DADOS DE TESTE
-- =============================================================
-- Workspaces: 2
-- Usuários: 4 (nutricionista, admin, educador físico, estudante)
-- Pacientes: 1 (fictício, LGPD-compliant)
-- Suplementos na base: 8
-- Referências científicas: 3
-- Transações de token: 6
-- =============================================================

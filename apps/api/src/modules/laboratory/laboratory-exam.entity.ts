import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('laboratory_exams')
export class LaboratoryExam {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'created_by' }) createdBy: string;
  @Column({ name: 'collection_date', type: 'date' }) collectionDate: Date;
  @Column({ name: 'report_date', type: 'date', nullable: true }) reportDate: Date | null;
  @Column({ name: 'laboratory_name', nullable: true }) laboratoryName: string | null;
  @Column({ name: 'requesting_physician', nullable: true }) requestingPhysician: string | null;

  // Hematologia
  @Column({ name: 'hemoglobin_g_dl', type: 'numeric', precision: 5, scale: 2, nullable: true }) hemoglobinGDl: number | null;
  @Column({ name: 'hematocrit_pct', type: 'numeric', precision: 5, scale: 2, nullable: true }) hematocritPct: number | null;
  @Column({ name: 'mcv_fl', type: 'numeric', precision: 5, scale: 1, nullable: true }) mcvFl: number | null;
  @Column({ name: 'mchc_g_dl', type: 'numeric', precision: 5, scale: 2, nullable: true }) mchcGDl: number | null;
  @Column({ name: 'leukocytes_ul', type: 'numeric', precision: 8, scale: 0, nullable: true }) leukocytesUl: number | null;
  @Column({ name: 'platelets_ul', type: 'numeric', precision: 8, scale: 0, nullable: true }) plateletsUl: number | null;

  // Metabolismo do ferro
  @Column({ name: 'ferritin_ng_ml', type: 'numeric', precision: 7, scale: 2, nullable: true }) ferritinNgMl: number | null;
  @Column({ name: 'serum_iron_ug_dl', type: 'numeric', precision: 6, scale: 1, nullable: true }) serumIronUgDl: number | null;
  @Column({ name: 'tibc_ug_dl', type: 'numeric', precision: 6, scale: 1, nullable: true }) tibcUgDl: number | null;
  @Column({ name: 'transferrin_saturation_pct', type: 'numeric', precision: 5, scale: 2, nullable: true }) transferrinSaturationPct: number | null;

  // Vitaminas
  @Column({ name: 'vitamin_d_ng_ml', type: 'numeric', precision: 6, scale: 2, nullable: true }) vitaminDNgMl: number | null;
  @Column({ name: 'vitamin_b12_pg_ml', type: 'numeric', precision: 7, scale: 2, nullable: true }) vitaminB12PgMl: number | null;
  @Column({ name: 'folic_acid_ng_ml', type: 'numeric', precision: 6, scale: 2, nullable: true }) folicAcidNgMl: number | null;

  // Minerais
  @Column({ name: 'zinc_ug_dl', type: 'numeric', precision: 6, scale: 2, nullable: true }) zincUgDl: number | null;
  @Column({ name: 'magnesium_mg_dl', type: 'numeric', precision: 5, scale: 2, nullable: true }) magnesiumMgDl: number | null;
  @Column({ name: 'calcium_mg_dl', type: 'numeric', precision: 5, scale: 2, nullable: true }) calciumMgDl: number | null;

  // Glicemia e insulina
  @Column({ name: 'fasting_glucose_mg_dl', type: 'numeric', precision: 5, scale: 1, nullable: true }) fastingGlucoseMgDl: number | null;
  @Column({ name: 'hba1c_pct', type: 'numeric', precision: 4, scale: 2, nullable: true }) hba1cPct: number | null;
  @Column({ name: 'insulin_uui_ml', type: 'numeric', precision: 6, scale: 2, nullable: true }) insulinUuiMl: number | null;
  @Column({ name: 'homa_ir', type: 'numeric', precision: 5, scale: 2, nullable: true }) homaIr: number | null;

  // Lipidograma
  @Column({ name: 'total_cholesterol_mg_dl', type: 'numeric', precision: 5, scale: 1, nullable: true }) totalCholesterolMgDl: number | null;
  @Column({ name: 'hdl_mg_dl', type: 'numeric', precision: 5, scale: 1, nullable: true }) hdlMgDl: number | null;
  @Column({ name: 'ldl_mg_dl', type: 'numeric', precision: 5, scale: 1, nullable: true }) ldlMgDl: number | null;
  @Column({ name: 'vldl_mg_dl', type: 'numeric', precision: 5, scale: 1, nullable: true }) vldlMgDl: number | null;
  @Column({ name: 'triglycerides_mg_dl', type: 'numeric', precision: 5, scale: 1, nullable: true }) triglyceridesMgDl: number | null;

  // Função renal
  @Column({ name: 'creatinine_mg_dl', type: 'numeric', precision: 5, scale: 2, nullable: true }) creatinineMgDl: number | null;
  @Column({ name: 'urea_mg_dl', type: 'numeric', precision: 5, scale: 1, nullable: true }) ureaMgDl: number | null;
  @Column({ name: 'uric_acid_mg_dl', type: 'numeric', precision: 5, scale: 2, nullable: true }) uricAcidMgDl: number | null;
  @Column({ name: 'egfr_ml_min', type: 'numeric', precision: 6, scale: 1, nullable: true }) egfrMlMin: number | null;

  // Função hepática
  @Column({ name: 'alt_u_l', type: 'numeric', precision: 6, scale: 1, nullable: true }) altUL: number | null;
  @Column({ name: 'ast_u_l', type: 'numeric', precision: 6, scale: 1, nullable: true }) astUL: number | null;
  @Column({ name: 'ggt_u_l', type: 'numeric', precision: 6, scale: 1, nullable: true }) ggtUL: number | null;
  @Column({ name: 'albumin_g_dl', type: 'numeric', precision: 4, scale: 2, nullable: true }) albuminGDl: number | null;

  // Hormônios
  @Column({ name: 'tsh_uui_ml', type: 'numeric', precision: 6, scale: 3, nullable: true }) tshUuiMl: number | null;
  @Column({ name: 'free_t4_ng_dl', type: 'numeric', precision: 5, scale: 3, nullable: true }) freeT4NgDl: number | null;
  @Column({ name: 'testosterone_ng_dl', type: 'numeric', precision: 7, scale: 2, nullable: true }) testosteroneNgDl: number | null;
  @Column({ name: 'cortisol_ug_dl', type: 'numeric', precision: 6, scale: 2, nullable: true }) cortisolUgDl: number | null;

  // Inflamação
  @Column({ name: 'crp_mg_l', type: 'numeric', precision: 6, scale: 2, nullable: true }) crpMgL: number | null;

  // Campos extras livres
  @Column({ name: 'custom_results', type: 'jsonb', default: '{}' }) customResults: Record<string, unknown>;

  // Análise
  @Column({ name: 'ai_analysis_id', type: 'uuid', nullable: true }) aiAnalysisId: string | null;
  @Column({ name: 'tokens_consumed', default: 0 }) tokensConsumed: number;
  @Column({ name: 'professional_interpretation', type: 'text', nullable: true }) professionalInterpretation: string | null;
  @Column({ name: 'flags', type: 'text', array: true, default: '{}' }) flags: string[];

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

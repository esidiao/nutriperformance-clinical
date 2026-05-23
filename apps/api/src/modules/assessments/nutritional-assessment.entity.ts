import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('nutritional_assessments')
export class NutritionalAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'created_by' }) createdBy: string;
  @Column({ name: 'assessment_date', type: 'date', default: () => 'CURRENT_DATE' }) assessmentDate: Date;

  // Anamnese
  @Column({ name: 'main_complaint', type: 'text', nullable: true }) mainComplaint: string | null;
  @Column({ name: 'food_history', type: 'text', nullable: true }) foodHistory: string | null;
  @Column({ name: 'dietary_restrictions', type: 'text', array: true, default: '{}' }) dietaryRestrictions: string[];
  @Column({ name: 'meal_frequency', nullable: true }) mealFrequency: number | null;
  @Column({ name: 'water_intake_ml', nullable: true }) waterIntakeMl: number | null;
  @Column({ name: 'alcohol_consumption', nullable: true }) alcoholConsumption: string | null;
  @Column({ nullable: true }) smoking: boolean | null;
  @Column({ name: 'bowel_habits', nullable: true }) bowelHabits: string | null;
  @Column({ name: 'gastrointestinal_symptoms', type: 'text', array: true, default: '{}' }) gastrointestinalSymptoms: string[];

  // Cálculo energético
  @Column({ name: 'basal_metabolic_rate', type: 'numeric', precision: 8, scale: 2, nullable: true }) basalMetabolicRate: number | null;
  @Column({ name: 'bmr_formula', nullable: true }) bmrFormula: string | null;
  @Column({ name: 'total_energy_expenditure', type: 'numeric', precision: 8, scale: 2, nullable: true }) totalEnergyExpenditure: number | null;
  @Column({ name: 'pal_factor', type: 'numeric', precision: 4, scale: 2, nullable: true }) palFactor: number | null;
  @Column({ name: 'caloric_target', type: 'numeric', precision: 8, scale: 2, nullable: true }) caloricTarget: number | null;
  @Column({ name: 'protein_target_g', type: 'numeric', precision: 6, scale: 2, nullable: true }) proteinTargetG: number | null;
  @Column({ name: 'carb_target_g', type: 'numeric', precision: 6, scale: 2, nullable: true }) carbTargetG: number | null;
  @Column({ name: 'fat_target_g', type: 'numeric', precision: 6, scale: 2, nullable: true }) fatTargetG: number | null;

  // Diagnóstico — campo do profissional
  @Column({ name: 'nutritional_diagnosis', type: 'text', nullable: true }) nutritionalDiagnosis: string | null;
  @Column({ name: 'dietary_strategy', type: 'text', nullable: true }) dietaryStrategy: string | null;
  @Column({ name: 'professional_notes', type: 'text', nullable: true }) professionalNotes: string | null;

  // Controle
  @Column({ name: 'ai_analysis_id', type: 'uuid', nullable: true }) aiAnalysisId: string | null;
  @Column({ name: 'tokens_consumed', default: 0 }) tokensConsumed: number;
  @Column({ name: 'is_draft', default: true }) isDraft: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

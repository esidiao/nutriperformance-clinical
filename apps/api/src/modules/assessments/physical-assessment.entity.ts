import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('physical_assessments')
export class PhysicalAssessment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'created_by' }) createdBy: string;
  @Column({ name: 'assessment_date', type: 'date', default: () => 'CURRENT_DATE' }) assessmentDate: Date;

  // Medidas antropométricas
  @Column({ name: 'weight_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) weightKg: number | null;
  @Column({ name: 'height_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) heightCm: number | null;
  @Column({ name: 'bmi', type: 'numeric', precision: 5, scale: 2, nullable: true }) bmi: number | null;

  // Composição corporal
  @Column({ name: 'body_fat_pct', type: 'numeric', precision: 5, scale: 2, nullable: true }) bodyFatPct: number | null;
  @Column({ name: 'body_fat_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) bodyFatKg: number | null;
  @Column({ name: 'lean_mass_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) leanMassKg: number | null;
  @Column({ name: 'muscle_mass_kg', type: 'numeric', precision: 6, scale: 2, nullable: true }) muscleMassKg: number | null;
  @Column({ name: 'bone_mass_kg', type: 'numeric', precision: 5, scale: 2, nullable: true }) boneMassKg: number | null;
  @Column({ name: 'visceral_fat_level', nullable: true }) visceralFatLevel: number | null;
  @Column({ name: 'body_water_pct', type: 'numeric', precision: 5, scale: 2, nullable: true }) bodyWaterPct: number | null;
  @Column({ name: 'body_composition_method', nullable: true }) bodyCompositionMethod: string | null;

  // Circunferências (cm)
  @Column({ name: 'waist_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) waistCm: number | null;
  @Column({ name: 'hip_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) hipCm: number | null;
  @Column({ name: 'whr', type: 'numeric', precision: 4, scale: 3, nullable: true }) whr: number | null;
  @Column({ name: 'neck_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) neckCm: number | null;
  @Column({ name: 'chest_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) chestCm: number | null;
  @Column({ name: 'abdomen_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) abdomenCm: number | null;
  @Column({ name: 'right_arm_relaxed_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) rightArmRelaxedCm: number | null;
  @Column({ name: 'right_arm_flexed_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) rightArmFlexedCm: number | null;
  @Column({ name: 'right_thigh_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) rightThighCm: number | null;
  @Column({ name: 'right_calf_cm', type: 'numeric', precision: 5, scale: 1, nullable: true }) rightCalfCm: number | null;

  // Dobras cutâneas (mm)
  @Column({ name: 'skinfold_triceps_mm', type: 'numeric', precision: 4, scale: 1, nullable: true }) skinfoldTricepsMm: number | null;
  @Column({ name: 'skinfold_subscapular_mm', type: 'numeric', precision: 4, scale: 1, nullable: true }) skinfoldSubscapularMm: number | null;
  @Column({ name: 'skinfold_suprailiac_mm', type: 'numeric', precision: 4, scale: 1, nullable: true }) skinfoldSuprailiacMm: number | null;
  @Column({ name: 'skinfold_abdominal_mm', type: 'numeric', precision: 4, scale: 1, nullable: true }) skinfoldAbdominalMm: number | null;
  @Column({ name: 'skinfold_thigh_mm', type: 'numeric', precision: 4, scale: 1, nullable: true }) skinfoldThighMm: number | null;
  @Column({ name: 'skinfold_chest_mm', type: 'numeric', precision: 4, scale: 1, nullable: true }) skinfoldChestMm: number | null;
  @Column({ name: 'skinfold_protocol', nullable: true }) skinfoldProtocol: string | null;

  // Atividade física
  @Column({ name: 'physical_activity_level', nullable: true }) physicalActivityLevel: string | null;
  @Column({ name: 'training_frequency_per_week', nullable: true }) trainingFrequencyPerWeek: number | null;
  @Column({ name: 'training_duration_min', nullable: true }) trainingDurationMin: number | null;
  @Column({ name: 'main_sport_activity', nullable: true }) mainSportActivity: string | null;
  @Column({ name: 'competitive_athlete', default: false }) competitiveAthlete: boolean;

  // Testes funcionais
  @Column({ name: 'vo2max_ml_kg_min', type: 'numeric', precision: 5, scale: 2, nullable: true }) vo2maxMlKgMin: number | null;
  @Column({ name: 'handgrip_right_kg', type: 'numeric', precision: 5, scale: 1, nullable: true }) handgripRightKg: number | null;
  @Column({ name: 'handgrip_left_kg', type: 'numeric', precision: 5, scale: 1, nullable: true }) handgripLeftKg: number | null;

  // Objetivos e diagnóstico
  @Column({ name: 'primary_goal', nullable: true }) primaryGoal: string | null;
  @Column({ name: 'fitness_diagnosis', type: 'text', nullable: true }) fitnessDiagnosis: string | null;
  @Column({ name: 'training_recommendations', type: 'text', nullable: true }) trainingRecommendations: string | null;
  @Column({ name: 'professional_notes', type: 'text', nullable: true }) professionalNotes: string | null;

  @Column({ name: 'is_draft', default: true }) isDraft: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('patient_supplementations')
export class PatientSupplementation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'prescribed_by' }) prescribedBy: string;

  // Identificação do suplemento
  @Column({ name: 'supplement_name' }) supplementName: string;
  @Column({ name: 'anvisa_category', nullable: true }) anvisaCategory: string | null;
  @Column({ name: 'brand', nullable: true }) brand: string | null;
  @Column({ name: 'active_compounds', type: 'text', array: true, default: '{}' }) activeCompounds: string[];

  // Posologia
  @Column({ name: 'dose_amount', type: 'numeric', precision: 8, scale: 2, nullable: true }) doseAmount: number | null;
  @Column({ name: 'dose_unit', nullable: true }) doseUnit: string | null;
  @Column({ name: 'frequency_per_day', nullable: true }) frequencyPerDay: number | null;
  @Column({ name: 'administration_timing', nullable: true }) administrationTiming: string | null;
  @Column({ name: 'administration_route', nullable: true }) administrationRoute: string | null;
  @Column({ name: 'with_food', nullable: true }) withFood: boolean | null;

  // Período
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate: Date | null;
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate: Date | null;
  @Column({ name: 'is_continuous', default: false }) isContinuous: boolean;
  @Column({ name: 'is_active', default: true }) isActive: boolean;

  // Objetivo e contexto
  @Column({ name: 'therapeutic_goal', type: 'text', nullable: true }) therapeuticGoal: string | null;
  @Column({ name: 'clinical_justification', type: 'text', nullable: true }) clinicalJustification: string | null;

  // Risco e análise
  @Column({ name: 'risk_level', default: 'low' }) riskLevel: string;
  @Column({ name: 'known_interactions', type: 'jsonb', default: '[]' }) knownInteractions: object[];
  @Column({ name: 'contraindications', type: 'text', array: true, default: '{}' }) contraindications: string[];
  @Column({ name: 'monitoring_required', default: false }) monitoringRequired: boolean;
  @Column({ name: 'monitoring_notes', type: 'text', nullable: true }) monitoringNotes: string | null;

  // IA
  @Column({ name: 'ai_analysis_id', type: 'uuid', nullable: true }) aiAnalysisId: string | null;
  @Column({ name: 'tokens_consumed', default: 0 }) tokensConsumed: number;

  @Column({ name: 'professional_notes', type: 'text', nullable: true }) professionalNotes: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('bioavailability_analyses')
export class BioavailabilityAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'analysis_date', type: 'timestamptz', default: () => 'NOW()' })
  analysisDate: Date;

  @Column({ name: 'nutrients_analyzed', type: 'text', array: true, default: '{}' })
  nutrientsAnalyzed: string[];

  @Column({ name: 'supplements_analyzed', type: 'text', array: true, default: '{}' })
  supplementsAnalyzed: string[];

  @Column({ name: 'compromising_factors', type: 'jsonb', default: '[]' })
  compromissingFactors: Record<string, unknown>[];

  @Column({ name: 'gi_conditions', type: 'text', array: true, default: '{}' })
  giConditions: string[];

  @Column({ name: 'medications_considered', type: 'text', array: true, default: '{}' })
  medicationsConsidered: string[];

  @Column({ name: 'surgical_history', type: 'text', array: true, default: '{}' })
  surgicalHistory: string[];

  @Column({ name: 'low_absorption_risks', type: 'jsonb', default: '[]' })
  lowAbsorptionRisks: Record<string, unknown>[];

  @Column({ name: 'investigation_suggestions', type: 'text', array: true, default: '{}' })
  investigationSuggestions: string[];

  @Column({ name: 'referral_needed', default: false })
  referralNeeded: boolean;

  @Column({ name: 'referral_reason', type: 'text', nullable: true })
  referralReason: string | null;

  @Column({ name: 'overall_assessment', type: 'text', nullable: true })
  overallAssessment: string | null;

  @Column({
    name: 'ai_disclaimer',
    type: 'text',
    default: 'Análise de apoio. Não substitui avaliação clínica.',
  })
  aiDisclaimer: string;

  @Column({ name: 'tokens_consumed', default: 0 })
  tokensConsumed: number;

  @Column({ name: 'professional_notes', type: 'text', nullable: true })
  professionalNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

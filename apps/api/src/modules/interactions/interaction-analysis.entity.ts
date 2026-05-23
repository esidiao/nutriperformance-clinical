import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';

@Entity('interaction_analyses')
export class InteractionAnalysis {
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

  @Column({ name: 'supplements_analyzed', type: 'jsonb' })
  supplementsAnalyzed: Record<string, unknown>[];

  @Column({ name: 'medications_analyzed', type: 'jsonb' })
  medicationsAnalyzed: Record<string, unknown>[];

  @Column({ name: 'conditions_analyzed', type: 'jsonb' })
  conditionsAnalyzed: string[];

  @Column({ name: 'lab_results_context', type: 'jsonb', nullable: true })
  labResultsContext: Record<string, unknown> | null;

  @Column({ name: 'interactions_found', type: 'jsonb', default: '[]' })
  interactionsFound: Record<string, unknown>[];

  @Column({
    name: 'overall_risk_level',
    type: 'enum',
    enum: ['low','moderate','high','contraindicated','insufficient_data'],
    default: 'insufficient_data',
  })
  overallRiskLevel: string;

  @Column({ name: 'ai_disclaimer', type: 'text' })
  aiDisclaimer: string;

  @Column({ name: 'requires_medical_review', default: false })
  requiresMedicalReview: boolean;

  @Column({ name: 'tokens_consumed', default: 0 })
  tokensConsumed: number;

  @Column({ name: 'professional_review', type: 'text', nullable: true })
  professionalReview: string | null;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

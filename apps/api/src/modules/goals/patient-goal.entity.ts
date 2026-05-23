import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('patient_goals')
export class PatientGoal {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'created_by' }) createdBy: string;

  @Column({ name: 'goal_type' }) goalType: string;
  @Column({ type: 'text' }) description: string;

  @Column({ name: 'baseline_value', type: 'numeric', precision: 10, scale: 3, nullable: true }) baselineValue: number | null;
  @Column({ name: 'target_value', type: 'numeric', precision: 10, scale: 3, nullable: true }) targetValue: number | null;
  @Column({ name: 'target_unit', nullable: true }) targetUnit: string | null;

  @Column({ name: 'start_date', type: 'date' }) startDate: Date;
  @Column({ name: 'target_date', type: 'date', nullable: true }) targetDate: Date | null;

  @Column({ name: 'is_achieved', default: false }) isAchieved: boolean;
  @Column({ name: 'achieved_at', type: 'timestamptz', nullable: true }) achievedAt: Date | null;
  @Column({ name: 'achieved_by', nullable: true }) achievedBy: string | null;

  @Column({ type: 'jsonb', default: '[]', name: 'checkpoints' }) checkpoints: Array<{
    date: string;
    value: number;
    note?: string;
    recordedBy?: string;
  }>;

  @Column({ name: 'professional_notes', type: 'text', nullable: true }) professionalNotes: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

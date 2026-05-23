import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('clinical_alerts')
export class ClinicalAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @Column({ name: 'triggered_by' })
  triggeredBy: string;

  @Column({ type: 'enum', enum: ['info','warning','danger','critical'] })
  severity: string;

  @Column()
  category: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  recommendation: string | null;

  @Column({ name: 'is_resolved', default: false })
  isResolved: boolean;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

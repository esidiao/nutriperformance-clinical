import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'workspace_id', nullable: true })
  workspaceId: string | null;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ name: 'patient_id', nullable: true })
  patientId: string | null;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, unknown> | null;

  @Column({ default: true })
  success: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

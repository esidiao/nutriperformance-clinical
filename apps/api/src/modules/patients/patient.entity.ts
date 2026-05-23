import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
import { User } from '../users/user.entity';

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @Column({ name: 'name_encrypted', type: 'bytea' })
  nameEncrypted: Buffer;

  @Column({ name: 'email_encrypted', type: 'bytea', nullable: true })
  emailEncrypted: Buffer | null;

  @Column({ name: 'phone_encrypted', type: 'bytea', nullable: true })
  phoneEncrypted: Buffer | null;

  @Column({ name: 'cpf_hash', nullable: true })
  cpfHash: string | null;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: Date;

  @Column({ type: 'enum', enum: ['male', 'female', 'other', 'not_informed'], default: 'not_informed' })
  gender: string;

  @Column({ name: 'is_pregnant', default: false })
  isPregnant: boolean;

  @Column({ name: 'is_breastfeeding', default: false })
  isBreastfeeding: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'lgpd_consent', default: false })
  lgpdConsent: boolean;

  @Column({ name: 'lgpd_consent_at', type: 'timestamptz', nullable: true })
  lgpdConsentAt: Date | null;

  @Column({ name: 'lgpd_consent_ip', nullable: true })
  lgpdConsentIp: string | null;

  @Column({ name: 'data_deletion_requested_at', type: 'timestamptz', nullable: true })
  dataDeletionRequestedAt: Date | null;

  @Column({ name: 'internal_code', nullable: true })
  internalCode: string | null;

  @Column({ name: 'notes_encrypted', type: 'bytea', nullable: true })
  notesEncrypted: Buffer | null;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => Workspace)
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

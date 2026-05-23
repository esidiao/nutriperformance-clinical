import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @Column({ name: 'auth_id', unique: true })
  authId: string;

  @Column()
  email: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({
    type: 'enum',
    enum: ['admin','nutritionist','fitness_professional','supervised_student','clinic_manager','institutional_manager'],
  })
  role: string;

  @Column({ name: 'council_type', nullable: true })
  councilType: string | null;

  @Column({ name: 'council_number', nullable: true })
  councilNumber: string | null;

  @Column({ name: 'council_state', nullable: true })
  councilState: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'jsonb', default: '{}' })
  settings: Record<string, unknown>;

  @ManyToOne(() => Workspace)
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

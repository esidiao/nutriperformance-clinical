import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('token_transactions')
export class TokenTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({
    type: 'enum',
    enum: ['purchase','consumption','refund','bonus','expiration','admin_adjustment'],
  })
  operation: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter: number;

  @Column()
  description: string;

  @Column({ nullable: true })
  module: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

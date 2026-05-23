import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('token_costs')
export class TokenCost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  operation: string;

  @Column({ name: 'tokens_cost', type: 'integer' })
  tokensCost: number;

  @Column({ nullable: true })
  description: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

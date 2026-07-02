import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('supplements_catalog')
export class SupplementCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'dsld_id', unique: true })
  dsldId: string;

  @Column({ nullable: true })
  nome: string | null;

  @Column({ nullable: true })
  marca: string | null;

  @Column({ name: 'forma_farmaceutica', nullable: true })
  formaFarmaceutica: string | null;

  @Column({ name: 'ingredientes_ativos', type: 'jsonb', default: () => "'[]'::jsonb" })
  ingredientesAtivos: Array<{ name: string; group?: string; notes?: string }>;

  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  flags: string[];

  @Column({ nullable: true })
  finalidade: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  advertencias: string[];

  @Column({ default: 'EUA' })
  pais: string;

  @Column({ default: 'dsld' })
  fonte: string;

  @Column({ default: 'alta' })
  confiabilidade: string;

  @Column({ default: 'Domínio público (NIH DSLD)' })
  licenca: string;

  @Column({ name: 'data_atualizacao', type: 'timestamptz', default: () => 'now()' })
  dataAtualizacao: Date;
}

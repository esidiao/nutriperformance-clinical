import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('industrialized_products')
export class IndustrializedProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'codigo_barras', unique: true })
  codigoBarras: string;

  @Column({ nullable: true })
  marca: string | null;

  @Column({ name: 'nome_comercial', nullable: true })
  nomeComercial: string | null;

  @Column({ type: 'text', nullable: true })
  ingredientes: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  alergenos: string[];

  @Column({ name: 'tabela_nutricional', type: 'jsonb', default: () => "'{}'::jsonb" })
  tabelaNutricional: Record<string, number>;

  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  aditivos: string[];

  @Column({ name: 'nutri_score', nullable: true })
  nutriScore: string | null;

  @Column({ name: 'nova_classificacao', type: 'smallint', nullable: true })
  novaClassificacao: number | null;

  @Column({ nullable: true })
  pais: string | null;

  @Column({ name: 'imagem_rotulo_url', nullable: true })
  imagemRotuloUrl: string | null;

  @Column({ name: 'alerta_nutricional', type: 'text', array: true, default: () => "'{}'::text[]" })
  alertaNutricional: string[];

  @Column({ default: 'openfoodfacts' })
  fonte: string;

  @Column({ default: 'media' })
  confiabilidade: string;

  @Column({ default: 'ODbL (Open Food Facts)' })
  licenca: string;

  @Column({ name: 'data_atualizacao', type: 'timestamptz', default: () => 'now()' })
  dataAtualizacao: Date;
}

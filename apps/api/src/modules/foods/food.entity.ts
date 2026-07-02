import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('foods')
export class Food {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nome_padronizado' })
  nomePadronizado: string;

  @Column({ name: 'nomes_populares', type: 'text', array: true, default: () => "'{}'::text[]" })
  nomesPopulares: string[];

  @Column({ name: 'grupo_alimentar', nullable: true })
  grupoAlimentar: string | null;

  @Column({ name: 'nova_classificacao', type: 'smallint', nullable: true })
  novaClassificacao: number | null;

  @Column({ name: 'energia_kcal', type: 'numeric', nullable: true })
  energiaKcal: number | null;

  @Column({ name: 'carboidratos_g', type: 'numeric', nullable: true })
  carboidratosG: number | null;

  @Column({ name: 'proteinas_g', type: 'numeric', nullable: true })
  proteinasG: number | null;

  @Column({ name: 'lipidios_g', type: 'numeric', nullable: true })
  lipidiosG: number | null;

  @Column({ name: 'gordura_saturada_g', type: 'numeric', nullable: true })
  gorduraSaturadaG: number | null;

  @Column({ name: 'gordura_trans_g', type: 'numeric', nullable: true })
  gorduraTransG: number | null;

  @Column({ name: 'fibras_g', type: 'numeric', nullable: true })
  fibrasG: number | null;

  @Column({ name: 'sodio_mg', type: 'numeric', nullable: true })
  sodioMg: number | null;

  @Column({ name: 'acucares_g', type: 'numeric', nullable: true })
  acucaresG: number | null;

  @Column({ name: 'calcio_mg', type: 'numeric', nullable: true })
  calcioMg: number | null;

  @Column({ name: 'ferro_mg', type: 'numeric', nullable: true })
  ferroMg: number | null;

  @Column({ name: 'potassio_mg', type: 'numeric', nullable: true })
  potassioMg: number | null;

  @Column({ name: 'magnesio_mg', type: 'numeric', nullable: true })
  magnesioMg: number | null;

  @Column({ name: 'zinco_mg', type: 'numeric', nullable: true })
  zincoMg: number | null;

  @Column({ name: 'vitaminas', type: 'jsonb', default: () => "'{}'::jsonb" })
  vitaminas: Record<string, number>;

  @Column({ name: 'indice_glicemico', type: 'numeric', nullable: true })
  indiceGlicemico: number | null;

  @Column({ name: 'porcao_padrao_g', type: 'numeric', default: 100 })
  porcaoPadraoG: number;

  @Column({ name: 'alergenos', type: 'text', array: true, default: () => "'{}'::text[]" })
  alergenos: string[];

  @Column({ name: 'fonte' })
  fonte: string;

  @Column({ name: 'fonte_id_externo', nullable: true })
  fonteIdExterno: string | null;

  @Column({ name: 'fonte_versao', nullable: true })
  fonteVersao: string | null;

  @Column({ name: 'data_importacao', type: 'timestamptz', default: () => 'now()' })
  dataImportacao: Date;

  @Column({ name: 'confiabilidade', default: 'pendente' })
  confiabilidade: 'alta' | 'media' | 'baixa' | 'pendente';

  @Column({ name: 'licenca', nullable: true })
  licenca: string | null;

  @Column({ name: 'observacoes_clinicas', type: 'text', nullable: true })
  observacoesClinicas: string | null;

  @Column({ name: 'ativo', default: true })
  ativo: boolean;
}

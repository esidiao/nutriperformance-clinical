import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Um alimento relatado dentro de uma refeição do recordatório.
 *
 * Espelha `MealPlanItem` de propósito: mesmos campos, mesma escala por 100 g,
 * mesma semântica de ausência. É o que permite o relatório de adequação ler os
 * dois sem conversão.
 */
@Entity('dietary_recall_items')
@Index(['recallId', 'refeicao'])
export class DietaryRecallItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'recall_id' }) recallId: string;
  @Column({ name: 'workspace_id' }) workspaceId: string;

  @Column({ name: 'refeicao' }) refeicao: string;
  @Column({ name: 'horario', nullable: true }) horario: string | null;
  @Column({ name: 'ordem', default: 0 }) ordem: number;

  /** Procedência — de onde veio, não de onde se lê. */
  @Column({ name: 'food_id', type: 'uuid', nullable: true }) foodId: string | null;
  @Column({ name: 'fonte', nullable: true }) fonte: string | null;

  @Column({ name: 'alimento_nome' }) alimentoNome: string;

  @Column({ name: 'quantidade_g', type: 'numeric', precision: 8, scale: 2 })
  quantidadeG: number;

  /** Como o paciente descreveu: "duas colheres de feijão", "uma escumadeira". */
  @Column({ name: 'medida_caseira', nullable: true }) medidaCaseira: string | null;

  @Column({ name: 'kcal', type: 'numeric', precision: 8, scale: 2, default: 0 }) kcal: number;
  @Column({ name: 'proteinas_g', type: 'numeric', precision: 7, scale: 2, default: 0 })
  proteinasG: number;
  @Column({ name: 'carboidratos_g', type: 'numeric', precision: 7, scale: 2, default: 0 })
  carboidratosG: number;
  @Column({ name: 'lipidios_g', type: 'numeric', precision: 7, scale: 2, default: 0 })
  lipidiosG: number;
  @Column({ name: 'fibras_g', type: 'numeric', precision: 7, scale: 2, default: 0 })
  fibrasG: number;
  @Column({ name: 'sodio_mg', type: 'numeric', precision: 8, scale: 2, default: 0 })
  sodioMg: number;

  /**
   * Chave AUSENTE = a base não tem o dado para este alimento.
   * Valor ZERO = o alimento não fornece.
   */
  @Column({ name: 'micronutrientes', type: 'jsonb', default: () => "'{}'::jsonb" })
  micronutrientes: Record<string, number>;

  @Column({ name: 'observacao', type: 'text', nullable: true }) observacao: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

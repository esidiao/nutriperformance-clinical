import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Food } from './food.entity';

/**
 * Medida caseira de um alimento.
 *
 * Um alimento tem VÁRIAS: o arroz cozido pesa 25 g numa colher de sopa, 45 g
 * numa colher de servir, 100 g numa concha e 200 g num prato fundo cheio.
 * Qual serve depende do que o paciente relatou, e por isso elas moram numa
 * tabela em vez de numa coluna.
 *
 * `gramas` é o peso de UMA unidade da medida — não o peso da porção
 * prescrita. Confundir os dois multiplicaria a prescrição pela quantidade de
 * colheres.
 */
@Entity('food_measures')
export class FoodMeasure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'food_id' })
  foodId: string;

  @ManyToOne(() => Food, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'food_id' })
  food?: Food;

  /** "colher de sopa", "concha", "fatia media". Como o paciente fala. */
  @Column()
  medida: string;

  /** Peso de UMA unidade, em gramas. */
  @Column({ type: 'numeric', precision: 8, scale: 2 })
  gramas: number;

  /**
   * A medida de referência do alimento na fonte.
   *
   * É a que a tela oferece primeiro: para arroz a colher de servir, para
   * feijoada a concha. Sem isso, a lista alfabética começaria em "bife" ou
   * "caneca" para qualquer alimento.
   */
  @Column({ default: false })
  padrao: boolean;

  @Column({ default: 'ibge_pof' })
  fonte: string;

  @Column({ name: 'fonte_versao', nullable: true })
  fonteVersao: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}

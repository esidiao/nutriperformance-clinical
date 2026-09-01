import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Um alimento dentro de uma refeição do plano.
 *
 * Os valores nutricionais são gravados como CÓPIA, não lidos de `foods` a cada
 * consulta. Três razões, todas clínicas:
 *
 *  - A curadoria pode corrigir ou bloquear um alimento a qualquer momento. Um
 *    plano já entregue ao paciente passaria a exibir números diferentes dos que
 *    foram prescritos, sem que ninguém tivesse editado o plano.
 *  - Alimento bloqueado sai das buscas. Sem a cópia, o item viraria uma linha
 *    vazia num plano que o paciente tem impresso em casa.
 *  - O plano é registro clínico: precisa mostrar o que foi prescrito, não o que
 *    a base diz hoje.
 *
 * `foodId` fica guardado como procedência — serve para rastrear a origem e
 * detectar depois que a base mudou, mas não é a fonte dos números.
 */
@Entity('meal_plan_items')
@Index(['mealPlanId', 'refeicao'])
export class MealPlanItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'meal_plan_id' }) mealPlanId: string;
  @Column({ name: 'workspace_id' }) workspaceId: string;

  /** cafe_manha | lanche_manha | almoco | lanche_tarde | jantar | ceia | pre_treino | pos_treino */
  @Column({ name: 'refeicao' }) refeicao: string;
  @Column({ name: 'horario', nullable: true }) horario: string | null;
  @Column({ name: 'ordem', default: 0 }) ordem: number;

  // Procedência — de onde veio, não de onde se lê
  @Column({ name: 'food_id', type: 'uuid', nullable: true }) foodId: string | null;
  @Column({ name: 'fonte', nullable: true }) fonte: string | null;

  @Column({ name: 'alimento_nome' }) alimentoNome: string;
  @Column({ name: 'quantidade_g', type: 'numeric', precision: 8, scale: 2 })
  quantidadeG: number;
  @Column({ name: 'medida_caseira', nullable: true }) medidaCaseira: string | null;

  // Cópia nutricional, já multiplicada pela quantidade do item
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

  @Column({ name: 'substituicoes', type: 'jsonb', default: '[]' }) substituicoes: object[];
  @Column({ name: 'observacao', type: 'text', nullable: true }) observacao: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

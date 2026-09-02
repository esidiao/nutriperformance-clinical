import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Plano alimentar prescrito a um paciente.
 *
 * As metas (kcal e macros) são copiadas da avaliação nutricional no momento da
 * criação, e não lidas dela a cada consulta: a avaliação pode ser refeita depois,
 * e um plano entregue ao paciente precisa continuar mostrando a meta que
 * justificou aquela prescrição.
 */
@Entity('meal_plans')
export class MealPlan {
  @PrimaryGeneratedColumn('uuid') id: string;

  /**
   * Nulo quando o plano é um MODELO. Um modelo não pertence a paciente
   * nenhum: se guardasse o `patientId` de origem, a identidade de um paciente
   * viajaria junto com o modelo para o prontuário de outro.
   */
  @Column({ name: 'patient_id', nullable: true }) patientId: string | null;
  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'created_by' }) createdBy: string;

  @Column({ name: 'nome' }) nome: string;
  @Column({ name: 'objetivo', type: 'text', nullable: true }) objetivo: string | null;

  @Column({ name: 'data_inicio', type: 'date', nullable: true }) dataInicio: Date | null;
  @Column({ name: 'data_fim', type: 'date', nullable: true }) dataFim: Date | null;

  // Metas — copiadas da avaliação, ver nota da classe
  @Column({ name: 'meta_kcal', type: 'numeric', precision: 8, scale: 2, nullable: true })
  metaKcal: number | null;
  @Column({ name: 'meta_proteinas_g', type: 'numeric', precision: 7, scale: 2, nullable: true })
  metaProteinasG: number | null;
  @Column({ name: 'meta_carboidratos_g', type: 'numeric', precision: 7, scale: 2, nullable: true })
  metaCarboidratosG: number | null;
  @Column({ name: 'meta_lipidios_g', type: 'numeric', precision: 7, scale: 2, nullable: true })
  metaLipidiosG: number | null;

  @Column({ name: 'observacoes', type: 'text', nullable: true }) observacoes: string | null;
  @Column({ name: 'orientacoes_gerais', type: 'text', nullable: true })
  orientacoesGerais: string | null;

  // Rascunho não vale como prescrição — só o plano finalizado é entregue
  /**
   * Modelo reutilizável — lacuna 10 do benchmark.
   *
   * Vive na mesma tabela dos planos porque é a mesma estrutura: refeições,
   * itens, metas. Tabela separada duplicaria toda a lógica de itens e as duas
   * cópias divergiriam na primeira mudança.
   */
  @Column({ name: 'is_template', default: false }) isTemplate: boolean;

  @Column({ name: 'is_draft', default: true }) isDraft: boolean;
  @Column({ name: 'is_active', default: true }) isActive: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

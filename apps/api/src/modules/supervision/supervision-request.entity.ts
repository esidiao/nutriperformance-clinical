import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Pedido de supervisão — lacuna 15 do benchmark.
 *
 * O papel `supervised_student` já existia e podia criar plano alimentar como
 * qualquer profissional. O que faltava era o ato que dá sentido ao estágio:
 * alguém habilitado revisar antes de aquilo chegar ao paciente.
 *
 * A supervisão não é um carimbo administrativo. Quem aprova assume
 * responsabilidade profissional pelo que foi prescrito — por isso o registro
 * guarda quem decidiu, quando, e o parecer. Sem essas três coisas, não há como
 * dizer depois quem respondeu pelo atendimento.
 */
@Entity('supervision_requests')
@Index(['workspaceId', 'status'])
@Index(['workspaceId', 'recurso', 'recursoId'])
export class SupervisionRequest {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'workspace_id' }) workspaceId: string;

  /** meal_plan | nutritional_assessment | physical_assessment */
  @Column({ name: 'recurso' }) recurso: string;
  @Column({ name: 'recurso_id' }) recursoId: string;

  @Column({ name: 'estudante_id' }) estudanteId: string;

  /** Nulo até alguém decidir. */
  @Column({ name: 'supervisor_id', type: 'uuid', nullable: true })
  supervisorId: string | null;

  /** pendente | aprovado | ajustes_solicitados */
  @Column({ name: 'status', default: 'pendente' }) status: string;

  /**
   * O que o supervisor escreveu. Obrigatório ao pedir ajustes: "ajustes
   * solicitados" sem dizer quais não ensina nada, e estágio é lugar de ensinar.
   */
  @Column({ name: 'parecer', type: 'text', nullable: true }) parecer: string | null;

  @Column({ name: 'decidido_em', type: 'timestamptz', nullable: true })
  decididoEm: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Recordatório alimentar de 24 horas.
 *
 * O que o paciente RELATOU ter comido — não o que foi prescrito. É instrumento
 * de avaliação de consumo, e a distinção não é formal: plano alimentar é
 * documento assinado e entregue; recordatório é entrevista. Guardar os dois na
 * mesma tabela economizaria código e criaria o risco de um recordatório sair
 * impresso como prescrição.
 *
 * O que os dois COMPARTILHAM é a conta: os itens guardam os mesmos campos
 * nutricionais, com a mesma escala por 100 g, para que o relatório de
 * adequação sirva aos dois sem conversão.
 */
@Entity('dietary_recalls')
@Index(['workspaceId', 'patientId', 'dataReferencia'])
export class DietaryRecall {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'created_by' }) createdBy: string;

  /**
   * O dia RECORDADO, que não é o dia da consulta.
   *
   * Um recordatório feito na segunda costuma cobrir o domingo — e domingo não
   * representa a rotina. Por isso a data é explícita em vez de inferida da
   * data de criação.
   */
  @Column({ name: 'data_referencia', type: 'date' }) dataReferencia: string;

  /** `dia_util` | `fim_de_semana` — muda a leitura do consumo. */
  @Column({ name: 'tipo_de_dia', nullable: true }) tipoDeDia: string | null;

  @Column({ name: 'observacao', type: 'text', nullable: true }) observacao: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

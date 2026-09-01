import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Formulário de anamnese enviado ao paciente antes da consulta.
 *
 * É a PRIMEIRA superfície pública do sistema: o paciente responde sem login,
 * por um link. Três decisões carregam essa exposição.
 *
 * 1. O token é guardado como HASH, nunca em claro. Um vazamento do banco não
 *    entrega acesso a formulário nenhum — o mesmo raciocínio de senha. O valor
 *    bruto é devolvido UMA vez, na criação, e não existe rota que o recupere:
 *    perdeu o link, gera outro.
 *
 * 2. Todo link expira. Um link de anamnese que vale para sempre vira uma porta
 *    permanente para dado de saúde, muito depois de a consulta ter acontecido.
 *
 * 3. Responde uma vez. Depois de enviado, o link não aceita mais escrita —
 *    senão qualquer um com o link poderia sobrescrever o que o paciente
 *    respondeu, e o prontuário passaria a registrar a última pessoa que abriu
 *    o link, não o paciente.
 */
@Entity('pre_consult_forms')
@Index(['workspaceId', 'patientId'])
export class PreConsultForm {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'patient_id' }) patientId: string;

  /** Consulta que motivou o envio, quando houver. */
  @Column({ name: 'appointment_id', nullable: true }) appointmentId: string | null;

  @Column({ name: 'created_by' }) createdBy: string;

  /**
   * SHA-256 do token. Índice único: a busca pública é por este hash, então
   * precisa ser rápida — e é o único caminho de leitura sem autenticação.
   */
  @Index({ unique: true })
  @Column({ name: 'token_hash' }) tokenHash: string;

  /** pendente | respondido | cancelado */
  @Column({ name: 'status', default: 'pendente' }) status: string;

  @Column({ name: 'expira_em', type: 'timestamptz' }) expiraEm: Date;

  /**
   * Versão do questionário no momento do envio. Sem isto, uma resposta de hoje
   * seria lida amanhã contra perguntas diferentes — adulteração silenciosa de
   * registro clínico.
   */
  @Column({ name: 'versao_questionario', type: 'int', default: 1 })
  versaoQuestionario: number;

  @Column({ name: 'respostas', type: 'jsonb', nullable: true })
  respostas: Record<string, unknown> | null;

  @Column({ name: 'respondido_em', type: 'timestamptz', nullable: true })
  respondidoEm: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

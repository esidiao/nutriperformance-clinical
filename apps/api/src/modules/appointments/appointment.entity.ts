import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Consulta agendada.
 *
 * `inicio` e `fim` sao timestamptz: o servidor roda em UTC e a profissional
 * pensa em horario de Brasilia. Guardar sem fuso faria a consulta das 14h
 * aparecer as 17h para quem consulta a API de outro lugar.
 *
 * O fim e gravado, e nao derivado da duracao a cada leitura, porque a deteccao
 * de conflito precisa comparar intervalos no banco — derivar em JavaScript
 * exigiria trazer a agenda inteira para a memoria a cada agendamento.
 */
@Entity('appointments')
@Index(['workspaceId', 'profissionalId', 'inicio'])
export class Appointment {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'patient_id' }) patientId: string;

  /**
   * Dono da agenda. Numa clinica com varias profissionais, o conflito de
   * horario e de cada uma — nao do workspace inteiro.
   */
  @Column({ name: 'profissional_id' }) profissionalId: string;
  @Column({ name: 'created_by' }) createdBy: string;

  @Column({ name: 'inicio', type: 'timestamptz' }) inicio: Date;
  @Column({ name: 'fim', type: 'timestamptz' }) fim: Date;

  /** primeira_consulta | retorno | avaliacao | online */
  @Column({ name: 'tipo', default: 'retorno' }) tipo: string;

  /** agendada | confirmada | realizada | faltou | cancelada */
  @Column({ name: 'status', default: 'agendada' }) status: string;

  /**
   * Sala da consulta online — lacuna 13.
   *
   * Guarda a URL completa. Nulo quando a consulta é presencial ou quando
   * ninguém definiu sala ainda.
   */
  @Column({ name: 'link_video', type: 'text', nullable: true }) linkVideo: string | null;

  /**
   * gerado | proprio — de onde veio o link.
   *
   * Importa para a tela: sala gerada usa um serviço público de terceiro, e a
   * profissional precisa saber disso. Link próprio é escolha dela, e o aviso
   * seria ruído.
   */
  @Column({ name: 'video_origem', type: 'text', nullable: true })
  videoOrigem: string | null;

  @Column({ name: 'observacoes', type: 'text', nullable: true }) observacoes: string | null;

  /** Motivo do cancelamento — sem ele, "cancelada" nao explica nada depois. */
  @Column({ name: 'motivo_cancelamento', type: 'text', nullable: true })
  motivoCancelamento: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

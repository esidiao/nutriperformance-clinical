import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Lançamento financeiro — o que foi cobrado de um paciente e se foi recebido.
 *
 * NÃO é meio de pagamento. Não cobra, não integra gateway, não guarda cartão:
 * registra o que a profissional combinou e o que entrou. A plataforma removeu
 * pagamentos de propósito enquanto a estratégia comercial não é definida, e
 * controle de recebimento é outra coisa — é o caderno, não a maquininha.
 *
 * Valores em CENTAVOS inteiros, não em decimal de ponto flutuante. 0.1 + 0.2
 * não é 0.3 em binário; num sistema que soma centenas de consultas por mês, o
 * erro aparece no fechamento e a profissional não tem como saber de onde veio.
 * Inteiro fecha exato, sempre.
 */
@Entity('charges')
@Index(['workspaceId', 'status', 'vencimento'])
export class Charge {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'patient_id' }) patientId: string;

  /**
   * Consulta que originou a cobrança, quando houver. Opcional de propósito:
   * pacote fechado, plano avulso e taxa de retorno não nascem de uma consulta.
   */
  @Column({ name: 'appointment_id', nullable: true }) appointmentId: string | null;

  /** A quem a receita pertence. Numa clínica, o fechamento é por profissional. */
  @Column({ name: 'profissional_id' }) profissionalId: string;
  @Column({ name: 'created_by' }) createdBy: string;

  @Column({ name: 'descricao' }) descricao: string;

  /** Valor cobrado, em centavos. */
  @Column({ name: 'valor_centavos', type: 'int' }) valorCentavos: number;

  /**
   * Valor efetivamente recebido, em centavos. Separado do cobrado porque
   * desconto e pagamento parcial existem: forçar os dois a serem iguais
   * obrigaria a registrar mentira no fechamento.
   */
  @Column({ name: 'valor_pago_centavos', type: 'int', nullable: true })
  valorPagoCentavos: number | null;

  /** pendente | pago | isento | cancelado */
  @Column({ name: 'status', default: 'pendente' }) status: string;

  /**
   * Data de vencimento. Obrigatória: sem ela não existe "vencida", e um
   * contas-a-receber que não envelhece não serve para cobrar ninguém.
   */
  @Column({ name: 'vencimento', type: 'date' }) vencimento: string;

  @Column({ name: 'pago_em', type: 'timestamptz', nullable: true }) pagoEm: Date | null;

  /** dinheiro | pix | debito | credito | transferencia | convenio | outro */
  @Column({ name: 'forma_pagamento', nullable: true }) formaPagamento: string | null;

  @Column({ name: 'observacoes', type: 'text', nullable: true }) observacoes: string | null;

  @Column({ name: 'motivo_cancelamento', type: 'text', nullable: true })
  motivoCancelamento: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

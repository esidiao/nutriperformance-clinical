import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Link do portal do paciente — lacuna 2 do benchmark.
 *
 * ATENÇÃO ao que este link é, comparado aos outros dois:
 *
 * - O link de ANAMNESE não devolve dado nenhum do paciente. Ele pergunta.
 * - O link do DIÁRIO devolve o que o próprio paciente enviou.
 * - Este devolve CONTEÚDO CLÍNICO PRESCRITO: o plano alimentar, as consultas
 *   marcadas, o nome da pessoa.
 *
 * É a maior exposição das três, e o desenho responde por isso: validade mais
 * curta que a de um diário longo, revogação a qualquer momento, e a tela da
 * profissional diz exatamente o que o paciente vai ver ANTES de ela enviar o
 * link. Quem envia precisa saber o que está entregando.
 *
 * Não existe conta de paciente. Isso é escolha, não atalho: conta traz
 * cadastro, senha, recuperação e consentimento — uma superfície inteira que
 * não se justifica antes de a plataforma ser testada. O token é a credencial,
 * e por isso expira e pode ser cortado.
 */
@Entity('patient_portal_links')
@Index(['workspaceId', 'patientId'])
export class PatientPortalLink {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'created_by' }) createdBy: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash' }) tokenHash: string;

  /** ativo | revogado */
  @Column({ name: 'status', default: 'ativo' }) status: string;

  @Column({ name: 'expira_em', type: 'timestamptz' }) expiraEm: Date;

  /** Última vez que alguém abriu. Ajuda a profissional a saber se está em uso. */
  @Column({ name: 'ultimo_acesso_em', type: 'timestamptz', nullable: true })
  ultimoAcessoEm: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

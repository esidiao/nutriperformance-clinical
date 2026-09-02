import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Link do diário alimentar do paciente.
 *
 * Difere do link de anamnese num ponto que muda tudo: é MULTIUSO. A anamnese
 * se responde uma vez; o diário recebe fotos por semanas. Por isso não existe
 * "respondido" aqui — o link vive até expirar ou ser revogado, e o controle é
 * a validade curta somada à revogação a qualquer momento.
 *
 * O token continua guardado só como hash, pelo mesmo motivo de sempre.
 */
@Entity('food_diary_links')
@Index(['workspaceId', 'patientId'])
export class FoodDiaryLink {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'created_by' }) createdBy: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash' }) tokenHash: string;

  /** ativo | revogado */
  @Column({ name: 'status', default: 'ativo' }) status: string;

  @Column({ name: 'expira_em', type: 'timestamptz' }) expiraEm: Date;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

/**
 * Uma refeição registrada.
 *
 * `fotoPath` guarda o CAMINHO no bucket privado, nunca uma URL. URL de download
 * é assinada na hora da leitura e expira: gravada, viraria um link permanente
 * para a foto de um paciente dentro do banco.
 *
 * `tomadaEm` é quando a pessoa comeu; `createdAt` é quando enviou. Separar
 * importa porque quase todo mundo registra depois — juntar os dois faria a
 * refeição das 12h aparecer às 22h no acompanhamento.
 */
@Entity('food_diary_entries')
@Index(['workspaceId', 'patientId', 'tomadaEm'])
export class FoodDiaryEntry {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'patient_id' }) patientId: string;

  /** Link que originou o envio. Nulo quando a própria profissional registra. */
  @Column({ name: 'link_id', type: 'uuid', nullable: true }) linkId: string | null;

  /** cafe_manha | lanche_manha | almoco | lanche_tarde | jantar | ceia */
  @Column({ name: 'refeicao' }) refeicao: string;

  @Column({ name: 'descricao', type: 'text', nullable: true }) descricao: string | null;

  /** Caminho no bucket privado. Nulo: registro só com texto é válido. */
  @Column({ name: 'foto_path', type: 'text', nullable: true }) fotoPath: string | null;

  @Column({ name: 'tomada_em', type: 'timestamptz' }) tomadaEm: Date;

  /** paciente | profissional */
  @Column({ name: 'origem', default: 'paciente' }) origem: string;

  /**
   * Comentário da profissional sobre a refeição. Só ela escreve; o paciente
   * não vê nem edita — é anotação clínica, não conversa.
   */
  @Column({ name: 'comentario', type: 'text', nullable: true }) comentario: string | null;

  /**
   * Quando a foto foi apagada pela retenção de 12 meses.
   *
   * O REGISTRO permanece; só a imagem sai. A descrição, a refeição e o horário
   * são histórico clínico e continuam servindo ao acompanhamento anos depois —
   * a foto é a parte pesada e mais sensível, e é ela que a retenção alcança.
   *
   * Marcar em vez de simplesmente zerar `fotoPath` importa: sem isso, "sem
   * foto" e "foto expurgada" ficariam indistinguíveis, e a profissional
   * concluiria que o paciente nunca enviou imagem.
   */
  @Column({ name: 'foto_removida_em', type: 'timestamptz', nullable: true })
  fotoRemovidaEm: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Foto de evolução corporal — lacuna 11 do benchmark.
 *
 * O QUE ESTE MÓDULO NÃO FAZ, e é a decisão central: não estima composição
 * corporal a partir da imagem.
 *
 * O benchmark descreve "estimativa de composição corporal por foto". Fazer
 * isso com um modelo de linguagem generalista produziria um percentual de
 * gordura que PARECE medida clínica, entraria no prontuário ao lado de valores
 * de bioimpedância, e viraria base de conduta — sem validação nenhuma. A
 * própria entidade de avaliação física tem `body_composition_method`
 * justamente porque o método importa; "IA olhou a foto" não é método.
 *
 * O QUE ELE FAZ: registro fotográfico padronizado para comparação visual ao
 * longo do tempo. É o que a profissional e o paciente de fato usam para
 * enxergar mudança, e não finge ser medição.
 *
 * Para ter estimativa numérica seria preciso um serviço especializado e
 * validado para isso — decisão de contratação, não de programação.
 */
@Entity('progress_photos')
@Index(['workspaceId', 'patientId', 'tiradaEm'])
export class ProgressPhoto {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'workspace_id' }) workspaceId: string;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'created_by' }) createdBy: string;

  /**
   * frente | perfil | costas
   *
   * O ângulo é obrigatório porque comparação só vale entre fotos do mesmo
   * ponto de vista. Sem ele, a tela colocaria lado a lado uma foto de frente e
   * uma de costas e chamaria isso de evolução.
   */
  @Column({ name: 'angulo' }) angulo: string;

  /** Caminho no bucket privado, nunca uma URL. */
  @Column({ name: 'foto_path', type: 'text' }) fotoPath: string;

  @Column({ name: 'tirada_em', type: 'date' }) tiradaEm: string;

  /** Anotação da profissional. O paciente não vê — não há portal para isto. */
  @Column({ name: 'observacao', type: 'text', nullable: true }) observacao: string | null;

  @Column({ name: 'removida_em', type: 'timestamptz', nullable: true })
  removidaEm: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

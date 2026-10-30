import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @Column({ name: 'auth_id', unique: true })
  authId: string;

  @Column()
  email: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({
    type: 'enum',
    enum: ['admin','nutritionist','fitness_professional','supervised_student','clinic_manager','institutional_manager'],
  })
  role: string;

  @Column({ name: 'council_type', nullable: true })
  councilType: string | null;

  @Column({ name: 'council_number', nullable: true })
  councilNumber: string | null;

  @Column({ name: 'council_state', nullable: true })
  councilState: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // `last_login_at` NAO esta aqui, e a ausencia e a correcao.
  //
  // A coluna existia na entidade, era NULA para todos os 14 usuarios (inclusive
  // os que usam o sistema todo dia) e nao era escrita em nenhum lugar do
  // codigo. Em 30/10/2026 ela quase me fez concluir que uma profissional nunca
  // havia entrado no sistema; o Supabase Auth mostrava o login dela.
  //
  // O caminho obvio seria passar a gravar. Seria errado: `auth.users
  // .last_sign_in_at` ja registra isso, o Supabase o mantem correto, e uma
  // segunda copia so pode divergir da primeira. Quem precisa do ultimo login
  // consulta a FONTE, pelo admin de auth.
  //
  // A coluna segue no banco, intocada, para nao precisar de migracao
  // destrutiva. Ela e ignorada pelo codigo de proposito, e o teste ao lado
  // (`user.entity.spec.ts`) falha se alguem a redeclarar sem ler isto.
  //
  // ⚠️ Em banco LOCAL com `synchronize` ligado, o TypeORM vai derrubar a coluna
  // justamente por ela nao estar declarada aqui. Em producao nao: a guarda de
  // `common/banco-local.ts` desliga a sincronizacao contra banco remoto.

  @Column({ type: 'jsonb', default: '{}' })
  settings: Record<string, unknown>;

  @ManyToOne(() => Workspace)
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

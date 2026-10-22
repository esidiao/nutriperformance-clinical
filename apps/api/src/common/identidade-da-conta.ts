/**
 * A invariante de identidade: `users.id` É o UUID do Supabase Auth.
 *
 * ================================ A CADEIA ==================================
 *
 * 1. `JwtAuthGuard` põe o `sub` do token em `req.user.id` (e em `req.user.sub`).
 *    O `sub` é o UUID da conta no Supabase Auth.
 * 2. Os controllers passam esse valor adiante como `createdBy` / `userId`.
 * 3. Essas colunas são chave estrangeira para **`users.id`** — não para
 *    `users.auth_id`.
 *
 * Logo, para qualquer escrita funcionar, a linha de `users` daquela pessoa
 * precisa ter `id` IGUAL ao `auth_id`. Nada no código garante isso, e a
 * entidade `User` declara o oposto: `@PrimaryGeneratedColumn('uuid')` diz que
 * o banco inventa o `id`.
 *
 * ============================ POR QUE ESTÁ AQUI =============================
 *
 * Em 22/10/2026 eu "consertei" contas de teste semeadas gravando o `auth_id`
 * certo e deixando o `id` como estava. O efeito: as contas passaram a
 * autenticar normalmente e TODA escrita delas morreu com HTTP 500 genérico,
 * porque `created_by` apontava para um id que não existe em `users`. Levou uma
 * rodada de investigação para entender, porque o sintoma (500 em tudo) não diz
 * nada sobre identidade.
 *
 * O que a invariante custa a quem provisiona conta: gravar `id = auth_id` na
 * criação. O que ela cobra de quem não sabe dela: um dia de depuração.
 *
 * =============================== COMO MUDAR =================================
 *
 * Trocar a chave estrangeira para `users.auth_id` é uma correção legítima e
 * melhor — aí `users.id` volta a ser um id interno qualquer. Mas é migração de
 * verdade: há linhas dependentes em produção (a conta da dra.ana tinha 11).
 * Se alguém fizer isso, o teste ao lado FALHA de propósito, para que a decisão
 * seja consciente e esta explicação seja atualizada em vez de ficar mentindo.
 */

/** Colunas que recebem `req.user.id` (= o `sub` do token) e viram FK de `users`. */
export const COLUNAS_COM_ID_DE_CONTA: ReadonlyArray<string> = [
  'appointments.created_by',
  'audit_logs.user_id',
  'bioavailability_analyses.created_by',
  'charges.created_by',
  'dietary_recalls.created_by',
  'interaction_analyses.created_by',
  'laboratory_exams.created_by',
  'meal_plans.created_by',
  'nutritional_assessments.created_by',
  'patient_goals.created_by',
  'patient_portal_links.created_by',
  'patients.created_by',
  'physical_assessments.created_by',
  'pre_consult_forms.created_by',
  'progress_photos.created_by',
  'token_transactions.user_id',
];

export interface LinhaDeConta {
  id: string;
  authId: string | null | undefined;
  email?: string;
}

/**
 * Diz se a linha serve para ESCREVER, não só para entrar.
 *
 * Separado do `null` de propósito: conta sem `auth_id` não autentica (falha
 * cedo, visível), enquanto conta com `auth_id` diferente do `id` autentica e
 * falha depois, em cada escrita. O segundo caso é o perigoso, e é o que esta
 * função existe para apontar antes de alguém descobrir pelo 500.
 */
export function conferirIdentidadeDaConta(linha: LinhaDeConta): string | null {
  if (!linha.authId) {
    return 'sem auth_id: a conta não autentica (falha no login, não na escrita)';
  }
  if (linha.id !== linha.authId) {
    return 'id diferente de auth_id: a conta autentica e TODA escrita falha com 500, '
      + 'porque created_by aponta para um id que não existe em users';
  }
  return null;
}

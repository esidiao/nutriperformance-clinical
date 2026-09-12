import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../guards/roles.guard';
import { TOKEN_OPERATION_KEY } from '../guards/token-balance.guard';
import { IS_PUBLIC_KEY } from '../guards/jwt-auth.guard';

/** Marca rota como pública — ignora o JwtAuthGuard global (health, webhooks) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe endpoint a roles específicos */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Indica qual operação de token este endpoint consome */
export const RequiresTokens = (operation: string) => SetMetadata(TOKEN_OPERATION_KEY, operation);

// ─── Papel de TENANT × papel de PLATAFORMA ───────────────────────────────────
//
// Os papéis abaixo são todos DENTRO de um workspace: descrevem o que a pessoa
// faz na clínica dela. `institutional_manager` e `clinic_manager` são gestores
// de um tenant — não da plataforma.
//
// `PlatformAdminOnly` é a outra coisa: administração da plataforma inteira, sem
// escopo de workspace nenhum. Quem passa por ela lista todos os workspaces,
// credita tokens para qualquer um, suspende qualquer um, lê a trilha de LGPD de
// todos os tenants e edita a curadoria de `foods`, que é base compartilhada.
//
// Manter as duas coisas separadas é o ponto. `institutional_manager` estava em
// `AdminOnly` — o nome antigo convidava ao erro, porque "gerente institucional"
// soa administrativo — e com isso um gestor de uma clínica administrava as
// outras. O frontend nunca concordou: `/admin/*` sempre exigiu `role === 'admin'`
// exato, no AuthGuard e no middleware. Era o backend que estava mais permissivo
// que a própria interface.

/** Roles permitidos por módulo — todos são papéis DENTRO de um workspace. */
export const NutritionistOnly = () =>
  Roles('admin', 'nutritionist', 'supervised_student', 'clinic_manager', 'institutional_manager');

export const FitnessProfessionalOnly = () =>
  Roles('admin', 'fitness_professional', 'supervised_student', 'clinic_manager', 'institutional_manager');

export const ClinicalStaff = () =>
  Roles('admin', 'nutritionist', 'fitness_professional', 'clinic_manager', 'institutional_manager');

/**
 * Administração da PLATAFORMA — atravessa todos os workspaces.
 *
 * Só `admin`. Nenhum papel de tenant entra aqui, por mais administrativo que o
 * nome dele soe: o que está do outro lado não tem escopo de workspace, então
 * conceder a um gestor de clínica é conceder sobre as clínicas dos outros.
 */
export const PlatformAdminOnly = () => Roles('admin');

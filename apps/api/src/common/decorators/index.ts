import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../guards/roles.guard';
import { TOKEN_OPERATION_KEY } from '../guards/token-balance.guard';

/** Restringe endpoint a roles específicos */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Indica qual operação de token este endpoint consome */
export const RequiresTokens = (operation: string) => SetMetadata(TOKEN_OPERATION_KEY, operation);

/** Roles permitidos por módulo */
export const NutritionistOnly = () =>
  Roles('admin', 'nutritionist', 'supervised_student', 'clinic_manager', 'institutional_manager');

export const FitnessProfessionalOnly = () =>
  Roles('admin', 'fitness_professional', 'supervised_student', 'clinic_manager', 'institutional_manager');

export const ClinicalStaff = () =>
  Roles('admin', 'nutritionist', 'fitness_professional', 'clinic_manager', 'institutional_manager');

export const AdminOnly = () =>
  Roles('admin', 'institutional_manager');

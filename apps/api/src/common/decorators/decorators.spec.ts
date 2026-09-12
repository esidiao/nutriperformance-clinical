import { ROLES_KEY } from '../guards/roles.guard';
import {
  PlatformAdminOnly, ClinicalStaff, NutritionistOnly, FitnessProfessionalOnly,
} from './index';

/**
 * Trava a fronteira entre papel de TENANT e papel de PLATAFORMA.
 *
 * `institutional_manager` e `clinic_manager` gerenciam UM workspace. O que está
 * atrás de `PlatformAdminOnly` não tem escopo de workspace nenhum: lista todos,
 * credita tokens para qualquer um, suspende qualquer um, lê a trilha de LGPD de
 * todos os tenants e edita a curadoria de `foods`, que é base compartilhada.
 *
 * O decorator antigo (`AdminOnly`) incluía `institutional_manager`, e com isso
 * um gestor de uma clínica administrava as outras. O frontend nunca concordou —
 * `/admin/*` sempre exigiu `role === 'admin'` exato. Se alguém reintroduzir um
 * papel de tenant aqui, este teste quebra.
 */

/** Lê a lista de papéis que o decorator grava via SetMetadata. */
function papeisDe(decorator: () => MethodDecorator & ClassDecorator): string[] {
  class Alvo {}
  decorator()(Alvo);
  return Reflect.getMetadata(ROLES_KEY, Alvo) ?? [];
}

describe('Decorators de papel', () => {
  describe('PlatformAdminOnly', () => {
    it('admite exclusivamente admin', () => {
      expect(papeisDe(PlatformAdminOnly as any)).toEqual(['admin']);
    });

    it.each(['institutional_manager', 'clinic_manager', 'nutritionist', 'fitness_professional', 'supervised_student'])(
      'NÃO admite o papel de tenant "%s"',
      (papel) => {
        expect(papeisDe(PlatformAdminOnly as any)).not.toContain(papel);
      },
    );
  });

  describe('papéis clínicos', () => {
    // A separação tira administração de plataforma do gestor institucional, e
    // só isso: todo o trabalho clínico dele continua de pé.
    it('institutional_manager mantém acesso clínico', () => {
      expect(papeisDe(ClinicalStaff as any)).toContain('institutional_manager');
      expect(papeisDe(NutritionistOnly as any)).toContain('institutional_manager');
      expect(papeisDe(FitnessProfessionalOnly as any)).toContain('institutional_manager');
    });

    it('estagiário não entra em ClinicalStaff (financeiro é fora do escopo dele)', () => {
      expect(papeisDe(ClinicalStaff as any)).not.toContain('supervised_student');
    });
  });
});

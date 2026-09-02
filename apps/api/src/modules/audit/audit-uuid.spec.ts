import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guarda estrutural: nenhuma chamada de auditoria pode passar texto livre para
 * coluna uuid.
 *
 * Nasceu de um bug que ficou escondido por meses. `audit_logs.user_id`,
 * `workspace_id`, `patient_id` e `resource_id` são todos uuid em produção. O
 * expurgo de retenção passava 'retencao-automatica', 'sistema' e
 * '12 registros'. O INSERT falhava inteiro — e como `AuditService.log` é
 * fire-and-forget (`.catch(warn)`), o erro nunca chegou a lugar nenhum.
 *
 * O resultado é o pior dos dois mundos: a operação que apaga foto de paciente
 * em definitivo era justamente a que não deixava rastro. Um teste que mocka o
 * repositório jamais pegaria isso, porque o mock aceita qualquer string.
 *
 * Por isso a verificação é sobre o CÓDIGO-FONTE, não sobre o comportamento.
 */
const CAMPOS_UUID = ['userId', 'workspaceId', 'patientId', 'resourceId'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) return arquivos(p);
    return nome.endsWith('.ts') && !nome.includes('.spec.') ? [p] : [];
  });
}

describe('auditoria — colunas uuid', () => {
  it('nenhuma chamada passa literal de texto para campo uuid', () => {
    const problemas: string[] = [];

    for (const caminho of arquivos(join(__dirname, '..', '..'))) {
      const fonte = readFileSync(caminho, 'utf8');

      // Cada bloco de argumento de `auditService.log({ ... })`. Basta o miolo
      // até a primeira `}` porque o objeto é sempre plano nessas chamadas.
      for (const chamada of fonte.matchAll(/auditService\.log\(\{([^}]*)\}/g)) {
        for (const campo of CAMPOS_UUID) {
          // Só valores literais interessam: variável não dá para conferir aqui.
          const literal = chamada[1].match(
            new RegExp(`\\b${campo}\\s*:\\s*(['\`])([^'\`]*)\\1`),
          );
          if (literal && !UUID.test(literal[2])) {
            problemas.push(
              `${caminho.split(/src[\\/]/)[1]}: ${campo} = "${literal[2]}"`,
            );
          }
        }
      }
    }

    expect(problemas).toEqual([]);
  });

  it('a própria verificação enxerga um caso ruim', () => {
    // Sem isto o teste acima passaria mesmo se o regex parasse de casar —
    // exatamente o que aconteceu com a guarda de entidades, que passava porque
    // não encontrava nada para verificar.
    const amostra = `this.auditService.log({ userId: 'retencao-automatica', action: 'DELETE' }`;
    const achado = [...amostra.matchAll(/auditService\.log\(\{([^}]*)\}/g)];
    expect(achado).toHaveLength(1);
    expect(achado[0][1]).toMatch(/userId\s*:\s*'retencao-automatica'/);
  });
});

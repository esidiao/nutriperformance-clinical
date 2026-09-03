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

/**
 * Miolo de cada `auditService.log({ ... })`, com as chaves balanceadas.
 *
 * A primeira versão parava na primeira `}` (`[^}]*`). Parece equivalente e não
 * é: `resourceId: ${'`'}${'${x.length}'} marcadores${'`'}` tem uma `}` no meio da
 * interpolação, então o bloco era cortado ANTES do campo problemático. Foi
 * assim que esta guarda deixou passar um quinto caso do mesmo bug que ela
 * existe para pegar.
 */
export function blocosDeChamada(fonte: string): string[] {
  const blocos: string[] = [];
  const marca = 'auditService.log({';
  let i = fonte.indexOf(marca);
  while (i !== -1) {
    let profundidade = 1;
    let j = i + marca.length;
    while (j < fonte.length && profundidade > 0) {
      if (fonte[j] === '{') profundidade++;
      else if (fonte[j] === '}') profundidade--;
      j++;
    }
    blocos.push(fonte.slice(i + marca.length, j - 1));
    i = fonte.indexOf(marca, j);
  }
  return blocos;
}

/**
 * Campos uuid recebendo literal impróprio dentro de UM bloco.
 *
 * Separado para poder ser exercitado contra um exemplo ruim conhecido. Guarda
 * que só roda sobre código já corrigido não prova nada: ela passa tanto quando
 * funciona quanto quando parou de enxergar.
 */
export function problemasNoBloco(bloco: string): string[] {
  const achados: string[] = [];

  for (const campo of CAMPOS_UUID) {
    // Só valores literais interessam: variável não dá para conferir aqui.
    const literal = bloco.match(
      new RegExp(`\\b${campo}\\s*:\\s*(['\`])((?:[^'\`\\\\]|\\\\.)*)\\1`),
    );
    if (!literal) continue;

    const [, aspas, valor] = literal;
    // Template com interpolação: o que sobra FORA do ${...} é texto solto, e
    // texto solto não cabe numa coluna uuid. Interpolação sozinha passa, porque
    // pode ser um uuid em tempo de execução.
    const foraDaInterpolacao = valor.replace(/\$\{[^}]*\}/g, '').trim();
    const ruim = aspas === '`' ? foraDaInterpolacao.length > 0 : !UUID.test(valor);

    if (ruim) achados.push(`${campo} = ${aspas}${valor}${aspas}`);
  }

  return achados;
}

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
      for (const bloco of blocosDeChamada(readFileSync(caminho, 'utf8'))) {
        for (const p of problemasNoBloco(bloco)) {
          problemas.push(`${caminho.split(/src[\\/]/)[1]}: ${p}`);
        }
      }
    }

    expect(problemas).toEqual([]);
  });

  describe('a guarda enxerga os casos que já escaparam', () => {
    // Cada um destes existiu no código de verdade.

    it('string literal solta', () => {
      const bloco = blocosDeChamada(
        `this.auditService.log({ userId: 'retencao-automatica', action: 'DELETE' });`,
      )[0];
      expect(problemasNoBloco(bloco)).toEqual([`userId = 'retencao-automatica'`]);
    });

    it('template com interpolação — o caso que a versão antiga cortava', () => {
      const bloco = blocosDeChamada(
        'this.auditService.log({\n'
        + "  action: 'READ', resource: 'x',\n"
        + '  resourceId: `${r.valores.length} marcadores`,\n'
        + '});',
      )[0];
      expect(problemasNoBloco(bloco)).toEqual(['resourceId = `${r.valores.length} marcadores`']);
    });
  });

  describe('não acusa o que está certo', () => {
    it('interpolação sozinha pode ser um uuid em execução', () => {
      const bloco = blocosDeChamada('this.auditService.log({ resourceId: `${foto.id}` });')[0];
      expect(problemasNoBloco(bloco)).toEqual([]);
    });

    it('uuid literal', () => {
      const bloco = blocosDeChamada(
        `this.auditService.log({ workspaceId: '00000000-0000-0000-0000-000000000001' });`,
      )[0];
      expect(problemasNoBloco(bloco)).toEqual([]);
    });

    it('texto em campo que não é uuid', () => {
      const bloco = blocosDeChamada(
        `this.auditService.log({ action: 'DELETE', resource: 'progress_photos' });`,
      )[0];
      expect(problemasNoBloco(bloco)).toEqual([]);
    });
  });
});

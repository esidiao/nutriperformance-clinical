import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Guarda de regressão: toda tela do painel precisa falar com o backend.
 *
 * NASCEU DE UM CASO REAL. Em 09/10/2026 chegaram dois relatórios — áudios da
 * nutricionista e um PDF da testadora — com sete pontos. QUATRO tinham a mesma
 * causa: cinco telas nunca foram ligadas à API e mostravam dados escritos no
 * código (`MOCK_GOALS`, `PAC-SEED-001`…).
 *
 * As consequências não eram cosméticas:
 *  - a tela de Metas exibia três exemplos, e a testadora leu como "metas de
 *    todos os pacientes misturadas" — suspeitou de vazamento entre pacientes
 *    onde havia dado falso;
 *  - a prescrição em PDF saía vinculada a um paciente que não existe;
 *  - a tela de Tokens anunciava um preço já REMOVIDO do banco e um gráfico de
 *    consumo com números inventados ao lado de saldo real.
 *
 * Nenhum dos 800+ testes unitários pegava isso: eles testam o que o código faz,
 * e o problema era código que não era chamado por ninguém.
 *
 * REGRA: uma página sob `app/(dashboard)` precisa chamar `api.` — diretamente
 * ou através de um componente que chame. A busca é transitiva em um nível,
 * porque telas como `prescriptions/new` delegam a busca ao
 * `<SeletorDePaciente>` e estariam certas.
 */
const WEB = join(__dirname, '..', '..', '..', 'web');
const PAGINAS = join(WEB, 'app', '(dashboard)');
const COMPONENTES = join(WEB, 'components');

/**
 * Telas que legitimamente não consultam o backend, cada uma com o motivo.
 *
 * A lista é a parte importante deste teste: acrescentar algo aqui é uma
 * decisão consciente e revisável. Sem ela, a saída seria afrouxar a regra.
 */
const SEM_BACKEND: Record<string, string> = {
  'settings/page.tsx':
    'preferências locais (tema, atalhos); nada do que ela ajusta é persistido no servidor hoje',
};

function arquivos(dir: string, filtro: (n: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) return arquivos(p, filtro);
    return filtro(nome) ? [p] : [];
  });
}

/** Componentes de `components/` que falam com a API. */
function componentesComApi(): Set<string> {
  const out = new Set<string>();
  for (const caminho of arquivos(COMPONENTES, (n) => n.endsWith('.tsx') || n.endsWith('.ts'))) {
    const fonte = readFileSync(caminho, 'utf8');
    if (/\bapi\.[a-zA-Z]/.test(fonte)) {
      out.add(caminho.split(/[\\/]/).pop()!.replace(/\.tsx?$/, ''));
    }
  }
  return out;
}

const relativo = (caminho: string) =>
  caminho.split(/\(dashboard\)[\\/]/)[1]?.replace(/\\/g, '/') ?? caminho;

describe('telas do painel estão ligadas ao backend', () => {
  const comApi = componentesComApi();
  const paginas = arquivos(PAGINAS, (n) => n === 'page.tsx');

  it('encontra as páginas do painel', () => {
    // Sem isto, um caminho errado faria o teste passar sem verificar nada —
    // foi o que aconteceu com a primeira guarda de entidades deste projeto.
    expect(paginas.length).toBeGreaterThan(20);
  });

  it('encontra componentes que falam com a API', () => {
    expect(comApi.size).toBeGreaterThan(3);
  });

  it('nenhuma tela mostra dados escritos no código', () => {
    const suspeitas: string[] = [];
    for (const caminho of paginas) {
      const fonte = readFileSync(caminho, 'utf8');
      // `const MOCK_X = [` no topo de arquivo, e códigos de paciente semente.
      if (/^const\s+MOCK_[A-Z_]+\s*(:|=)/m.test(fonte)) {
        suspeitas.push(`${relativo(caminho)}: declara MOCK_*`);
      }
      // Em comentário é legítimo (explicando o que foi removido); em código não.
      for (const linha of fonte.split(/\r?\n/)) {
        if (/^\s*(\/\/|\*|\/\*)/.test(linha)) continue;
        if (/PAC-SEED-\d|PAC-00\d/.test(linha)) {
          suspeitas.push(`${relativo(caminho)}: paciente de exemplo no código`);
          break;
        }
      }
    }
    expect(suspeitas).toEqual([]);
  });

  it('toda tela consulta o backend, direta ou indiretamente', () => {
    const desligadas: string[] = [];

    for (const caminho of paginas) {
      const rel = relativo(caminho);
      if (rel in SEM_BACKEND) continue;

      const fonte = readFileSync(caminho, 'utf8');
      if (/\bapi\.[a-zA-Z]/.test(fonte)) continue;

      // Importa algum componente que fala com a API?
      const importados = [...fonte.matchAll(/from\s+'@\/components\/([A-Za-z0-9_]+)'/g)]
        .map((m) => m[1]);
      if (importados.some((c) => comApi.has(c))) continue;

      desligadas.push(rel);
    }

    expect(desligadas).toEqual([]);
  });

  it('a lista de exceções explica cada caso', () => {
    // Exceção sem motivo escrito vira porta de entrada para afrouxar a regra.
    for (const [tela, motivo] of Object.entries(SEM_BACKEND)) {
      expect(motivo.length).toBeGreaterThan(25);
      expect(existsSync(join(PAGINAS, tela))).toBe(true);
    }
  });

  it('a verificação enxerga uma tela desligada', () => {
    // Falsificação: prova que o regex de `api.` não casa com qualquer coisa.
    const falsa = "export default function X() { return <div>oi</div>; }";
    expect(/\bapi\.[a-zA-Z]/.test(falsa)).toBe(false);
    const verdadeira = "const { data } = useQuery({ queryFn: () => api.patients.list() });";
    expect(/\bapi\.[a-zA-Z]/.test(verdadeira)).toBe(true);
  });
});

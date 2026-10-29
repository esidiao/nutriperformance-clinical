import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Nenhuma tela assina documento clínico com identidade escrita no código.
 *
 * O QUE ISTO IMPEDE DE VOLTAR
 *
 * `prescriptions/new/page.tsx` tinha, por meses:
 *
 *     const PROFESSIONAL = { name: 'Dra. Ana Costa', council: 'CRN-3',
 *                            councilNumber: '12345', ... }
 *
 * TODO PDF de prescrição, de qualquer profissional, saía assinado com esse
 * nome e esse registro. Registro de conselho identifica legalmente quem
 * assina; um documento que chega ao paciente com registro inventado é pior
 * que um sem assinatura, porque parece assinado.
 *
 * E não foi a primeira vez: o relatório de 07/10/2026 pegou o MESMO padrão
 * com os pacientes (quatro exemplos escritos no código; "o PDF saía
 * certinho, mas vinculado a um paciente que não existe"). Corrigiram a parte
 * do paciente, a do profissional ficou — porque o PDF continuou saindo
 * bonito. Nada quebra, nada acusa: é o tipo de defeito que só um teste
 * encontra de novo.
 *
 * POR QUE PROCURAR O REGISTRO, E NÃO O NOME
 *
 * Nome de exemplo é legítimo em muitos lugares (teste, texto de ajuda, dado
 * semeado). O que não é legítimo em código de TELA é um número de conselho
 * literal: CRN, CRM, CREF, CRF. É esse o padrão que identifica alguém.
 */

const WEB = join(__dirname, '..', '..', '..', 'web');

/** Onde um registro literal seria assinatura falsa, não exemplo. */
const PASTAS = ['app', 'components', 'lib'];

/**
 * Conselhos brasileiros seguidos de número — "CRN-3 12345", "CRM 54321".
 * A `i` é deliberada: minúsculo não deixa de identificar ninguém.
 */
const REGISTRO_LITERAL = /\b(CRN|CRM|CREF|CRF|CRP|COREN)\s*-?\s*\d{1,2}?\s*[:/]?\s*\d{3,}/i;

/**
 * Exceções com motivo. Lista vazia é o estado desejado — e uma entrada aqui
 * é uma decisão, não um desvio silencioso.
 */
const PERMITIDOS: Array<{ arquivo: string; porque: string }> = [];

function arquivosDeTela(dir: string): string[] {
  let achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === 'node_modules' || nome === '.next') continue;
      achados = achados.concat(arquivosDeTela(caminho));
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.spec\.tsx?$/.test(nome)) {
      achados.push(caminho);
    }
  }
  return achados;
}

describe('identidade de quem assina', () => {
  it('nenhuma tela traz registro de conselho escrito no código', () => {
    const culpados: string[] = [];

    for (const pasta of PASTAS) {
      for (const arquivo of arquivosDeTela(join(WEB, pasta))) {
        const rel = relative(WEB, arquivo).replace(/\\/g, '/');
        if (PERMITIDOS.some((p) => p.arquivo === rel)) continue;

        const fonte = readFileSync(arquivo, 'utf8');
        for (const linha of fonte.split('\n')) {
          // O comentário que explica o defeito cita o valor antigo de
          // propósito: é a memória de por que a regra existe.
          const comentario = /^\s*(\/\/|\*|\/\*)/.test(linha);
          // `placeholder` é o lugar certo de mostrar o FORMATO esperado
          // ("CRN-3 12345" no campo de cadastro). Placeholder não é valor:
          // não vai para o documento nem assina nada. Achado pelo próprio
          // teste, em `settings/page.tsx`, na primeira execução.
          const ehPlaceholder = /placeholder\s*=/.test(linha);
          if (!comentario && !ehPlaceholder && REGISTRO_LITERAL.test(linha)) {
            culpados.push(`${rel}: ${linha.trim().slice(0, 80)}`);
          }
        }
      }
    }

    expect(culpados).toEqual([]);
  });

  it('a tela de prescrição busca quem assina em /users/me', () => {
    // O outro lado: ausência do literal não prova que a tela pegou a
    // identidade certa — ela poderia ter ficado sem assinatura nenhuma.
    const fonte = readFileSync(
      join(WEB, 'app', '(dashboard)', 'prescriptions', 'new', 'page.tsx'), 'utf8',
    );
    expect(fonte).toContain('api.usuarios.eu()');
    expect(fonte).toMatch(/semIdentidade/);
  });

  it('a folha do plano alimentar também', () => {
    const fonte = readFileSync(join(WEB, 'components', 'BotaoImprimirPlano.tsx'), 'utf8');
    expect(fonte).toContain('api.usuarios.eu()');
  });
});

/**
 * Questionário de anamnese pré-consulta — lacuna 8 do benchmark.
 *
 * As perguntas vivem em código, versionadas, e NÃO no banco. O motivo é a
 * leitura futura: uma resposta gravada hoje precisa continuar interpretável em
 * 2030, quando o questionário já tiver mudado. Guardando a versão junto da
 * resposta, sempre dá para saber qual era a pergunta. Se as perguntas fossem
 * editáveis em tabela, alguém trocaria o texto de uma pergunta e todas as
 * respostas antigas passariam a responder outra coisa — em prontuário, isso é
 * adulteração silenciosa de registro clínico.
 *
 * Ao mudar perguntas: incremente VERSAO_ATUAL e mantenha a versão anterior no
 * histórico. Nunca reaproveite um `id` para outra pergunta.
 */

export const VERSAO_ATUAL = 1;

export type TipoPergunta = 'texto' | 'textarea' | 'numero' | 'sim_nao' | 'escolha' | 'multipla';

export interface Pergunta {
  id: string;
  rotulo: string;
  tipo: TipoPergunta;
  obrigatoria?: boolean;
  opcoes?: string[];
  ajuda?: string;
  /** Unidade exibida ao lado do campo numérico. */
  unidade?: string;
  min?: number;
  max?: number;
}

export interface Secao {
  id: string;
  titulo: string;
  perguntas: Pergunta[];
}

/**
 * Pré-consulta, não consulta.
 *
 * Só entra aqui o que o paciente responde sobre si com segurança e que poupa
 * tempo de atendimento. Nada de diagnóstico, nada de conduta: interpretação é
 * ato do profissional. Perguntas que exigem exame ou julgamento clínico ficam
 * de fora de propósito.
 */
export const QUESTIONARIO: Secao[] = [
  {
    id: 'rotina',
    titulo: 'Sua rotina',
    perguntas: [
      {
        id: 'objetivo',
        rotulo: 'O que você espera do acompanhamento nutricional?',
        tipo: 'textarea',
        obrigatoria: true,
      },
      {
        id: 'ocupacao',
        rotulo: 'Qual sua ocupação e horário de trabalho?',
        tipo: 'texto',
      },
      {
        id: 'horas_sono',
        rotulo: 'Quantas horas você costuma dormir por noite?',
        tipo: 'numero',
        unidade: 'horas',
        min: 0,
        max: 24,
      },
      {
        id: 'atividade_fisica',
        rotulo: 'Pratica atividade física?',
        tipo: 'escolha',
        opcoes: ['Não pratico', '1 a 2 vezes por semana', '3 a 4 vezes por semana', '5 ou mais vezes por semana'],
      },
      {
        id: 'atividade_qual',
        rotulo: 'Qual atividade e há quanto tempo?',
        tipo: 'texto',
      },
    ],
  },
  {
    id: 'alimentacao',
    titulo: 'Alimentação',
    perguntas: [
      {
        id: 'refeicoes_dia',
        rotulo: 'Quantas refeições você faz por dia?',
        tipo: 'numero',
        min: 0,
        max: 12,
      },
      {
        id: 'quem_cozinha',
        rotulo: 'Quem prepara suas refeições?',
        tipo: 'escolha',
        opcoes: ['Eu mesmo(a)', 'Outra pessoa da casa', 'Como fora / delivery', 'Varia bastante'],
      },
      {
        id: 'recordatorio',
        rotulo: 'Descreva o que você comeu ontem, do café da manhã até a última refeição',
        tipo: 'textarea',
        ajuda: 'Não precisa ser exato. Um dia comum já ajuda bastante.',
        obrigatoria: true,
      },
      {
        id: 'agua',
        rotulo: 'Quanto de água você bebe por dia, aproximadamente?',
        tipo: 'texto',
        ajuda: 'Pode responder em copos, garrafas ou litros.',
      },
      {
        id: 'nao_gosta',
        rotulo: 'Que alimentos você não gosta ou não come?',
        tipo: 'textarea',
      },
      {
        id: 'restricao',
        rotulo: 'Tem alguma restrição alimentar?',
        tipo: 'multipla',
        opcoes: [
          'Nenhuma', 'Vegetariana', 'Vegana', 'Sem glúten', 'Sem lactose',
          'Religiosa', 'Outra',
        ],
      },
    ],
  },
  {
    id: 'saude',
    titulo: 'Saúde',
    perguntas: [
      {
        id: 'condicoes',
        rotulo: 'Você tem alguma condição de saúde diagnosticada?',
        tipo: 'textarea',
        ajuda: 'Por exemplo: diabetes, hipertensão, tireoide, anemia. Se não tiver, escreva "não".',
      },
      {
        id: 'medicamentos',
        rotulo: 'Usa algum medicamento contínuo? Quais e em que dose?',
        tipo: 'textarea',
        ajuda: 'Inclua também anticoncepcional, se usar.',
      },
      {
        id: 'suplementos',
        rotulo: 'Usa algum suplemento ou vitamina?',
        tipo: 'textarea',
      },
      {
        id: 'alergias',
        rotulo: 'Tem alergia ou intolerância alimentar?',
        tipo: 'textarea',
        ajuda: 'Descreva o alimento e o que acontece.',
      },
      {
        id: 'intestino',
        rotulo: 'Como funciona seu intestino?',
        tipo: 'escolha',
        opcoes: ['Todo dia', 'Dia sim, dia não', '2 a 3 vezes por semana', 'Menos que isso', 'Varia muito'],
      },
      {
        id: 'cirurgias',
        rotulo: 'Já fez alguma cirurgia? Qual e quando?',
        tipo: 'textarea',
      },
      {
        id: 'historico_familiar',
        rotulo: 'Há doenças frequentes na sua família?',
        tipo: 'textarea',
        ajuda: 'Pais, irmãos, avós.',
      },
    ],
  },
  {
    id: 'final',
    titulo: 'Para finalizar',
    perguntas: [
      {
        id: 'acompanhamento_anterior',
        rotulo: 'Já fez acompanhamento nutricional antes?',
        tipo: 'sim_nao',
      },
      {
        id: 'observacoes',
        rotulo: 'Há mais alguma coisa que você queira contar antes da consulta?',
        tipo: 'textarea',
      },
    ],
  },
];

/**
 * Histórico de versões. Uma resposta gravada na versão N precisa ser lida com
 * as perguntas da versão N — senão o prontuário mostra a resposta de ontem sob
 * a pergunta de hoje.
 *
 * Ao criar a versão 2: NÃO edite QUESTIONARIO em cima. Copie para uma
 * constante própria, registre as duas aqui e aponte VERSAO_ATUAL para a nova.
 */
export const VERSOES: Record<number, Secao[]> = {
  1: QUESTIONARIO,
};

/**
 * Perguntas de uma versão. Devolve null para versão desconhecida em vez de
 * cair na atual em silêncio: rotular respostas antigas com perguntas novas é
 * exatamente o erro que a versão existe para impedir.
 */
export function questionarioDaVersao(versao: number): Secao[] | null {
  return VERSOES[versao] ?? null;
}

export const TODAS_PERGUNTAS: Pergunta[] = QUESTIONARIO.flatMap((s) => s.perguntas);

/** Teto por campo de texto. Protege o banco de um POST gigante. */
const MAX_TEXTO = 4000;

export interface ErroValidacao {
  perguntaId: string;
  mensagem: string;
}

/**
 * Valida e normaliza as respostas.
 *
 * Descarta chave desconhecida em vez de gravar: a rota é pública, e aceitar
 * campo arbitrário deixaria qualquer um usar o prontuário do paciente como
 * depósito de texto.
 */
export function validarRespostas(bruto: unknown): {
  erros: ErroValidacao[];
  respostas: Record<string, unknown>;
} {
  const erros: ErroValidacao[] = [];
  const respostas: Record<string, unknown> = {};
  const entrada = (bruto ?? {}) as Record<string, unknown>;

  for (const p of TODAS_PERGUNTAS) {
    const valor = entrada[p.id];
    const vazio = valor === undefined || valor === null || valor === ''
      || (Array.isArray(valor) && valor.length === 0);

    if (vazio) {
      if (p.obrigatoria) erros.push({ perguntaId: p.id, mensagem: `"${p.rotulo}" é obrigatória` });
      continue;
    }

    switch (p.tipo) {
      case 'texto':
      case 'textarea': {
        const s = String(valor).trim();
        if (s.length > MAX_TEXTO) {
          erros.push({ perguntaId: p.id, mensagem: `Resposta muito longa (máximo ${MAX_TEXTO} caracteres)` });
          continue;
        }
        respostas[p.id] = s;
        break;
      }
      case 'numero': {
        const n = Number(valor);
        if (!Number.isFinite(n)) {
          erros.push({ perguntaId: p.id, mensagem: 'Informe um número' });
          continue;
        }
        if (p.min !== undefined && n < p.min) {
          erros.push({ perguntaId: p.id, mensagem: `Valor mínimo: ${p.min}` });
          continue;
        }
        if (p.max !== undefined && n > p.max) {
          erros.push({ perguntaId: p.id, mensagem: `Valor máximo: ${p.max}` });
          continue;
        }
        respostas[p.id] = n;
        break;
      }
      case 'sim_nao': {
        if (typeof valor !== 'boolean') {
          erros.push({ perguntaId: p.id, mensagem: 'Responda sim ou não' });
          continue;
        }
        respostas[p.id] = valor;
        break;
      }
      case 'escolha': {
        if (!p.opcoes?.includes(String(valor))) {
          erros.push({ perguntaId: p.id, mensagem: 'Opção inválida' });
          continue;
        }
        respostas[p.id] = String(valor);
        break;
      }
      case 'multipla': {
        if (!Array.isArray(valor)) {
          erros.push({ perguntaId: p.id, mensagem: 'Formato inválido' });
          continue;
        }
        const validos = valor.map(String).filter((v) => p.opcoes?.includes(v));
        if (validos.length !== valor.length) {
          erros.push({ perguntaId: p.id, mensagem: 'Opção inválida' });
          continue;
        }
        respostas[p.id] = validos;
        break;
      }
    }
  }

  return { erros, respostas };
}

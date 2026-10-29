import type { PrescriptionData, PrescriptionMeal } from './pdf/generatePrescription';
import { descreverQuantidade } from './medida-caseira';
import { registroProfissional } from './registro-profissional';

/**
 * Transforma o plano alimentar na folha que vai para a MÃO DO PACIENTE.
 *
 * Pedido da nutricionista (29/10/2026): "depois que a gente fez todo o
 * planejamento (…) eu tenho o plano, ele vai me fornecer o plano pra gente
 * imprimir, pro paciente (…) todas as refeições lá (…) e o substituto também".
 *
 * ===================== POR QUE ISTO É UMA FUNÇÃO PURA ======================
 *
 * Montar o documento é regra, não desenho: o que entra, como a quantidade é
 * escrita, o que acontece quando falta substituição. Separado da tela, isso
 * se testa — e um erro aqui sai impresso na casa de alguém, não na tela de
 * quem poderia notar.
 *
 * ========================= QUEM ASSINA É QUEM ASSINA =======================
 *
 * `profissional` é obrigatório e vem de `/users/me`. A tela de prescrição
 * antiga assinava com uma CONSTANTE — "Dra. Ana Costa · CRN-3 12345" — em
 * todo PDF, de qualquer profissional. Registro de conselho identifica
 * legalmente quem assina; inventar um é pior que não assinar, porque parece
 * assinado. Aqui, sem identidade, a montagem RECUSA.
 */

export interface ItemDoPlano {
  alimentoNome: string;
  quantidadeG?: number | null;
  medidaCaseira?: string | null;
  observacao?: string | null;
}

export interface RefeicaoDoPlano {
  refeicao: string;
  rotulo: string;
  horario?: string | null;
  itens: ItemDoPlano[];
}

export interface SubstituicaoDoItem {
  nome: string;
  quantidadeG: number;
  medidaTexto?: string | null;
}

export interface ProfissionalQueAssina {
  nome: string;
  conselho: string | null;
  conselhoNumero: string | null;
  conselhoUf: string | null;
}

export interface PacienteDoPlano {
  nome: string;
  codigo?: string | null;
  idade?: number | null;
  sexo?: string | null;
}

export interface EntradaDaImpressao {
  plano: { id: string; nome?: string | null; dataInicio?: string | null; dataFim?: string | null };
  refeicoes: RefeicaoDoPlano[];
  /** Substituições por nome do alimento de origem. */
  substituicoesPorAlimento: Record<string, SubstituicaoDoItem[]>;
  paciente: PacienteDoPlano;
  profissional: ProfissionalQueAssina | null;
  totais?: { kcal?: number; proteinasG?: number; carboidratosG?: number; lipidiosG?: number };
}

export class SemIdentidadeProfissional extends Error {
  constructor() {
    super(
      'Não é possível emitir o plano sem o nome e o registro de conselho de '
      + 'quem assina. Complete seu perfil profissional antes de imprimir.',
    );
    this.name = 'SemIdentidadeProfissional';
  }
}

/** "120 g (2 colheres de sopa)" · "120 g" · "2 colheres de sopa". */
export function escreverQuantidade(item: ItemDoPlano): string {
  const g = Number(item.quantidadeG);
  const temG = Number.isFinite(g) && g > 0;
  const medida = item.medidaCaseira?.trim();
  if (temG && medida) return `${g} g (${medida})`;
  if (temG) return `${g} g`;
  return medida || '—';
}

/**
 * A coluna de substituições, como o paciente lê.
 *
 * Limite de três: a folha é para executar, não para consultar. Uma lista de
 * oito trocas na célula vira parágrafo e ninguém lê — e a quarta opção não
 * ajuda quem está decidindo o almoço.
 */
export const MAXIMO_DE_TROCAS = 3;

export function escreverTrocas(trocas: SubstituicaoDoItem[] | undefined): string {
  if (!trocas?.length) return '';
  return trocas
    .slice(0, MAXIMO_DE_TROCAS)
    .map((t) => {
      const medida = t.medidaTexto?.trim();
      return medida
        ? `${t.nome} — ${medida} (${t.quantidadeG} g)`
        : `${t.nome} — ${t.quantidadeG} g`;
    })
    .join(' · ');
}

export function montarImpressaoDoPlano(e: EntradaDaImpressao): PrescriptionData {
  if (!e.profissional?.nome || !e.profissional.conselho || !e.profissional.conselhoNumero) {
    throw new SemIdentidadeProfissional();
  }

  const meals: PrescriptionMeal[] = e.refeicoes
    .filter((r) => r.itens.length > 0)
    .map((r) => ({
      name: r.rotulo,
      time: r.horario ?? undefined,
      items: r.itens.map((i) => {
        const trocas = escreverTrocas(e.substituicoesPorAlimento[i.alimentoNome]);
        const obs = i.observacao?.trim();
        return {
          name: i.alimentoNome,
          dose: escreverQuantidade(i),
          frequency: '',
          // A observação da profissional vem PRIMEIRO: ela é instrução, a
          // troca é alternativa. Juntar na ordem inversa enterraria o que foi
          // escrito de propósito para aquele paciente.
          notes: [obs, trocas].filter(Boolean).join(' | '),
        };
      }),
    }));

  const hoje = new Date();
  return {
    type: 'prescription',
    prescriptionNumber: e.plano.id.slice(0, 8).toUpperCase(),
    date: hoje.toLocaleDateString('pt-BR'),
    validity: e.plano.dataFim
      ? new Date(e.plano.dataFim).toLocaleDateString('pt-BR')
      : '—',
    professional: {
      // O cabecalho recebe o registro JA composto e o campo do conselho vazio:
      // concatenar os dois dava "CFN CRN-3 12345". Ver registro-profissional.ts.
      name: e.profissional.nome,
      council: '',
      councilNumber: registroProfissional(
        e.profissional.conselho, e.profissional.conselhoNumero, e.profissional.conselhoUf,
      ) ?? '',
      specialty: '',
      clinic: '',
    },
    patient: {
      name: e.paciente.nome,
      code: e.paciente.codigo ?? '—',
      age: Number(e.paciente.idade) || 0,
      gender: e.paciente.sexo ?? '—',
    },
    items: [],
    meals,
    nutritionSummary: {
      kcal: e.totais?.kcal,
      protein: e.totais?.proteinasG,
      carb: e.totais?.carboidratosG,
      fat: e.totais?.lipidiosG,
    },
  };
}

export { descreverQuantidade };

/**
 * Protocolos de dobras cutâneas.
 *
 * ESCOPO, e por que ele não é maior:
 *
 * Só entram aqui equações cujas constantes eu posso declarar com segurança.
 * Uma constante errada não dá erro — devolve um percentual de gordura
 * plausível, que entra no prontuário ao lado da bioimpedância e vira conduta.
 * É a pior falha possível neste arquivo, e é silenciosa.
 *
 * Por isso Petroski, Guedes e Durnin & Womersley NÃO estão implementados: são
 * usados no Brasil, mas eu não tenho como garantir os coeficientes de cabeça.
 * Durnin & Womersley ainda depende de uma tabela de constantes por faixa
 * etária. Para incluí-los é preciso a referência que a profissional usa — e
 * aí entram em meia hora, porque a estrutura abaixo já comporta.
 *
 * Nenhuma destas equações é "a certa": cada uma foi validada numa população.
 * Por isso o protocolo escolhido é GRAVADO junto com o resultado. Sem ele, os
 * mesmos milímetros não se interpretam.
 */

export type Sexo = 'male' | 'female';

/** Chaves iguais às colunas de `physical_assessments`. */
export type Sitio =
  | 'triceps' | 'subscapular' | 'suprailiac' | 'abdominal'
  | 'thigh' | 'chest' | 'midaxillary';

export const ROTULO_SITIO: Record<Sitio, string> = {
  triceps: 'Tríceps',
  subscapular: 'Subescapular',
  suprailiac: 'Supra-ilíaca',
  abdominal: 'Abdominal',
  thigh: 'Coxa',
  chest: 'Peitoral',
  midaxillary: 'Axilar média',
};

export interface Protocolo {
  id: string;
  nome: string;
  /** Sítios exigidos, por sexo quando o protocolo difere. */
  sitios: (sexo: Sexo) => Sitio[];
  /** Observação clínica curta, exibida junto da escolha. */
  nota: string;
  /** Percentual de gordura, ou null quando falta dado. */
  calcular: (medidas: Partial<Record<Sitio, number>>, idade: number, sexo: Sexo) => number | null;
}

const soma = (medidas: Partial<Record<Sitio, number>>, sitios: Sitio[]): number | null => {
  let total = 0;
  for (const s of sitios) {
    const v = medidas[s];
    if (v === undefined || v === null || !Number.isFinite(v) || v <= 0) return null;
    total += v;
  }
  return total;
};

const arred = (n: number) => Math.round(n * 10) / 10;

/**
 * Siri (1961): converte densidade corporal em percentual de gordura.
 * É a conversão que acompanha Jackson & Pollock na literatura.
 */
export const siri = (densidade: number): number => 495 / densidade - 450;

/** Brozek et al. (1963). Alternativa ao Siri; difere pouco na faixa usual. */
export const brozek = (densidade: number): number => 457 / densidade - 414.2;

const JP3: Protocolo = {
  id: 'jackson_pollock_3',
  nome: 'Jackson & Pollock — 3 dobras',
  nota: 'O mais usado na rotina. Sítios diferentes para homem e mulher.',
  sitios: (sexo) => sexo === 'male'
    ? ['chest', 'abdominal', 'thigh']
    : ['triceps', 'suprailiac', 'thigh'],
  calcular: (m, idade, sexo) => {
    const s = soma(m, JP3.sitios(sexo));
    if (s === null || !(idade > 0)) return null;
    const d = sexo === 'male'
      ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * idade
      : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * idade;
    return arred(siri(d));
  },
};

const JP7: Protocolo = {
  id: 'jackson_pollock_7',
  nome: 'Jackson & Pollock — 7 dobras',
  nota: 'Mais sítios, menor erro. Mesmos 7 pontos para ambos os sexos.',
  sitios: () => ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh'],
  calcular: (m, idade, sexo) => {
    const s = soma(m, JP7.sitios(sexo));
    if (s === null || !(idade > 0)) return null;
    const d = sexo === 'male'
      ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * idade
      : 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * idade;
    return arred(siri(d));
  },
};

const FAULKNER: Protocolo = {
  id: 'faulkner_4',
  nome: 'Faulkner — 4 dobras',
  nota: 'Comum em atletas. Não usa idade, e dá direto o percentual, sem densidade.',
  sitios: () => ['triceps', 'subscapular', 'suprailiac', 'abdominal'],
  calcular: (m) => {
    const s = soma(m, FAULKNER.sitios('male'));
    if (s === null) return null;
    return arred(s * 0.153 + 5.783);
  },
};

export const PROTOCOLOS: Protocolo[] = [JP3, JP7, FAULKNER];

export const protocoloPorId = (id: string): Protocolo | undefined =>
  PROTOCOLOS.find((p) => p.id === id);

/**
 * Protocolos pedidos e ainda NÃO implementados, com o motivo. Exibir esta
 * lista na tela é melhor que omitir: a profissional vê que o pedido foi
 * registrado e por que ainda não está lá.
 */
export const PENDENTES = [
  { nome: 'Petroski — 4 dobras', motivo: 'preciso confirmar os coeficientes na referência que você usa' },
  { nome: 'Guedes — 3 dobras', motivo: 'idem: coeficientes variam entre publicações' },
  {
    nome: 'Durnin & Womersley — 4 dobras',
    motivo: 'depende de tabela de constantes por faixa etária e exige a dobra do bíceps, que ainda não existe no cadastro',
  },
];

/**
 * Classificação ACSM. Faixas diferentes por sexo.
 *
 * `cls` usa o mesmo vocabulário das outras classificações da tela
 * (normal/elevated/critical) em vez de inventar um terceiro: dois conjuntos
 * de cores para a mesma ideia confundem quem lê o laudo.
 */
export type Classificacao = 'normal' | 'elevated' | 'critical';

export function classificarGordura(
  pct: number, sexo: Sexo,
): { label: string; cls: Classificacao } {
  if (sexo === 'male') {
    if (pct < 6) return { label: 'Abaixo do essencial', cls: 'critical' };
    if (pct < 14) return { label: 'Atlético', cls: 'normal' };
    if (pct < 18) return { label: 'Bom', cls: 'normal' };
    if (pct < 25) return { label: 'Aceitável', cls: 'elevated' };
    return { label: 'Elevado', cls: 'critical' };
  }
  if (pct < 14) return { label: 'Abaixo do essencial', cls: 'critical' };
  if (pct < 21) return { label: 'Atlético', cls: 'normal' };
  if (pct < 25) return { label: 'Bom', cls: 'normal' };
  if (pct < 32) return { label: 'Aceitável', cls: 'elevated' };
  return { label: 'Elevado', cls: 'critical' };
}

/** Massa gorda e massa magra em kg, a partir do percentual e do peso. */
export function composicao(pct: number | null, pesoKg: number | null) {
  if (pct === null || pesoKg === null || !(pesoKg > 0)) {
    return { massaGordaKg: null, massaMagraKg: null };
  }
  return {
    massaGordaKg: arred((pesoKg * pct) / 100),
    massaMagraKg: arred(pesoKg * (1 - pct / 100)),
  };
}

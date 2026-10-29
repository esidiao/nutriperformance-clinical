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
  | 'thigh' | 'chest' | 'midaxillary' | 'biceps' | 'calf';

export const ROTULO_SITIO: Record<Sitio, string> = {
  triceps: 'Tríceps',
  subscapular: 'Subescapular',
  suprailiac: 'Supra-ilíaca',
  abdominal: 'Abdominal',
  thigh: 'Coxa',
  chest: 'Peitoral',
  midaxillary: 'Axilar média',
  biceps: 'Bíceps',
  calf: 'Panturrilha medial',
};

export interface Protocolo {
  id: string;
  nome: string;
  /**
   * Constantes da equação, em texto, para a profissional CONFERIR contra a
   * referência dela antes de confiar no número.
   *
   * Existe porque coeficiente errado não dá erro: devolve um percentual
   * plausível. Deixar a conta visível transforma uma caixa-preta impossível de
   * auditar em algo que se confere com o livro aberto em 30 segundos.
   */
  constantes: string[];
  /** Sítios exigidos, por sexo quando o protocolo difere. */
  sitios: (sexo: Sexo) => Sitio[];
  /** Observação clínica curta, exibida junto da escolha. */
  nota: string;
  /**
   * Sexos para os quais a equação foi publicada. Ausente = ambos.
   *
   * Não é detalhe: as equações de Petroski e Guedes que consegui verificar
   * foram desenvolvidas em amostras FEMININAS. Aplicá-las a homem seria usar
   * uma equação fora da população em que foi validada — produz número, não
   * medida.
   */
  aplicaA?: Sexo[];
  /** Precisa de peso e estatura além das dobras. */
  exigeAntropometria?: boolean;
  /**
   * Faixa etária em que a equação foi DESENVOLVIDA E VALIDADA.
   *
   * Não bloqueia o cálculo: bloquear impediria a profissional de avaliar uma
   * paciente de 55 anos com Petroski, decisão que é dela e não minha. Mas
   * aplicar uma equação fora da amostra em que foi construída produz um
   * número que parece medida e não é — então a tela avisa.
   *
   * As faixas vêm da apostila de antropometria que a profissional usa, que
   * as declara protocolo a protocolo.
   */
  faixaEtaria?: { de: number; ate: number; porSexo?: Partial<Record<Sexo, { de: number; ate: number }>> };
  /** Percentual de gordura, ou null quando falta dado. */
  calcular: (
    medidas: Partial<Record<Sitio, number>>,
    idade: number,
    sexo: Sexo,
    antropometria?: { pesoKg?: number | null; estaturaCm?: number | null },
  ) => number | null;
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
  faixaEtaria: {
    de: 18, ate: 61,
    porSexo: { male: { de: 18, ate: 61 }, female: { de: 18, ate: 55 } },
  },
  nome: 'Jackson & Pollock — 3 dobras',
  nota: 'O mais usado na rotina. Sítios diferentes para homem e mulher.',
  constantes: [
    'Homens: D = 1,10938 − 0,0008267·Σ + 0,0000016·Σ² − 0,0002574·idade',
    'Mulheres: D = 1,0994921 − 0,0009929·Σ + 0,0000023·Σ² − 0,0001392·idade',
    'Conversão: Siri — %G = 495/D − 450',
  ],
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
  faixaEtaria: {
    de: 18, ate: 61,
    porSexo: { male: { de: 18, ate: 61 }, female: { de: 18, ate: 55 } },
  },
  nome: 'Jackson & Pollock — 7 dobras',
  nota: 'Mais sítios, menor erro. Mesmos 7 pontos para ambos os sexos.',
  constantes: [
    'Homens: D = 1,112 − 0,00043499·Σ + 0,00000055·Σ² − 0,00028826·idade',
    'Mulheres: D = 1,097 − 0,00046971·Σ + 0,00000056·Σ² − 0,00012828·idade',
    'Conversão: Siri — %G = 495/D − 450',
  ],
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
  constantes: ['%G = Σ·0,153 + 5,783 (mesma equação para ambos os sexos)'],
  sitios: () => ['triceps', 'subscapular', 'suprailiac', 'abdominal'],
  calcular: (m) => {
    const s = soma(m, FAULKNER.sitios('male'));
    if (s === null) return null;
    return arred(s * 0.153 + 5.783);
  },
};

/**
 * Durnin & Womersley (1974) — 4 dobras, equação logarítmica.
 *
 * Diferente das outras: as constantes mudam por FAIXA ETÁRIA, não entram na
 * fórmula como variável. Por isso a tabela abaixo.
 *
 * ⚠️ Estes valores vêm da tabela amplamente reproduzida na literatura. São os
 * que eu consigo declarar, mas NÃO substituem conferência: a tela mostra as
 * constantes usadas justamente para que a profissional compare com a edição
 * que ela adota antes de usar clinicamente.
 */
const DW_CONSTANTES: Array<{ ate: number; male: [number, number]; female: [number, number] }> = [
  { ate: 19, male: [1.1620, 0.0630], female: [1.1549, 0.0678] },
  { ate: 29, male: [1.1631, 0.0632], female: [1.1599, 0.0717] },
  { ate: 39, male: [1.1422, 0.0544], female: [1.1423, 0.0632] },
  { ate: 49, male: [1.1620, 0.0700], female: [1.1333, 0.0612] },
  { ate: 200, male: [1.1715, 0.0779], female: [1.1339, 0.0645] },
];

const DURNIN: Protocolo = {
  id: 'durnin_womersley_4',
  nome: 'Durnin & Womersley — 4 dobras',
  nota: 'Equação logarítmica; as constantes mudam por faixa etária. Exige a dobra do bíceps.',
  constantes: [
    'D = c − m · log₁₀(Σ), com c e m por faixa etária:',
    ...DW_CONSTANTES.map((f, i) => {
      const de = i === 0 ? 17 : DW_CONSTANTES[i - 1].ate + 1;
      const faixa = f.ate >= 200 ? `${de}+` : `${de}–${f.ate}`;
      return `  ${faixa} anos — H: c=${f.male[0]} m=${f.male[1]} · M: c=${f.female[0]} m=${f.female[1]}`;
    }),
    'Conversão: Siri — %G = 495/D − 450',
  ],
  sitios: () => ['biceps', 'triceps', 'subscapular', 'suprailiac'],
  calcular: (m, idade, sexo) => {
    const s = soma(m, DURNIN.sitios(sexo));
    if (s === null || !(idade > 0)) return null;
    const faixa = DW_CONSTANTES.find((f) => idade <= f.ate) ?? DW_CONSTANTES[DW_CONSTANTES.length - 1];
    const [c, k] = faixa[sexo];
    const d = c - k * Math.log10(s);
    return arred(siri(d));
  },
};

/**
 * Guedes (1985) — 3 dobras, equação logarítmica, FEMININA.
 *
 * Lida em: Rev. Bras. de Nutrição Esportiva, artigo que reproduz
 * "Guedes 3 dobras (Guedes, 1985)" como
 * `DC = 1,16650 − 0,07063 · log(CX + SI + SB)`.
 *
 * A versão masculina não foi encontrada em fonte legível — por isso o
 * protocolo é restrito a mulheres em vez de aplicar a feminina a todo mundo.
 */
const GUEDES3: Protocolo = {
  id: 'guedes_3',
  faixaEtaria: { de: 17, ate: 27 },
  nome: 'Guedes — 3 dobras (feminina)',
  nota: 'Desenvolvida em universitárias do RS. Só a versão feminina pôde ser verificada.',
  aplicaA: ['female'],
  constantes: [
    'Mulheres: D = 1,16650 − 0,07063 · log₁₀(coxa + supra-ilíaca + subescapular)',
    'Conversão: Siri — %G = 495/D − 450',
    'Fonte: Guedes (1985), dissertação UFSM, reproduzida em artigo de acesso aberto.',
  ],
  sitios: () => ['thigh', 'suprailiac', 'subscapular'],
  calcular: (m, _idade, sexo) => {
    if (sexo !== 'female') return null;
    const s = soma(m, GUEDES3.sitios(sexo));
    if (s === null) return null;
    return arred(siri(1.16650 - 0.07063 * Math.log10(s)));
  },
};

/**
 * Petroski (1995) — equações generalizadas quadráticas, FEMININAS.
 *
 * Lidas em: Martins MEA, Fernandes Filho J. "Validação de equações
 * antropométricas generalizadas para a estimativa da densidade corporal em
 * mulheres militares". Rev Bras Cineantropom Desempenho Hum, 8(1):22-28, 2006
 * — Tabela 2, que reproduz as equações originais (n = 281, mulheres 18–51).
 *
 * ⚠️ Uma versão MUITO difundida da equação de 4 dobras circula SEM o termo
 * linear em Σ, só com o quadrático. Ela é matematicamente impossível: com
 * Σ = 60 mm a densidade fica negativa. Confirmei que a original tem os dois
 * termos. Se você encontrar a versão sem o linear, é transcrição corrompida.
 *
 * Usam peso e estatura além das dobras — incomum, e é característica delas.
 */
const petroski = (
  id: string, nome: string, nota: string, sitios: Sitio[],
  c: [number, number, number, number, number, number],
): Protocolo => ({
  id, nome, nota,
  aplicaA: ['female'],
  exigeAntropometria: true,
  faixaEtaria: { de: 18, ate: 51 },
  constantes: [
    `Mulheres: D = ${c[0]} − ${c[1]}·Σ + ${c[2]}·Σ² − ${c[3]}·idade − ${c[4]}·peso(kg) + ${c[5]}·estatura(cm)`,
    `Σ = ${sitios.map((x) => ROTULO_SITIO[x].toLowerCase()).join(' + ')}`,
    'Conversão: Siri — %G = 495/D − 450',
    'Fonte: Petroski (1995), reproduzida em Martins & Fernandes Filho, RBCDH 8(1):22-28, 2006, Tabela 2.',
    'Validada em 281 mulheres de 18 a 51 anos (RS/SC). Não desenvolvida para atletas.',
  ],
  sitios: () => sitios,
  calcular: (m, idade, sexo, antro) => {
    if (sexo !== 'female') return null;
    const s = soma(m, sitios);
    const peso = antro?.pesoKg;
    const est = antro?.estaturaCm;
    if (s === null || !(idade > 0) || !(peso! > 0) || !(est! > 0)) return null;
    const d = c[0] - c[1] * s + c[2] * s * s - c[3] * idade - c[4] * peso! + c[5] * est!;
    return arred(siri(d));
  },
});

const PETROSKI5 = petroski(
  'petroski_5', 'Petroski — 5 dobras (feminina)',
  'A que apresentou melhor validade concorrente em mulheres militares. Usa peso e estatura.',
  ['subscapular', 'triceps', 'suprailiac', 'abdominal', 'calf'],
  [1.03091919, 0.00048584, 0.00000131, 0.00026016, 0.00056484, 0.00053716],
);

const PETROSKI4 = petroski(
  'petroski_4', 'Petroski — 4 dobras (feminina)',
  'Sem a abdominal. Usa peso e estatura.',
  ['subscapular', 'triceps', 'suprailiac', 'calf'],
  [1.02902361, 0.00067159, 0.00000242, 0.00026073, 0.00056009, 0.00054649],
);

const PETROSKI3 = petroski(
  'petroski_3', 'Petroski — 3 dobras (feminina)',
  'A mais curta. Usa peso e estatura.',
  ['subscapular', 'suprailiac', 'thigh'],
  [1.04127059, 0.00087756, 0.00000380, 0.00025821, 0.00059076, 0.00051050],
);

/**
 * Petroski (1995) — equação quadrática MASCULINA, 4 dobras.
 *
 * ================== POR QUE ELA DEMOROU A ENTRAR ==========================
 *
 * Esteve em `PENDENTES` porque eu não tinha os coeficientes em fonte legível,
 * e coeficiente errado aqui não dá erro: devolve um percentual de gordura
 * plausível, que entra no prontuário e vira conduta.
 *
 * A nutricionista mandou (28/10/2026) a foto de um slide com a equação, e
 * notou sozinha a divergência que importava: ali o segundo termo aparecia
 * como `+ 0,00000212 (Σ)`, sem o quadrado, e ela tinha visto em outro lugar
 * com o quadrado. Ela estava certa, e a foto estava corrompida — o expoente
 * se perde quando o texto é transcrito de um PDF para um slide.
 *
 * ========================== DE ONDE VEM CADA COISA =========================
 *
 * A EQUAÇÃO, lida na Rev Bras Cineantropom Desempenho Hum (artigo que
 * reproduz Petroski 1995 no método), literalmente:
 *
 *   D = 1,10726863 − 0,00081201·X1 + 0,00000212·(X1)² − 0,00041761·ID
 *   X1 = subescapular + tricipital + supra-ilíaca oblíqua + panturrilha medial
 *   ID = idade em anos
 *
 * O mesmo trecho reproduz a equação FEMININA de 4 dobras com os coeficientes
 * que já estavam aqui (1,02902361 / 0,00067159 / 0,00000242 / 0,00026073 /
 * 0,00056009 / 0,00054649) — então a implementação anterior ficou confirmada
 * por uma segunda fonte independente, o que não é pouco.
 *
 * A FAIXA ETÁRIA (18–61) vem do slide da nutricionista, não desse artigo, que
 * não a declara. Está anotado aqui de propósito: é a parte que não consegui
 * confirmar na mesma fonte da equação.
 *
 * ⚠️ NÃO usa peso nem estatura — ao contrário das femininas acima, que usam.
 * Não é descuido meu: as duas formas são diferentes no original.
 */
const PETROSKI4_M: Protocolo = {
  id: 'petroski_4_masculino',
  nome: 'Petroski — 4 dobras (masculina)',
  nota: 'Quadrática, só dobras e idade. Não usa peso nem estatura.',
  aplicaA: ['male'],
  faixaEtaria: { de: 18, ate: 61 },
  constantes: [
    'Homens: D = 1,10726863 − 0,00081201·Σ + 0,00000212·Σ² − 0,00041761·idade',
    'Σ = subescapular + tríceps + supra-ilíaca + panturrilha medial',
    'Conversão: Siri — %G = 495/D − 450',
    'Fonte: Petroski (1995), reproduzida em Rev Bras Cineantropom Desempenho Hum '
      + '(transcrição conferida dígito a dígito, 29/10/2026).',
    'Validada em 304 homens do sul do Brasil. Faixa 18–61 anos conforme o '
      + 'material da profissional; o artigo consultado não declara a faixa.',
    '⚠️ O termo quadrático é Σ AO QUADRADO. Transcrições que trazem apenas Σ '
      + 'nesse termo perderam o expoente e dão densidade errada.',
  ],
  sitios: () => ['subscapular', 'triceps', 'suprailiac', 'calf'],
  calcular: (m, idade, sexo) => {
    if (sexo !== 'male') return null;
    const s = soma(m, ['subscapular', 'triceps', 'suprailiac', 'calf']);
    if (s === null || !(idade > 0)) return null;
    const d = 1.10726863 - 0.00081201 * s + 0.00000212 * s * s - 0.00041761 * idade;
    return arred(siri(d));
  },
};

export const PROTOCOLOS: Protocolo[] = [
  JP3, JP7, FAULKNER, DURNIN, GUEDES3, PETROSKI3, PETROSKI4, PETROSKI5,
  PETROSKI4_M,
];

/** Protocolos que servem ao sexo informado. */
export const protocolosPara = (sexo: Sexo | null): Protocolo[] =>
  PROTOCOLOS.filter((p) => !p.aplicaA || (sexo !== null && p.aplicaA.includes(sexo)));

export const protocoloPorId = (id: string): Protocolo | undefined =>
  PROTOCOLOS.find((p) => p.id === id);

/**
 * Aviso quando o paciente está fora da faixa de validação, ou null.
 *
 * Avisa, NÃO bloqueia. A escolha de usar uma equação fora da amostra em que
 * foi construída é clínica, e é dela. O que não pode acontecer é o número
 * sair com a mesma cara de sempre, sem nada indicando que ali a equação está
 * extrapolando.
 */
export function foraDaFaixa(protocolo: Protocolo, idade: number, sexo: Sexo | null): string | null {
  const f = protocolo.faixaEtaria;
  if (!f || !(idade > 0)) return null;
  const faixa = (sexo && f.porSexo?.[sexo]) || f;
  if (idade >= faixa.de && idade <= faixa.ate) return null;
  return `Esta equação foi desenvolvida em pessoas de ${faixa.de} a ${faixa.ate} anos. `
    + `O paciente tem ${idade}: o resultado é uma extrapolação, não uma medida validada.`;
}

/**
 * Protocolos pedidos e ainda NÃO implementados, com o motivo. Exibir esta
 * lista na tela é melhor que omitir: a profissional vê que o pedido foi
 * registrado e por que ainda não está lá.
 */
export const PENDENTES = [
  {
    nome: 'Guedes — versão MASCULINA',
    motivo: 'só a equação feminina foi encontrada em fonte legível. Aplicar a feminina a homem usaria a equação fora da população em que foi validada',
  },
  {
    nome: 'Petroski — versão feminina logarítmica (axilar média, supra-ilíaca, coxa, panturrilha)',
    motivo: 'a profissional enviou esta equação em 28/10/2026 e ela NÃO foi encontrada nas fontes consultadas, '
      + 'que trazem a versão feminina quadrática já implementada aqui. São equações diferentes do mesmo autor — '
      + 'entra assim que a referência que a traz for localizada',
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

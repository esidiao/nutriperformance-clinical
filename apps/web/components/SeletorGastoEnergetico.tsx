'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import {
  FORMULAS, formulaPorId, calcular, fatoresDe, fatorPorId, PENDENTES,
  type Formula, type Sexo, type Entrada, type EstadoPreGestacional,
} from '@/lib/gasto-energetico';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * Escolha da fórmula de gasto energético.
 *
 * POR QUE A CONTA FICA VISÍVEL
 *
 * Coeficiente errado numa equação de gasto energético não dá erro: devolve
 * uma caloria plausível que vira prescrição. A profissional é a única que
 * pode conferir contra a referência dela — e só consegue se a conta estiver
 * na tela. Por isso cada fórmula mostra a equação, a fonte, e se os
 * coeficientes foram lidos na publicação ou são os de uso corrente.
 *
 * POR QUE A ESCALA DE ATIVIDADE MUDA COM A FÓRMULA
 *
 * Não são intercambiáveis. A FAO publica 1,40 a 2,40; a escala de uso
 * corrente com Harris-Benedict vai de 1,2 a 1,9; e no EER 2023 a categoria
 * não multiplica nada — escolhe uma equação inteira. Oferecer uma lista fixa
 * deixaria aplicar o fator de um sistema na TMB de outro, o que produz um
 * GET plausível e errado.
 */

export interface ResultadoGasto {
  tmb: number | null;
  get: number | null;
  formulaId: string;
  /** O que gravar em `bmr_formula`: id mais a categoria, quando há. */
  rotuloRegistro: string;
  /**
   * Fator PAL, ou null quando a fórmula não usa fator.
   *
   * No EER 2023 a categoria ESCOLHE a equação. Gravar 1,60 aqui faria o
   * registro afirmar que o GET saiu de TMB × 1,60, o que não aconteceu.
   */
  palFactor: number | null;
}

interface Props {
  pesoKg?: number | null;
  alturaCm?: number | null;
  idade?: number | null;
  sexo?: Sexo | null;
  /** Massa livre de gordura, quando a avaliação física já a calculou. */
  mlgKg?: number | null;
  onChange: (r: ResultadoGasto | null) => void;
}

const ESTADOS: Array<{ id: EstadoPreGestacional; label: string }> = [
  { id: 'baixo_peso', label: 'Baixo peso' },
  { id: 'eutrofia', label: 'Eutrofia' },
  { id: 'sobrepeso', label: 'Sobrepeso' },
  { id: 'obesidade', label: 'Obesidade' },
];

const selectCls =
  'w-full h-10 rounded-md border border-input bg-background px-3 text-sm dark:bg-gray-800 dark:border-gray-700';

export function SeletorGastoEnergetico({
  pesoKg, alturaCm, idade, sexo, mlgKg, onChange,
}: Props) {
  const [formulaId, setFormulaId] = useState('fao_who_unu_2004');
  const [fatorId, setFatorId] = useState('');
  const [valorInformado, setValorInformado] = useState('');
  const [semanaGestacional, setSemanaGestacional] = useState('');
  const [estadoPre, setEstadoPre] = useState<EstadoPreGestacional | ''>('');
  const [mesesPosParto, setMesesPosParto] = useState('');
  const [verConta, setVerConta] = useState(false);
  const [verPendentes, setVerPendentes] = useState(false);

  const formula: Formula = formulaPorId(formulaId) ?? FORMULAS[0];
  const fatores = useMemo(() => fatoresDe(formula, idade), [formula, idade]);

  const numero = (s: string) => {
    const v = Number(String(s).replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  };

  // Trocar de fórmula troca a escala: um id da escala antiga não existe na
  // nova, e deixá-lo selecionado daria "fator não encontrado" silencioso.
  useEffect(() => {
    if (fatorId && !fatores.some((f) => f.id === fatorId)) setFatorId('');
  }, [fatores, fatorId]);

  const entrada: Entrada = {
    pesoKg, alturaCm, idade, sexo, mlgKg,
    valorInformado: numero(valorInformado),
    categoriaAtividade: fatorId || null,
    semanaGestacional: numero(semanaGestacional),
    estadoPreGestacional: estadoPre || null,
    mesesPosParto: mesesPosParto === '' ? null : numero(mesesPosParto),
  };

  const fator = formula.ajuste === 'multiplica_tmb' || formula.ajuste === 'multiplica_get'
    ? fatorPorId(formula, fatorId)
    : null;

  const resultado = calcular(formula, entrada, fator);

  useEffect(() => {
    if (resultado.tmb === null && resultado.get === null) {
      onChange(null);
      return;
    }
    onChange({
      tmb: resultado.tmb,
      get: resultado.get,
      formulaId: formula.id,
      rotuloRegistro: fatorId ? `${formula.id}:${fatorId}` : formula.id,
      palFactor: formula.ajuste === 'multiplica_tmb' ? fator : null,
    });
    // `resultado` é recriado a cada render; as dependências reais são estas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado.tmb, resultado.get, formula.id, fatorId, fator]);

  const precisa = (campo: string) => formula.exige.includes(campo as never);

  const rotuloValor =
    formula.id === 'bolso' ? 'kcal por kg de peso'
      : formula.id === 'get_manual' ? 'GET (kcal/dia)'
        : 'TMB (kcal/dia)';

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-brand-600" />
        <p className="text-sm font-semibold">Gasto energético</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="formula">Fórmula</Label>
          <select
            id="formula" value={formulaId} className={selectCls}
            onChange={(e) => setFormulaId(e.target.value)}
          >
            {FORMULAS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}{f.verificacao === 'pendente' ? ' ⚠' : ''}
              </option>
            ))}
          </select>
        </div>

        {fatores.length > 0 && (
          <div>
            <Label htmlFor="fator">
              {formula.ajuste === 'seleciona_equacao'
                ? 'Nível de atividade física (NAF)'
                : 'Fator de atividade'}
            </Label>
            <select
              id="fator" value={fatorId} className={selectCls}
              onChange={(e) => setFatorId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {fatores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                  {formula.ajuste !== 'seleciona_equacao' ? ` (${String(f.valor).replace('.', ',')})` : ''}
                </option>
              ))}
            </select>
            {fatorId && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {fatores.find((f) => f.id === fatorId)?.detalhe}
              </p>
            )}
          </div>
        )}

        {precisa('valor') && (
          <div>
            <Label htmlFor="valorInformado">{rotuloValor}</Label>
            <Input
              id="valorInformado" type="number" inputMode="decimal" min={0}
              value={valorInformado} onChange={(e) => setValorInformado(e.target.value)}
              placeholder={formula.id === 'bolso' ? '30' : '1500'}
            />
          </div>
        )}

        {precisa('semanaGestacional') && (
          <div>
            <Label htmlFor="semanaGestacional">Semana gestacional</Label>
            <Input
              id="semanaGestacional" type="number" min={1} max={42}
              value={semanaGestacional} onChange={(e) => setSemanaGestacional(e.target.value)}
              placeholder="28"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              No 1º trimestre use a fórmula de mulher não gestante.
            </p>
          </div>
        )}

        {precisa('estadoPreGestacional') && (
          <div>
            <Label htmlFor="estadoPre">Estado nutricional pré-gestacional</Label>
            <select
              id="estadoPre" value={estadoPre} className={selectCls}
              onChange={(e) => setEstadoPre(e.target.value as EstadoPreGestacional | '')}
            >
              <option value="">Selecione…</option>
              {ESTADOS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </div>
        )}

        {precisa('mesesPosParto') && (
          <div>
            <Label htmlFor="mesesPosParto">Meses de pós-parto</Label>
            <Input
              id="mesesPosParto" type="number" min={0} max={12}
              value={mesesPosParto} onChange={(e) => setMesesPosParto(e.target.value)}
              placeholder="3"
            />
          </div>
        )}

        {precisa('mlg') && (
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground">
              {mlgKg
                ? `Massa livre de gordura: ${mlgKg} kg, vinda da avaliação física.`
                : 'Esta fórmula usa a massa livre de gordura, que vem da avaliação física por dobras cutâneas. Faça a avaliação física antes, ou escolha outra fórmula.'}
            </p>
          </div>
        )}
      </div>

      {/* Resultado, ou o motivo exato de não haver resultado. As duas
          situações são diferentes e a tela não as confunde. */}
      {resultado.naoSeAplica ? (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">{resultado.naoSeAplica}</p>
        </div>
      ) : resultado.faltando.length ? (
        <p className="text-xs text-muted-foreground">
          Falta preencher: {resultado.faltando.join(', ')}.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-2 text-center">
            <p className="text-[11px] text-gray-500">TMB</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
              {resultado.tmb ?? '—'}
            </p>
            <p className="text-[11px] text-gray-400">
              {resultado.tmb === null ? 'esta fórmula estima o GET direto' : 'kcal/dia'}
            </p>
          </div>
          <div className="rounded-lg border p-2 text-center">
            <p className="text-[11px] text-gray-500">GET</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {resultado.get ?? '—'}
            </p>
            <p className="text-[11px] text-gray-400">kcal/dia</p>
          </div>
        </div>
      )}

      {/* Procedência: o que permite a profissional confiar, ou desconfiar. */}
      {formula.verificacao === 'pendente' && (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Os coeficientes desta equação são os de uso corrente, mas a publicação
            original não foi conferida aqui. Compare a conta abaixo com a sua
            referência antes de prescrever.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setVerConta((v) => !v)}
        className="flex items-center gap-1 text-xs text-brand-700 dark:text-brand-400 hover:underline"
      >
        {verConta ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {verConta ? 'Ocultar a conta' : 'Ver a conta e a fonte'}
      </button>

      {verConta && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-1.5">
          {formula.constantes.map((c, i) => (
            <p key={i} className="text-[11px] font-mono text-gray-700 dark:text-gray-300">{c}</p>
          ))}
          {formula.nota && (
            <p className="text-[11px] text-gray-500 italic pt-1">{formula.nota}</p>
          )}
          <p className="text-[11px] text-gray-500 border-t pt-1.5 mt-1.5">
            <strong>Fonte:</strong> {formula.fonte}
          </p>
        </div>
      )}

      {/* A lista do que ainda não existe. Omitir faria parecer que o pedido
          se perdeu; declarada, a profissional sabe que pode usar a entrada
          manual enquanto isso. */}
      <button
        type="button"
        onClick={() => setVerPendentes((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <Info className="h-3 w-3" />
        {verPendentes ? 'Ocultar' : `Fórmulas ainda não disponíveis (${PENDENTES.length})`}
      </button>

      {verPendentes && (
        <ul className="space-y-1 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
          {PENDENTES.map((p) => (
            <li key={p.nome} className="text-[11px] text-gray-600 dark:text-gray-400">
              <strong>{p.nome}:</strong> {p.motivo}
            </li>
          ))}
          <li className="text-[11px] text-gray-500 italic pt-1 border-t">
            Enquanto isso, use “Informar TMB manualmente” ou “Informar GET manualmente”:
            calcule pela sua referência e digite o valor.
          </li>
        </ul>
      )}
    </div>
  );
}

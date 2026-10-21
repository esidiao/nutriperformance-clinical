'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * Quantidade em medida caseira, convertida para gramas.
 *
 * POR QUE ISTO EXISTE
 *
 * Até aqui a quantidade era digitada em gramas. "87 g de batata" exige
 * balança, e ninguém tem balança na cozinha. "2 colheres de servir" é o que
 * o paciente consegue seguir, e é como ele relata o que comeu — ninguém diz
 * "comi 225 gramas de feijoada", diz "comi uma concha".
 *
 * O QUE A TELA PRECISA DEIXAR CLARO
 *
 * A conversão aparece ao lado: "2 colheres de servir = 90 g". Sem isso, a
 * profissional não tem como conferir, e um erro de medida vira um erro de
 * prescrição sem deixar rastro.
 *
 * E a GRAMA continua disponível. Quando a profissional pesou, o valor pesado
 * é melhor que qualquer conversão — a medida caseira é uma estimativa da
 * população, não daquele prato.
 */

export interface MedidaCaseira {
  medida: string;
  gramas: number;
  padrao: boolean;
}

interface Props {
  medidas: MedidaCaseira[];
  /** Gramas atuais. É sempre isto que se grava. */
  valorG: string;
  onChangeG: (gramas: string) => void;
  /** Para a tela registrar o que a profissional escolheu, como ela escolheu. */
  onChangeMedida?: (descricao: string | null) => void;
  id?: string;
}

const EM_GRAMAS = '__gramas__';

const numero = (s: string) => {
  const v = Number(String(s).replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
};

/** 90 em vez de 90.00; 7,5 em vez de 7.5. */
const formatar = (n: number) =>
  (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function SeletorMedidaCaseira({
  medidas, valorG, onChangeG, onChangeMedida, id = 'medida',
}: Props) {
  const [escolhida, setEscolhida] = useState<string>(EM_GRAMAS);
  const [quantas, setQuantas] = useState('1');

  // A medida padrão do alimento vem pré-selecionada. Trocar de alimento troca
  // a lista inteira, e manter a escolha anterior apontaria para uma medida
  // que o novo alimento não tem.
  const chave = useMemo(() => medidas.map((m) => m.medida).join('|'), [medidas]);
  useEffect(() => {
    const padrao = medidas.find((m) => m.padrao) ?? medidas[0];
    setEscolhida(padrao ? padrao.medida : EM_GRAMAS);
    setQuantas('1');
    // `chave` muda quando a lista muda; `medidas` é recriado a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const medida = medidas.find((m) => m.medida === escolhida) ?? null;

  // A conversão roda quando a escolha ou a quantidade mudam. Em gramas, o
  // campo é o próprio valor e nada é convertido.
  useEffect(() => {
    if (!medida) {
      onChangeMedida?.(null);
      return;
    }
    const n = numero(quantas);
    if (n === null) return;
    onChangeG(String(Math.round(n * medida.gramas * 10) / 10));
    onChangeMedida?.(`${formatar(n)} ${medida.medida}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhida, quantas, medida?.gramas]);

  if (!medidas.length) {
    return (
      <div>
        <Label htmlFor={id}>Quantidade (g)</Label>
        <Input
          id={id} type="number" min={0} step="1" inputMode="decimal"
          value={valorG} onChange={(e) => onChangeG(e.target.value)}
          placeholder="100"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Este alimento não tem medida caseira na base.
        </p>
      </div>
    );
  }

  const emGramas = medida === null;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label htmlFor={`${id}-qtd`}>{emGramas ? 'Quantidade (g)' : 'Quantas'}</Label>
        <Input
          id={`${id}-qtd`}
          type="number" min={0} step={emGramas ? '1' : '0.5'} inputMode="decimal"
          value={emGramas ? valorG : quantas}
          onChange={(e) => (emGramas ? onChangeG(e.target.value) : setQuantas(e.target.value))}
          placeholder={emGramas ? '100' : '1'}
        />
      </div>

      <div>
        <Label htmlFor={`${id}-medida`}>Medida</Label>
        <select
          id={`${id}-medida`}
          value={escolhida}
          onChange={(e) => setEscolhida(e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm dark:bg-gray-800 dark:border-gray-700"
        >
          {medidas.map((m) => (
            <option key={m.medida} value={m.medida}>
              {m.medida}{m.padrao ? ' ★' : ''}
            </option>
          ))}
          {/* A balança vence a tabela quando a profissional pesou. */}
          <option value={EM_GRAMAS}>gramas (pesado)</option>
        </select>
      </div>

      {/* A conta, visível. Sem ela a profissional não tem como conferir. */}
      {!emGramas && medida && (
        <p className="col-span-2 text-[11px] text-muted-foreground">
          {formatar(numero(quantas) ?? 0)} {medida.medida} ={' '}
          <strong>{formatar((numero(quantas) ?? 0) * medida.gramas)} g</strong>
          <span className="text-gray-400"> · 1 {medida.medida} = {formatar(medida.gramas)} g</span>
        </p>
      )}
    </div>
  );
}

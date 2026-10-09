'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Label } from '@/components/ui/label';

export type PacienteResumo = {
  id: string;
  name: string;
  internalCode: string | null;
  age?: number;
  gender?: string;
};

/**
 * Seleção de paciente a partir dos pacientes REAIS do workspace.
 *
 * Existe porque quatro telas mantinham a própria lista escrita no código
 * (`PAC-SEED-001` a `PAC-004`). No relatório de testes de 07/10/2026 isso
 * apareceu como "os pacientes cadastrados não aparecem para seleção" — o PDF
 * saía certinho, mas vinculado a um paciente de exemplo.
 *
 * Lista em um lugar só porque quatro cópias divergem: basta alguém corrigir
 * uma para as outras três seguirem erradas, e nenhuma avisa.
 */
export function SeletorDePaciente({
  value,
  onChange,
  label = 'Paciente',
  id = 'paciente',
  obrigatorio = false,
  className = '',
}: {
  value: string;
  onChange: (id: string, paciente?: PacienteResumo) => void;
  label?: string;
  id?: string;
  obrigatorio?: boolean;
  className?: string;
}) {
  const { data, isLoading, isError } = useQuery({
    // Limite alto porque é um <select>: paginar aqui esconderia paciente sem
    // que a pessoa perceba que a lista está cortada.
    queryKey: ['pacientes-seletor'],
    queryFn: () => api.patients.list({ limit: 200, active: true }),
    staleTime: 60_000,
  });

  const pacientes: PacienteResumo[] = (data as any)?.items ?? [];

  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}{obrigatorio && <span className="text-destructive"> *</span>}
      </Label>

      {isLoading ? (
        <div className="h-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando pacientes…
        </div>
      ) : isError ? (
        <p className="h-10 flex items-center text-sm text-destructive">
          Não foi possível carregar os pacientes.
        </p>
      ) : pacientes.length === 0 ? (
        // Lista vazia precisa dizer que está vazia. Um select vazio parece
        // defeito, e foi assim que a lista de exemplo passou por "a lista".
        <p className="h-10 flex items-center text-sm text-muted-foreground">
          Nenhum paciente cadastrado ainda.
        </p>
      ) : (
        <select
          id={id}
          aria-label={label}
          value={value}
          onChange={(e) => {
            const escolhido = pacientes.find((p) => p.id === e.target.value);
            onChange(e.target.value, escolhido);
          }}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Selecione…</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.internalCode ? ` · ${p.internalCode}` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

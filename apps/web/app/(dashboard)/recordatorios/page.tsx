'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ClipboardList, ChevronRight, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';
import { SeletorDePaciente } from '@/components/SeletorDePaciente';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const dataBR = (iso?: string | null) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

const ROTULO_DIA: Record<string, string> = {
  dia_util: 'Dia útil',
  fim_de_semana: 'Fim de semana',
};

/**
 * Recordatório de 24 horas.
 *
 * Registra o que o paciente RELATOU ter comido. Não é prescrição: não se
 * assina e não vai para o paciente como orientação. A separação aparece na
 * tela, não só no banco — quem abre precisa saber o que está lendo.
 */
export default function RecordatoriosPage() {
  const search = useSearchParams();
  const patientId = search.get('patient') ?? '';
  const qc = useQueryClient();

  const hojeISO = new Date().toISOString().slice(0, 10);
  // Padrão é ONTEM: um recordatório de 24 h cobre o dia anterior, e deixar
  // hoje como padrão levaria a registrar um dia que ainda não terminou.
  const ontemISO = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

  const [data, setData] = useState(ontemISO);
  const [tipoDeDia, setTipoDeDia] = useState('dia_util');
  const [erro, setErro] = useState<string | null>(null);

  const listaQ = useQuery({
    queryKey: ['recordatorios', patientId],
    queryFn: () => api.recordatorios.list(patientId),
    enabled: !!patientId,
  });

  const criar = useMutation({
    mutationFn: () => api.recordatorios.create({
      patientId, dataReferencia: data, tipoDeDia,
    }),
    onSuccess: (novo: any) => {
      setErro(null);
      qc.invalidateQueries({ queryKey: ['recordatorios', patientId] });
      if (novo?.id) window.location.href = `/recordatorios/${novo.id}?patient=${patientId}`;
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível criar o recordatório.'),
  });

  // Sem paciente a tela ESCOLHE, em vez de mandar embora — o beco sem saída
  // de /meal-plans foi relatado como "o sistema volta para a lista".
  if (!patientId) {
    return (
      <>
        <PageHeader
          title="Recordatório de 24 horas"
          description="Registro do que o paciente relatou ter comido"
        />
        <div className="p-4 sm:p-6 max-w-xl">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                O recordatório é sempre de um paciente. Escolha de quem você quer
                registrar ou consultar.
              </p>
              <SeletorDePaciente
                id="recordatorio-paciente"
                value=""
                onChange={(id) => {
                  if (id) window.location.href = `/recordatorios?patient=${id}`;
                }}
              />
              <p className="text-xs text-muted-foreground">
                Prefere começar pela ficha?{' '}
                <Link href="/patients" className="underline">Ver todos os pacientes</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const lista: any[] = (listaQ.data as any) ?? [];

  return (
    <>
      <PageHeader
        title="Recordatório de 24 horas"
        description="Registro do que o paciente relatou ter comido"
        breadcrumbs={[
          { label: 'Pacientes', href: '/patients' },
          { label: 'Paciente', href: `/patients/${patientId}` },
          { label: 'Recordatórios' },
        ]}
      />

      <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
        {/* Diz o que o instrumento é — e o que ele NÃO é. Sem isso alguém
            entrega o recordatório ao paciente achando que é a dieta. */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>Isto não é prescrição.</strong> O recordatório registra o consumo
          relatado pelo paciente, para avaliar o que ele come hoje. O plano alimentar —
          o que você prescreve — fica em <Link href={`/meal-plans?patient=${patientId}`} className="underline">Planos Alimentares</Link>.
        </div>

        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm font-semibold">Novo recordatório</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="data">Dia recordado</Label>
                <Input
                  id="data" type="date" value={data} max={hojeISO}
                  onChange={(e) => setData(e.target.value)}
                />
                {/* A data é do dia RECORDADO, não da consulta. Um recordatório
                    feito na segunda costuma cobrir o domingo. */}
                <p className="text-[11px] text-muted-foreground mt-1">
                  O dia que o paciente está recordando — não o dia de hoje.
                </p>
              </div>
              <div>
                <Label htmlFor="tipo">Tipo de dia</Label>
                <select
                  id="tipo" value={tipoDeDia}
                  onChange={(e) => setTipoDeDia(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="dia_util">Dia útil</option>
                  <option value="fim_de_semana">Fim de semana</option>
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Muda a leitura do consumo — fim de semana costuma não representar a rotina.
                </p>
              </div>
            </div>

            {erro && <p className="text-xs text-destructive">{erro}</p>}

            <Button onClick={() => criar.mutate()} disabled={!data || criar.isPending}>
              {criar.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Criando…</>
                : <><Plus className="h-4 w-4 mr-1" /> Criar recordatório</>}
            </Button>
          </CardContent>
        </Card>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            Recordatórios deste paciente
          </p>

          {listaQ.isLoading && (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {listaQ.isError && (
            <p className="py-6 text-center text-sm text-destructive">
              Não foi possível carregar os recordatórios.
            </p>
          )}

          {!listaQ.isLoading && !listaQ.isError && lista.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum recordatório registrado ainda.
            </p>
          )}

          <div className="space-y-2">
            {lista.map((r) => (
              <Link key={r.id} href={`/recordatorios/${r.id}?patient=${patientId}`}>
                <Card className="hover:border-blue-300 transition-colors">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <ClipboardList className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <CalendarDays className="h-3 w-3 text-gray-400" />
                        {dataBR(r.dataReferencia)}
                        {r.tipoDeDia && (
                          <span className="text-[11px] text-gray-500">
                            · {ROTULO_DIA[r.tipoDeDia] ?? r.tipoDeDia}
                          </span>
                        )}
                      </p>
                      {r.observacao && (
                        <p className="text-xs text-gray-500 truncate">{r.observacao}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

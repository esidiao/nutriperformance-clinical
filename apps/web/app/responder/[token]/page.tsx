'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * Anamnese pré-consulta — a página que o paciente abre pelo link.
 *
 * Não usa o api-client do app: aquele anexa o token do Supabase, e aqui não
 * existe sessão. Fala direto com as rotas `publico/`, sem cabeçalho de
 * autenticação — o token da URL é a única credencial.
 *
 * A tela também não mostra nome de paciente nem qualquer dado pessoal, porque
 * o backend não devolve nenhum: quem abriu o link pode ser quem recebeu o
 * encaminhamento por engano. O formulário pergunta, não informa.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Pergunta {
  id: string; rotulo: string; tipo: string;
  obrigatoria?: boolean; opcoes?: string[]; ajuda?: string;
  unidade?: string; min?: number; max?: number;
}

function Campo({
  p, valor, onChange,
}: { p: Pergunta; valor: any; onChange: (v: any) => void }) {
  const base = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

  switch (p.tipo) {
    case 'textarea':
      return (
        <textarea id={p.id} rows={4} className={base} value={valor ?? ''}
                  onChange={(e) => onChange(e.target.value)} />
      );
    case 'numero':
      return (
        <div className="flex items-center gap-2">
          <input id={p.id} type="number" inputMode="decimal" min={p.min} max={p.max}
                 className={base} value={valor ?? ''}
                 onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
          {p.unidade && <span className="text-sm text-muted-foreground">{p.unidade}</span>}
        </div>
      );
    case 'sim_nao':
      return (
        <div className="flex gap-2">
          {[['Sim', true], ['Não', false]].map(([rotulo, v]) => (
            <button
              key={String(v)} type="button" onClick={() => onChange(v)}
              className={`px-4 py-2 rounded-md border text-sm ${
                valor === v ? 'bg-primary text-primary-foreground border-primary' : 'border-input'
              }`}
            >
              {rotulo as string}
            </button>
          ))}
        </div>
      );
    case 'escolha':
      return (
        <select id={p.id} className={base} value={valor ?? ''}
                onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione…</option>
          {p.opcoes?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'multipla':
      return (
        <div className="space-y-1.5">
          {p.opcoes?.map((o) => {
            const marcados: string[] = valor ?? [];
            return (
              <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox" checked={marcados.includes(o)}
                  onChange={() => onChange(
                    marcados.includes(o) ? marcados.filter((x) => x !== o) : [...marcados, o],
                  )}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    default:
      return (
        <input id={p.id} type="text" className={base} value={valor ?? ''}
               onChange={(e) => onChange(e.target.value)} />
      );
  }
}

function Aviso({ titulo, texto, Icone }: { titulo: string; texto: string; Icone: any }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-3">
        <Icone className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}

export default function ResponderAnamnese() {
  const { token } = useParams<{ token: string }>();
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['anamnese', token],
    queryFn: async () => {
      const r = await fetch(`${API}/publico/anamnese/${token}`);
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo?.message ?? 'Não foi possível abrir o formulário.');
      return corpo;
    },
    retry: false,
  });

  const enviar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/publico/anamnese/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(respostas),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw corpo;
      return corpo;
    },
    onSuccess: () => setEnviado(true),
    onError: (e: any) => {
      // O backend devolve erro por pergunta; mostrar cada um ao lado do seu
      // campo poupa o paciente de caçar o que faltou num formulário longo.
      const mapa: Record<string, string> = {};
      for (const err of e?.erros ?? []) mapa[err.perguntaId] = err.mensagem;
      setErros(mapa);
      if (Object.keys(mapa).length) {
        document.getElementById(Object.keys(mapa)[0])?.scrollIntoView({
          behavior: 'smooth', block: 'center',
        });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <Aviso titulo="Link indisponível" texto={(error as Error).message} Icone={AlertTriangle} />;
  }

  if (enviado) {
    return (
      <Aviso
        titulo="Respostas enviadas"
        texto="Obrigado! Suas respostas já estão com a profissional que vai te atender."
        Icone={CheckCircle2}
      />
    );
  }

  const secoes = (data as any)?.questionario ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-5 sm:p-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Antes da sua consulta</h1>
          <p className="text-sm text-muted-foreground">
            Responder agora deixa o atendimento mais proveitoso — sobra tempo para o que
            realmente importa. Leva cerca de 10 minutos e não precisa ser perfeito.
          </p>
        </header>

        {secoes.map((s: any) => (
          <section key={s.id} className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground border-b pb-1.5">{s.titulo}</h2>
            {s.perguntas.map((p: Pergunta) => (
              <div key={p.id} className="space-y-1.5">
                <label htmlFor={p.id} className="block text-sm text-foreground">
                  {p.rotulo}
                  {/* Marca o obrigatório com palavra, não com asterisco: nem todo
                      mundo sabe o que o asterisco quer dizer. */}
                  {p.obrigatoria && (
                    <span className="text-xs text-muted-foreground"> (obrigatória)</span>
                  )}
                </label>
                {p.ajuda && <p className="text-xs text-muted-foreground">{p.ajuda}</p>}
                <Campo
                  p={p} valor={respostas[p.id]}
                  onChange={(v) => {
                    setRespostas((r) => ({ ...r, [p.id]: v }));
                    setErros((e) => { const n = { ...e }; delete n[p.id]; return n; });
                  }}
                />
                {erros[p.id] && <p className="text-xs text-destructive">{erros[p.id]}</p>}
              </div>
            ))}
          </section>
        ))}

        {/* LGPD: dado de saúde coletado fora de uma sessão autenticada. A pessoa
            precisa saber o que acontece com o que ela escreveu, na hora de
            escrever — não num link de política que ninguém abre. */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-4">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Suas respostas vão direto para o prontuário da profissional que solicitou este
            formulário e são usadas apenas no seu atendimento. Este link expira e aceita
            envio uma única vez.
          </p>
        </div>

        {enviar.isError && !Object.keys(erros).length && (
          <p className="text-sm text-destructive">
            {(enviar.error as any)?.message ?? 'Não foi possível enviar. Tente novamente.'}
          </p>
        )}

        <button
          type="button"
          onClick={() => enviar.mutate()}
          disabled={enviar.isPending}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {enviar.isPending
            ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            : 'Enviar respostas'}
        </button>
        <p className="text-xs text-center text-muted-foreground pb-6">
          Depois de enviar, não é possível alterar.
        </p>
      </div>
    </div>
  );
}

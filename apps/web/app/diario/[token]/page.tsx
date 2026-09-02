'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Camera, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

/**
 * Diário alimentar — a página que o paciente abre pelo link.
 *
 * A foto vai DIRETO para o armazenamento, com uma URL assinada que a API emite
 * e que vale dez minutos. A imagem não passa pelo servidor: além de mais
 * rápido no celular, evita streamar 8 MB pela instância do plano gratuito, que
 * seria a primeira coisa a cair.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

const ROTULO_REFEICAO: Record<string, string> = {
  cafe_manha: 'Café da manhã',
  lanche_manha: 'Lanche da manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
};

/** Sugere a refeição pelo horário — quase sempre acerta e poupa um toque. */
function refeicaoProvavel(): string {
  const h = new Date().getHours();
  if (h < 10) return 'cafe_manha';
  if (h < 12) return 'lanche_manha';
  if (h < 15) return 'almoco';
  if (h < 18) return 'lanche_tarde';
  if (h < 22) return 'jantar';
  return 'ceia';
}

const horaLocal = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-3">
        <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}

export default function DiarioPaciente() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();

  const [refeicao, setRefeicao] = useState(refeicaoProvavel());
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [tomadaEm, setTomadaEm] = useState(horaLocal(new Date()));
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoAgora, setEnviadoAgora] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['diario', token],
    queryFn: async () => {
      const r = await fetch(`${API}/publico/diario/${token}`);
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo?.message ?? 'Não foi possível abrir o diário.');
      return corpo;
    },
    retry: false,
  });

  const escolherFoto = (f: File | null) => {
    setArquivo(f);
    setPrevia(f ? URL.createObjectURL(f) : null);
  };

  const enviar = useMutation({
    mutationFn: async () => {
      // 1. Registra e pede a assinatura de envio.
      const r = await fetch(`${API}/publico/diario/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refeicao,
          descricao: descricao.trim() || undefined,
          tomadaEm: new Date(tomadaEm).toISOString(),
          mimeFoto: arquivo?.type,
        }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo?.message ?? 'Não foi possível registrar.');

      // 2. Envia a foto direto ao armazenamento.
      if (arquivo && corpo.envio?.url) {
        const up = await fetch(corpo.envio.url, {
          method: 'PUT',
          headers: { 'Content-Type': arquivo.type },
          body: arquivo,
        });
        // O registro já está salvo com a descrição. Falhar aqui não deve
        // apagar o que a pessoa escreveu — avisa e segue.
        if (!up.ok) {
          throw new Error('A refeição foi registrada, mas a foto não subiu. Tente anexá-la de novo.');
        }
      }
      return corpo;
    },
    onSuccess: () => {
      setDescricao(''); escolherFoto(null); setErro(null);
      setTomadaEm(horaLocal(new Date()));
      setEnviadoAgora(true);
      setTimeout(() => setEnviadoAgora(false), 4000);
      qc.invalidateQueries({ queryKey: ['diario', token] });
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível enviar.'),
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>;
  }

  if (error) {
    return <Aviso titulo="Link indisponível" texto={(error as Error).message} />;
  }

  const registros = (data as any)?.registros ?? [];
  const podeEnviar = (!!descricao.trim() || !!arquivo) && !enviar.isPending;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-5 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Seu diário alimentar</h1>
          <p className="text-sm text-muted-foreground">
            Registre suas refeições com foto ou descrição. Não precisa ser todo dia perfeito —
            o que ajuda é o retrato real da sua rotina.
          </p>
        </header>

        <div className="rounded-lg border p-4 space-y-3">
          <div>
            <label htmlFor="ref" className="text-xs text-muted-foreground">Refeição</label>
            <select id="ref" value={refeicao} onChange={(e) => setRefeicao(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              {Object.entries(ROTULO_REFEICAO).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="hora" className="text-xs text-muted-foreground">Quando você comeu</label>
            {/* Preenchido com agora, mas editável: registrar depois é o normal,
                e forçar "agora" gravaria o almoço no horário do jantar. */}
            <input id="hora" type="datetime-local" value={tomadaEm}
                   max={horaLocal(new Date())}
                   onChange={(e) => setTomadaEm(e.target.value)}
                   className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" />
          </div>

          <div>
            <label htmlFor="foto" className="text-xs text-muted-foreground">Foto do prato</label>
            <label htmlFor="foto"
                   className="flex items-center justify-center gap-2 h-24 rounded-md border border-dashed border-input cursor-pointer text-sm text-muted-foreground">
              {previa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previa} alt="Prévia da foto" className="h-full object-contain rounded" />
              ) : (
                <><Camera className="h-4 w-4" /> Tirar ou escolher foto</>
              )}
            </label>
            <input
              id="foto" type="file" accept="image/*" capture="environment" className="sr-only"
              onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <label htmlFor="desc" className="text-xs text-muted-foreground">
              Descrição <span className="text-muted-foreground">(opcional se enviar foto)</span>
            </label>
            <textarea id="desc" rows={3} value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Arroz, feijão, frango grelhado e salada"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}
          {enviadoAgora && (
            <p className="text-xs text-primary flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Registrado. Pode enviar a próxima quando quiser.
            </p>
          )}

          <button
            type="button" disabled={!podeEnviar} onClick={() => enviar.mutate()}
            className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            {enviar.isPending
              ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              : 'Registrar refeição'}
          </button>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Últimos 7 dias</h2>
          {registros.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum registro ainda. O primeiro é o mais difícil.
            </p>
          ) : (
            <ul className="space-y-2">
              {registros.map((r: any) => (
                <li key={r.id} className="flex gap-3 rounded-lg border p-3">
                  {r.fotoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.fotoUrl} alt={`Foto do ${ROTULO_REFEICAO[r.refeicao] ?? 'registro'}`}
                         className="h-16 w-16 object-cover rounded shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{ROTULO_REFEICAO[r.refeicao] ?? r.refeicao}</p>
                    <p className="text-[11px] text-muted-foreground">{quando(r.tomadaEm)}</p>
                    {r.descricao && <p className="text-sm mt-0.5">{r.descricao}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-4 pb-6">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Suas fotos e descrições ficam guardadas em área privada e são vistas apenas pela
            profissional que acompanha você. Este link expira e pode ser desativado por ela a
            qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
}

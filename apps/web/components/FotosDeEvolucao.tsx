'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Camera, Trash2, Info, ImageOff } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ROTULO_ANGULO: Record<string, string> = {
  frente: 'De frente',
  perfil: 'De perfil',
  costas: 'De costas',
};

const dataBR = (iso: string) =>
  new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');

/**
 * Fotos de evolução corporal — lacuna 11.
 *
 * A tela compara duas datas do MESMO ângulo, lado a lado. Não calcula nada, não
 * estima percentual de gordura e não escreve laudo: mostra as duas imagens e
 * deixa a leitura com quem tem formação para fazê-la.
 *
 * Isso não é limitação de escopo — é a decisão da lacuna. Um número de
 * composição corporal saído de um modelo generalista pareceria medida, entraria
 * no prontuário ao lado da bioimpedância e viraria conduta, sem validação.
 */
export function FotosDeEvolucao({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [angulo, setAngulo] = useState('frente');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [esquerda, setEsquerda] = useState<string>('');
  const [direita, setDireita] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['fotos-evolucao', patientId],
    queryFn: () => api.progressPhotos.list(patientId),
  });

  const enviar = useMutation({
    mutationFn: async (arquivo: File) => {
      const r = await api.progressPhotos.criar({
        patientId, angulo, mimeFoto: arquivo.type,
      });
      if (r?.envio?.url) {
        const up = await fetch(r.envio.url, {
          method: 'PUT', headers: { 'Content-Type': arquivo.type }, body: arquivo,
        });
        if (!up.ok) throw new Error('O registro foi criado, mas a imagem não subiu.');
      }
      return r;
    },
    onSuccess: () => {
      setEnviando(false); setErro(null);
      qc.invalidateQueries({ queryKey: ['fotos-evolucao', patientId] });
    },
    onError: (e: any) => { setEnviando(false); setErro(e?.message ?? 'Não foi possível enviar.'); },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.progressPhotos.remover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fotos-evolucao', patientId] }),
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível apagar.'),
  });

  const grupos = (data as any) ?? [];
  const doAngulo = grupos.find((g: any) => g.angulo === angulo)?.fotos ?? [];
  const fotoEsq = doAngulo.find((f: any) => f.id === esquerda) ?? doAngulo[0];
  const fotoDir = doAngulo.find((f: any) => f.id === direita) ?? doAngulo[doAngulo.length - 1];
  const compara = doAngulo.length >= 2 && fotoEsq?.id !== fotoDir?.id;

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-muted-foreground" />
            Fotos de evolução
          </p>
          <div className="flex items-center gap-1.5">
            {Object.entries(ROTULO_ANGULO).map(([k, v]) => (
              <Button key={k} size="sm" variant={angulo === k ? 'default' : 'outline'}
                      onClick={() => { setAngulo(k); setEsquerda(''); setDireita(''); }}>
                {v}
              </Button>
            ))}
          </div>
        </div>

        {/* Diz o que a ferramenta faz e o que não faz. Sem isso alguém esperaria
            um número de composição corporal que ela não produz. */}
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 rounded-md bg-muted p-2.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          Comparação visual entre duas datas. O sistema <strong>não estima</strong> percentual
          de gordura nem composição corporal a partir da imagem — para isso, use bioimpedância
          ou adipometria e registre na avaliação física.
        </p>

        <div>
          <label htmlFor="foto-evo" className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input text-sm cursor-pointer hover:bg-muted">
            {enviando || enviar.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…</>
              : <><Camera className="h-3.5 w-3.5" /> Adicionar foto {ROTULO_ANGULO[angulo].toLowerCase()}</>}
          </label>
          <input id="foto-evo" type="file" accept="image/*" className="sr-only"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) { setEnviando(true); setErro(null); enviar.mutate(f); }
                 }} />
        </div>

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : doAngulo.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma foto {ROTULO_ANGULO[angulo].toLowerCase()} ainda.
          </p>
        ) : (
          <>
            {compara && (
              <div className="grid grid-cols-2 gap-3">
                {[fotoEsq, fotoDir].map((f: any, i: number) => (
                  <div key={f.id} className="space-y-1.5">
                    <select
                      value={i === 0 ? fotoEsq.id : fotoDir.id}
                      onChange={(e) => (i === 0 ? setEsquerda : setDireita)(e.target.value)}
                      aria-label={i === 0 ? 'Foto da esquerda' : 'Foto da direita'}
                      className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                    >
                      {doAngulo.map((o: any) => (
                        <option key={o.id} value={o.id}>{dataBR(o.tiradaEm)}</option>
                      ))}
                    </select>
                    {f.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.fotoUrl} alt={`${ROTULO_ANGULO[f.angulo]} em ${dataBR(f.tiradaEm)}`}
                           className="w-full rounded-md object-cover" />
                    ) : (
                      <div className="aspect-[3/4] rounded-md bg-muted flex items-center justify-center">
                        <ImageOff className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Todas — {ROTULO_ANGULO[angulo].toLowerCase()}
              </p>
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {doAngulo.map((f: any) => (
                  <li key={f.id} className="shrink-0 w-24 space-y-1">
                    {f.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.fotoUrl} alt={`${ROTULO_ANGULO[f.angulo]} em ${dataBR(f.tiradaEm)}`}
                           className="w-24 h-32 object-cover rounded" />
                    ) : (
                      <div className="w-24 h-32 rounded bg-muted flex items-center justify-center">
                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground text-center">
                      {dataBR(f.tiradaEm)}
                    </p>
                    <button
                      onClick={() => {
                        if (window.confirm('Apagar esta foto definitivamente? Não há como desfazer.')) {
                          remover.mutate(f.id);
                        }
                      }}
                      className="w-full inline-flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> apagar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <p className="text-[11px] text-muted-foreground border-t pt-3">
          As fotos ficam em área privada e são apagadas após 12 meses. Apagar aqui é
          definitivo — não há cópia guardada.
        </p>
      </CardContent>
    </Card>
  );
}

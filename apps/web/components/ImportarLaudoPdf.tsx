'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, FileUp, AlertTriangle, Check, X, Info } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Importação de laudo em PDF — lacuna 12.
 *
 * A tela existe para uma coisa: fazer a conferência acontecer de verdade.
 *
 * Um modelo que leia "TSH 4,5" como "45" põe um valor dez vezes maior no
 * prontuário, e não há nada no número 45 que denuncie o erro. Por isso cada
 * valor aparece ao lado do TRECHO LITERAL do laudo, e cada um começa
 * DESMARCADO: a profissional escolhe o que entra, item por item. Marcar tudo
 * por padrão transformaria a revisão em um clique de "aceitar".
 */

const ROTULOS: Record<string, string> = {
  hemoglobinGDl: 'Hemoglobina', hematocritPct: 'Hematócrito', mcvFl: 'VCM',
  mchcGDl: 'CHCM', leukocytesUl: 'Leucócitos', plateletsUl: 'Plaquetas',
  ferritinNgMl: 'Ferritina', serumIronUgDl: 'Ferro sérico', tibcUgDl: 'TIBC',
  transferrinSaturationPct: 'Saturação de transferrina',
  vitaminDNgMl: 'Vitamina D', vitaminB12PgMl: 'Vitamina B12', folicAcidNgMl: 'Ácido fólico',
  zincUgDl: 'Zinco', magnesiumMgDl: 'Magnésio', calciumMgDl: 'Cálcio',
  fastingGlucoseMgDl: 'Glicose de jejum', hba1cPct: 'Hemoglobina glicada',
  insulinUuiMl: 'Insulina', homaIr: 'HOMA-IR',
  totalCholesterolMgDl: 'Colesterol total', hdlMgDl: 'HDL', ldlMgDl: 'LDL',
  vldlMgDl: 'VLDL', triglyceridesMgDl: 'Triglicerídeos',
  creatinineMgDl: 'Creatinina', ureaMgDl: 'Ureia', uricAcidMgDl: 'Ácido úrico',
  egfrMlMin: 'Taxa de filtração glomerular',
  altUL: 'TGP (ALT)', astUL: 'TGO (AST)', ggtUL: 'Gama GT', albuminGDl: 'Albumina',
  tshUuiMl: 'TSH', freeT4NgDl: 'T4 livre', testosteroneNgDl: 'Testosterona',
  cortisolUgDl: 'Cortisol', crpMgL: 'PCR',
};

export function ImportarLaudoPdf({
  patientId, onImportado,
}: { patientId: string; onImportado?: (examId: string) => void }) {
  const [rascunho, setRascunho] = useState<any>(null);
  const [aceitos, setAceitos] = useState<Set<string>>(new Set());
  const [editados, setEditados] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  const extrair = useMutation({
    mutationFn: async (arquivo: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1]);
        fr.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        fr.readAsDataURL(arquivo);
      });
      return api.laboratory.extrairPdf(base64);
    },
    onSuccess: (r: any) => {
      setRascunho(r);
      // Nada vem marcado. A conferência é escolha ativa, não desmarcar erros.
      setAceitos(new Set());
      setEditados({});
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível ler o laudo.'),
  });

  const salvar = useMutation({
    mutationFn: () => {
      const dto: Record<string, unknown> = {
        patientId,
        collectionDate: rascunho?.collectionDate ?? new Date().toISOString().slice(0, 10),
        laboratoryName: rascunho?.laboratoryName ?? null,
      };
      for (const v of rascunho.valores) {
        if (!aceitos.has(v.campo)) continue;
        const bruto = editados[v.campo];
        dto[v.campo] = bruto !== undefined ? Number(bruto.replace(',', '.')) : v.valor;
      }
      return api.laboratory.create(dto);
    },
    onSuccess: (novo: any) => {
      setRascunho(null);
      if (novo?.id) onImportado?.(novo.id);
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível salvar o exame.'),
  });

  const alternar = (campo: string) => {
    setAceitos((prev) => {
      const n = new Set(prev);
      if (n.has(campo)) n.delete(campo); else n.add(campo);
      return n;
    });
  };

  if (!rascunho) {
    return (
      <Card>
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <FileUp className="h-4 w-4 text-muted-foreground" />
            Importar laudo em PDF
          </p>
          <p className="text-xs text-muted-foreground">
            Os valores são extraídos para conferência — nada é salvo antes de você revisar.
          </p>

          <label htmlFor="laudo" className="block">
            <span className="sr-only">Escolher PDF do laudo</span>
            <input
              id="laudo" type="file" accept="application/pdf" className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setErro(null); extrair.mutate(f); }
              }}
            />
            <span className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input text-sm cursor-pointer hover:bg-muted">
              {extrair.isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo o laudo…</>
                : <><FileUp className="h-3.5 w-3.5" /> Escolher PDF</>}
            </span>
          </label>

          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </CardContent>
      </Card>
    );
  }

  const suspeitos = rascunho.valores.filter((v: any) => v.suspeito).length;

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Confira antes de salvar</p>
            <p className="text-xs text-muted-foreground">
              {rascunho.valores.length} marcador(es) encontrado(s)
              {rascunho.collectionDate && ` · coleta em ${
                new Date(`${rascunho.collectionDate}T12:00:00`).toLocaleDateString('pt-BR')
              }`}
              {rascunho.laboratoryName && ` · ${rascunho.laboratoryName}`}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setRascunho(null)}>
            <X className="h-3.5 w-3.5 mr-1" /> Descartar
          </Button>
        </div>

        {/* Diz o que a marcação significa. Sem isso, alguém marcaria tudo por
            reflexo, achando que "aceitar" é só uma formalidade. */}
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 rounded-md bg-muted p-2.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          Marque só os valores que você conferiu contra o laudo. O texto cinza é a
          linha literal de onde o valor foi lido. Nada é salvo sem sua marcação.
        </p>

        {suspeitos > 0 && (
          <p className="text-xs text-destructive flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {suspeitos === 1
              ? '1 valor está fora da faixa possível — provável erro de leitura.'
              : `${suspeitos} valores estão fora da faixa possível — provável erro de leitura.`}
          </p>
        )}

        <ul className="space-y-1.5 max-h-96 overflow-y-auto">
          {rascunho.valores.map((v: any) => {
            const marcado = aceitos.has(v.campo);
            return (
              <li key={v.campo}
                  className={`rounded-md border p-2.5 ${v.suspeito ? 'border-destructive/50' : ''}`}>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox" checked={marcado} onChange={() => alternar(v.campo)}
                    aria-label={`Aceitar ${ROTULOS[v.campo] ?? v.campo}`}
                    className="mt-1 h-3.5 w-3.5 rounded border-input"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{ROTULOS[v.campo] ?? v.campo}</span>
                      <input
                        value={editados[v.campo] ?? String(v.valor).replace('.', ',')}
                        onChange={(e) => setEditados((p) => ({ ...p, [v.campo]: e.target.value }))}
                        className="w-24 h-7 px-2 rounded border border-input bg-background text-sm tabular-nums"
                      />
                      {v.unidadeNoLaudo && (
                        <span className="text-xs text-muted-foreground">{v.unidadeNoLaudo}</span>
                      )}
                    </div>
                    {v.trecho && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {v.trecho}
                      </p>
                    )}
                    {v.suspeito && (
                      <p className="text-[11px] text-destructive mt-0.5">{v.motivoSuspeita}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* O que a IA viu e não soube mapear. Se sumisse, a profissional acharia
            que o laudo não tinha mais nada. */}
        {rascunho.naoMapeados?.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-[11px] font-medium text-muted-foreground mb-1">
              Encontrados no laudo, mas sem campo no sistema — anote à mão se precisar:
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-0.5">
              {rascunho.naoMapeados.map((n: any, i: number) => (
                <li key={i}>{n.nome}: {n.valor}</li>
              ))}
            </ul>
          </div>
        )}

        {rascunho.avisos?.length > 0 && (
          <ul className="text-[11px] text-muted-foreground space-y-0.5 border-t pt-3">
            {rascunho.avisos.map((a: string, i: number) => <li key={i}>• {a}</li>)}
          </ul>
        )}

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        <div className="flex items-center gap-2 border-t pt-3">
          <Button size="sm" disabled={aceitos.size === 0 || salvar.isPending}
                  onClick={() => { setErro(null); salvar.mutate(); }}>
            {salvar.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Check className="h-3.5 w-3.5 mr-1" /> Salvar {aceitos.size} valor(es)</>}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {aceitos.size === 0
              ? 'Marque ao menos um valor conferido.'
              : `${aceitos.size} de ${rascunho.valores.length} marcados.`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

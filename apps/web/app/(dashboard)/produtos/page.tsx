'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import {
  Barcode, Search, Camera, X, Loader2, AlertCircle, AlertTriangle, ShieldAlert, BadgeCheck,
} from 'lucide-react';

type Product = Awaited<ReturnType<typeof api.products.byBarcode>>;

const NUTRI_COLOR: Record<string, string> = {
  A: 'bg-green-600', B: 'bg-lime-500', C: 'bg-yellow-500', D: 'bg-orange-500', E: 'bg-red-600',
};
const NUTRIENT_LABEL: Record<string, string> = {
  energia_kcal: 'Energia (kcal)', proteinas_g: 'Proteínas (g)', carboidratos_g: 'Carboidratos (g)',
  lipidios_g: 'Gorduras (g)', gordura_saturada_g: 'Gord. saturada (g)', acucares_g: 'Açúcares (g)',
  fibras_g: 'Fibras (g)', sodio_mg: 'Sódio (mg)',
};

function ScannerModal({ onDetected, onClose }: { onDetected: (ean: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) { setError('Seu navegador não suporta leitura de código de barras. Digite o código manualmente.'); return; }
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.length && codes[0].rawValue) { onDetected(String(codes[0].rawValue)); return; }
          } catch { /* frame sem código */ }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões ou digite o código manualmente.');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-label="Leitor de código de barras">
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden max-w-md w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-800">
          <span className="text-sm font-semibold flex items-center gap-2"><Camera className="h-4 w-4" /> Escanear código de barras</span>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4">
          {error ? (
            <p className="text-sm text-gray-500 text-center py-6">{error}</p>
          ) : (
            <>
              <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video object-cover" muted playsInline />
              <p className="text-xs text-gray-400 text-center mt-2">Aponte a câmera para o código de barras do produto.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProdutosPage() {
  const [ean, setEan] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const lookup = useCallback(async (code: string) => {
    const clean = code.replace(/\D/g, '');
    if (clean.length < 8) { setError('Código de barras inválido.'); return; }
    setLoading(true); setError(null); setProduct(null);
    try {
      const p = await api.products.byBarcode(clean);
      setProduct(p);
    } catch (err: any) {
      setError(err?.message ?? 'Produto não encontrado.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onDetected = useCallback((code: string) => {
    setScanning(false);
    setEan(code.replace(/\D/g, ''));
    lookup(code);
  }, [lookup]);

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Produtos Industrializados"
        description="Consulta por código de barras — dados do Open Food Facts"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Produtos' }]}
      />
      <div className="px-4 py-5 sm:p-6 max-w-3xl mx-auto w-full space-y-5 flex-1">

        <Alert className="border-blue-200 bg-blue-50">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs leading-relaxed">
            Dados colaborativos (confiabilidade média) — <strong>valide o rótulo físico</strong> antes de orientação clínica.
            Alertas seguem limiares da ANVISA (RDC 429/2020) como apoio, não como conduta.
          </AlertDescription>
        </Alert>

        {/* Busca */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                <Input
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') lookup(ean); }}
                  placeholder="Digite o código de barras (EAN)"
                  inputMode="numeric"
                  aria-label="Código de barras"
                  className="pl-8"
                />
              </div>
              <Button onClick={() => lookup(ean)} disabled={loading} className="flex items-center gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
              </Button>
              <Button variant="outline" onClick={() => setScanning(true)} className="flex items-center gap-1.5">
                <Camera className="h-4 w-4" /> Escanear
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Ficha do produto */}
        {product && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                {product.imagemRotuloUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imagemRotuloUrl} alt={product.nomeComercial ?? 'Produto'} className="w-16 h-16 object-contain rounded border bg-white flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{product.nomeComercial ?? 'Produto sem nome'}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">{product.marca ?? '—'} · EAN {product.codigoBarras}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {product.nutriScore && (
                      <span className={`text-white text-xs font-bold px-2 py-0.5 rounded ${NUTRI_COLOR[product.nutriScore] ?? 'bg-gray-400'}`}>
                        Nutri-Score {product.nutriScore}
                      </span>
                    )}
                    {product.novaClassificacao != null && (
                      <Badge variant="outline" className="text-xs">NOVA {product.novaClassificacao}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Alertas clínicos */}
              {product.alertaNutricional.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.alertaNutricional.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-1">
                      <AlertTriangle className="h-3 w-3" /> {a}
                    </span>
                  ))}
                </div>
              )}

              {/* Tabela nutricional por 100g */}
              {Object.keys(product.tabelaNutricional).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Tabela nutricional (por 100g)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(product.tabelaNutricional).map(([k, v]) => (
                      <div key={k} className="rounded-lg border bg-gray-50 dark:bg-gray-800 px-2 py-1.5">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{v}</p>
                        <p className="text-[10px] text-gray-500">{NUTRIENT_LABEL[k] ?? k}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {product.alergenos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Alérgenos</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{product.alergenos.join(', ')}</p>
                </div>
              )}

              {product.ingredientes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Ingredientes</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{product.ingredientes}</p>
                </div>
              )}

              {/* Proveniência (ODbL) */}
              <p className="text-[11px] text-gray-400 border-t pt-2 flex items-center gap-1.5">
                <BadgeCheck className="h-3 w-3" />
                Fonte: <strong>Open Food Facts</strong> ({product.licenca}) · Confiabilidade: {product.confiabilidade}
                {product.origem === 'openfoodfacts' && ' · recém-importado'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {scanning && <ScannerModal onDetected={onDetected} onClose={() => setScanning(false)} />}
    </div>
  );
}

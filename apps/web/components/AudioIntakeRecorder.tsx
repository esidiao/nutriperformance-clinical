'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

/** Gravações acima disso estouram o teto de 20 MB de áudio inline do Gemini. */
const MAX_DURATION_SEC = 15 * 60;

interface AudioIntakeRecorderProps {
  kind: 'nutritional' | 'physical';
  /** Recebe os campos extraídos para preencher o formulário. */
  onFieldsExtracted: (fields: Record<string, unknown>) => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AudioIntakeRecorder({ kind, onFieldsExtracted }: AudioIntakeRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{
    transcricao: string;
    observacoes: string;
    campos: Record<string, unknown>;
    tokensConsumed: number;
  } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Sem isto, sair da página no meio da consulta deixa o microfone aberto.
  useEffect(() => {
    return () => {
      stopTimer();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
      return;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      stopTimer();
      // O tipo vem como "audio/webm;codecs=opus"; a API valida só o mime base.
      const mimeType = (recorder.mimeType || 'audio/webm').split(';')[0];
      await processAudio(new Blob(chunksRef.current, { type: mimeType }), mimeType);
    };

    recorder.start();
    setIsRecording(true);
    setElapsed(0);
    setResult(null);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= MAX_DURATION_SEC) {
          toast.info('Limite de 15 minutos atingido — encerrando a gravação.');
          recorder.stop();
          setIsRecording(false);
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  const processAudio = async (blob: Blob, mimeType: string) => {
    setIsProcessing(true);
    const t = toast.loading('Transcrevendo a consulta...');
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Em blocos: String.fromCharCode(...bytes) estoura a pilha em áudios longos.
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
      }
      const audioBase64 = btoa(binary);

      const res = await api.assessments.audioIntake(kind, { audioBase64, mimeType });
      setResult(res);
      onFieldsExtracted(res.campos ?? {});

      const count = Object.keys(res.campos ?? {}).length;
      toast.success(
        count > 0
          ? `${count} campo(s) preenchido(s) a partir do áudio. Revise antes de salvar.`
          : 'Transcrição concluída, mas nenhum campo pôde ser extraído.',
        { id: t },
      );
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao transcrever o áudio.', { id: t });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" />
          Anamnese por Áudio
          <span className="ml-auto text-xs font-normal text-muted-foreground">15 tokens</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Grave a consulta e os campos da anamnese são preenchidos automaticamente. O áudio não é
          armazenado — só é usado para gerar a transcrição. Informe o paciente antes de gravar.
        </p>

        <div className="flex items-center gap-3">
          {!isRecording ? (
            <Button
              type="button"
              onClick={startRecording}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
              ) : (
                <><Mic className="h-4 w-4" /> Gravar consulta</>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={stopRecording}
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" /> Parar e processar
            </Button>
          )}

          {isRecording && (
            <div className="flex items-center gap-2" role="status" aria-live="polite">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-sm tabular-nums">{formatDuration(elapsed)}</span>
              <span className="text-xs text-muted-foreground">/ {formatDuration(MAX_DURATION_SEC)}</span>
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-3 pt-3 border-t">
            {result.observacoes && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  Pontos a confirmar
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">{result.observacoes}</p>
              </div>
            )}

            <details className="group">
              <summary className="flex items-center gap-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
                <FileText className="h-3.5 w-3.5" />
                Ver transcrição completa
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-muted text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {result.transcricao || 'Transcrição vazia.'}
              </pre>
            </details>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground italic">
                Revise os campos preenchidos — a transcrição é apoio, não substitui sua conferência.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setResult(null)}
                className="flex items-center gap-1.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" /> Limpar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

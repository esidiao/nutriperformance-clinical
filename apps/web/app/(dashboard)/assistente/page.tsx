'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import { Sparkles, Send, Loader2, ShieldAlert, BadgeCheck, Coins, User } from 'lucide-react';

interface Source { fonte: string; fonteRef: string | null; confiabilidade: string; score: number; }
interface Turn { role: 'user' | 'assistant'; text: string; sources?: Source[]; tokens?: number; }

const SUGGESTIONS = [
  'Quais alimentos são ricos em ferro?',
  'Compare arroz integral e batata-doce.',
  'Alimentos com baixo teor de sódio e boa proteína.',
  'Quais alimentos têm mais fibras?',
];

const CONF_BADGE: Record<string, string> = {
  alta: 'bg-green-100 text-green-700', media: 'bg-yellow-100 text-yellow-800', baixa: 'bg-orange-100 text-orange-700',
};

export default function AssistentePage() {
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, loading]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || loading) return;
    setTurns((t) => [...t, { role: 'user', text }]);
    setQ('');
    setLoading(true);
    try {
      const res = await api.assistant.ask(text);
      setTurns((t) => [...t, { role: 'assistant', text: res.answer, sources: res.sources, tokens: res.tokensConsumed }]);
    } catch (err: any) {
      setTurns((t) => [...t, { role: 'assistant', text: `Erro: ${err?.message ?? 'não foi possível responder.'}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Assistente Nutricional"
        description="Pergunte em linguagem natural — respostas com fonte"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Assistente' }]}
      />
      <div className="px-4 py-5 sm:p-6 max-w-3xl mx-auto w-full space-y-4 flex-1 flex flex-col">

        <Alert className="border-blue-200 bg-blue-50">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs leading-relaxed">
            Respostas baseadas <strong>somente</strong> nas bases do app (TACO etc.), sempre com a fonte. Não inventa dados;
            se não houver evidência, informa. Apoio à decisão — <strong>não substitui</strong> julgamento clínico. Cada consulta consome 5 tokens.
          </AlertDescription>
        </Alert>

        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)}
                className="text-xs px-3 py-1.5 rounded-full border bg-white dark:bg-gray-900 text-gray-600 hover:border-blue-400 transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Conversa */}
        <div className="flex-1 space-y-3">
          {turns.map((t, i) => (
            <div key={i} className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {t.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className={`max-w-[85%] ${t.role === 'user' ? 'order-1' : ''}`}>
                <Card className={t.role === 'user' ? 'bg-blue-600 border-blue-600' : ''}>
                  <CardContent className="py-2.5 px-3.5">
                    <p className={`text-sm whitespace-pre-wrap leading-relaxed ${t.role === 'user' ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{t.text}</p>
                    {t.sources && t.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-semibold text-gray-400 mb-1 flex items-center gap-1"><BadgeCheck className="h-3 w-3" /> Fontes</p>
                        <div className="flex flex-wrap gap-1">
                          {t.sources.map((s, j) => (
                            <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded-full ${CONF_BADGE[s.confiabilidade] ?? 'bg-gray-100 text-gray-500'}`}>
                              {s.fonte.toUpperCase()} · {Math.round(s.score * 100)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {t.tokens != null && t.tokens > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-0.5">{t.tokens} <Coins className="h-2.5 w-2.5" /></p>
                    )}
                  </CardContent>
                </Card>
              </div>
              {t.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 order-2">
                  <User className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
              <Card><CardContent className="py-2.5 px-3.5 flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Consultando as bases…</CardContent></Card>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-950 pt-2">
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask(q); }}
              placeholder="Ex.: Quais alimentos são ricos em ferro?"
              aria-label="Pergunta ao assistente"
              maxLength={500}
              disabled={loading}
            />
            <Button onClick={() => ask(q)} disabled={loading || q.trim().length < 3} className="flex items-center gap-1.5">
              <Send className="h-4 w-4" /> Perguntar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

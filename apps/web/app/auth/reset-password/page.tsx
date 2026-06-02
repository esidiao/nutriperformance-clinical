'use client';

import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // detectSessionInUrl (default: true) consumes the recovery token from the
  // URL and establishes a temporary session so updateUser() can set the password.
  return createBrowserClient(url, key);
}

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // null = still checking, true/false = whether a recovery session is present
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const supabaseOrNull = getSupabase();

  if (!supabaseOrNull) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <span className="text-white text-2xl font-bold">NP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">NutriPerformance Clinical</h1>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
            <p className="text-red-800 font-semibold text-sm mb-2">⚠️ Configuração pendente</p>
            <p className="text-red-700 text-xs leading-relaxed">
              As variáveis de ambiente do Supabase não estão configuradas neste ambiente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const supabase = supabaseOrNull;

  useEffect(() => {
    // The recovery link establishes a session via detectSessionInUrl. Supabase
    // also emits PASSWORD_RECOVERY when the token in the URL is processed.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true);
      }
    });

    // Fallback: check directly in case the event fired before we subscribed.
    supabase.auth.getSession().then(({ data }) => {
      setHasSession((prev) => (prev === null ? !!data.session : prev));
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      // Sign out the temporary recovery session so the user logs in fresh.
      await supabase.auth.signOut();
      setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    } catch (err: any) {
      if (err.message?.includes('session') || err.message?.includes('Auth session missing')) {
        setError('Link de recuperação inválido ou expirado. Solicite um novo email de recuperação.');
      } else if (err.message?.includes('should be different')) {
        setError('A nova senha deve ser diferente da anterior.');
      } else {
        setError(err.message ?? 'Erro ao redefinir a senha. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">NP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">NutriPerformance Clinical</h1>
          <p className="text-gray-500 text-sm mt-1">Definir nova senha</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Redefinir senha</CardTitle>
            <CardDescription className="text-xs">
              Escolha uma nova senha de acesso para sua conta.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {done ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 text-sm">
                  Senha redefinida com sucesso! Redirecionando para o login...
                </AlertDescription>
              </Alert>
            ) : hasSession === false ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Link de recuperação inválido ou expirado. Volte ao{' '}
                  <a href="/login?mode=forgot" className="underline font-medium">login</a>{' '}
                  e solicite um novo email de recuperação.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">Nova senha (mín. 6 caracteres)</Label>
                  <Input id="password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={6} autoComplete="new-password" />
                </div>
                <div>
                  <Label htmlFor="confirm">Confirmar nova senha</Label>
                  <Input id="confirm" type="password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••" required minLength={6} autoComplete="new-password" />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={isLoading || hasSession === null}>
                  {isLoading
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                    : hasSession === null
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validando link...</>
                      : 'Salvar nova senha'}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  <a href="/login" className="text-blue-600 hover:underline font-medium">← Voltar ao login</a>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <Alert className="border-blue-200 bg-blue-50">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs leading-relaxed">
            <strong>Plataforma segura.</strong> Dados protegidos por criptografia AES-256. Conforme LGPD (Lei 13.709/2018).
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

type Mode = 'login' | 'register' | 'forgot';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  // Derived: is the login form currently locked out?
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const lockSecondsLeft = isLocked ? Math.ceil((lockedUntil! - Date.now()) / 1000) : 0;

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
              Configure <code className="bg-red-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> e{' '}
              <code className="bg-red-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no painel do Vercel e faça um novo deploy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Safe to use — guarded above
  const supabase = supabaseOrNull;

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'register') setMode('register');
    else if (m === 'forgot') setMode('forgot');
  }, [searchParams]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setSuccess('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side brute-force guard: lock for 30 s after 5 failed attempts
    if (isLocked) {
      setError(`Muitas tentativas. Aguarde ${lockSecondsLeft} segundo(s) para tentar novamente.`);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setFailedAttempts(0);
      setLockedUntil(null);
      window.location.href = '/dashboard';
    } catch (err: any) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockedUntil(Date.now() + 30_000);
        setError('Muitas tentativas incorretas. Aguarde 30 segundos antes de tentar novamente.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError(`Email ou senha incorretos. Verifique seus dados. (${newAttempts}/5 tentativas)`);
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Confirme seu email antes de entrar. Verifique sua caixa de entrada.');
      } else {
        setError(err.message ?? 'Erro ao entrar. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString(),
            terms_version: '1.0',
            privacy_accepted: true,
            privacy_accepted_at: new Date().toISOString(),
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;

      // Se o usuário já foi confirmado automaticamente (sem email de confirmação)
      if (data.session) {
        window.location.href = '/dashboard';
        return;
      }

      setSuccess('Conta criada! Verifique seu email para confirmar o cadastro e depois faça login.');
      switchMode('login');
    } catch (err: any) {
      if (err.message?.includes('already registered') || err.message?.includes('User already registered')) {
        setError('Este email já está cadastrado. Faça login.');
      } else if (err.message?.includes('Password should be') || err.message?.includes('password')) {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError(err.message ?? 'Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setSuccess('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      setError(err.message ?? 'Erro ao enviar email.');
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
          <p className="text-gray-500 text-sm mt-1">Plataforma de apoio para profissionais de saúde</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {mode === 'login' && 'Entrar na plataforma'}
              {mode === 'register' && 'Criar conta profissional'}
              {mode === 'forgot' && 'Recuperar senha'}
            </CardTitle>
            <CardDescription className="text-xs">
              {mode === 'login' && 'Acesso exclusivo para profissionais habilitados (CFN / CONFEF)'}
              {mode === 'register' && 'Preencha seus dados para criar sua conta'}
              {mode === 'forgot' && 'Informe seu email para receber o link de recuperação'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <AlertDescription className="text-green-800 text-sm">{success}</AlertDescription>
              </Alert>
            )}

            {/* LOGIN */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email profissional</Label>
                  <Input id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com" required autoComplete="email" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="password">Senha</Label>
                    <button type="button" onClick={() => switchMode('forgot')}
                      className="text-xs text-blue-600 hover:underline">
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input id="password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" required autoComplete="current-password" />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={isLoading || isLocked}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Entrando...</> : isLocked ? `Aguarde ${lockSecondsLeft}s...` : 'Entrar'}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  Não tem conta?{' '}
                  <button type="button" onClick={() => switchMode('register')}
                    className="text-blue-600 hover:underline font-medium">
                    Criar conta
                  </button>
                </p>
              </form>
            )}

            {/* CADASTRO */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" type="text" value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. João Silva" required />
                </div>
                <div>
                  <Label htmlFor="email">Email profissional</Label>
                  <Input id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com" required autoComplete="email" />
                </div>
                <div>
                  <Label htmlFor="password">Senha (mín. 6 caracteres)</Label>
                  <Input id="password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={6} />
                </div>
                {/* Consentimento LGPD — obrigatório */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded flex-shrink-0"
                    required
                  />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    Li e aceito os{' '}
                    <a href="/legal/terms" target="_blank" className="text-blue-600 hover:underline font-medium">Termos de Uso</a>
                    {' '}e a{' '}
                    <a href="/legal/privacy" target="_blank" className="text-blue-600 hover:underline font-medium">Política de Privacidade</a>,
                    incluindo o tratamento de dados conforme a <strong>LGPD (Lei 13.709/2018)</strong>.
                    Sou profissional habilitado pelo <strong>CFN ou CONFEF</strong>.
                  </span>
                </label>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={isLoading || !termsAccepted}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando conta...</> : 'Criar conta'}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  Já tem conta?{' '}
                  <button type="button" onClick={() => switchMode('login')}
                    className="text-blue-600 hover:underline font-medium">
                    Entrar
                  </button>
                </p>
              </form>
            )}

            {/* RECUPERAR SENHA */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email da conta</Label>
                  <Input id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com" required autoComplete="email" />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : 'Enviar link de recuperação'}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  <button type="button" onClick={() => switchMode('login')}
                    className="text-blue-600 hover:underline font-medium">
                    ← Voltar ao login
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <Alert className="border-blue-200 bg-blue-50">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs leading-relaxed">
            <strong>Plataforma segura.</strong> Dados protegidos por criptografia AES-256.
            Conforme LGPD (Lei 13.709/2018).
          </AlertDescription>
        </Alert>

        <p className="text-center text-xs text-gray-400">
          Ferramenta de apoio profissional. Não substitui avaliação clínica.
          <br />CFN · CONFEF · LGPD
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { error } = await api.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      if (err.message?.includes('Invalid login credentials')) {
        setError('Email ou senha incorretos.');
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
      const { error } = await api.supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
      setSuccess('Conta criada! Verifique seu email para confirmar o cadastro.');
      setMode('login');
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        setError('Este email já está cadastrado. Faça login.');
      } else if (err.message?.includes('Password should be')) {
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
      const { error } = await api.supabase.auth.resetPasswordForEmail(email, {
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
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                      className="text-xs text-blue-600 hover:underline">
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input id="password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" required autoComplete="current-password" />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Entrando...</> : 'Entrar'}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  Não tem conta?{' '}
                  <button type="button" onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
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
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando conta...</> : 'Criar conta'}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  Já tem conta?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
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
                  <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
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

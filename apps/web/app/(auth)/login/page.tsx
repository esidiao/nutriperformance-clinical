'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      // Em produção: autenticar via Supabase Auth
      // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      await new Promise((r) => setTimeout(r, 1000));
      window.location.href = '/dashboard';
    } catch {
      setError('Credenciais inválidas. Verifique seu email e senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo e título */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">NP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">NutriPerformance Clinical</h1>
          <p className="text-gray-500 text-sm mt-1">Plataforma de apoio para profissionais de saúde</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Entrar na plataforma</CardTitle>
            <CardDescription className="text-xs">
              Acesso exclusivo para profissionais habilitados (CFN / CONFEF)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email profissional</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="password">Senha</Label>
                  <a href="/auth/forgot-password" className="text-xs text-blue-600 hover:underline">
                    Esqueci minha senha
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Entrando...</>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Não tem conta?{' '}
                <a href="/auth/register" className="text-blue-600 hover:underline font-medium">
                  Criar conta profissional
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Aviso de segurança */}
        <Alert className="border-blue-200 bg-blue-50">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs leading-relaxed">
            <strong>Plataforma segura.</strong> Dados protegidos por criptografia AES-256.
            Conforme LGPD (Lei 13.709/2018). Acesso exclusivo para profissionais habilitados.
          </AlertDescription>
        </Alert>

        <p className="text-center text-xs text-gray-400">
          Ferramenta de apoio profissional. Não substitui avaliação clínica.
          <br />
          CFN · CONFEF · LGPD
        </p>
      </div>
    </div>
  );
}

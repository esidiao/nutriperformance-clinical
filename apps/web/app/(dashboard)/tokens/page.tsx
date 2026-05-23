'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, TrendingUp, ArrowDownCircle, ArrowUpCircle, Zap } from 'lucide-react';

interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  priceBrl: number;
  isSubscription: boolean;
  billingPeriod?: string;
  features: string[];
  highlight?: boolean;
}

const packages: TokenPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    tokens: 200,
    priceBrl: 49.9,
    isSubscription: false,
    features: ['200 tokens únicos', 'Sem expiração em 90 dias', 'Suporte por email'],
  },
  {
    id: 'individual_pro',
    name: 'Profissional',
    tokens: 600,
    priceBrl: 129.9,
    isSubscription: true,
    billingPeriod: 'mensal',
    highlight: true,
    features: [
      '600 tokens/mês',
      'Tokens não utilizados acumulam (até 200)',
      'Relatórios ilimitados*',
      'Suporte prioritário',
      'Acesso à base científica atualizada',
    ],
  },
  {
    id: 'clinic',
    name: 'Clínica',
    tokens: 2000,
    priceBrl: 349.9,
    isSubscription: true,
    billingPeriod: 'mensal',
    features: [
      '2.000 tokens/mês',
      'Até 5 profissionais',
      'Painel administrativo',
      'Relatórios com logo da clínica',
      'Suporte premium',
      'API de integração',
    ],
  },
  {
    id: 'institutional',
    name: 'Institucional',
    tokens: 10000,
    priceBrl: 1199.9,
    isSubscription: true,
    billingPeriod: 'mensal',
    features: [
      '10.000 tokens/mês',
      'Usuários ilimitados',
      'Multi-workspace',
      'SLA garantido',
      'Onboarding dedicado',
      'Integrações customizadas',
    ],
  },
];

const tokenCosts = [
  { operation: 'Análise de Interações', tokens: 15 },
  { operation: 'Avaliação Nutricional (IA)', tokens: 10 },
  { operation: 'Análise de Biodisponibilidade', tokens: 12 },
  { operation: 'Análise de Suplementação', tokens: 8 },
  { operation: 'Avaliação Física (IA)', tokens: 5 },
  { operation: 'Geração de Relatório PDF', tokens: 5 },
  { operation: 'Análise de Exames Laboratoriais', tokens: 10 },
  { operation: 'Sugestão de Meta (IA)', tokens: 5 },
];

const mockTransactions = [
  { date: '22/05/2026', operation: 'Análise de interações', amount: -15, balance: 485, module: 'interactions' },
  { date: '21/05/2026', operation: 'Geração de relatório PDF', amount: -5, balance: 500, module: 'reports' },
  { date: '20/05/2026', operation: 'Recarga — Plano Profissional', amount: +600, balance: 505, module: 'billing' },
  { date: '18/05/2026', operation: 'Avaliação nutricional', amount: -10, balance: -95, module: 'nutritional' },
];

export default function TokensPage() {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const currentBalance = 485;
  const monthlyUsed = 115;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tokens e Assinatura</h1>
        <p className="text-gray-500 text-sm mt-1">
          Gerencie seu saldo de créditos e plano de assinatura.
        </p>
      </div>

      {/* Saldo atual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Coins className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-3xl font-bold text-blue-700">{currentBalance}</p>
                <p className="text-sm text-blue-600">Tokens disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-gray-500" />
              <div>
                <p className="text-2xl font-bold text-gray-800">{monthlyUsed}</p>
                <p className="text-sm text-gray-500">Usados este mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-green-600" />
              <div>
                <p className="text-lg font-bold text-gray-800">Profissional</p>
                <p className="text-sm text-gray-500">Plano atual · 600/mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de custos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custo por Operação</CardTitle>
          <CardDescription className="text-xs">
            Cada análise consome tokens do saldo do workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {tokenCosts.map((cost) => (
              <div key={cost.operation} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <span className="text-xs text-gray-700">{cost.operation}</span>
                <Badge variant="outline" className="ml-2 text-xs font-bold text-blue-700 border-blue-300">
                  {cost.tokens}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Planos */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Planos e Pacotes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`cursor-pointer transition-all ${
                pkg.highlight
                  ? 'border-blue-500 shadow-lg ring-2 ring-blue-200'
                  : 'hover:border-gray-300'
              } ${selectedPackage === pkg.id ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setSelectedPackage(pkg.id)}
            >
              {pkg.highlight && (
                <div className="bg-blue-600 text-white text-center text-xs py-1 rounded-t-lg font-semibold">
                  MAIS POPULAR
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{pkg.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">
                    R$ {pkg.priceBrl.toFixed(2).replace('.', ',')}
                  </span>
                  {pkg.billingPeriod && (
                    <span className="text-xs text-gray-500">/{pkg.billingPeriod}</span>
                  )}
                </div>
                <p className="text-sm text-blue-600 font-semibold">
                  {pkg.tokens.toLocaleString('pt-BR')} tokens
                  {pkg.isSubscription ? '/mês' : ''}
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {pkg.features.map((f) => (
                    <li key={f} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full mt-4 ${pkg.highlight ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  variant={pkg.highlight ? 'default' : 'outline'}
                  size="sm"
                >
                  {pkg.isSubscription ? 'Assinar' : 'Comprar'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          * Relatórios consomem 5 tokens cada. Pagamentos processados via Stripe ou Mercado Pago.
          Conforme LGPD, dados de pagamento não são armazenados em nossos servidores.
        </p>
      </div>

      {/* Histórico de transações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mockTransactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  {tx.amount > 0 ? (
                    <ArrowUpCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm text-gray-800">{tx.operation}</p>
                    <p className="text-xs text-gray-400">{tx.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      tx.amount > 0 ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount}
                  </p>
                  <p className="text-xs text-gray-400">Saldo: {tx.balance}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

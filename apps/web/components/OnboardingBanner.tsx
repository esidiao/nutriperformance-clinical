'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, Circle, X, ChevronRight, Sparkles } from 'lucide-react';

interface Step {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

const STORAGE_KEY = 'np_onboarding_dismissed';

export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(true); // start hidden, check storage
  const [mounted, setMounted] = useState(false);

  // Steps — in production, check real data from API
  const steps: Step[] = [
    {
      id: 'profile',
      label: 'Complete seu perfil',
      description: 'Adicione seu registro CFN/CONFEF e especialidade',
      href: '/settings',
      done: false,
    },
    {
      id: 'patient',
      label: 'Cadastre seu primeiro paciente',
      description: 'Inicie o acompanhamento clínico',
      href: '/patients/new',
      done: false,
    },
    {
      id: 'assessment',
      label: 'Realize uma avaliação',
      description: 'Nutricional ou física — com cálculos e apoio de IA',
      href: '/assessments/nutritional/new',
      done: false,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  useEffect(() => {
    setMounted(true);
    const d = localStorage.getItem(STORAGE_KEY);
    if (!d && !allDone) setDismissed(false);
  }, [allDone]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  if (!mounted || dismissed || allDone) return null;

  return (
    <div className="mx-6 mt-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white overflow-hidden shadow-lg">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Bem-vindo ao NutriPerformance Clinical!</h3>
              <p className="text-xs text-blue-100 mt-0.5">
                Complete os primeiros passos para começar a usar a plataforma
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dispensar banner de boas-vindas"
            className="text-white/60 hover:text-white transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-white/80 flex-shrink-0">
              {completedCount}/{steps.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            {steps.map((step, i) => (
              <Link key={step.id} href={step.href}>
                <div className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer
                  ${step.done
                    ? 'bg-white/10 opacity-60'
                    : 'bg-white/15 hover:bg-white/25'
                  }
                `}>
                  {step.done
                    ? <CheckCircle className="h-4 w-4 text-green-300 flex-shrink-0" />
                    : <div className="w-4 h-4 rounded-full border-2 border-white/50 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold">{i + 1}</span>
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight">{step.label}</p>
                    <p className="text-[10px] text-blue-100 leading-tight mt-0.5 truncate">
                      {step.description}
                    </p>
                  </div>
                  {!step.done && <ChevronRight className="h-3 w-3 text-white/50 flex-shrink-0" />}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

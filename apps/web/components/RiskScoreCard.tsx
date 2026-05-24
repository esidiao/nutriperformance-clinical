'use client';

import { useMemo } from 'react';
import { calculateRiskScore, getRiskBarColor, type RiskInput } from '@/lib/risk-score';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';

interface RiskScoreCardProps {
  input: RiskInput;
  compact?: boolean;
  showDetails?: boolean;
}

export function RiskScoreCard({ input, compact = false, showDetails = true }: RiskScoreCardProps) {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo(() => calculateRiskScore(input), [input]);

  const barColor = getRiskBarColor(result.score);

  if (compact) {
    return (
      <div className={`rounded-xl border p-3 ${result.bgColor}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className={`h-4 w-4 ${result.color}`} />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Score Cardiometabólico</span>
          </div>
          <span className={`text-lg font-bold ${result.color}`}>{result.score}</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${result.score}%` }} />
        </div>
        <p className={`text-xs font-medium mt-1 ${result.color}`}>{result.label}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 p-5 space-y-4 ${result.bgColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className={`h-5 w-5 ${result.color}`} />
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Score de Risco Cardiometabólico</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Calculado com base em dados clínicos e de composição corporal</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-4xl font-black ${result.color}`}>{result.score}</p>
          <p className="text-xs text-gray-400">/ 100</p>
        </div>
      </div>

      {/* Bar */}
      <div className="space-y-1">
        <div className="h-3 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${result.score}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>0 — Mínimo</span>
          <span className={`font-semibold ${result.color}`}>{result.label}</span>
          <span>100 — Máximo</span>
        </div>
      </div>

      {/* Risk level legend */}
      <div className="flex gap-1.5 flex-wrap">
        {(['low','moderate','high','very_high'] as const).map((lvl) => {
          const cfg = {
            low: { label:'Baixo', color:'bg-green-500' },
            moderate: { label:'Moderado', color:'bg-yellow-500' },
            high: { label:'Alto', color:'bg-orange-500' },
            very_high: { label:'Muito alto', color:'bg-red-600' },
          }[lvl];
          return (
            <span key={lvl} className={`flex items-center gap-1 text-[10px] font-medium ${lvl === result.level ? 'opacity-100' : 'opacity-40'}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
              {cfg.label}
            </span>
          );
        })}
      </div>

      {showDetails && (
        <>
          {/* Recommendations */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Recomendações</p>
            {result.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                <TrendingDown className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                {r}
              </div>
            ))}
          </div>

          {/* Collapsible contributors */}
          {result.contributors.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {expanded ? 'Ocultar' : 'Ver'} fatores contribuintes ({result.contributors.length})
              </button>

              {expanded && (
                <div className="mt-2 space-y-1.5">
                  {result.contributors.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{c.factor}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.min(100, c.points * 5)}%` }} />
                        </div>
                        <span className="text-gray-500 w-8 text-right">+{c.points}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-gray-400 italic border-t dark:border-gray-700 pt-2">
            Score de apoio clínico · Não substitui avaliação médica individualizada · Requer validação do profissional responsável
          </p>
        </>
      )}
    </div>
  );
}

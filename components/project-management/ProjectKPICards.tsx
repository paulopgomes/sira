'use client';

import React from 'react';
import { Target, CheckCircle2, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectMetrics } from '@/hooks/useProjectMetrics';

interface ProjectKPICardsProps {
  metrics: ProjectMetrics;
}

export function ProjectKPICards({ metrics }: ProjectKPICardsProps) {
  const getExecutionColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-[#ed1c24]';
  };

  const getExecutionBg = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-50 border-green-100';
    if (percentage >= 60) return 'bg-yellow-50 border-yellow-100';
    return 'bg-[#ed1c24]/5 border-[#ed1c24]/20';
  };

  const cards = [
    {
      label: 'Meta de Atendimentos',
      value: metrics.totalTarget,
      subValue: `Esperado: ${metrics.expectedUntilToday}`,
      icon: Target,
      color: 'text-[#5e3f3b]',
      bg: 'bg-[#f4f3f5]'
    },
    {
      label: 'Realizados',
      value: metrics.totalRealized,
      subValue: metrics.totalRealized >= metrics.expectedUntilToday ? 'Dentro da meta' : 'Abaixo do esperado',
      icon: CheckCircle2,
      color: metrics.totalRealized >= metrics.expectedUntilToday ? 'text-green-600' : 'text-[#ed1c24]',
      bg: metrics.totalRealized >= metrics.expectedUntilToday ? 'bg-green-50' : 'bg-[#ed1c24]/5'
    },
    {
      label: 'Execução',
      value: `${metrics.executionPercentage.toFixed(1)}%`,
      subValue: 'Do total previsto',
      icon: BarChart3,
      color: getExecutionColor(metrics.executionPercentage),
      bg: getExecutionBg(metrics.executionPercentage)
    },
    {
      label: 'Média Mensal',
      value: metrics.monthlyAverage.toFixed(1),
      subValue: 'Atendimentos/mês',
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-100'
    },
    {
      label: 'Dias Restantes',
      value: metrics.daysRemaining,
      subValue: 'Para o término',
      icon: Clock,
      color: metrics.daysRemaining <= 30 ? 'text-[#ed1c24]' : 'text-[#5e3f3b]',
      bg: metrics.daysRemaining <= 30 ? 'bg-[#ed1c24]/5 border-[#ed1c24]/20' : 'bg-[#f4f3f5]'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
      {cards.map((card, index) => (
        <div 
          key={index}
          className={cn(
            "p-6 rounded-[2rem] border border-transparent shadow-sm transition-all hover:shadow-md",
            card.bg
          )}
        >
          <div className="flex justify-between items-start mb-4">
            <div className={cn("p-2.5 rounded-xl bg-white/80", card.color)}>
              <card.icon size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">
              {card.label}
            </p>
            <p className={cn("text-2xl font-black tracking-tight", card.color)}>
              {card.value}
            </p>
            <p className="text-[10px] font-bold text-[#5e3f3b] opacity-40">
              {card.subValue}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

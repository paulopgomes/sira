'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectMetrics } from '@/hooks/useProjectMetrics';

interface ProjectAlertsProps {
  metrics: ProjectMetrics;
}

export function ProjectAlerts({ metrics }: ProjectAlertsProps) {
  const alerts = [];

  // 1. Meta não atingida
  if (metrics.totalRealized < metrics.expectedUntilToday) {
    alerts.push({
      type: 'critical',
      title: 'Meta não atingida',
      message: `O projeto está com ${metrics.expectedUntilToday - metrics.totalRealized} atendimentos abaixo do esperado para a data de hoje.`,
      icon: XCircle
    });
  }

  // 2. Prazo próximo do fim
  if (metrics.daysRemaining > 0 && metrics.daysRemaining <= 30) {
    let type: 'warning' | 'critical' = 'warning';
    if (metrics.daysRemaining <= 7) type = 'critical';

    alerts.push({
      type,
      title: 'Prazo próximo do fim',
      message: `Faltam apenas ${metrics.daysRemaining} dias para o encerramento do projeto.`,
      icon: AlertTriangle
    });
  }

  // 3. Projeto expirado
  if (metrics.daysRemaining === 0 && metrics.status === 'Encerrado') {
    alerts.push({
      type: 'critical',
      title: 'Projeto expirado',
      message: 'A vigência deste projeto chegou ao fim. Verifique a necessidade de prorrogação.',
      icon: XCircle
    });
  }

  // 4. Baixa produtividade (Exemplo: menos de 50% da meta esperada)
  if (metrics.expectedUntilToday > 0 && (metrics.totalRealized / metrics.expectedUntilToday) < 0.5) {
    alerts.push({
      type: 'critical',
      title: 'Baixa produtividade detectada',
      message: 'A execução está abaixo de 50% do esperado. Recomenda-se revisão estratégica.',
      icon: AlertCircle
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <div 
          key={index}
          className={cn(
            "flex items-start gap-4 p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300",
            alert.type === 'critical' 
              ? "bg-[#ed1c24]/5 border-[#ed1c24]/10 text-[#ed1c24]" 
              : "bg-yellow-50 border-yellow-100 text-yellow-800"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl shrink-0",
            alert.type === 'critical' ? "bg-[#ed1c24]/10 text-[#ed1c24]" : "bg-yellow-100 text-yellow-600"
          )}>
            <alert.icon size={20} />
          </div>
          <div className="flex-1 pt-1">
            <h3 className="text-sm font-black uppercase tracking-tight">{alert.title}</h3>
            <p className="text-xs font-medium opacity-80 mt-0.5">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

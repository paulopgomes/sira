'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck,
  FileText,
  TrendingUp,
  FileBarChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ViewType } from './Sidebar';

interface BottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  permission?: string;
}

const navItems = [
  { id: 'atendimentos' as ViewType, icon: LayoutDashboard, label: 'REG. MENSAL' },
  { id: 'lancamento' as ViewType, icon: CalendarCheck, label: 'REG. DIÁRIO' },
  { id: 'relatorio' as ViewType, icon: FileText, label: 'RELATÓRIO' },
  { id: 'relatorios_personalizados' as ViewType, icon: FileBarChart, label: 'ANÁLISE' },
];

export function BottomNav({ currentView, onViewChange, permission = '' }: BottomNavProps) {
  const isProfessional = permission === 'Profissional';
  const filteredItems = isProfessional 
    ? navItems.filter(item => item.id !== 'relatorios_personalizados')
    : navItems;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e8bcb7]/20 px-1 py-1 flex justify-around items-center z-[50] pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className="flex w-full max-w-lg mx-auto justify-around items-center">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 min-w-0 px-1 py-2 rounded-xl transition-all active:scale-90",
              currentView === item.id 
                ? "text-[#ed1c24]" 
                : "text-[#5e3f3b] opacity-60"
            )}
          >
            <item.icon size={18} className={cn("shrink-0", currentView === item.id ? "stroke-[2.5px]" : "stroke-2")} />
            <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-tighter truncate w-full text-center">
              {item.label}
            </span>
            <div className={cn(
              "w-1 h-1 rounded-full mt-0.5 transition-all opacity-0",
              currentView === item.id && "bg-[#ed1c24] opacity-100"
            )} />
          </button>
        ))}
      </div>
    </nav>
  );
}

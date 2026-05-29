'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  FolderKanban, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  CalendarCheck,
  FileText,
  FileBarChart
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';

export type ViewType = 'atendimentos' | 'lancamento' | 'usuarios' | 'projetos' | 'configuracoes' | 'relatorio' | 'avaliacoes' | 'relatorios_personalizados';
export type SubViewType = 'profissionais' | 'projetos' | 'modalidades' | 'usuarios_sistema' | 'unidades' | 'historico_atividades';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  permission?: string;
  hasUnitPermission?: boolean;
}

const navGroups = [
  {
    label: 'Produção',
    items: [
      { id: 'lancamento' as ViewType, icon: CalendarCheck, label: 'Registro Diário' },
      { id: 'atendimentos' as ViewType, icon: LayoutDashboard, label: 'Registro Mensal' },
      { id: 'avaliacoes' as ViewType, icon: TrendingUp, label: 'Evoluções' },
      { id: 'relatorio' as ViewType, icon: FileText, label: 'Relatório Mensal' },
    ]
  },
  {
    label: 'Relatórios',
    items: [
      { id: 'relatorios_personalizados' as ViewType, icon: FileBarChart, label: 'Relatórios Personalizados' },
    ]
  },
  {
    label: 'Gestão',
    items: [
      { id: 'usuarios' as ViewType, icon: Users, label: 'Usuários' },
      { id: 'projetos' as ViewType, icon: FolderKanban, label: 'Gestão de Projetos' },
    ]
  },
  {
    label: 'Configurações',
    items: [
      { id: 'configuracoes' as ViewType, icon: Settings, label: 'Configurações' },
    ]
  }
];

export function Sidebar({ 
  currentView, 
  onViewChange, 
  isCollapsed, 
  onToggleCollapse,
  isMobileOpen = false,
  onMobileClose,
  permission = '',
  hasUnitPermission = false
}: SidebarProps) {
  const isAdmin = permission === 'Administrador';
  const isProfessional = permission === 'Profissional';
  const isUnitAdmin = permission === 'Administrador por Unidade';

  // Filter groups and items based on role and permissions
  const filteredNavGroups = navGroups.map(group => {
    // If professional, limit production items and conditional users item
    if (isProfessional) {
      if (group.label === 'Produção') {
        return group; // All items in Produção are allowed
      }
      if (group.label === 'Gestão') {
        const filteredItems = group.items.filter(item => item.id === 'usuarios');
        return filteredItems.length > 0 ? { ...group, items: filteredItems } : null;
      }
      return null; // Hide other groups for professionals
    }
    
    // If Admin by Unit, allow ONLY Produção, Relatórios, Gestão (exclude Configurações)
    if (isUnitAdmin) {
      if (group.label === 'Produção' || group.label === 'Relatórios' || group.label === 'Gestão') {
        return group;
      }
      return null;
    }
    
    return group; // Admins see everything
  }).filter(Boolean) as typeof navGroups;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] lg:hidden"
        />
      )}

      <aside 
        onClick={() => isCollapsed && onToggleCollapse()}
        onDoubleClick={() => !isCollapsed && onToggleCollapse()}
        className={cn(
          "fixed left-0 top-0 h-screen bg-[#f4f3f5] border-r-0 z-[60] flex flex-col py-6 transition-all duration-300 ease-in-out cursor-pointer no-print",
          isCollapsed ? "w-20" : "w-72",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className={cn("px-6 mb-8 flex items-center justify-center", isCollapsed && "px-2")}>
          <Logo 
            size={isCollapsed ? 32 : 44} 
            showText={!isCollapsed} 
            className={cn(isCollapsed && "mx-auto")}
          />
        </div>

        <nav className={cn("flex-1 px-3 overflow-y-auto scrollbar-hide pb-10", isCollapsed ? "space-y-1" : "space-y-6")}>
          {filteredNavGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!isCollapsed && (
                <div className="px-4 py-2 flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40">
                    {group.label}
                  </span>
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewChange(item.id);
                      onMobileClose?.();
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
                      currentView === item.id 
                        ? "bg-white text-[#ed1c24] shadow-sm border-r-4 border-[#ed1c24]" 
                        : "text-[#5e3f3b] hover:bg-[#e9e8ea] hover:text-[#1a1c1d]",
                      isCollapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon size={18} className={cn(currentView === item.id ? "text-[#ed1c24]" : "text-[#5e3f3b] group-hover:text-[#1a1c1d]")} />
                    {!isCollapsed && (
                      <span className="text-sm font-semibold whitespace-nowrap">{item.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 mt-auto space-y-2">
          {/* Mobile Close Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onMobileClose?.();
            }}
            className="lg:hidden w-full flex items-center justify-center p-3 rounded-xl text-[#5e3f3b] hover:bg-[#e9e8ea] hover:text-[#1a1c1d] transition-all"
          >
            <ChevronLeft size={20} />
            <span className="ml-2 text-xs font-bold uppercase tracking-widest">Fechar Menu</span>
          </button>

          {/* Desktop Collapse Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="hidden lg:flex w-full items-center justify-center p-3 rounded-xl text-[#5e3f3b] hover:bg-[#e9e8ea] hover:text-[#1a1c1d] transition-all"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!isCollapsed && <span className="ml-2 text-xs font-bold uppercase tracking-widest">Recolher</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

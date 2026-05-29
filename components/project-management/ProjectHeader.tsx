'use client';

import React from 'react';
import { Calendar, User, Edit2, History, AlertTriangle } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Project } from '@/hooks/useProjectData';

interface ProjectHeaderProps {
  project: Project;
  status: 'Ativo' | 'Próximo do vencimento' | 'Encerrado';
  isAdmin?: boolean;
  onEdit: () => void;
  onExtend: () => void;
}

export function ProjectHeader({ project, status, isAdmin = true, onEdit, onExtend }: ProjectHeaderProps) {
  const statusColors = {
    'Ativo': 'bg-green-50 text-green-600 border-green-100',
    'Próximo do vencimento': 'bg-yellow-50 text-yellow-600 border-yellow-100',
    'Encerrado': 'bg-[#ed1c24]/5 text-[#ed1c24] border-[#ed1c24]/20'
  };

  const statusDots = {
    'Ativo': 'bg-green-500',
    'Próximo do vencimento': 'bg-yellow-500',
    'Encerrado': 'bg-[#ed1c24]'
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-[#e8bcb7]/10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-[#1a1c1d] tracking-tight">
              {project.name}
            </h1>
            <div className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
              statusColors[status]
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full", statusDots[status], status === 'Ativo' && "animate-pulse")} />
              {status}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 text-[#5e3f3b]">
              <Calendar size={18} className="opacity-40" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">Vigência</span>
                <span className="text-sm font-bold">
                  {formatDate(project.start_date)} — {formatDate(project.end_date)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[#5e3f3b]">
              <User size={18} className="opacity-40" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">Coordenador</span>
                <span className="text-sm font-bold">{project.coordinator || 'Não definido'}</span>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <button
              onClick={onEdit}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#f4f3f5] text-[#1a1c1d] font-bold rounded-xl text-sm hover:bg-[#e9e8ea] transition-all active:scale-95"
            >
              <Edit2 size={18} />
              Editar Projeto
            </button>
            <button
              onClick={onExtend}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#ed1c24] text-white font-bold rounded-xl text-sm shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920] transition-all active:scale-95"
            >
              <History size={18} />
              Prorrogar Prazo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

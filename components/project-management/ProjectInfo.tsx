'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info, Users, Briefcase, FileText, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project } from '@/hooks/useProjectData';

interface ProjectInfoProps {
  project: Project;
  professionals: any[];
  modalities: any[];
}

export function ProjectInfo({ project, professionals, modalities }: ProjectInfoProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-[#e8bcb7]/10 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 sm:p-8 hover:bg-[#faf9fb] transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f4f3f5] flex items-center justify-center text-[#5e3f3b]">
            <Info size={20} />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black text-[#1a1c1d] tracking-tight">Informações do Projeto</h2>
            <p className="text-[10px] font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest">Equipe e observações</p>
          </div>
        </div>
        {isOpen ? <ChevronUp size={24} className="text-[#5e3f3b] opacity-40" /> : <ChevronDown size={24} className="text-[#5e3f3b] opacity-40" />}
      </button>

      {isOpen && (
        <div className="p-6 sm:p-8 pt-0 border-t border-[#f4f3f5] space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#5e3f3b] opacity-60">
                <Building2 size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Unidade Responsável</span>
              </div>
              <div className="px-3 py-1.5 bg-[#ed1c24]/5 rounded-lg text-[11px] font-bold text-[#ed1c24] border border-[#ed1c24]/10 w-fit">
                {project.units?.name || 'Não vinculada'}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#5e3f3b] opacity-60">
                <Users size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Profissionais Vinculados</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {professionals.map((prof) => (
                  <div key={prof.id} className="px-3 py-1.5 bg-[#f4f3f5] rounded-lg text-[11px] font-bold text-[#1a1c1d] border border-[#e8bcb7]/10">
                    {prof.name}
                  </div>
                ))}
                {professionals.length === 0 && <span className="text-xs text-[#5e3f3b] opacity-40">Nenhum profissional vinculado.</span>}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#5e3f3b] opacity-60">
                <Briefcase size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Modalidades Ativas</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {modalities.map((mod) => (
                  <div key={mod.id} className="px-3 py-1.5 bg-white rounded-lg text-[11px] font-bold text-[#ed1c24] border border-[#ed1c24]/20">
                    {mod.name}
                  </div>
                ))}
                {modalities.length === 0 && <span className="text-xs text-[#5e3f3b] opacity-40">Nenhuma modalidade ativa.</span>}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#f4f3f5]">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#5e3f3b] opacity-60">
                <Info size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Observações Adicionais</span>
              </div>
              <p className="text-sm text-[#5e3f3b] leading-relaxed italic bg-[#faf9fb] p-4 rounded-2xl border border-[#e8bcb7]/5">
                {project.observations || 'Nenhuma observação adicional registrada para este projeto.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

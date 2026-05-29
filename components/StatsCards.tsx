'use client';

import React, { useState } from 'react';
import { Users, CheckCircle2, BarChart3, CalendarDays, Edit2 } from 'lucide-react';
import { QuickEditMeta } from './QuickEditMeta';

interface AttendanceData {
  id: string | number;
  name: string;
  status: 'Ativo' | 'Inativo';
  attendance: number[];
}

interface StatsCardsProps {
  data: AttendanceData[];
  currentUser?: any;
  filters?: {
    project: string;
    professional: string;
    modality: string;
    month: string;
    year: string;
  };
}

export function StatsCards({ data, currentUser, filters }: StatsCardsProps) {
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const isAdmin = currentUser?.permission === 'Administrador';
  const totalPatients = data.length;
  const totalAttendances = data.reduce((acc, curr) => acc + curr.attendance.length, 0);
  
  // Calculate unique days with at least one attendance
  const uniqueDays = new Set<number>();
  data.forEach(item => {
    item.attendance.forEach(day => uniqueDays.add(day));
  });
  const daysWithAttendance = uniqueDays.size;
  
  const avgAttendancePerUser = totalPatients > 0 ? (totalAttendances / totalPatients).toFixed(1) : '0';

  const stats = [
    {
      label: 'Total de Usuários',
      value: totalPatients.toString(),
      icon: Users,
      color: 'bg-[#d0e4ff]',
      iconColor: 'text-[#004a7a]',
    },
    {
      label: 'Atendimentos Realizados',
      value: totalAttendances.toLocaleString('pt-BR'),
      icon: CheckCircle2,
      color: 'bg-[#ed1c24]/10',
      iconColor: 'text-[#ed1c24]',
    },
    {
      label: 'Dias com Atendimento',
      value: daysWithAttendance.toString(),
      icon: CalendarDays,
      color: 'bg-[#f4f3f5]',
      iconColor: 'text-[#5e3f3b]',
    },
    {
      label: 'Média por Usuário',
      value: avgAttendancePerUser,
      icon: BarChart3,
      color: 'bg-[#ed1c24]/10',
      iconColor: 'text-[#ed1c24]',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col justify-between h-32 sm:h-40 border border-[#e8bcb7]/5 group relative"
        >
          <div className="flex justify-between items-start">
            <div className={`p-2.5 rounded-xl ${stat.color}`}>
              <stat.icon size={20} style={{ color: typeof stat.iconColor === 'string' && stat.iconColor.startsWith('#') ? stat.iconColor : undefined }} className={!stat.iconColor.startsWith('#') ? stat.iconColor : ''} />
            </div>

            {/* Restricted Edit Action for Admins on the 2nd Card (Atendimentos Realizados) - REMOVED PER USER REQUEST */}
          </div>
          <div className="mt-2 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] mb-1 opacity-60">
              {stat.label}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-[#1a1c1d] leading-none">{stat.value}</p>
          </div>
        </div>
      ))}

      {/* Admin meta editor modal */}
      {isAdmin && filters && (
        <QuickEditMeta 
          isOpen={isMetaModalOpen}
          onClose={() => setIsMetaModalOpen(false)}
          currentUser={currentUser}
          project={filters.project}
          professional={filters.professional}
          modality={filters.modality}
        />
      )}
    </div>
  );
}

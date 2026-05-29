'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

interface AttendanceData {
  id: string | number;
  name: string;
  record_number: string;
  status: 'Ativo' | 'Inativo';
  attendance: number[];
}

interface AttendanceTableProps {
  data: AttendanceData[];
  onToggle: (id: string | number, day: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  month?: string;
  year?: string;
  showAttendanceDays?: boolean;
}

export function AttendanceTable({ 
  data, 
  onToggle, 
  disabled = false, 
  readOnly = false,
  month, 
  year, 
  showAttendanceDays = false 
}: AttendanceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Inativo'>('Todos');
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  const isInteractionDisabled = disabled || readOnly;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      setZoom(1.4);
    } else {
      setZoom(1);
    }
    setIsFullScreen(!isFullScreen);
  };

  const getDaysInMonth = (m: string, y: string) => {
    if (!m || !y) return 31;
    const monthInt = parseInt(m);
    const yearInt = parseInt(y);
    if (isNaN(monthInt) || isNaN(yearInt)) return 31;
    // monthInt is 1-12, so new Date(y, m, 0) gives last day of month m
    const date = new Date(yearInt, monthInt, 0);
    return isNaN(date.getTime()) ? 31 : date.getDate();
  };

  const isWeekend = (day: number, m: string, y: string) => {
    if (!m || !y) return false;
    const monthInt = parseInt(m);
    const yearInt = parseInt(y);
    if (isNaN(monthInt) || isNaN(yearInt)) return false;
    const date = new Date(yearInt, monthInt - 1, day);
    if (isNaN(date.getTime())) return false;
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 is Sunday, 6 is Saturday
  };

  // On the server or before mount, we use a fixed number of days to avoid mismatch
  // if the month/year are not yet set.
  const daysInMonth = isMounted ? getDaysInMonth(month || '', year || '') : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getFirstDayOfMonth = (m: string, y: string) => {
    if (!m || !y) return 0;
    const monthInt = parseInt(m);
    const yearInt = parseInt(y);
    if (isNaN(monthInt) || isNaN(yearInt)) return 0;
    return new Date(yearInt, monthInt - 1, 1).getDay();
  };

  const firstDay = isMounted ? getFirstDayOfMonth(month || '', year || '') : 0;
  const emptySlots = Array.from({ length: firstDay }, (_, i) => i);
  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const getDayTotal = (day: number) => {
    return data.filter(p => p.attendance.includes(day)).length;
  };

  const filteredData = data.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
    <div className={cn(
      "bg-white rounded-[2rem] shadow-sm overflow-hidden border border-[#e8bcb7]/10 relative print:bg-transparent print:rounded-none print:shadow-none print:border-none transition-all duration-300",
      isFullScreen ? "fixed inset-0 z-[100] rounded-none border-none m-0 max-h-screen overflow-hidden flex flex-col" : "relative"
    )}>
      {disabled && (
        <div className="absolute inset-0 z-30 bg-white/60 backdrop-blur-[2px] flex items-center justify-center no-print">
          <div className="bg-[#1a1c1d] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
            <div className="w-2 h-2 rounded-full bg-[#ed1c24] animate-pulse"></div>
            <p className="text-xs font-bold uppercase tracking-widest">Selecione todos os filtros para registrar presenças</p>
          </div>
        </div>
      )}
      <div className="p-6 border-b border-[#f4f3f5] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-[#1a1c1d]">Registro de Presença em Atendimento</h3>
          
          <div className="hidden md:flex items-center gap-1 bg-[#f4f3f5] p-1 rounded-xl border border-[#e8bcb7]/10">
            <button 
              onClick={handleZoomOut}
              className="p-1.5 text-[#5e3f3b] hover:bg-white hover:text-[#ed1c24] rounded-lg transition-all shadow-sm hover:shadow-md"
              title="Diminuir Zoom"
            >
              <ZoomOut size={14} />
            </button>
            <div className="px-2 min-w-[45px] text-center">
              <span className="text-[10px] font-black text-[#5e3f3b]">{Math.round(zoom * 100)}%</span>
            </div>
            <button 
              onClick={handleZoomIn}
              className="p-1.5 text-[#5e3f3b] hover:bg-white hover:text-[#ed1c24] rounded-lg transition-all shadow-sm hover:shadow-md"
              title="Aumentar Zoom"
            >
              <ZoomIn size={14} />
            </button>
            <div className="w-px h-4 bg-[#e8bcb7]/20 mx-1"></div>
            <button 
              onClick={handleResetZoom}
              className="p-1.5 text-[#5e3f3b] hover:bg-white hover:text-[#ed1c24] rounded-lg transition-all shadow-sm hover:shadow-md"
              title="Resetar Zoom"
            >
              <RotateCcw size={14} />
            </button>
            <div className="w-px h-4 bg-[#e8bcb7]/20 mx-1"></div>
            <button 
              onClick={toggleFullScreen}
              className="p-1.5 text-[#ed1c24] hover:bg-[#ed1c24] hover:text-white rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-1 bg-white border border-[#ed1c24]/20"
              title={isFullScreen ? "Sair da Tela Cheia" : "Tela Cheia"}
            >
              {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="text-[10px] font-bold uppercase hidden sm:inline">{isFullScreen ? "Sair" : "Expandir"}</span>
            </button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto no-print">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-40" size={16} />
            <input 
              type="text" 
              placeholder="Filtrar usuário..."
              className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-[#ed1c24] outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            className="w-full sm:w-32 bg-[#f4f3f5] border-0 rounded-xl py-2 px-4 text-xs focus:ring-2 focus:ring-[#ed1c24] outline-none cursor-pointer appearance-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="Todos">Todos</option>
            <option value="Ativo">Ativos</option>
            <option value="Inativo">Inativos</option>
          </select>
        </div>
      </div>
      
      <div className={cn(
        "overflow-x-auto scrollbar-thin scrollbar-thumb-[#e3e2e4] scrollbar-track-transparent hidden md:block",
        isFullScreen ? "flex-1 overflow-y-auto" : "max-h-[70vh] overflow-y-auto"
      )}>
        <div 
          style={{ 
            zoom: isMounted ? zoom : 1,
            width: '100%'
          }}
          className="transition-all duration-200"
        >
          <table className="w-full border-collapse min-w-full border-b border-[#f3f2f4]">
          <thead className={cn("sticky top-0 z-30 shadow-sm")}>
            <tr className="bg-[#f3f2f4] print:bg-white">
              <th className={cn(
                "sticky left-0 z-40 bg-[#f3f2f4] px-1 py-1.5 text-center text-[7px] font-bold uppercase tracking-tighter text-[#5e3f3b] border-r border-b border-[#f3f2f4] w-10 whitespace-nowrap shadow-[1px_0_3px_rgba(0,0,0,0.02)] print:shadow-none print:bg-white top-0"
              )}>
                PRONT.
              </th>
              <th className={cn(
                "sticky left-10 z-40 bg-[#f3f2f4] px-2 py-1.5 text-left text-[8px] font-bold uppercase tracking-tight text-[#5e3f3b] border-r border-b border-[#f3f2f4] w-[180px] shadow-[1px_0_3px_rgba(0,0,0,0.02)] print:shadow-none print:bg-white top-0"
              )}>
                USUÁRIO
              </th>
              {days.map(day => {
                const weekend = isWeekend(day, month || '', year || '');
                return (
                  <th 
                    key={day} 
                    className={cn(
                      "px-0 py-1.5 text-center text-[7px] font-bold text-[#5e3f3b] border-r border-b border-[#f3f2f4] min-w-[20px] sticky top-0",
                      weekend ? "bg-[#ed1c24]/5" : "bg-[#f3f2f4]"
                    )}
                  >
                    {day}
                  </th>
                );
              })}
              <th className={cn(
                "px-1 py-1.5 text-center text-[7px] font-bold uppercase tracking-tighter text-[#5e3f3b] border-b border-[#f3f2f4] w-10 sticky top-0 bg-[#f3f2f4] z-30"
              )}>
                SOMA:
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3f2f4]">
            {filteredData.map(patient => (
              <tr key={patient.id} className="hover:bg-[#f3f2f4]/30 transition-colors group">
                <td className="sticky left-0 z-20 bg-white group-hover:bg-[#f3f2f4]/30 px-1 py-1 text-[8px] font-bold text-[#1a1c1d] text-center border-r border-b border-[#f3f2f4] w-10 shadow-[1px_0_3px_rgba(0,0,0,0.02)] print:shadow-none">
                  {patient.record_number.padStart(3, '0')}
                </td>
                <td className="sticky left-10 z-20 bg-white group-hover:bg-[#f3f2f4]/30 px-2 py-1 text-[9px] font-semibold text-[#1a1c1d] truncate border-r border-b border-[#f3f2f4] shadow-[1px_0_3px_rgba(0,0,0,0.02)] print:shadow-none">
                  {patient.name}
                </td>
                {days.map(day => {
                  const weekend = isWeekend(day, month || '', year || '');
                  const isChecked = patient.attendance.includes(day);
                  
                  return (
                    <td 
                      key={day} 
                      className={cn(
                        "px-0 py-0.5 text-center border-r border-b border-[#f3f2f4]",
                        weekend ? "bg-[#ed1c24]/5 print:bg-transparent" : "bg-white group-hover:bg-[#f3f2f4]/30 print:bg-transparent"
                      )}
                    >
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => onToggle(patient.id, day)}
                          disabled={isInteractionDisabled}
                          className={cn(
                            "attendance-mark w-3 h-3 rounded-sm transition-all flex items-center justify-center",
                            isChecked 
                              ? "bg-[#ed1c24] text-white shadow-sm" 
                              : "border border-[#f3f2f4] bg-white hover:border-[#ed1c24]",
                            isInteractionDisabled && !isChecked && "opacity-50",
                            isInteractionDisabled && "cursor-not-allowed"
                          )}
                        >
                          {isChecked && (
                            <span className="text-[7px] font-black leading-none">1</span>
                          )}
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-center text-[9px] font-bold text-[#1a1c1d] border-b border-[#f3f2f4]">
                  {patient.attendance.length}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#f8f7f9] font-bold print:bg-transparent">
              <td colSpan={2} className="sticky left-0 z-20 bg-[#f8f7f9] px-2 py-1.5 text-[7px] font-black uppercase tracking-tight text-[#1a1c1d] border-r border-b border-[#f3f2f4] print:hidden">
                TOTAL:
              </td>
              <td colSpan={2} className="bg-[#f8f7f9] px-2 py-1.5 text-[7px] font-black uppercase tracking-tight text-[#1a1c1d] border-r border-b border-[#f3f2f4] hidden print:table-cell print:bg-transparent">
                TOTAL:
              </td>
              {days.map(day => (
                <td 
                  key={day} 
                  className={cn(
                    "px-0 py-2 text-center text-[9px] print:text-[6px] print:p-0 print:leading-none print:whitespace-nowrap font-black text-[#ed1c24] border-r border-b border-[#f3f2f4]",
                    isWeekend(day, month || '', year || '') && "bg-[#ed1c24]/5 print:bg-transparent"
                  )}
                  style={{ wordBreak: 'keep-all', overflowWrap: 'normal', whiteSpace: 'nowrap' }}
                >
                  {getDayTotal(day)}
                </td>
              ))}
              <td className="px-1 py-1.5 text-center text-[10px] sm:text-[11px] font-black text-[#ed1c24] bg-[#ffeded]/30 border-l border-b border-[#ed1c24]/10 grand-total-cell">
                {data.reduce((acc, curr) => acc + curr.attendance.length, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    {/* Mobile Card View */}
    <div className="md:hidden divide-y divide-[#f4f3f5] print:hidden">
      {filteredData.map(patient => (
        <div key={patient.id} className="p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#f4f3f5] flex items-center justify-center text-[10px] font-black text-[#5e3f3b]">
                {patient.record_number.padStart(3, '0')}
              </div>
              <div>
                <p className="text-sm font-bold text-[#1a1c1d]">{patient.name}</p>
                <p className="text-[10px] font-bold text-[#ed1c24] uppercase tracking-widest opacity-70">Total: {patient.attendance.length} atendimentos</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((wd, i) => (
              <div key={`wd-${i}`} className="text-[8px] font-black text-[#5e3f3b] opacity-40 text-center pb-1">
                {wd}
              </div>
            ))}
            
            {emptySlots.map(i => (
              <div key={`empty-${i}`} className="w-7 h-7 min-h-[32px] min-w-[32px]" />
            ))}

            {days.map(day => {
              const isChecked = patient.attendance.includes(day);
              const weekend = isWeekend(day, month || '', year || '');
              
              return (
                <button
                  key={day}
                  onClick={() => onToggle(patient.id, day)}
                  disabled={isInteractionDisabled}
                  className={cn(
                    "w-7 h-7 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center border min-h-[32px] min-w-[32px]",
                    isChecked 
                      ? "bg-[#ed1c24] border-[#ed1c24] text-white shadow-sm" 
                      : weekend 
                        ? "bg-[#ed1c24]/5 border-[#ed1c24]/10 text-[#5e3f3b]"
                        : "bg-white border-[#f4f3f5] text-[#5e3f3b] hover:border-[#ed1c24]",
                    isInteractionDisabled && !isChecked && "opacity-50",
                    isInteractionDisabled && "cursor-not-allowed"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {filteredData.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-xs font-bold text-[#5e3f3b] opacity-40">Nenhum usuário encontrado.</p>
        </div>
      )}
    </div>
    </div>
    </>
  );
}

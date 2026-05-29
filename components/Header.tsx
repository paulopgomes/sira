'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Printer, UserCircle, LogOut, User, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  showPrintButton?: boolean;
  isPrintDisabled?: boolean;
  user: {
    name: string;
    role: string;
  };
  onMenuClick?: () => void;
  onLogout?: () => void;
}

export function Header({ 
  showPrintButton = false, 
  isPrintDisabled = false,
  user, 
  onMenuClick, 
  onLogout 
}: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#faf9fb]/85 backdrop-blur-xl px-4 lg:px-8 py-3 sm:py-4 flex justify-between items-center no-print">
      <div className="flex items-center gap-2 sm:gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2.5 text-[#5e3f3b] hover:bg-[#e9e8ea] rounded-xl transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Menu size={24} />
        </button>
        <div className="flex flex-col lg:hidden">
          <h2 className="text-base font-black text-[#1a1c1d] leading-tight">SIRA</h2>
          <p className="text-[8px] font-bold text-[#ed1c24] uppercase tracking-widest leading-tight">Sistema de Registro</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        {showPrintButton && (
          <button 
            onClick={() => !isPrintDisabled && window.print()}
            disabled={isPrintDisabled}
            className={cn(
              "bg-[#ed1c24] hover:bg-[#d11920] text-white px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(237,28,36,0.2)] active:scale-95 min-h-[44px]",
              isPrintDisabled && "opacity-50 cursor-not-allowed grayscale"
            )}
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Imprimir Relatório</span>
          </button>
        )}
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={cn(
              "p-2.5 text-[#5e3f3b] hover:bg-[#e9e8ea] rounded-full transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center",
              isDropdownOpen && "bg-[#e9e8ea] text-[#ed1c24]"
            )}
          >
            <UserCircle size={24} />
          </button>

          {isDropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#e8bcb7]/10 overflow-hidden py-2"
            >
              <div className="px-4 py-3 border-b border-[#f4f3f5] mb-1">
                <p className="text-sm font-bold text-[#1a1c1d] truncate">{user.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#ed1c24] mt-0.5">
                  {user.role}
                </p>
              </div>
              
              <button 
                onClick={() => {
                  setIsDropdownOpen(false);
                  onLogout?.();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-[#ed1c24] hover:bg-[#ed1c24]/5 transition-all"
              >
                <LogOut size={18} />
                Sair do Sistema
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro na aplicação:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-[#ed1c24]/5 rounded-full flex items-center justify-center mb-8 border border-[#ed1c24]/10">
        <AlertCircle size={40} className="text-[#ed1c24]" />
      </div>
      <h1 className="text-3xl font-black text-[#1a1c1d] mb-4 tracking-tighter">Ops! Algo deu errado.</h1>
      <p className="text-[#5e3f3b] opacity-60 mb-8 max-w-md">
        Ocorreu um erro inesperado ao carregar esta página. Por favor, tente novamente.
      </p>
      <button 
        onClick={() => reset()}
        className="bg-[#ed1c24] text-white font-black py-4 px-8 rounded-2xl text-sm shadow-[0_12px_24px_rgba(237,28,36,0.25)] hover:bg-[#d11920] transition-all active:scale-95 flex items-center gap-2"
      >
        <RefreshCw size={18} />
        Tentar Novamente
      </button>
    </div>
  );
}

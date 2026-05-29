import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-black text-[#ed1c24] mb-4 tracking-tighter">404</h1>
      <h2 className="text-2xl font-bold text-[#1a1c1d] mb-6">Página não encontrada</h2>
      <p className="text-[#5e3f3b] opacity-60 mb-8 max-w-md">
        Desculpe, a página que você está procurando não existe ou foi movida.
      </p>
      <Link 
        href="/"
        className="bg-[#ed1c24] text-white font-black py-4 px-8 rounded-2xl text-sm shadow-[0_12px_24px_rgba(237,28,36,0.25)] hover:bg-[#d11920] transition-all active:scale-95"
      >
        Voltar para o Início
      </Link>
    </div>
  );
}

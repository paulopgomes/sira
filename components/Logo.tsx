'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function Logo({ className, size = 40, showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <Image
          src="/logo.svg"
          alt="SIRA Logo"
          fill
          className="object-contain"
          priority
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-[#ed1c24] tracking-tighter leading-none">SIRA</h1>
          <p className="text-[7px] font-bold uppercase tracking-tight text-[#5e3f3b] opacity-70 leading-tight max-w-[120px]">
            Sistema Integrado de Registro de Atendimentos
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { motion } from 'motion/react';
import { Logo } from './Logo';

interface LoadingScreenProps {
  userName?: string;
}

export function LoadingScreen({ userName }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 w-full h-full bg-[#faf9fb] flex flex-col items-center justify-center z-[100] p-6 overflow-hidden">
      {/* Background Accents like Login Page */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ed1c24]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ed1c24]/5 rounded-full blur-3xl" />

      <div className="relative flex flex-col items-center max-w-xs w-full gap-10">
        {/* Logo and Text matching Login Page */}
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Logo size={64} showText={false} className="mb-3" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-black text-[#ed1c24] tracking-tighter"
          >
            SIRA
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.3 }}
            className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#5e3f3b] opacity-60 mt-1"
          >
            Iniciando sessão
          </motion.p>
          
          {userName && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-base font-semibold text-[#5e3f3b] text-center mt-4 tracking-tight"
            >
              Seja bem-vindo, <span className="font-extrabold text-[#ed1c24]">{userName}</span>!
            </motion.p>
          )}
        </div>

        {/* Minimalist Loader */}
        <div className="w-48 h-[3px] bg-[#ed1c24]/10 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="h-full bg-[#ed1c24]"
          />
        </div>
      </div>

      {/* Subtle brand mark at edge */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ delay: 1 }}
        className="absolute bottom-10 text-[9px] font-medium uppercase tracking-[0.1em] text-[#5e3f3b]"
      >
        © 2026 Paulo Gomes
      </motion.div>
    </div>
  );
}

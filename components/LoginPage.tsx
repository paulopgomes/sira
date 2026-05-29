'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, User, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from './Logo';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { ActivityLogger } from '@/lib/activity_logger';

interface LoginPageProps {
  onLogin: (user: { id: string; username: string; email?: string; permission: string; session_version?: number }) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();

      // Simple login check against the table
      const { data, error: loginError } = await supabase
        .from('system_users')
        .select('*')
        .eq('username', trimmedUsername)
        .eq('password', trimmedPassword)
        .single();

      if (loginError || !data) {
        console.error('Login error details:', loginError);
        setError('Usuário inexistente ou senha incorreta.');
        setIsLoading(false);
        ActivityLogger.logLogin(trimmedUsername, null, 'Falha', 'Usuário ou senha incorreta.');
        return;
      }

      if (data.status === 'Inativo') {
        setError('Este usuário está desativado. Entre em contato com o administrador.');
        setIsLoading(false);
        ActivityLogger.logLogin(trimmedUsername, data.id, 'Falha', 'Tentativa de login com usuário desativado (Inativo).');
        return;
      }

      let actualPermission = data.permission;
      if (data.email && data.email.endsWith('@adminunidade.sistema.com')) {
        actualPermission = 'Administrador por Unidade';
      }

      onLogin({ 
        id: data.id,
        username: data.username, 
        email: data.email,
        permission: actualPermission,
        session_version: data.session_version || 1
      });
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-[#faf9fb] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ed1c24]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ed1c24]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[340px] xs:max-w-sm my-auto flex flex-col items-center">
        {/* Animated Card Container */}
        <div className="w-full relative">
          {/* Injecting CSS Keyframes for the Energetic Fluid Fire Border & Deep Glowing Radiance */}
          <style>{`
            @keyframes fire-border-spin {
              0% { transform: translate(-50%, -50%) rotate(0deg); }
              100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
            @keyframes fire-glow-pulse-a {
              0%, 100% {
                opacity: 0.55;
                filter: blur(28px);
                transform: scale(0.97) translate(2px, -2px);
              }
              50% {
                opacity: 0.85;
                filter: blur(40px);
                transform: scale(1.05) translate(-2px, 2px);
              }
            }
            @keyframes fire-glow-pulse-b {
              0%, 100% {
                opacity: 0.45;
                filter: blur(36px);
                transform: scale(1.04) translate(-3px, 3px);
              }
              50% {
                opacity: 0.75;
                filter: blur(48px);
                transform: scale(0.95) translate(3px, -3px);
              }
            }
          `}</style>

          {/* Liquid Gold & Fire Radiance Glow - Irradiates sophisticatedly beyond the card */}
          <div className="absolute -inset-8 -z-20 pointer-events-none overflow-visible">
            {/* Base Warm Heatmap Glow */}
            <div 
              className="absolute inset-0 rounded-[3rem] mix-blend-screen opacity-70"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(237,28,36,0.55) 0%, rgba(94,63,59,0.15) 55%, transparent 75%)',
                animation: 'fire-glow-pulse-a 6s ease-in-out infinite'
              }}
            />
            {/* Secondary Higher Frequency Energized Amber Flare */}
            <div 
              className="absolute inset-0 rounded-[3rem] mix-blend-screen opacity-55"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(255,82,82,0.4) 0%, rgba(237,28,36,0.05) 45%, transparent 70%)',
                animation: 'fire-glow-pulse-b 8.5s ease-in-out infinite'
              }}
            />
          </div>

          {/* Animated fluid fire border, positioned exactly behind the card so we don't get any inside gray lines */}
          <div className="absolute -inset-[3px] rounded-[2.65rem] overflow-hidden pointer-events-none z-0">
            {/* Primary chasing fluid fire stream */}
            <div 
              className="absolute top-1/2 left-1/2 w-[300%] h-[300%] origin-center opacity-95"
              style={{
                background: 'conic-gradient(from 0deg, transparent 80%, rgba(237,28,36,0.2) 88%, #ed1c24 94%, #ff7a45 98%, transparent 100%)',
                animation: 'fire-border-spin 4s linear infinite',
                willChange: 'transform'
              }}
            />
          </div>

          {/* Clean Rounded High-Contrast White Login Card Body */}
          <div className="bg-white rounded-[2.5rem] overflow-hidden relative z-10 shadow-[0_20px_50px_rgba(237,28,36,0.12)] border border-[#e8bcb7]/15">
            <div className="p-6 xs:p-8 md:p-10">
              <div className="flex flex-col items-center mb-6 md:mb-10">
                <Logo size={56} showText={false} className="mb-3" />
                <h1 className="text-3xl md:text-4xl font-black text-[#ed1c24] tracking-tighter">SIRA</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#5e3f3b] opacity-60 mt-1">
                  Acesso ao Sistema
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4 md:space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Usuário do Sistema</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-40" size={18} />
                    <input 
                      required
                      type="text" 
                      placeholder="Seu usuário"
                      className="w-full bg-[#f4f3f5] border-0 rounded-2xl py-3.5 pl-12 pr-6 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none transition-all"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-40" size={18} />
                    <input 
                      required
                      type="password" 
                      placeholder="Sua senha"
                      className="w-full bg-[#f4f3f5] border-0 rounded-2xl py-3.5 pl-12 pr-6 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-[#ed1c24] bg-[#ed1c24]/5 p-4 rounded-xl border border-[#ed1c24]/10">
                    <AlertCircle size={16} />
                    <p className="text-xs font-bold">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-xl border border-green-100">
                    <ShieldCheck size={16} />
                    <p className="text-xs font-bold">{success}</p>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#ed1c24] text-white font-black py-4 rounded-2xl text-sm shadow-[0_10px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920] transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Entrar no Sistema'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Copyright cleanly placed under the card, completely outside the rotating animation border scope */}
        <div 
          className="mt-6 md:mt-8 text-center text-[9px] font-medium uppercase tracking-[0.1em] text-[#5e3f3b] opacity-30 relative z-20"
        >
          © 2026 Paulo Gomes
        </div>
      </div>
      <PWAInstallPrompt />
    </div>
  );
}

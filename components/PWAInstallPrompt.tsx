'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PWAInstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Check if it's mobile (Android/iOS)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    // 2. Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // 3. Check if user already dismissed it
    const isDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (isDismissed) return;

    // 4. Register Service Worker if exists
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('SW registration failed:', err);
      });
    }

    // 5. Listen for beforeinstallprompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS check (iOS doesn't support beforeinstallprompt)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !isStandalone && !isDismissed) {
      setIsVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // For iOS, we check user agent again to show instructions or just handle the click
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert('Para instalar no iOS: Toque no ícone Compartilhar e selecione "Adicionar à Tela de Início".');
        handleDismiss();
        return;
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install');
      localStorage.setItem('pwa-prompt-dismissed', 'true');
    }
    
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 no-print">
      {/* Backdrop with Soft Blur */}
      <div 
        className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-sm animate-in fade-in duration-500"
        onClick={handleDismiss}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl border border-[#e8bcb7]/10 p-8 pt-10 text-center animate-in fade-in zoom-in-95 duration-500">
        
        {/* Close Button */}
        <button 
          onClick={handleDismiss}
          className="absolute top-6 right-6 p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
        >
          <X size={20} />
        </button>

        {/* Brand Icon Container */}
        <div className="relative mb-8">
          <div className="w-24 h-24 bg-[#ed1c24]/5 rounded-[2.2rem] flex items-center justify-center mx-auto shadow-inner transform -rotate-3">
            <Smartphone className="text-[#ed1c24]" size={48} strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center border border-[#e8bcb7]/10 animate-bounce cursor-default">
            <Download size={18} className="text-[#ed1c24]" />
          </div>
        </div>
        
        {/* Content Section */}
        <div className="space-y-4 mb-10">
          <div className="space-y-1">
            <h4 className="text-2xl font-black text-[#1a1c1d] tracking-tight leading-tight">SIRA no seu Celular</h4>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#ed1c24] opacity-80">App Performance</p>
          </div>
          <p className="text-sm text-[#5e3f3b] opacity-70 leading-relaxed font-medium">
            Transforme o SIRA em um aplicativo e acesse instantaneamente sem precisar usar o navegador.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button 
            onClick={handleInstall}
            className="w-full bg-[#ed1c24] text-white font-black py-4 rounded-2xl text-sm shadow-[0_12px_24px_rgba(237,28,36,0.25)] hover:bg-[#d11920] transition-all active:scale-[0.97] flex items-center justify-center gap-3 group"
          >
            Instalar Aplicativo
            <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
          </button>
          <button 
            onClick={handleDismiss}
            className="w-full text-[#5e3f3b] font-bold py-3 text-xs opacity-60 hover:opacity-100 hover:bg-[#f4f3f5] rounded-xl transition-all"
          >
            Talvez outro momento
          </button>
        </div>
        
        {/* Decorative Element */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1.5 bg-gradient-to-r from-transparent via-[#ed1c24]/10 to-transparent rounded-b-full" />
      </div>
    </div>
  );
}

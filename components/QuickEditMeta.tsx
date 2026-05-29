'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  X, 
  Save, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Lock,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface QuickEditMetaProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  project: string;
  professional: string;
  modality: string;
}

export function QuickEditMeta({ isOpen, onClose, currentUser, project, professional, modality }: QuickEditMetaProps) {
  const isAdmin = currentUser?.permission === 'Administrador';
  const [metaValue, setMetaValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && isAdmin && project && modality) {
      fetchCurrentMeta();
    }
  }, [isOpen, project, modality]);

  const fetchCurrentMeta = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Logic: Find project_id and modality_id then fetch meta from professional_projects or projects
      // For simplicity, we assume there's a goal field in projects or similar. 
      // In this specific implementation, we'll try to find or create a 'project_metas' entry
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('id')
        .eq('name', project)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      if (data) {
        // Here we'd fetch the actual meta from a joint table or project field
        // For this demo, let's assume it's in the projects table or we use a metadata approach
        const { data: projData } = await supabase
          .from('projects')
          .select('observations') // Using observations to store target for now as an example of "editing data"
          .eq('id', data.id)
          .single();
          
        const match = projData?.observations?.match(/MetaAtendimento:(\d+)/);
        if (match) {
          setMetaValue(parseInt(match[1]));
        } else {
          setMetaValue(0);
        }
      }
    } catch (err) {
      console.error('Error fetching meta:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      setError('Acesso negado: Apenas administradores podem editar metas.');
      // Log unauthorized attempt in console
      console.warn(`Tentativa de acesso não autorizado por: ${currentUser?.username}. Operação: Editar Meta.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const { data: proj } = await supabase
        .from('projects')
        .select('id, observations')
        .eq('name', project)
        .single();

      if (proj) {
        let newObs = proj.observations || '';
        if (newObs.includes('MetaAtendimento:')) {
          newObs = newObs.replace(/MetaAtendimento:\d+/, `MetaAtendimento:${metaValue}`);
        } else {
          newObs += `\nMetaAtendimento:${metaValue}`;
        }

        const { error: saveError } = await supabase
          .from('projects')
          .update({ observations: newObs })
          .eq('id', proj.id);

        if (saveError) throw saveError;

        // Log SUCCESSFUL audit trail if needed
        console.log(`Meta do projeto "${project}" atualizada para ${metaValue} por ${currentUser?.username}`);

        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Error saving meta:', err);
      setError(err.message || 'Erro ao salvar meta.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        {!isAdmin ? (
          <div className="p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 text-[#ed1c24] rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Lock size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-[#1a1c1d] tracking-tight">Acesso Restrito</h2>
              <p className="text-sm text-[#5e3f3b] font-medium opacity-60">
                A funcionalidade de edição de metas é exclusiva para o perfil **Administrador**.
              </p>
            </div>
            <button 
              onClick={onClose}
              className="w-full bg-[#1a1c1d] text-white font-bold py-4 rounded-2xl hover:bg-[#2a2c2d] transition-all"
            >
              Entendido
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="p-6 sm:p-8 border-b border-[#e8bcb7]/10 bg-[#faf9fb]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24]">
                    <Plus size={24} />
                  </div>
                  <h2 className="text-xl font-black text-[#1a1c1d] tracking-tight">Editar Meta</h2>
                </div>
                <button onClick={onClose} className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90">
                  <X size={20} />
                </button>
              </div>
              <p className="text-[10px] font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest">
                Meta Mensal para: {project || 'Projeto não selecionado'}
              </p>
            </div>

            <div className="p-8 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-600 text-xs font-bold">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="py-10 flex flex-col items-center justify-center gap-4">
                  <Loader2 size={32} className="text-[#ed1c24] animate-spin" />
                  <p className="text-xs font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest">Carregando dados...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Valor da Meta Mensal</label>
                    <div className="relative">
                      <History className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-20" size={20} />
                      <input 
                        type="number" 
                        min="0"
                        className="w-full bg-[#f4f3f5] border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 text-lg font-black focus:border-[#ed1c24]/20 focus:bg-white outline-none transition-all"
                        value={metaValue}
                        onChange={(e) => setMetaValue(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <p className="text-[9px] text-[#5e3f3b] opacity-40 font-medium ml-1">Defina o número alvo de atendimentos para este projeto.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={onClose}
                  className="flex-1 bg-[#f4f3f5] text-[#1a1c1d] font-bold py-4 rounded-2xl hover:bg-[#e9e8ea] transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving || isLoading || showSuccess}
                  className={cn(
                    "flex-[2] text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2",
                    showSuccess 
                      ? "bg-green-600 shadow-green-100" 
                      : "bg-[#ed1c24] shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920]"
                  )}
                >
                  {isSaving ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : showSuccess ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Save size={20} />
                  )}
                  <span>{isSaving ? 'Salvando...' : showSuccess ? 'Salvo!' : 'Salvar Meta'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { History, Plus, Calendar, FileText, User, X, Info } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Extension } from '@/hooks/useProjectData';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface ProjectExtensionsProps {
  projectId: string;
  extensions: Extension[];
  onUpdate: () => void;
  currentEndDate: string;
  isAdding: boolean;
  setIsAdding: (value: boolean) => void;
  currentUserName: string;
  isAdmin?: boolean;
}

export function ProjectExtensions({ projectId, extensions, onUpdate, currentEndDate, isAdding, setIsAdding, currentUserName, isAdmin = true }: ProjectExtensionsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    new_end_date: '',
    reason: '',
    created_by: '' // Should be current user
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 1. Create extension record
      const { error: extError } = await supabase
        .from('project_extensions')
        .insert([{
          project_id: projectId,
          previous_end_date: currentEndDate,
          new_end_date: formData.new_end_date,
          reason: formData.reason,
          created_by: currentUserName
        }]);
      if (extError) throw extError;

      // 2. Update project end_date
      const { error: projError } = await supabase
        .from('projects')
        .update({ end_date: formData.new_end_date })
        .eq('id', projectId);
      if (projError) throw projError;

      onUpdate();
      setIsAdding(false);
      setFormData({ new_end_date: '', reason: '', created_by: '' });
    } catch (err) {
      console.error('Error adding extension:', err);
      alert('Erro ao prorrogar prazo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-[#e8bcb7]/10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-black text-[#1a1c1d] tracking-tight">Histórico de Prorrogações</h2>
          <p className="text-xs font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest">Acompanhe as alterações de prazo</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-[#f4f3f5] text-[#ed1c24] font-bold rounded-xl hover:bg-[#e9e8ea] transition-all text-xs"
          >
            <Plus size={16} />
            Nova Prorrogação
          </button>
        )}
      </div>

      {/* Add Extension Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 sm:p-8 border-b border-[#f4f3f5] flex justify-between items-center shrink-0 bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24]">
                    <History size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-[#1a1c1d] tracking-tight">Nova Prorrogação</h2>
                    <p className="text-xs font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest">Ajuste o prazo final do projeto</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAdding(false)}
                  className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleAdd} className="flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5]">
                      <Calendar size={14} className="text-[#ed1c24]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Configuração de Prazo</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                          Data Atual de Término
                        </label>
                        <div className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-bold text-[#5e3f3b] opacity-50 cursor-not-allowed">
                          {formatDate(currentEndDate)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                          Nova Data de Término
                        </label>
                        <input
                          required
                          type="date"
                          min={currentEndDate}
                          className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white outline-none transition-all shadow-sm"
                          value={formData.new_end_date}
                          onChange={(e) => setFormData({ ...formData, new_end_date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                        <FileText size={12} className="opacity-50" />
                        Motivo da Prorrogação
                      </label>
                      <textarea
                        required
                        placeholder="Descreva o motivo legal ou técnico (ex: Aditivo nº 01/2024)..."
                        className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-4 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white outline-none transition-all shadow-sm min-h-[100px] resize-none"
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-[#faf9fb] border-t border-[#f4f3f5] shrink-0">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 px-6 py-4 bg-white border border-[#e8bcb7]/20 text-[#5e3f3b] font-black rounded-2xl text-sm hover:bg-[#f4f3f5] transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-[2] px-8 py-4 bg-[#ed1c24] text-white text-sm font-black rounded-2xl shadow-[0_12px_24px_rgba(237,28,36,0.25)] hover:bg-[#d11920] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Plus className="w-4 h-4 animate-spin" /> : <Plus size={18} />}
                      {isSaving ? 'Salvando...' : 'Confirmar Prorrogação'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#f4f3f5]">
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-50">Data Original</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-50">Nova Data</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-50">Motivo</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-50">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f3f5]">
            {extensions.map((ext) => (
              <tr key={ext.id} className="hover:bg-[#faf9fb] transition-colors">
                <td className="px-4 py-4 text-xs font-bold text-[#5e3f3b] line-through opacity-40">
                  {formatDate(ext.previous_end_date)}
                </td>
                <td className="px-4 py-4 text-xs font-bold text-[#ed1c24]">
                  {formatDate(ext.new_end_date)}
                </td>
                <td className="px-4 py-4 text-xs font-medium text-[#1a1c1d]">
                  {ext.reason}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#f4f3f5] flex items-center justify-center text-[#5e3f3b]">
                      <User size={12} />
                    </div>
                    <span className="text-[10px] font-bold text-[#5e3f3b]">{ext.created_by}</span>
                  </div>
                </td>
              </tr>
            ))}
            {extensions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center opacity-30">
                  <History size={32} className="mx-auto mb-2" />
                  <p className="text-sm font-bold">Nenhuma prorrogação registrada.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

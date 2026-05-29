'use client';

import React, { useState } from 'react';
import { Target, Plus, Trash2, Calendar, AlertCircle, X, Info, Edit2, Users, ChevronRight } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Goal } from '@/hooks/useProjectData';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface ProjectGoalsProps {
  projectId: string;
  goals: Goal[];
  modalities: any[];
  onUpdate: () => void;
  projectStartDate: string;
  projectEndDate: string;
  isAdmin?: boolean;
  professionals?: any[];
}

export function ProjectGoals({ 
  projectId, 
  goals, 
  modalities, 
  onUpdate, 
  projectStartDate, 
  projectEndDate, 
  isAdmin = true,
  professionals = []
}: ProjectGoalsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedGoalForDetails, setSelectedGoalForDetails] = useState<Goal | null>(null);
  const [formData, setFormData] = useState({
    modality_id: '',
    type: 'monthly' as 'monthly' | 'total',
    target_value: 0,
    start_date: projectStartDate,
    end_date: projectEndDate
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      modality_id: '',
      type: 'monthly',
      target_value: 0,
      start_date: projectStartDate,
      end_date: projectEndDate
    });
    setIsAdding(true);
  };

  const handleOpenEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setFormData({
      modality_id: goal.modality_id,
      type: goal.type,
      target_value: goal.target_value,
      start_date: goal.start_date,
      end_date: goal.end_date || projectEndDate
    });
    setIsAdding(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.modality_id) {
      alert('Por favor, selecione uma modalidade.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('project_goals')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_goals')
          .insert([{ ...formData, project_id: projectId }]);
        if (error) throw error;
      }
      onUpdate();
      setIsAdding(false);
      setEditingId(null);
    } catch (err) {
      console.error('Error saving goal:', err);
      alert('Erro ao salvar meta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase
        .from('project_goals')
        .delete()
        .eq('id', deletingId);
      if (error) throw error;
      onUpdate();
      setDeletingId(null);
    } catch (err) {
      console.error('Error deleting goal:', err);
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-[#e8bcb7]/10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-black text-[#1a1c1d] tracking-tight">Metas do Projeto</h2>
          <p className="text-xs font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest">Defina objetivos mensais ou totais</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="p-3 bg-[#f4f3f5] text-[#ed1c24] rounded-xl hover:bg-[#e9e8ea] transition-all"
          >
            {isAdding ? <AlertCircle size={20} /> : <Plus size={20} />}
          </button>
        )}
      </div>

      {/* Add/Edit Goal Modal */}
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
                    <Target size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-[#1a1c1d] tracking-tight">{editingId ? 'Editar Meta' : 'Configurar Meta'}</h2>
                    <p className="text-xs font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest">Defina objetivos para o projeto</p>
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
              <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5]">
                      <Info size={14} className="text-[#ed1c24]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Parâmetros da Meta</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                          Modalidade
                        </label>
                        <select
                          required
                          className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white outline-none transition-all shadow-sm"
                          value={formData.modality_id}
                          onChange={(e) => setFormData({ ...formData, modality_id: e.target.value })}
                        >
                          <option value="">Selecionar...</option>
                          {modalities.map((mod) => (
                            <option key={mod.id} value={mod.id}>{mod.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                          Tipo de Meta
                        </label>
                        <select
                          className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white outline-none transition-all shadow-sm"
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value as 'monthly' | 'total' })}
                        >
                          <option value="monthly">Mensal (Recorrente)</option>
                          <option value="total">Total (Global)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                          Quantidade {formData.type === 'total' ? 'Total' : 'Mensal'}
                        </label>
                        <input
                          required
                          type="number"
                          placeholder="0"
                          className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white outline-none transition-all shadow-sm"
                          value={formData.target_value || ''}
                          onChange={(e) => setFormData({ ...formData, target_value: parseInt(e.target.value) || 0 })}
                        />
                        {formData.type === 'total' && formData.target_value > 0 && (
                          <p className="text-[10px] font-bold text-[#004a7a] ml-1">
                            ≈ {Math.round(formData.target_value / Math.max(1, (
                              (new Date(formData.end_date || projectEndDate).getFullYear() - new Date(formData.start_date || projectStartDate).getFullYear()) * 12 + 
                              (new Date(formData.end_date || projectEndDate).getMonth() - new Date(formData.start_date || projectStartDate).getMonth()) + 1
                            )))} atendimentos/mês
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5] pt-4">
                      <Calendar size={14} className="text-[#ed1c24]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Período de Validade</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                          Data de Início
                        </label>
                        <input
                          required
                          type="date"
                          min={projectStartDate}
                          max={projectEndDate}
                          className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white outline-none transition-all shadow-sm"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                          Data de Fim
                        </label>
                        <input
                          type="date"
                          min={formData.start_date || projectStartDate}
                          max={projectEndDate}
                          className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white outline-none transition-all shadow-sm"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        />
                      </div>
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
                      {isSaving ? 'Salvando...' : 'Confirmar Meta'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {goals.map((goal) => (
          <div 
            key={goal.id} 
            onClick={() => setSelectedGoalForDetails(goal)}
            className="flex items-center justify-between p-4 bg-[#f4f3f5]/50 hover:bg-white hover:border-[#ed1c24]/20 hover:scale-[1.01] hover:shadow-sm cursor-pointer rounded-2xl border border-[#e8bcb7]/10 transition-all group"
            title="Clique para visualizar os profissionais vinculados a esta meta"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#ed1c24] border border-[#e8bcb7]/15 group-hover:border-[#ed1c24]/20 shadow-xs transition-all">
                <Target size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1a1c1d] group-hover:text-[#ed1c24] transition-colors">
                  {modalities.find(m => m.id === goal.modality_id)?.name || 'Modalidade não encontrada'} — {goal.target_value} atendimentos {goal.type === 'monthly' ? 'por mês' : 'no total'}
                </p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <p className="text-[10px] font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest">
                    Desde {formatDate(goal.start_date)} 
                    {goal.end_date ? ` até ${formatDate(goal.end_date)}` : ''}
                  </p>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200 hidden sm:inline-block" />
                  <span className="text-[10px] font-bold text-[#ed1c24] flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-all bg-red-500/5 px-2 py-0.5 rounded-md">
                    <Users size={12} /> Ver equipe vinculada
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleOpenEdit(goal)}
                    className="p-2 text-[#5e3f3b] opacity-30 hover:opacity-100 hover:text-[#ed1c24] transition-all"
                    title="Editar Meta"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="p-2 text-[#5e3f3b] opacity-30 hover:opacity-100 hover:text-[#ed1c24] transition-all"
                    title="Excluir Meta"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
              <ChevronRight size={18} className="text-[#5e3f3b] opacity-20 group-hover:opacity-60 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        ))}
        {goals.length === 0 && !isAdding && (
          <div className="py-12 text-center opacity-30">
            <Target size={32} className="mx-auto mb-2" />
            <p className="text-sm font-bold">Nenhuma meta cadastrada.</p>
          </div>
        )}
      </div>

      {/* Linked Professionals Modal */}
      <AnimatePresence>
        {selectedGoalForDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGoalForDetails(null)}
              className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 sm:p-8 border-b border-[#f4f3f5] flex justify-between items-center shrink-0 bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24]">
                    <Users size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-[#1a1c1d] tracking-tight">Equipe Vinculada</h2>
                    <p className="text-[10px] font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest mt-0.5">Profissionais designados para esta meta</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedGoalForDetails(null)}
                  className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Goal Overview Card */}
              <div className="px-6 sm:px-8 pt-6 pb-2 shrink-0">
                <div className="p-4 bg-[#f4f3f5]/50 border border-[#e8bcb7]/15 rounded-2xl">
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#ed1c24] bg-[#ed1c24]/5 px-2 py-0.5 rounded-md">
                    Meta de {modalities.find(m => m.id === selectedGoalForDetails.modality_id)?.name || 'Modalidade'}
                  </span>
                  <div className="mt-2 flex justify-between items-baseline">
                    <span className="text-lg font-black text-[#1a1c1d]">
                      {selectedGoalForDetails.target_value} atendimentos
                    </span>
                    <span className="text-xs font-bold text-[#5e3f3b] uppercase tracking-widest opacity-80">
                      {selectedGoalForDetails.type === 'monthly' ? 'como Meta Mensal' : 'no Total Geral'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#5e3f3b]/70 font-semibold">
                    <Calendar size={12} className="text-[#5e3f3b]/50" />
                    Vigência: {formatDate(selectedGoalForDetails.start_date)} {selectedGoalForDetails.end_date ? ` até ${formatDate(selectedGoalForDetails.end_date)}` : ''}
                  </div>
                </div>
              </div>

              {/* Professionals List Content */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#1a1c1d] pb-2 border-b border-[#f4f3f5]">
                  Lista de Profissionais ({professionals.filter(p => p.modality_ids?.includes(selectedGoalForDetails.modality_id)).length})
                </h4>
                
                <div className="space-y-3">
                  {professionals
                    .filter(p => p.modality_ids?.includes(selectedGoalForDetails.modality_id))
                    .map((prof) => (
                      <div 
                        key={prof.id} 
                        className="flex items-center justify-between p-3 bg-white border border-[#e8bcb7]/10 rounded-xl hover:border-[#ed1c24]/20 hover:bg-[#faf9fb]/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#faf9fb] border border-[#e8bcb7]/10 flex items-center justify-center font-bold text-[#ed1c24]">
                            {prof.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#1a1c1d]">{prof.name}</p>
                            <p className="text-[10px] font-semibold text-[#5e3f3b]/70 truncate max-w-[200px]" title={prof.username || ''}>
                              usuário: {prof.username ? prof.username.toLowerCase() : 'sem usuário'}
                            </p>
                          </div>
                        </div>
                        <div className="px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-md text-[9px] font-bold text-emerald-700 uppercase">
                          No Projeto
                        </div>
                      </div>
                    ))}

                  {professionals.filter(p => p.modality_ids?.includes(selectedGoalForDetails.modality_id)).length === 0 && (
                    <div className="py-8 text-center opacity-40">
                      <Users size={32} className="mx-auto mb-2 text-[#5e3f3b]/60" />
                      <p className="text-xs font-bold text-[#5e3f3b]">Nenhum profissional vinculado a esta modalidade no projeto.</p>
                      <p className="text-[10px] text-[#5e3f3b]/70 font-medium mt-1">
                        Vincule profissionais a esta modalidade na aba de profissionais para exibi-los aqui.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-[#faf9fb] border-t border-[#f4f3f5] shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedGoalForDetails(null)}
                  className="w-full px-6 py-3.5 bg-white border border-[#e8bcb7]/20 text-[#5e3f3b] font-black rounded-2xl text-xs hover:bg-[#f4f3f5] hover:text-[#ed1c24] transition-all cursor-pointer select-none"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#ed1c24]/5 text-[#ed1c24] rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-[#1a1c1d] text-center mb-2">Excluir Meta?</h3>
            <p className="text-sm text-[#5e3f3b] text-center mb-8 font-medium">
              Esta ação não pode ser desfeita. A meta será removida permanentemente do projeto.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-3 bg-[#f4f3f5] text-[#5e3f3b] font-bold rounded-xl hover:bg-[#e9e8ea] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-[#ed1c24] text-white font-bold rounded-xl shadow-lg hover:bg-[#d11920] transition-all"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

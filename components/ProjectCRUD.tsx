'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Edit2, 
  Trash2, 
  FolderPlus,
  X,
  AlertCircle,
  FolderKanban,
  ExternalLink,
  Info,
  FileText,
  Loader2,
  Shield,
  Contact,
  Activity,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ActivityLogger } from '@/lib/activity_logger';

interface Project {
  id: string;
  name: string;
  coordinator: string;
  start_date: string;
  end_date: string;
  status: 'Ativo' | 'Inativo';
  unit_id: string | null;
  units?: { name: string };
  created_at: string;
}

interface ProjectCRUDProps {
  onUpdate?: () => void;
  permission: string;
  userId?: string;
}

export function ProjectCRUD({ onUpdate, permission, userId }: ProjectCRUDProps) {
  const router = useRouter();
  const isAdmin = permission === 'Administrador';
  const isUnitAdmin = permission === 'Administrador por Unidade';
  const isReadOnly = !isAdmin && !isUnitAdmin;
  const [projects, setProjects] = useState<Project[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [allowedUnitIds, setAllowedUnitIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<{
    name: string;
    coordinator: string;
    start_date: string;
    end_date: string;
    status: 'Ativo' | 'Inativo';
    observations: string;
    unit_id: string;
  }>({
    name: '',
    coordinator: '',
    start_date: '',
    end_date: '',
    status: 'Ativo',
    observations: '',
    unit_id: '',
  });

  const [isMounted, setIsMounted] = useState(false);
  
  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, units(name)')
        .order('name');
      
      if (error) throw error;
      
      let filteredProjects = data || [];
      if (isUnitAdmin && userId) {
        let allowedIds = allowedUnitIds;
        if (allowedIds.length === 0) {
          const { data: permissions } = await supabase
            .from('system_user_units')
            .select('unit_id')
            .eq('system_user_id', userId);
          allowedIds = (permissions || []).map((p: any) => p.unit_id);
          setAllowedUnitIds(allowedIds);
        }
        filteredProjects = filteredProjects.filter((p: any) => allowedIds.includes(p.unit_id));
      }
      setProjects(filteredProjects);
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id, name')
        .eq('status', 'Ativo')
        .order('name');
      if (unitsError) throw unitsError;

      if (isAdmin) {
        setUnits(unitsData || []);
      } else if (isUnitAdmin && userId) {
        const { data: permissions, error: permError } = await supabase
          .from('system_user_units')
          .select('unit_id')
          .eq('system_user_id', userId);
        
        if (permError) throw permError;

        const allowedIds = (permissions || []).map((p: any) => p.unit_id);
        setAllowedUnitIds(allowedIds);

        const filteredUnits = (unitsData || []).filter((u: any) => allowedIds.includes(u.id));
        setUnits(filteredUnits);
      } else {
        setUnits([]);
      }
    } catch (err) {
      console.error('Erro ao buscar unidades:', err);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchProjects();
    fetchUnits();
  }, []);

  const handleOpenModal = (item?: Project | any) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        coordinator: item.coordinator || '',
        start_date: item.start_date || '',
        end_date: item.end_date || '',
        status: item.status,
        observations: item.observations || '',
        unit_id: item.unit_id || '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        coordinator: '',
        start_date: '',
        end_date: '',
        status: 'Ativo',
        observations: '',
        unit_id: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!isAdmin) {
      alert('Acesso negado: Apenas administradores podem gerenciar projetos.');
      return;
    }

    setIsSaving(true);
    try {
      if (formData.start_date && formData.end_date) {
        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);
        if (end <= start) {
          alert('A data de término deve ser posterior à data de início.');
          setIsSaving(false);
          return;
        }
      }

      const dataToSave = {
        ...formData,
        name: formData.name.trim(),
        unit_id: formData.unit_id || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('projects')
          .update(dataToSave)
          .eq('id', editingItem.id);
        if (error) throw error;
        
        const associatedUnitName = units.find(u => u.id === dataToSave.unit_id)?.name;
        ActivityLogger.logEdition(
          'projetos', 
          editingItem, 
          { ...editingItem, ...dataToSave }, 
          `Editou o projeto "${editingItem.name}" para "${dataToSave.name}".`,
          associatedUnitName
        );
      } else {
        const { error } = await supabase
          .from('projects')
          .insert([dataToSave]);
        if (error) throw error;
        
        const associatedUnitName = units.find(u => u.id === dataToSave.unit_id)?.name;
        ActivityLogger.logCreation(
          'projetos', 
          dataToSave, 
          `Criou o novo projeto de assistência "${dataToSave.name}".`,
          associatedUnitName
        );
      }
      
      fetchProjects();
      if (onUpdate) onUpdate();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao salvar projeto:', err);
      if (err.code === '23505') {
        alert('Erro ao salvar projeto. Este nome de projeto já está em uso.');
      } else {
        alert(`Erro ao salvar projeto: ${err.message || 'Erro desconhecido'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!isAdmin) {
      alert('Acesso negado: Apenas administradores podem excluir projetos.');
      setIsDeleteModalOpen(false);
      return;
    }

    if (itemToDelete) {
      try {
        const deletedObj = projects.find(p => p.id === itemToDelete);
        const associatedUnitName = deletedObj ? units.find(u => u.id === deletedObj.unit_id)?.name : null;
        
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', itemToDelete);
        if (error) throw error;
        
        if (deletedObj) {
          ActivityLogger.logDeletion(
            'projetos', 
            deletedObj, 
            `Excluiu o projeto de assistência "${deletedObj.name}".`,
            associatedUnitName
          );
        }
        
        fetchProjects();
        if (onUpdate) onUpdate();
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
      } catch (err) {
        console.error('Erro ao excluir projeto:', err);
      }
    }
  };

  const filteredItems = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-4 rounded-[1.5rem] shadow-sm border border-[#e8bcb7]/10">
        <div className="relative flex-1 max-w-none md:max-w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-40" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome do projeto..."
            className="w-full bg-[#f4f3f5] border-0 rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-[#bc0010] outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {!isReadOnly && (
          <button 
            onClick={() => handleOpenModal()}
            className="w-full md:w-auto bg-[#ed1c24] text-white px-8 py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920] transition-all active:scale-95 group"
          >
            <FolderPlus size={18} className="group-hover:rotate-12 transition-transform" />
            Novo Projeto
          </button>
        )}
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm overflow-hidden border border-[#e8bcb7]/10">
        <div className="overflow-x-auto scrollbar-thin hidden md:block">
          <table className="w-full border-collapse min-w-full">
            <thead>
              <tr className="bg-[#f4f3f5]">
                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Projeto</th>
                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Unidade</th>
                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Coordenador</th>
                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Período</th>
                <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Status</th>
                <th className="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f3f5]">
              {filteredItems.map((item, index) => (
                <motion.tr 
                  key={item.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-[#faf9fb] transition-colors group"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#ffdad5] flex items-center justify-center text-[#bc0010] shrink-0 shadow-sm group-hover:shadow-md transition-all">
                        <FolderKanban size={16} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#1a1c1d] truncate group-hover:text-[#bc0010] transition-colors">{item.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-[#1a1c1d] font-bold whitespace-nowrap">
                        {item.units?.name || <span className="text-[#bc0010] opacity-30 italic text-[10px]">Não vinculada</span>}
                      </span>
                      <span className="text-[8px] text-[#5e3f3b] font-bold uppercase tracking-widest opacity-30">Unidade</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-[#1a1c1d] font-bold whitespace-nowrap">{item.coordinator || 'Não definido'}</span>
                      <span className="text-[8px] text-[#5e3f3b] font-bold uppercase tracking-widest opacity-30">Coordenador</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <Calendar size={9} className="text-[#5e3f3b] opacity-40" />
                        <span className="text-[11px] text-[#5e3f3b] font-bold whitespace-nowrap">
                          {item.start_date ? formatDate(item.start_date) : ''} 
                          {item.end_date ? ` - ${formatDate(item.end_date)}` : ''}
                          {!item.start_date && !item.end_date && (isMounted ? new Date(item.created_at).toLocaleDateString('pt-BR') : '')}
                        </span>
                      </div>
                      <span className="text-[8px] text-[#5e3f3b] font-bold uppercase tracking-widest opacity-30">Vigência</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1",
                      item.status === 'Ativo' 
                        ? "bg-green-50 text-green-600 border border-green-100" 
                        : "bg-gray-50 text-gray-400 border border-gray-100"
                    )}>
                      <div className={cn("w-1 h-1 rounded-full", item.status === 'Ativo' ? "bg-green-600" : "bg-gray-400")} />
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-1.5 lg:opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 lg:translate-x-1">
                      <button 
                        onClick={() => router.push(`/projects/${item.id}`)}
                        title="Gerenciar Projeto"
                        className="p-2 text-[#bc0010] hover:bg-[#bc0010]/5 rounded-lg transition-all active:scale-90"
                      >
                        <ExternalLink size={16} />
                      </button>
                      {!isReadOnly && (
                        <>
                          <button 
                            onClick={() => handleOpenModal(item)}
                            title="Editar"
                            className="p-2 text-[#5e3f3b] hover:text-[#bc0010] hover:bg-[#bc0010]/5 rounded-lg transition-all active:scale-90"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(item.id)}
                            title="Excluir"
                            className="p-2 text-[#5e3f3b] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <AlertCircle size={32} />
                      <p className="text-sm font-medium">Nenhum projeto encontrado.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-[#f4f3f5]">
          {filteredItems.map((item, index) => (
            <motion.div 
              key={item.id} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-5 space-y-5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#ffdad5] flex items-center justify-center text-[#bc0010] shrink-0 shadow-sm">
                    <FolderKanban size={24} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-black text-[#1a1c1d] truncate tracking-tight">{item.name}</span>
                    <div className="flex items-center gap-1.5">
                      <Activity size={10} className="text-[#bc0010] opacity-60" />
                      <span className="text-[10px] font-bold text-[#5e3f3b] opacity-60 uppercase tracking-widest truncate">{item.coordinator || 'Sem coordenador'}</span>
                    </div>
                  </div>
                </div>
                <span className={cn(
                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border",
                  item.status === 'Ativo' 
                    ? "bg-green-50 text-green-600 border-green-100" 
                    : "bg-gray-50 text-gray-400 border-gray-100"
                )}>
                  {item.status}
                </span>
              </div>

              <div className="bg-[#f4f3f5]/50 p-4 rounded-2xl space-y-3 border border-[#e8bcb7]/5">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 opacity-40">
                    <FolderKanban size={10} />
                    <p className="text-[8px] font-black uppercase tracking-widest">Unidade</p>
                  </div>
                  <p className="text-xs font-bold text-[#ed1c24]">
                    {item.units?.name || 'Não vinculada'}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 opacity-40">
                    <Calendar size={10} />
                    <p className="text-[8px] font-black uppercase tracking-widest">Período de Vigência</p>
                  </div>
                  <p className="text-xs font-bold text-[#1a1c1d]">
                    {item.start_date ? formatDate(item.start_date) : ''} 
                    {item.end_date ? ` - ${formatDate(item.end_date)}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button 
                  onClick={() => router.push(`/projects/${item.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#bc0010]/5 text-[#bc0010] py-3.5 rounded-2xl text-xs font-black active:scale-95 transition-all"
                >
                  <ExternalLink size={16} />
                  Gerenciar
                </button>
                {!isReadOnly && (
                  <>
                    <button 
                      onClick={() => handleOpenModal(item)}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#f4f3f5] text-[#1a1c1d] py-3.5 rounded-2xl text-xs font-black active:scale-95 transition-all"
                    >
                      <Edit2 size={16} />
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(item.id)}
                      className="p-3.5 bg-red-50 text-red-600 rounded-2xl active:scale-95 flex items-center justify-center transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
          {filteredItems.length === 0 && (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-2 opacity-40">
                <AlertCircle size={32} />
                <p className="text-xs font-bold">Nenhum projeto encontrado.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsDeleteModalOpen(false)}
            className="absolute inset-0 bg-[#1a1c1d]/40 backdrop-blur-sm"
          />
          <div 
            className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden p-6 sm:p-8 text-center"
          >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-50 text-[#bc0010] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Trash2 size={24} className="sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#1a1c1d] mb-2">Excluir Projeto</h2>
              <p className="text-xs sm:text-sm text-[#5e3f3b] mb-6 sm:mb-8">
                Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 bg-[#e9e8ea] text-[#1a1c1d] font-bold py-3 rounded-xl text-sm hover:bg-[#f4f3f5] transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl text-sm shadow-[0_8px_20px_rgba(220,38,38,0.2)] hover:bg-red-700 transition-all"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-[95%] max-w-2xl max-h-[90vh] bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-[#e8bcb7]/10 flex justify-between items-center bg-[#faf9fb] shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#bc0010]/10 flex items-center justify-center text-[#bc0010]">
                      <FolderKanban size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#1a1c1d] tracking-tight">
                        {editingItem ? 'Editar Projeto' : 'Novo Projeto'}
                      </h2>
                      <p className="text-[10px] font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest mt-1">
                        {editingItem ? 'Atualize as informações estratégicas' : 'Configure um novo projeto estratégico'}
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-thin">
                  <div className="space-y-8">
                    {/* Seção: Identificação */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5]">
                        <Info size={14} className="text-[#bc0010]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Identificação Básica</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                            <FolderKanban size={12} className="opacity-50" />
                            Nome do Projeto
                          </label>
                          <input 
                            required
                            type="text" 
                            placeholder="Ex: Apoio à Inclusão"
                            className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-4 focus:ring-[#bc0010]/5 focus:bg-white focus:border-[#bc0010]/20 outline-none transition-all"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                            <FolderKanban size={12} className="opacity-50" />
                            Unidade
                          </label>
                          <select 
                            className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-4 focus:ring-[#bc0010]/5 focus:bg-white focus:border-[#bc0010]/20 outline-none appearance-none cursor-pointer transition-all"
                            value={formData.unit_id}
                            onChange={(e) => setFormData({...formData, unit_id: e.target.value})}
                          >
                            <option value="">Selecione uma unidade</option>
                            {units.map(unit => (
                              <option key={unit.id} value={unit.id}>{unit.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                            <Edit2 size={12} className="opacity-50" />
                            Coordenador
                          </label>
                          <input 
                            type="text" 
                            placeholder="Nome do Coordenador"
                            className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-4 focus:ring-[#bc0010]/5 focus:bg-white focus:border-[#bc0010]/20 outline-none transition-all"
                            value={formData.coordinator}
                            onChange={(e) => setFormData({...formData, coordinator: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção: Vigência e Status */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5]">
                        <AlertCircle size={14} className="text-[#bc0010]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Vigência e Status</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                            <Calendar size={12} className="opacity-50" />
                            Início
                          </label>
                          <input 
                            type="date" 
                            className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-4 focus:ring-[#bc0010]/5 focus:bg-white focus:border-[#bc0010]/20 outline-none transition-all"
                            value={formData.start_date}
                            onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                            <Calendar size={12} className="opacity-50" />
                            Término
                          </label>
                          <input 
                            type="date" 
                            min={formData.start_date}
                            className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-4 focus:ring-[#bc0010]/5 focus:bg-white focus:border-[#bc0010]/20 outline-none transition-all"
                            value={formData.end_date}
                            onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                            <Activity size={12} className="opacity-50" />
                            Status
                          </label>
                          <select 
                            className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-4 focus:ring-[#bc0010]/5 focus:bg-white focus:border-[#bc0010]/20 outline-none appearance-none cursor-pointer transition-all"
                            value={formData.status}
                            onChange={(e) => setFormData({...formData, status: e.target.value as 'Ativo' | 'Inativo'})}
                          >
                            <option value="Ativo">Ativo</option>
                            <option value="Inativo">Inativo</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Seção: Detalhamento */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5]">
                        <FileText size={14} className="text-[#bc0010]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Detalhamento Estratégico</span>
                      </div>

                      <div className="space-y-5">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                            <Info size={12} className="opacity-50" />
                            Observações Adicionais
                          </label>
                          <textarea 
                            placeholder="Notas internas, restrições ou informações complementares..."
                            className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-4 px-4 text-sm font-medium focus:ring-4 focus:ring-[#bc0010]/5 focus:bg-white focus:border-[#bc0010]/20 outline-none transition-all min-h-[80px] resize-none"
                            value={formData.observations}
                            onChange={(e) => setFormData({...formData, observations: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 sm:p-6 bg-[#faf9fb] border-t border-[#e8bcb7]/10 shrink-0">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 bg-white border border-[#e8bcb7]/20 text-[#1a1c1d] font-black py-3.5 rounded-2xl text-sm hover:bg-[#f4f3f5] transition-all active:scale-95 shadow-sm"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={isSaving}
                      className="flex-[2] bg-[#bc0010] text-white font-black py-3.5 rounded-2xl text-sm shadow-[0_12px_24px_rgba(188,0,16,0.2)] hover:bg-[#e6191e] hover:shadow-[0_16px_32px_rgba(188,0,16,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        editingItem ? 'Salvar Alterações' : 'Confirmar Cadastro'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

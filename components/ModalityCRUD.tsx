'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Edit2, 
  Trash2, 
  Plus,
  X,
  AlertCircle,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { ActivityLogger } from '@/lib/activity_logger';

interface Modality {
  id: string;
  name: string;
  description: string;
  status: 'Ativo' | 'Inativo';
  created_at: string;
}

interface ModalityCRUDProps {
  onUpdate?: () => void;
  permission: string;
}

export function ModalityCRUD({ onUpdate, permission }: ModalityCRUDProps) {
  const isReadOnly = permission === 'Profissional';
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Modality | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: 'Ativo' | 'Inativo';
  }>({
    name: '',
    description: '',
    status: 'Ativo',
  });

  const fetchModalities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('modalities')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setModalities(data || []);
    } catch (err) {
      console.error('Erro ao buscar modalidades:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModalities();
  }, []);

  const handleOpenModal = (item?: Modality) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description,
        status: item.status,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        status: 'Ativo',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('modalities')
          .update(formData)
          .eq('id', editingItem.id);
        if (error) throw error;
        
        ActivityLogger.logEdition(
          'modalidades', 
          editingItem, 
          { ...editingItem, ...formData }, 
          `Editou a modalidade de atendimento "${editingItem.name}" para "${formData.name}".`
        );
      } else {
        const { error } = await supabase
          .from('modalities')
          .insert([formData]);
        if (error) throw error;
        
        ActivityLogger.logCreation(
          'modalidades', 
          formData, 
          `Criou a nova modalidade de atendimento "${formData.name}".`
        );
      }
      
      fetchModalities();
      if (onUpdate) onUpdate();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar modalidade:', err);
      alert('Erro ao salvar modalidade. Verifique se o nome já existe.');
    }
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        const deletedObj = modalities.find(m => m.id === itemToDelete);
        
        const { error } = await supabase
          .from('modalities')
          .delete()
          .eq('id', itemToDelete);
        if (error) throw error;
        
        if (deletedObj) {
          ActivityLogger.logDeletion(
            'modalidades', 
            deletedObj, 
            `Excluiu a modalidade de atendimento "${deletedObj.name}".`
          );
        }
        
        fetchModalities();
        if (onUpdate) onUpdate();
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
      } catch (err) {
        console.error('Erro ao excluir modalidade:', err);
      }
    }
  };

  const filteredItems = modalities.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-[#e8bcb7]/10">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-[#f4f3f5] rounded-2xl text-[#ed1c24]">
            <Settings size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#1a1c1d]">Configurações do Sistema</h2>
            <p className="text-xs text-[#5e3f3b] font-medium opacity-70">Gerencie as modalidades de atendimento e outras preferências.</p>
          </div>
        </div>

        <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <h3 className="text-[10px] sm:text-sm font-black underline decoration-[#ed1c24]/30 underline-offset-4 tracking-widest text-[#5e3f3b] uppercase">Modalidades</h3>
          {!isReadOnly && (
            <button 
              onClick={() => handleOpenModal()}
              className="bg-[#ed1c24] text-white px-5 py-4 sm:py-2.5 rounded-2xl sm:rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(237,28,36,0.15)] hover:bg-[#d11920] transition-all active:scale-95 shrink-0"
            >
              <Plus size={18} />
              Nova Modalidade
            </button>
          )}
        </div>

        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-30" size={18} />
          <input 
            type="text" 
            placeholder="Buscar modalidade..."
            className="w-full bg-[#f4f3f5] border border-[#e8bcb7]/10 sm:border-0 rounded-2xl sm:rounded-xl py-3.5 sm:py-2.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#bc0010] outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="group bg-[#f4f3f5]/50 border border-[#e8bcb7]/5 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-2xl hover:bg-white hover:shadow-lg hover:shadow-[#ed1c24]/5 transition-all duration-300">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col min-w-0 pr-2">
                  <h4 className="font-black text-[#1a1c1d] text-base leading-tight truncate">{item.name}</h4>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", item.status === 'Ativo' ? "bg-green-500" : "bg-gray-300")} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-40">{item.status}</span>
                  </div>
                </div>
                {!isReadOnly ? (
                  <div className="flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(item)}
                      className="p-2 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/10 rounded-xl transition-all h-10 w-10 flex items-center justify-center"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(item.id)}
                      className="p-2 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/5 rounded-xl transition-all h-10 w-10 flex items-center justify-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-40">Leitura</span>
                )}
              </div>
              <p className="text-[11px] text-[#5e3f3b] leading-relaxed opacity-80 font-medium line-clamp-3">{item.description}</p>
            </div>
          ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full py-10 text-center opacity-40">
                <AlertCircle size={24} className="mx-auto mb-2" />
                <p className="text-xs font-medium">Nenhuma modalidade encontrada.</p>
              </div>
            )}
          </div>
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
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#ed1c24]/5 text-[#ed1c24] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Trash2 size={24} className="sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#1a1c1d] mb-2">Excluir Modalidade</h2>
              <p className="text-xs sm:text-sm text-[#5e3f3b] mb-6 sm:mb-8">
                Tem certeza que deseja excluir esta modalidade?
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
                  className="flex-1 bg-[#ed1c24] text-white font-bold py-3 rounded-xl text-sm shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920] transition-all"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
          <div 
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-[#1a1c1d]/40 backdrop-blur-sm"
          />
          <div 
            className="relative w-full h-full sm:h-auto sm:max-w-md bg-white sm:rounded-[2rem] shadow-2xl overflow-y-auto scrollbar-thin"
          >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-black text-[#1a1c1d]">
                    {editingItem ? 'Editar Modalidade' : 'Nova Modalidade'}
                  </h2>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Nome da Modalidade</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Descrição</label>
                    <textarea 
                      required
                      rows={3}
                      className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none resize-none"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Status</label>
                    <select 
                      className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as 'Ativo' | 'Inativo'})}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 bg-[#e9e8ea] text-[#1a1c1d] font-bold py-3 rounded-xl text-sm hover:bg-[#f4f3f5] transition-all order-2 sm:order-1"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-[#ed1c24] text-white font-bold py-3 rounded-xl text-sm shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920] transition-all order-1 sm:order-2"
                    >
                      {editingItem ? 'Salvar Alterações' : 'Criar Modalidade'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

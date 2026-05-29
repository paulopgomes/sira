'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Edit2, 
  Trash2, 
  UserPlus,
  X,
  AlertCircle,
  ShieldCheck,
  User,
  Crown,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { ActivityLogger } from '@/lib/activity_logger';

interface SystemUser {
  id: string;
  username: string;
  permission: 'Administrador' | 'Profissional' | 'Administrador por Unidade';
  password: string;
  status: 'Ativo' | 'Inativo';
  created_at: string;
  unit_permissions?: string[];
  session_version?: number;
}

interface SystemUserCRUDProps {
  permission: string;
  currentUsername: string;
  targetUsername?: string | null;
  onClearTargetUsername?: () => void;
}

export function SystemUserCRUD({ 
  permission, 
  currentUsername, 
  targetUsername, 
  onClearTargetUsername 
}: SystemUserCRUDProps) {
  const isReadOnly = permission === 'Profissional';
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<SystemUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Inativo'>('Todos');
  const [roleFilter, setRoleFilter] = useState<string>('Todos');
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [modalPasswordVisible, setModalPasswordVisible] = useState(false);
  
  const [formData, setFormData] = useState<{
    username: string;
    permission: 'Administrador' | 'Profissional' | 'Administrador por Unidade';
    password: string;
    status: 'Ativo' | 'Inativo';
    unit_permissions: string[];
  }>({
    username: '',
    permission: 'Profissional',
    password: '',
    status: 'Ativo',
    unit_permissions: [],
  });

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .eq('status', 'Ativo')
        .order('name');
      if (error) throw error;
      setUnits(data || []);
    } catch (err) {
      console.error('Erro ao buscar unidades:', err);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from('system_users')
        .select('*')
        .order('username');
      
      if (userError) throw userError;

      const { data: permissionData, error: permissionError } = await supabase
        .from('system_user_units')
        .select('*');
      
      if (permissionError) throw permissionError;

      const usersWithPermissions = (userData || []).map((user: any) => {
        let actualPermission = user.permission;
        if (user.email && user.email.endsWith('@adminunidade.sistema.com')) {
          actualPermission = 'Administrador por Unidade';
        }
        return {
          ...user,
          permission: actualPermission,
          unit_permissions: (permissionData || [])
            .filter((p: any) => p.system_user_id === user.id)
            .map((p: any) => p.unit_id)
        };
      });

      setUsers(usersWithPermissions);
    } catch (err) {
      console.error('Erro ao buscar usuários do sistema:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUnits();
  }, []);

  useEffect(() => {
    if (!isLoading && targetUsername) {
      const found = users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
      if (found) {
        handleOpenModal(found);
      } else {
        handleOpenModal(undefined, targetUsername.toLowerCase());
      }
      if (onClearTargetUsername) {
        onClearTargetUsername();
      }
    }
  }, [isLoading, targetUsername, users, onClearTargetUsername]);

  const handleOpenModal = (item?: SystemUser, prefilledUsername?: string) => {
    setModalPasswordVisible(false);
    if (item) {
      setEditingItem(item);
      setFormData({
        username: item.username,
        permission: item.permission,
        password: item.password,
        status: item.status || 'Ativo',
        unit_permissions: item.unit_permissions || [],
      });
    } else {
      setEditingItem(null);
      setFormData({
        username: prefilledUsername || '',
        permission: 'Profissional',
        password: '',
        status: 'Ativo',
        unit_permissions: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      const trimmedUsername = formData.username.trim();
      const { unit_permissions, ...userPayload } = formData;
      const isCustomRole = formData.permission === 'Administrador por Unidade';
      const payload = {
        ...userPayload,
        permission: (isCustomRole ? 'Profissional' : formData.permission) as 'Administrador' | 'Profissional',
        username: trimmedUsername,
        email: isCustomRole 
          ? `${trimmedUsername.toLowerCase()}@adminunidade.sistema.com` 
          : `${trimmedUsername.toLowerCase()}@sistema.com`
      };

      let userId = editingItem?.id;

      if (editingItem) {
        // Increment session_version if password is changed to invalidate active sessions/logins on all devices
        const isPasswordChanged = editingItem.password !== payload.password;
        const finalPayload = {
          ...payload,
          session_version: isPasswordChanged 
            ? (editingItem.session_version ? editingItem.session_version + 1 : 2)
            : editingItem.session_version
        };

        const { error } = await supabase
          .from('system_users')
          .update(finalPayload)
          .eq('id', editingItem.id);
        if (error) throw error;
        
        ActivityLogger.logEdition(
          'usuarios', 
          editingItem, 
          { ...editingItem, ...payload }, 
          `Editou o usuário do sistema "${editingItem.username}".`
        );
      } else {
        const { data, error } = await supabase
          .from('system_users')
          .insert([payload])
          .select();
        if (error) throw error;
        userId = data[0].id;
        
        ActivityLogger.logCreation(
          'usuarios', 
          payload, 
          `Criou o novo usuário do sistema "${payload.username}" com a função de "${payload.permission}".`
        );
      }

      // Sync unit permissions
      if (userId) {
        // Delete existing
        await supabase
          .from('system_user_units')
          .delete()
          .eq('system_user_id', userId);
        
        // Insert new
        if ((formData.permission === 'Profissional' || formData.permission === 'Administrador por Unidade') && formData.unit_permissions.length > 0) {
          const permissionInserts = formData.unit_permissions.map(unitId => ({
            system_user_id: userId,
            unit_id: unitId
          }));
          const { error: permError } = await supabase
            .from('system_user_units')
            .insert(permissionInserts);
          if (permError) throw permError;
        }
      }
      
      fetchUsers();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao salvar usuário do sistema:', err);
      if (err.code === '23505') {
        alert('Erro ao salvar usuário. Este nome de usuário já está em uso.');
      } else {
        alert(`Erro ao salvar usuário: ${err.message || 'Erro desconhecido'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    const user = users.find(u => u.id === id);
    
    if (user?.username === 'admin') {
      alert('O usuário administrador principal não pode ser excluído.');
      return;
    }

    if (user?.username === currentUsername) {
      alert('Você não pode excluir seu próprio usuário.');
      return;
    }

    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        const user = users.find(u => u.id === itemToDelete);
        
        const deletedObj = users.find(u => u.id === itemToDelete);
        
        const { error } = await supabase
          .from('system_users')
          .delete()
          .eq('id', itemToDelete);
        if (error) throw error;
        
        if (deletedObj) {
          ActivityLogger.logDeletion(
            'usuarios', 
            deletedObj, 
            `Excluiu o usuário do sistema "${deletedObj.username}".`
          );
        }
        
        fetchUsers();
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
      } catch (err) {
        console.error('Erro ao excluir usuário do sistema:', err);
        alert('Ocorreu um erro ao excluir o usuário do sistema.');
      }
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredItems = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.permission.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || (u.status || 'Ativo') === statusFilter;
    const matchesRole = roleFilter === 'Todos' || u.permission === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-40 md:opacity-30" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por usuário ou função..."
              className="w-full bg-white border border-[#e8bcb7]/10 sm:border-0 rounded-2xl sm:rounded-xl py-3.5 sm:py-3 pl-11 sm:pl-10 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative w-full sm:w-40">
            <select 
              className="w-full bg-white border border-[#e8bcb7]/10 sm:border-0 rounded-2xl sm:rounded-xl py-3.5 sm:py-3 px-4 text-sm shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer transition-all pr-10"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="Todos">Todos Status</option>
              <option value="Ativo">Ativos</option>
              <option value="Inativo">Inativos</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
              <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-[#5e3f3b] rotate-45" />
            </div>
          </div>

          <div className="relative w-full sm:w-52">
            <select 
              className="w-full bg-white border border-[#e8bcb7]/10 sm:border-0 rounded-2xl sm:rounded-xl py-3.5 sm:py-3 px-4 text-sm shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer transition-all pr-10"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="Todos">Todas Funções</option>
              <option value="Administrador">Administrador</option>
              <option value="Administrador por Unidade">Administrador por Unidade</option>
              <option value="Profissional">Profissional</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
              <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-[#5e3f3b] rotate-45" />
            </div>
          </div>
        </div>
        
        {!isReadOnly && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-[#ed1c24] text-white px-6 py-4 sm:py-3 rounded-2xl sm:rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920] transition-all active:scale-95 shrink-0"
          >
            <UserPlus size={18} />
            Novo Usuário
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#e8bcb7]/10">
        <div className="overflow-x-auto scrollbar-thin hidden md:block">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f4f3f5]">
                <th className="px-3 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Usuário do Sistema</th>
                <th className="px-3 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Função</th>
                <th className="px-3 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Status</th>
                <th className="px-3 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Senha</th>
                <th className="px-3 py-3 text-right text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f3f5]">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#faf9fb] transition-colors group">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#004a7a]/10 flex items-center justify-center text-[#004a7a] font-bold text-[10px] shrink-0">
                        {item.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-[#1a1c1d] truncate">{item.username}</span>
                        {item.username === currentUsername && (
                          <span className="text-[9px] text-[#ed1c24] font-bold uppercase tracking-widest">Você</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {item.permission === 'Administrador' ? (
                        <>
                          <Crown size={12} className="text-[#004a7a]" />
                          <span className="text-[11px] text-[#004a7a] font-bold whitespace-nowrap">{item.permission}</span>
                        </>
                      ) : item.permission === 'Administrador por Unidade' ? (
                        <>
                          <ShieldCheck size={12} className="text-[#0d9488]" />
                          <span className="text-[11px] text-[#0d9488] font-bold whitespace-nowrap">{item.permission}</span>
                        </>
                      ) : (
                        <>
                          <User size={12} className="text-[#5e3f3b]" />
                          <span className="text-[11px] text-[#5e3f3b] font-medium whitespace-nowrap">{item.permission}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider whitespace-nowrap",
                      item.status === 'Ativo' ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                    )}>
                      {item.status || 'Ativo'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono bg-[#f4f3f5] px-1.5 py-0.5 rounded whitespace-nowrap">
                        {(!isReadOnly || item.username === currentUsername) && showPassword[item.id] 
                          ? item.password 
                          : '••••••••'}
                      </span>
                      {(!isReadOnly || item.username === currentUsername) && (
                        <button 
                          onClick={() => togglePasswordVisibility(item.id)}
                          className="p-1 text-[#5e3f3b] hover:text-[#ed1c24] transition-colors active:scale-90"
                        >
                          {showPassword[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {!isReadOnly ? (
                      <div className="flex justify-end gap-1.5 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(item)}
                          className="p-1 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/10 rounded-lg transition-all"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(item.id)}
                          className={cn(
                            "p-1 rounded-lg transition-all",
                            (item.id === '1' || item.username === currentUsername) 
                              ? "text-gray-300 cursor-not-allowed" 
                              : "text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/5"
                          )}
                          disabled={item.id === '1' || item.username === currentUsername}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-40">Visualização</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <AlertCircle size={32} />
                      <p className="text-sm font-medium">Nenhum usuário do sistema encontrado.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-[#f4f3f5]">
          {filteredItems.map((item) => (
            <div key={item.id} className="p-4 sm:p-5 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#004a7a]/10 flex items-center justify-center text-[#004a7a] font-black text-sm sm:text-base shrink-0">
                    {item.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-black text-[#1a1c1d] truncate tracking-tight">{item.username}</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.permission === 'Administrador' ? (
                        <Crown size={10} className="text-[#004a7a] shrink-0" />
                      ) : item.permission === 'Administrador por Unidade' ? (
                        <ShieldCheck size={10} className="text-[#0d9488] shrink-0" />
                      ) : (
                        <User size={10} className="text-[#5e3f3b] shrink-0" />
                      )}
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest truncate",
                        item.permission === 'Administrador' ? "text-[#004a7a]" : item.permission === 'Administrador por Unidade' ? "text-[#0d9488]" : "text-[#5e3f3b] opacity-60"
                      )}>{item.permission}</span>
                    </div>
                  </div>
                </div>
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shrink-0",
                  (item.status || 'Ativo') === 'Ativo' ? "bg-green-50 text-green-600 border border-green-100" : "bg-gray-50 text-gray-500 border border-gray-100"
                )}>
                  {item.status || 'Ativo'}
                </span>
              </div>

              <div className="bg-[#f4f3f5]/50 p-3 rounded-2xl border border-[#e8bcb7]/5 flex justify-between items-center px-4">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40">Senha</p>
                  <span className="text-xs font-mono font-black text-[#1a1c1d]">
                    {(!isReadOnly || item.username === currentUsername) && showPassword[item.id] 
                      ? item.password 
                      : '••••••••'}
                  </span>
                </div>
                {(!isReadOnly || item.username === currentUsername) && (
                  <button 
                    onClick={() => togglePasswordVisibility(item.id)}
                    className="p-2 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-white rounded-xl transition-all active:scale-90"
                  >
                    {showPassword[item.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>

              {!isReadOnly && (
                <div className="flex gap-2 pt-1">
                  <button 
                    onClick={() => handleOpenModal(item)}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#f4f3f5] text-[#1a1c1d] py-3.5 rounded-2xl text-[10px] font-black active:scale-95 transition-all outline-none focus:ring-2 focus:ring-[#bc0010]/10"
                  >
                    <Edit2 size={16} />
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(item.id)}
                    disabled={item.id === '1' || item.username === currentUsername}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[10px] font-black active:scale-95 transition-all outline-none",
                      (item.id === '1' || item.username === currentUsername)
                        ? "bg-gray-50 text-gray-200 cursor-not-allowed"
                        : "bg-[#ed1c24]/5 text-[#ed1c24] focus:ring-2 focus:ring-[#ed1c24]/10"
                    )}
                  >
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-2 opacity-40">
                <AlertCircle size={32} />
                <p className="text-xs font-bold">Nenhum usuário encontrado.</p>
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
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#ed1c24]/5 text-[#ed1c24] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Trash2 size={24} className="sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#1a1c1d] mb-2">Excluir Usuário</h2>
              <p className="text-xs sm:text-sm text-[#5e3f3b] mb-6 sm:mb-8">
                Tem certeza que deseja excluir este usuário do sistema? Esta ação não pode ser desfeita.
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-[#1a1c1d]/40 backdrop-blur-sm"
          />
          <div 
            className="relative w-full max-h-[90vh] sm:max-w-xl bg-white rounded-[2rem] shadow-2xl overflow-y-auto scrollbar-thin"
          >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-black text-[#1a1c1d]">
                    {editingItem ? 'Editar Usuário do Sistema' : 'Novo Usuário do Sistema'}
                  </h2>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Usuário do Sistema</label>
                      <input 
                        required
                        type="text" 
                        className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none transition-all"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                      />
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Função</label>
                      <select 
                        className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer transition-all"
                        value={formData.permission}
                        onChange={(e) => setFormData({...formData, permission: e.target.value as any})}
                      >
                        <option value="Administrador">Administrador</option>
                        <option value="Administrador por Unidade">Administrador por Unidade</option>
                        <option value="Profissional">Profissional</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Senha</label>
                      <div className="relative">
                        <input 
                          required
                          type={modalPasswordVisible ? "text" : "password"} 
                          className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 pl-4 pr-10 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none transition-all animate-none"
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                        />
                        <button
                          type="button"
                          onClick={() => setModalPasswordVisible(!modalPasswordVisible)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#5e3f3b]/60 hover:text-[#ed1c24] transition-colors rounded hover:bg-black/5"
                          title={modalPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {modalPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Status</label>
                      <select 
                        disabled={editingItem?.username === currentUsername}
                        className={cn(
                           "w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer transition-all",
                          editingItem?.username === currentUsername && "opacity-50 cursor-not-allowed"
                        )}
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                      {editingItem?.username === currentUsername && (
                        <p className="text-[10px] text-[#ed1c24] font-medium ml-1">Você não pode desativar seu próprio usuário.</p>
                      )}
                    </div>
                  </div>

                  {(formData.permission === 'Profissional' || formData.permission === 'Administrador por Unidade') && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                          {formData.permission === 'Profissional' 
                            ? 'Vincular Unidades para Cadastro de Usuários' 
                            : 'Vincular Unidades ao Cadastro'}
                        </label>
                        <span className="text-[10px] font-bold text-[#ed1c24]">
                          {formData.unit_permissions.length} selecionada(s)
                        </span>
                      </div>
                      <div className="bg-[#f4f3f5] rounded-2xl p-4 max-h-48 overflow-y-auto border border-[#e8bcb7]/10 space-y-2">
                        {units.length === 0 ? (
                          <p className="text-xs text-[#5e3f3b] opacity-60 italic text-center py-4">Nenhuma unidade ativa encontrada.</p>
                        ) : (
                          units.map(unit => (
                            <label key={unit.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer group">
                              <input 
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-[#ed1c24] focus:ring-[#ed1c24]"
                                checked={formData.unit_permissions.includes(unit.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      unit_permissions: [...formData.unit_permissions, unit.id]
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      unit_permissions: formData.unit_permissions.filter(id => id !== unit.id)
                                    });
                                  }
                                }}
                              />
                              <span className="text-sm font-medium text-[#1a1c1d] group-hover:text-[#ed1c24] transition-colors">
                                {unit.name}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                      <p className="text-[10px] text-[#5e3f3b] opacity-60 ml-1">
                        Selecione as unidades às quais este usuário terá acesso para gerenciar, preencher ou visualizar.
                      </p>
                    </div>
                  )}

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
                      disabled={isSaving}
                      className="flex-1 bg-[#ed1c24] text-white font-bold py-3 rounded-xl text-sm shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920] transition-all disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
                    >
                      {isSaving ? 'Salvando...' : (editingItem ? 'Salvar Alterações' : 'Criar Usuário')}
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

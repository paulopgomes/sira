'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Edit2, 
  Trash2, 
  UserPlus,
  X,
  AlertCircle,
  History,
  Calendar,
  Layers,
  CheckCircle,
  UserCheck,
  User,
  MapPin,
  CreditCard,
  FileText,
  Activity
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { validateCPF, validateCNS, validateCID, maskCPF, maskCNS } from '@/lib/validators';
import { ActivityLogger } from '@/lib/activity_logger';

interface User {
  id: string;
  name: string;
  record_number: string;
  birth_date: string;
  gender: string;
  cpf: string;
  sus_card: string;
  cid_primary: string;
  cid_secondary: string;
  status: 'Ativo' | 'Inativo';
  unit_id: string | null;
  units?: { name: string };
  created_at: string;
  admission_date?: string;
  death_date?: string;
  phone_1?: string;
  phone_2?: string;
  dependency_degree?: string;
  termination_date?: string;
}

interface UserCRUDProps {
  onUpdate?: () => void;
  permission: string;
  userId: string;
}

const calculateAge = (birthDateStr: string) => {
  if (!birthDateStr) return '';
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age} anos`;
};

export function UserCRUD({ onUpdate, permission, userId }: UserCRUDProps) {
  const isAdmin = permission === 'Administrador';
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [allowedUnitIds, setAllowedUnitIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  
  const isReadOnly = !isAdmin && !allowedUnitIds.includes(selectedUnitId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateErrorInfo, setDuplicateErrorInfo] = useState<{ field: string; value: string; userName: string } | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState<{show: boolean, message: string}>({ show: false, message: '' });
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [viewingAttendanceUser, setViewingAttendanceUser] = useState<User | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    record_number: string;
    birth_date: string;
    gender: string;
    cpf: string;
    sus_card: string;
    cid_primary: string;
    cid_secondary: string;
    status: 'Ativo' | 'Inativo';
    unit_id: string;
    admission_date: string;
    death_date: string;
    phone_1: string;
    phone_2: string;
    dependency_degree: string;
    termination_date: string;
  }>({
    name: '',
    record_number: '',
    birth_date: '',
    gender: 'Feminino',
    cpf: '',
    sus_card: '',
    cid_primary: '',
    cid_secondary: '',
    status: 'Ativo',
    unit_id: '',
    admission_date: '',
    death_date: '',
    phone_1: '',
    phone_2: '',
    dependency_degree: '',
    termination_date: '',
  });

  const [isMounted, setIsMounted] = useState(false);
  
  const fetchUsers = async () => {
    if (!selectedUnitId) {
      setUsers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*, units(name)')
        .eq('unit_id', selectedUnitId)
        .order('name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      // Fetch all active units
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id, name')
        .eq('status', 'Ativo')
        .order('name');
      if (unitsError) throw unitsError;

      if (isAdmin) {
        setUnits(unitsData || []);
      } else {
        // Fetch permissions for the professional
        const { data: permissions, error: permError } = await supabase
          .from('system_user_units')
          .select('unit_id')
          .eq('system_user_id', userId);
        
        if (permError) throw permError;

        const allowedIds = (permissions || []).map((p: any) => p.unit_id);
        setAllowedUnitIds(allowedIds);

        // Filter units to only show those allowed
        const filteredUnits = (unitsData || []).filter((u: any) => allowedIds.includes(u.id));
        setUnits(filteredUnits);
      }
    } catch (err) {
      console.error('Erro ao buscar unidades ou permissões:', err);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchUnits();
  }, []);

  useEffect(() => {
    if (isMounted) {
      fetchUsers();
    }
  }, [selectedUnitId, isMounted]);

  const handleOpenModal = (user?: User) => {
    const hasAnyOptionalValue = !!(user && (
      user.admission_date ||
      user.death_date ||
      user.phone_1 ||
      user.phone_2 ||
      user.dependency_degree ||
      user.termination_date
    ));
    setShowOptionalFields(hasAnyOptionalValue);

    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        record_number: user.record_number || '',
        birth_date: user.birth_date,
        gender: user.gender,
        cpf: user.cpf,
        sus_card: user.sus_card,
        cid_primary: user.cid_primary || '',
        cid_secondary: user.cid_secondary || '',
        status: user.status,
        unit_id: user.unit_id || selectedUnitId,
        admission_date: user.admission_date || '',
        death_date: user.death_date || '',
        phone_1: user.phone_1 || '',
        phone_2: user.phone_2 || '',
        dependency_degree: user.dependency_degree || '',
        termination_date: user.termination_date || '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        record_number: '',
        birth_date: '',
        gender: 'Feminino',
        cpf: '',
        sus_card: '',
        cid_primary: '',
        cid_secondary: '',
        status: 'Ativo',
        unit_id: selectedUnitId,
        admission_date: '',
        death_date: '',
        phone_1: '',
        phone_2: '',
        dependency_degree: '',
        termination_date: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    // Validate CPF and CNS
    const cpfValidation = validateCPF(formData.cpf);
    
    // Only validate CPF format and validation digits for new registrations
    if (!editingUser) {
      if (!cpfValidation.isValid) {
        alert('CPF inválido. Por favor, verifique o número digitado.');
        return;
      }
    }

    const cnsValidation = formData.sus_card ? validateCNS(formData.sus_card) : { isValid: true, formatted: '' };

    if (!formData.name.trim()) {
      alert('Nome do usuário é obrigatório.');
      return;
    }

    if (!formData.unit_id) {
      alert('Selecione uma unidade para o usuário.');
      return;
    }

    if (!formData.record_number.trim()) {
      alert('O número de prontuário é obrigatório.');
      return;
    }

    if (formData.sus_card && !cnsValidation.isValid) {
      alert('Cartão SUS (CNS) inválido. Por favor, verifique o número digitado.');
      return;
    }

    // Validate CID codes
    if (formData.cid_primary && !validateCID(formData.cid_primary).isValid) {
      alert('Código CID Principal inválido. Use o formato CID-10 (Ex: F32) ou CID-11 (Ex: 6A70).');
      return;
    }

    if (formData.cid_secondary && !validateCID(formData.cid_secondary).isValid) {
      alert('Código CID Secundário inválido. Use o formato CID-10 (Ex: F32) ou CID-11 (Ex: 6A70).');
      return;
    }

    setIsSaving(true);
    const formattedCPF = cpfValidation.formatted;
    const formattedSUS = cnsValidation.formatted;
    const rawRecord = formData.record_number.trim();
    const formattedRecord = rawRecord.length > 0 && rawRecord.length < 3 ? rawRecord.padStart(3, '0') : rawRecord;

    try {
      // Check for Duplicates separately to be precise about which field triggered it
      // and ensure exact matches on all 11 digits of CPF
      
      // 1. Check for Record Number (Within same unit)
      const { data: recordDup, error: recordError } = await supabase
        .from('patients')
        .select('id, name')
        .eq('unit_id', formData.unit_id)
        .eq('record_number', formattedRecord)
        .neq('id', editingUser?.id || '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      if (recordError) throw recordError;
      if (recordDup) {
        setDuplicateErrorInfo({
          field: 'Número de Prontuário',
          value: formattedRecord,
          userName: recordDup.name
        });
        setIsDuplicateModalOpen(true);
        setIsSaving(false);
        return;
      }

      // 2. Check for SUS Card if provided (Within same unit)
      if (formattedSUS) {
        const { data: susDup, error: susError } = await supabase
          .from('patients')
          .select('id, name')
          .eq('unit_id', formData.unit_id)
          .eq('sus_card', formattedSUS)
          .neq('id', editingUser?.id || '00000000-0000-0000-0000-000000000000')
          .maybeSingle();

        if (susError) throw susError;
        if (susDup) {
          setDuplicateErrorInfo({
            field: 'Cartão SUS',
            value: formattedSUS,
            userName: susDup.name
          });
          setIsDuplicateModalOpen(true);
          setIsSaving(false);
          return;
        }
      }

      // Note: No explicit check for CPF uniqueness here as requested "por enquanto"

      const finalStatus = (formData.death_date || formData.termination_date) ? 'Inativo' : formData.status;

      const dataToSave = {
        ...formData,
        name: formData.name.trim(),
        record_number: formattedRecord,
        cpf: formattedCPF,
        sus_card: formattedSUS,
        cid_primary: formData.cid_primary.toUpperCase().trim(),
        cid_secondary: formData.cid_secondary.toUpperCase().trim(),
        unit_id: formData.unit_id || null,
        status: finalStatus,
        admission_date: formData.admission_date || null,
        death_date: formData.death_date || null,
        phone_1: formData.phone_1.trim() || null,
        phone_2: formData.phone_2.trim() || null,
        dependency_degree: formData.dependency_degree.trim() || null,
        termination_date: formData.termination_date || null,
      };

      if (editingUser) {
        const { error } = await supabase
          .from('patients')
          .update(dataToSave)
          .eq('id', editingUser.id);
        
        if (error) throw error;
        
        ActivityLogger.logEdition(
          'pacientes', 
          editingUser, 
          { ...editingUser, ...dataToSave }, 
          `Editou o cadastro do usuário/assistido "${editingUser.name}".`
        );
      } else {
        const { error } = await supabase
          .from('patients')
          .insert([dataToSave]);
        
        if (error) throw error;
        
        ActivityLogger.logCreation(
          'pacientes', 
          dataToSave, 
          `Criou o novo cadastro do usuário/assistido "${dataToSave.name}".`
        );
      }
      
      fetchUsers();
      if (onUpdate) onUpdate();
      
      const successMessage = editingUser 
        ? 'Dados do usuário atualizados com sucesso!' 
        : 'Usuário cadastrado com sucesso!';
      
      // Mostrar notificação customizada em vez de alert
      setShowSuccessToast({ show: true, message: successMessage });
      
      // Fechar automaticamente após 2 segundos
      setTimeout(() => setShowSuccessToast({ show: false, message: '' }), 2000);
      
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('ERRO CRÍTICO AO SALVAR:', err);
      
      if (err.code === '23505') {
        const detail = err.detail || err.message || '';
        const hint = err.hint || '';
        let field = 'campo (Prontuário, CPF ou SUS)';
        
        if (detail.includes('record_number')) field = 'Número de Prontuário';
        else if (detail.includes('sus_card')) field = 'Cartão SUS';
        else if (detail.includes('cpf')) field = 'CPF';

        alert(`CONFLITO DE DADOS (Erro 23505):
Este ${field} já está sendo usado por outro registro.

O banco de dados ainda possui uma trava de segurança que impede duplicatas. Por favor, execute o script SQL de limpeza total no Supabase ou verifique os dados digitados.

Detalhes: ${detail}
Dica: ${hint}`);
      } else {
        alert(`Não foi possível completar o cadastro.\nErro: ${err.message || 'Erro inesperado'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setUserToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleViewAttendance = async (user: User) => {
    setViewingAttendanceUser(user);
    setIsAttendanceModalOpen(true);
    setIsLoadingAttendance(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          day,
          month,
          year,
          projects(name),
          professionals(name),
          modalities(name)
        `)
        .eq('patient_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('day', { ascending: false });
      
      if (error) throw error;
      setAttendanceHistory(data || []);
    } catch (err) {
      console.error('Erro ao buscar histórico de atendimentos:', err);
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        // Integrity check: check if user has attendances
        const { data: attendanceData, error: attendanceCheckError } = await supabase
          .from('attendance')
          .select('id')
          .eq('patient_id', userToDelete)
          .limit(1);
        
        if (attendanceCheckError) throw attendanceCheckError;

        if (attendanceData && attendanceData.length > 0) {
          alert('Este usuário possui atendimentos registrados no sistema e não pode ser excluído por razões de integridade de dados. Por favor, remova ou reatribua os atendimentos antes de tentar excluir.');
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
          return;
        }

        const deletedObj = users.find(u => u.id === userToDelete);
        
        const { error } = await supabase
          .from('patients')
          .delete()
          .eq('id', userToDelete);
        
        if (error) throw error;
        
        if (deletedObj) {
          ActivityLogger.logDeletion(
            'pacientes', 
            deletedObj, 
            `Excluiu o cadastro do usuário/assistido "${deletedObj.name}".`
          );
        }
        
        fetchUsers();
        if (onUpdate) onUpdate();
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
      } catch (err) {
        console.error('Erro ao excluir usuário:', err);
        alert('Ocorreu um erro ao excluir o usuário.');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.cpf.includes(searchTerm) ||
      u.record_number?.includes(searchTerm);
    const matchesUnit = u.unit_id === selectedUnitId;
    return matchesSearch && matchesUnit;
  });

  const activeUsersCount = users.filter(u => u.status === 'Ativo').length;

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] shadow-sm border border-[#e8bcb7]/10">
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 space-y-1.5 sm:space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]">Selecione a Unidade para Gerenciar Usuários</label>
              {selectedUnitId && !isLoading && (
                <div className="flex items-center gap-1.5">
                  <UserCheck size={12} className="text-green-600" />
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {activeUsersCount} {activeUsersCount === 1 ? 'Usuário Ativo' : 'Usuários Ativos'}
                  </span>
                </div>
              )}
            </div>
            <select 
              className="w-full bg-[#f4f3f5] border-0 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
            >
              <option value="">Selecione uma unidade...</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={cn(
        "space-y-6 transition-all duration-300",
        !selectedUnitId ? "opacity-40 pointer-events-none grayscale" : "opacity-100"
      )}>
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="relative flex-1 max-w-none md:max-w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-40" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou CPF..."
              className="w-full bg-white border-0 rounded-xl py-3 pl-10 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!selectedUnitId}
            />
          </div>
          
          {!isReadOnly && (
            <button 
              onClick={() => handleOpenModal()}
              disabled={!selectedUnitId}
              className="bg-[#ed1c24] text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus size={18} />
              Novo Usuário
            </button>
          )}
        </div>

        <div className="bg-white rounded-[1.5rem] shadow-sm overflow-hidden border border-[#e8bcb7]/10">
          {!selectedUnitId ? (
            <div className="py-20 text-center">
              <div className="flex flex-col items-center gap-4 opacity-60">
                <AlertCircle size={48} className="text-[#5e3f3b]" />
                <div className="space-y-1">
                  <p className="text-lg font-bold text-[#1a1c1d]">
                    {!isAdmin && units.length === 0 
                      ? 'Sem permissão de cadastro' 
                      : 'Unidade não selecionada'}
                  </p>
                  <p className="text-sm text-[#5e3f3b]">
                    {!isAdmin && units.length === 0 
                      ? 'Você não possui permissão para cadastrar usuários em nenhuma unidade. Entre em contato com o administrador.' 
                      : 'Selecione uma unidade acima para visualizar e gerenciar os usuários.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto scrollbar-thin hidden md:block">
          <table className="w-full border-collapse min-w-full">
            <thead>
              <tr className="bg-[#f4f3f5]">
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]">Usuário / Prontuário</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]">CPF</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]">Nascimento</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f3f5]">
              {filteredUsers.map((user) => (
                <tr 
                  key={user.id} 
                  onClick={() => setViewingUser(user)}
                  className="hover:bg-[#faf9fb] transition-all duration-200 group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24] font-black text-xs shrink-0 group-hover:bg-[#ed1c24] group-hover:text-white transition-all duration-300">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-[#1a1c1d] group-hover:text-[#ed1c24] transition-colors truncate">{user.name}</span>
                        <span className="text-[10px] font-bold text-[#ed1c24] uppercase tracking-wider">Nº {user.record_number.padStart(3, '0')}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-[#1a1c1d] whitespace-nowrap">
                      {user.cpf || <span className="text-[#5e3f3b]/30 italic text-xs">Não informado</span>}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-[#1a1c1d] whitespace-nowrap">
                        {isMounted && user.birth_date ? formatDate(user.birth_date) : ''}
                      </span>
                      {user.birth_date && (
                        <span className="text-[10px] font-bold text-[#ed1c24] tracking-wide mt-0.5">
                          {calculateAge(user.birth_date)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      user.status === 'Ativo' ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                    )}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5 items-center">
                      <button 
                        onClick={() => handleViewAttendance(user)}
                        title="Ver Histórico de Atendimentos"
                        className="p-2 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/10 rounded-lg transition-all active:scale-90"
                      >
                        <History size={16} />
                      </button>
                      {!isReadOnly ? (
                        <>
                          <button 
                            onClick={() => handleOpenModal(user)}
                            title="Editar Usuário"
                            className="p-2 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/10 rounded-lg transition-all active:scale-90"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(user.id)}
                            title="Excluir Usuário"
                            className="p-2 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/10 rounded-lg transition-all active:scale-90"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-40 ml-2">Visualização</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <AlertCircle size={32} />
                      <p className="text-sm font-medium">Nenhum usuário encontrado nesta unidade.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-[#f4f3f5]">
          {filteredUsers.map((user) => (
            <div 
              key={user.id} 
              onClick={() => setViewingUser(user)}
              className="p-5 space-y-4 hover:bg-[#faf9fb] active:bg-[#f4f3f5] transition-all duration-200 cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24] font-black text-sm shrink-0 group-hover:bg-[#ed1c24] group-hover:text-white transition-all duration-300 uppercase">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-[#1a1c1d] group-hover:text-[#ed1c24] transition-colors truncate">{user.name}</span>
                    <span className="text-[10px] font-bold text-[#ed1c24] uppercase tracking-wider">Prontuário: {user.record_number.padStart(3, '0')}</span>
                  </div>
                </div>
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider",
                  user.status === 'Ativo' ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                )}>
                  {user.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#f4f3f5]/55 p-4 rounded-2xl text-xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40 mb-0.5">CPF</span>
                  <span className="font-bold text-[#1a1c1d]">{user.cpf || 'Não informado'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40 mb-0.5">Nascimento</span>
                  <span className="font-bold text-[#1a1c1d]">
                    {isMounted && user.birth_date ? formatDate(user.birth_date) : ''}
                    {user.birth_date && ` (${calculateAge(user.birth_date)})`}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => handleViewAttendance(user)}
                  className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 bg-[#f4f3f5] text-[#5e3f3b] py-2.5 px-3 rounded-xl text-xs font-bold active:scale-95"
                >
                  <History size={14} />
                  <span>Histórico</span>
                </button>
                {!isReadOnly ? (
                  <>
                    <button 
                      onClick={() => handleOpenModal(user)}
                      className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 bg-[#f4f3f5] text-[#5e3f3b] py-2.5 px-3 rounded-xl text-xs font-bold active:scale-95"
                    >
                      <Edit2 size={14} />
                      <span>Editar</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(user.id)}
                      className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 bg-[#ed1c24]/10 text-[#ed1c24] py-2.5 px-2 rounded-xl text-xs font-bold active:scale-95"
                    >
                      <Trash2 size={14} />
                      <span>Excluir</span>
                    </button>
                  </>
                ) : (
                  <span className="flex-1 text-center py-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-40">Visualização</span>
                )}
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-2 opacity-40">
                <AlertCircle size={32} />
                <p className="text-xs font-bold">Nenhum usuário encontrado nesta unidade.</p>
              </div>
            </div>
          )}
        </div>
      </>
    )}
  </div>
</div>

      {/* Notificação de Sucesso */}
      {showSuccessToast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-green-600 text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 border border-white/20">
            <div className="bg-white rounded-full p-1.5 shadow-sm">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div className="flex flex-col pr-2">
              <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 opacity-80">Sucesso</span>
              <span className="text-sm font-bold whitespace-nowrap">{showSuccessToast.message}</span>
            </div>
            <button 
              onClick={() => setShowSuccessToast({ show: false, message: '' })}
              className="ml-2 hover:bg-white/10 p-1 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Error Modal */}
      {isDuplicateModalOpen && duplicateErrorInfo && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsDuplicateModalOpen(false)}
            className="absolute inset-0 bg-[#1a1c1d]/40 backdrop-blur-sm"
          />
          <div 
            className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden p-6 sm:p-8 text-center border-t-4 border-[#ed1c24]"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-50 text-[#ed1c24] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <AlertCircle size={24} className="sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-[#1a1c1d] mb-2">Registro Duplicado</h2>
            <div className="bg-[#f4f3f5] p-4 rounded-2xl mb-6 text-left space-y-2">
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]">Campo Duplicado</p>
              <p className="text-xs sm:text-sm font-bold text-[#ed1c24]">{duplicateErrorInfo.field}: {duplicateErrorInfo.value}</p>
              <div className="pt-2 border-t border-[#e8bcb7]/20">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]">Já cadastrado para:</p>
                <p className="text-xs sm:text-sm font-bold text-[#1a1c1d]">{duplicateErrorInfo.userName}</p>
              </div>
            </div>
            <p className="text-[11px] sm:text-xs text-[#5e3f3b] mb-6 sm:mb-8">
              Por favor, verifique os dados informados ou localize o cadastro existente para realizar alterações.
            </p>
            <button 
              onClick={() => setIsDuplicateModalOpen(false)}
              className="w-full bg-[#1a1c1d] text-white font-bold py-3 rounded-xl text-sm shadow-lg hover:bg-[#2a2c2d] transition-all active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Detalhes do Usuário Modal */}
      {viewingUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div 
            onClick={() => setViewingUser(null)}
            className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
          />
          <div 
            className="relative w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] bg-white rounded-[2.5rem] shadow-[0_25px_60px_rgba(29,28,26,0.18)] overflow-hidden flex flex-col border border-[#e8bcb7]/15 animate-in fade-in zoom-in-95 duration-205"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#f4f3f5] flex justify-between items-center bg-[#faf9fb]/90 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ed1c24]/5 to-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24] border border-[#ed1c24]/15">
                  <User size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#1a1c1d] tracking-tight leading-none">
                    Dados do Usuário
                  </h2>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#5e3f3b] opacity-50 mt-1">
                    Ficha cadastral completa
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingUser(null)}
                className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-red-100 hover:scrollbar-thumb-red-200 scrollbar-track-transparent">
              {/* Badge Identificação */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-gradient-to-br from-[#faf9fb] via-[#faf9fb] to-[#ed1c24]/5 p-5 rounded-[1.75rem] border border-[#e8bcb7]/15 text-center sm:text-left">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ed1c24] to-[#d01920] text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-[#ed1c24]/20 shrink-0 uppercase">
                  {viewingUser.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1 space-y-2 animate-in slide-in-from-left-2 duration-200">
                  <div className="flex items-center justify-center sm:justify-start flex-wrap gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#ed1c24] bg-[#ed1c24]/10 px-2.5 py-1 rounded-lg leading-none">
                      Nº Prontuário: {viewingUser.record_number.padStart(3, '0')}
                    </span>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg leading-none",
                      viewingUser.status === 'Ativo' ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                    )}>
                      {viewingUser.status}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#1a1c1d] leading-snug tracking-tight select-all">
                      {viewingUser.name}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-xs font-semibold text-[#5e3f3b]/70 mt-1">
                      <span>{isMounted && viewingUser.birth_date ? formatDate(viewingUser.birth_date) : ''}</span>
                      <span className="w-1 h-1 rounded-full bg-[#5e3f3b]/30 hidden sm:inline" />
                      <span className="text-[#ed1c24] font-bold">{calculateAge(viewingUser.birth_date)}</span>
                      <span className="w-1 h-1 rounded-full bg-[#5e3f3b]/30 hidden sm:inline" />
                      <span>{viewingUser.gender}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações Complementares Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Unidade */}
                <div className="bg-[#faf9fb]/60 border border-[#f4f3f5] p-3.5 rounded-xl flex items-center gap-3.5 sm:col-span-2">
                  <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#ed1c24] shadow-sm border border-[#f4f3f5] shrink-0">
                    <MapPin size={15} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#5e3f3b]/50 leading-none mb-1">Unidade Vinculada</span>
                    <span className="text-xs font-semibold text-[#1a1c1d] truncate">
                      {viewingUser.units?.name || <span className="text-red-400 font-normal italic">Não cadastrada/Não vinculada</span>}
                    </span>
                  </div>
                </div>

                {/* Documentos */}
                <div className="bg-[#faf9fb]/40 border border-[#f4f3f5] p-4 rounded-2xl flex flex-col justify-between space-y-3 hover:border-[#e8bcb7]/30 transition-colors">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-60 flex items-center gap-1.5 select-none">
                    <CreditCard size={12} className="text-[#ed1c24]" /> Documentos oficiais
                  </span>
                  <div className="space-y-2 pt-0.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">CPF</span>
                      <span className="font-bold text-[#1a1c1d] font-mono select-all tracking-wide">
                        {viewingUser.cpf || <span className="opacity-30 font-normal font-sans italic text-[11px]">Não inf.</span>}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-[#f4f3f5]">
                      <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">CNS (SUS)</span>
                      <span className="font-bold text-[#1a1c1d] font-mono select-all tracking-wide">
                        {viewingUser.sus_card || <span className="opacity-30 font-normal font-sans italic text-[11px]">Não inf.</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CIDs */}
                <div className="bg-[#faf9fb]/40 border border-[#f4f3f5] p-4 rounded-2xl flex flex-col justify-between space-y-3 hover:border-[#e8bcb7]/30 transition-colors">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-60 flex items-center gap-1.5 select-none">
                    <Activity size={12} className="text-[#ed1c24]" /> Códigos CID
                  </span>
                  <div className="space-y-2 pt-0.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">CID Principal</span>
                      <span className="font-bold text-[#1a1c1d] flex items-center gap-1.5 font-mono">
                        {viewingUser.cid_primary || <span className="opacity-30 font-normal font-sans italic text-[11px]">Nenhum</span>}
                        {viewingUser.cid_primary && (
                          <span className={cn(
                            "text-[8px] font-black px-1.5 rounded-md leading-none py-0.5",
                            validateCID(viewingUser.cid_primary).isValid ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                          )}>
                            {validateCID(viewingUser.cid_primary).isValid ? validateCID(viewingUser.cid_primary).type : '!'}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-[#f4f3f5]">
                      <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">CID Secundário</span>
                      <span className="font-bold text-[#1a1c1d] flex items-center gap-1.5 font-mono">
                        {viewingUser.cid_secondary || <span className="opacity-30 font-normal font-sans italic text-[11px]">Nenhum</span>}
                        {viewingUser.cid_secondary && (
                          <span className={cn(
                            "text-[8px] font-black px-1.5 rounded-md leading-none py-0.5",
                            validateCID(viewingUser.cid_secondary).isValid ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                          )}>
                            {validateCID(viewingUser.cid_secondary).isValid ? validateCID(viewingUser.cid_secondary).type : '!'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dados Complementares (Se existirem) */}
                {(viewingUser.admission_date || viewingUser.termination_date || viewingUser.death_date || viewingUser.dependency_degree) && (
                  <div className="bg-[#faf9fb]/40 border border-[#f4f3f5] p-4 rounded-2xl space-y-3 sm:col-span-2 hover:border-[#e8bcb7]/30 transition-colors">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-60 flex items-center gap-1.5 select-none font-sans">
                      <Calendar size={12} className="text-[#ed1c24]" /> Contrato & Clínico Complementar
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1 text-xs">
                      {viewingUser.admission_date && (
                        <div className="flex justify-between items-center py-1 border-b border-[#f4f3f5]/55">
                          <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">Admissão</span>
                          <span className="font-bold text-[#1a1c1d]">{isMounted ? formatDate(viewingUser.admission_date) : ''}</span>
                        </div>
                      )}
                      {viewingUser.dependency_degree && (
                        <div className="flex justify-between items-center py-1 border-b border-[#f4f3f5]/55">
                          <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">Grau Dependência</span>
                          <span className="font-bold text-[#1a1c1d]">{viewingUser.dependency_degree}</span>
                        </div>
                      )}
                      {viewingUser.termination_date && (
                        <div className="flex justify-between items-center py-1 border-b border-[#f4f3f5]/55">
                          <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">Distrato</span>
                          <span className="font-extrabold text-[#e06820]/90">{isMounted ? formatDate(viewingUser.termination_date) : ''}</span>
                        </div>
                      )}
                      {viewingUser.death_date && (
                        <div className="flex justify-between items-center py-1 border-b border-[#f4f3f5]/55">
                          <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">Óbito</span>
                          <span className="font-extrabold text-red-600">{isMounted ? formatDate(viewingUser.death_date) : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contatos de Emergência (Se existirem) */}
                {(viewingUser.phone_1 || viewingUser.phone_2) && (
                  <div className="bg-[#faf9fb]/40 border border-[#f4f3f5] p-4 rounded-2xl space-y-3 sm:col-span-2 hover:border-[#e8bcb7]/30 transition-colors">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-60 flex items-center gap-1.5 select-none">
                      <FileText size={12} className="text-[#ed1c24]" /> Contatos de Emergência
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1 text-xs">
                      {viewingUser.phone_1 && (
                        <div className="flex justify-between items-center py-1 border-b border-[#f4f3f5]/55">
                          <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">Telefone Principal</span>
                          <span className="font-bold text-[#1a1c1d] font-mono select-all tracking-wide">{viewingUser.phone_1}</span>
                        </div>
                      )}
                      {viewingUser.phone_2 && (
                        <div className="flex justify-between items-center py-1 border-b border-[#f4f3f5]/55">
                          <span className="text-[#5e3f3b]/60 font-bold text-[10px] uppercase tracking-wider">Telefone Alternativo</span>
                          <span className="font-bold text-[#1a1c1d] font-mono select-all tracking-wide">{viewingUser.phone_2}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-[#f4f3f5] flex gap-3 bg-[#faf9fb]/80 backdrop-blur-md">
              <button 
                type="button"
                onClick={() => setViewingUser(null)}
                className="flex-1 bg-[#f4f3f5] text-[#5e3f3b] font-bold py-3.5 rounded-2xl text-xs hover:bg-[#e9e8ea] hover:text-[#1a1c1d] transition-all active:scale-95"
              >
                Fechar
              </button>
              {!isReadOnly && (
                <button 
                  type="button"
                  onClick={() => {
                    const savedUser = viewingUser;
                    setViewingUser(null);
                    handleOpenModal(savedUser);
                  }}
                  className="flex-[1.5] bg-[#ed1c24] text-white font-bold py-3.5 rounded-2xl text-xs shadow-[0_8px_20px_rgba(237,28,36,0.18)] hover:bg-[#d01920] transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Edit2 size={13} className="stroke-[2.5]" />
                  Editar Usuário
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#ed1c24]/10 text-[#ed1c24] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Trash2 size={24} className="sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#1a1c1d] mb-2">Excluir Usuário</h2>
              <p className="text-xs sm:text-sm text-[#5e3f3b] mb-6 sm:mb-8">
                Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
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
                  className="flex-1 bg-[#ed1c24] text-white font-bold py-3 rounded-xl text-sm shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d01920] transition-all"
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
                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                  </h2>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Nome Completo</label>
                      <input 
                        required
                        type="text" 
                        className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Nº Prontuário</label>
                      <input 
                        required
                        type="text" 
                        inputMode="numeric"
                        className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none"
                        value={formData.record_number}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                          setFormData({...formData, record_number: val});
                        }}
                        onBlur={(e) => {
                          if (e.target.value) {
                            setFormData({...formData, record_number: e.target.value.padStart(3, '0')});
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Data de Nascimento</label>
                      <input 
                        required
                        type="date" 
                        className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none"
                        value={formData.birth_date}
                        onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Sexo</label>
                      <select 
                        className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer"
                        value={formData.gender}
                        onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      >
                        <option value="Feminino">Feminino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">CPF</label>
                      <input 
                        required
                        type="text" 
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        className={cn(
                          "w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 outline-none",
                          !editingUser && formData.cpf && !validateCPF(formData.cpf).isValid 
                            ? "ring-2 ring-red-500 bg-red-50 text-red-900" 
                            : "focus:ring-[#ed1c24]"
                        )}
                        value={formData.cpf}
                        onChange={(e) => setFormData({...formData, cpf: maskCPF(e.target.value)})}
                        onBlur={(e) => {
                          const val = validateCPF(e.target.value);
                          setFormData({...formData, cpf: val.formatted});
                        }}
                      />
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Cartão SUS</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        placeholder="000 0000 0000 0000"
                        className={cn(
                          "w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 outline-none",
                          formData.sus_card && !validateCNS(formData.sus_card).isValid ? "ring-2 ring-red-500" : "focus:ring-[#ed1c24]"
                        )}
                        value={formData.sus_card}
                        onChange={(e) => setFormData({...formData, sus_card: maskCNS(e.target.value)})}
                        onBlur={(e) => {
                          if (e.target.value) {
                            const val = validateCNS(e.target.value);
                            if (val.isValid) setFormData({...formData, sus_card: val.formatted});
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1 flex justify-between items-center">
                        <span>CID Principal</span>
                        {formData.cid_primary && (
                          <span className={cn(
                            "text-[8px] px-1.5 py-0.5 rounded",
                            validateCID(formData.cid_primary).isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {validateCID(formData.cid_primary).type || 'Inválido'}
                          </span>
                        )}
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: F32 ou 6A70"
                        className={cn(
                          "w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 outline-none uppercase",
                          formData.cid_primary && !validateCID(formData.cid_primary).isValid ? "ring-2 ring-red-500" : "focus:ring-[#ed1c24]"
                        )}
                        value={formData.cid_primary}
                        onChange={(e) => setFormData({...formData, cid_primary: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1 flex justify-between items-center">
                        <span>CID Secundário</span>
                        {formData.cid_secondary && (
                          <span className={cn(
                            "text-[8px] px-1.5 py-0.5 rounded",
                            validateCID(formData.cid_secondary).isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {validateCID(formData.cid_secondary).type || 'Inválido'}
                          </span>
                        )}
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: F32.1 ou MG2A"
                        className={cn(
                          "w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 outline-none uppercase",
                          formData.cid_secondary && !validateCID(formData.cid_secondary).isValid ? "ring-2 ring-red-500" : "focus:ring-[#ed1c24]"
                        )}
                        value={formData.cid_secondary}
                        onChange={(e) => setFormData({...formData, cid_secondary: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Unidade</label>
                      <select 
                        className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer"
                        value={formData.unit_id}
                        onChange={(e) => setFormData({...formData, unit_id: e.target.value})}
                      >
                        <option value="">Selecione uma unidade</option>
                        {units.map(unit => (
                          <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Status</label>
                      <select 
                        className="w-full bg-[#f4f3f5] border-0 rounded-xl py-2.5 sm:py-3 px-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        value={formData.status}
                        disabled={!!(formData.death_date || formData.termination_date)}
                        onChange={(e) => setFormData({...formData, status: e.target.value as 'Ativo' | 'Inativo'})}
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                      {!!(formData.death_date || formData.termination_date) && (
                        <p className="text-[9px] text-[#ed1c24] font-bold mt-0.5 leading-tight">Inativado devido à data de óbito ou distrato preenchida.</p>
                      )}
                    </div>
                  </div>

                  {/* Botão de Expansão de Informações Opcionais */}
                  <div className="pt-2 border-t border-[#f4f3f5]">
                    <button
                      type="button"
                      onClick={() => setShowOptionalFields(!showOptionalFields)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 sm:p-4 rounded-xl border border-dashed text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200",
                        showOptionalFields
                          ? "bg-[#ed1c24]/5 border-[#ed1c24]/30 text-[#ed1c24] hover:bg-[#ed1c24]/10"
                          : "bg-[#faf9fb] border-[#e8bcb7]/30 text-[#5e3f3b]/70 hover:bg-[#f4f3f5]"
                      )}
                    >
                      <span className="flex items-center gap-2 select-none">
                        {showOptionalFields ? '−' : '+'} Dados Opcionais e Complementares
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold opacity-60 select-none">
                        {showOptionalFields ? 'Ocultar campos' : 'Exibir mais campos'}
                      </span>
                    </button>
                  </div>

                  {showOptionalFields && (
                    <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#faf9fb] p-4 rounded-2xl border border-[#f4f3f5]">
                        
                        {/* Data de Admissão */}
                        <div className="space-y-1.5 sm:space-y-2">
                          <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-1">Data de Admissão</label>
                          <input 
                            type="date" 
                            className="w-full bg-white border border-[#f4f3f5] rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-[#ed1c24] outline-none"
                            value={formData.admission_date}
                            onChange={(e) => setFormData({...formData, admission_date: e.target.value})}
                          />
                        </div>

                        {/* Grau de Dependência */}
                        <div className="space-y-1.5 sm:space-y-2">
                          <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-1">Grau de Dependência</label>
                          <input 
                            type="text" 
                            placeholder="Ex: Baixo, Médio, Elevado"
                            className="w-full bg-white border border-[#f4f3f5] rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-[#ed1c24] outline-none"
                            value={formData.dependency_degree}
                            onChange={(e) => setFormData({...formData, dependency_degree: e.target.value})}
                          />
                        </div>

                        {/* Telefone 1 */}
                        <div className="space-y-1.5 sm:space-y-2">
                          <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-1">Telefone Familiar 1</label>
                          <input 
                            type="text" 
                            placeholder="(00) 00000-0000"
                            className="w-full bg-white border border-[#f4f3f5] rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-[#ed1c24] outline-none"
                            value={formData.phone_1}
                            onChange={(e) => setFormData({...formData, phone_1: e.target.value})}
                          />
                        </div>

                        {/* Telefone 2 */}
                        <div className="space-y-1.5 sm:space-y-2">
                          <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-1">Telefone Familiar 2</label>
                          <input 
                            type="text" 
                            placeholder="(00) 00000-0000"
                            className="w-full bg-white border border-[#f4f3f5] rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-[#ed1c24] outline-none"
                            value={formData.phone_2}
                            onChange={(e) => setFormData({...formData, phone_2: e.target.value})}
                          />
                        </div>

                        {/* Data de Distrato de Contrato */}
                        <div className="space-y-1.5 sm:space-y-2">
                          <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-1">Data de Distrato</label>
                          <input 
                            type="date" 
                            className="w-full bg-white border border-[#f4f3f5] rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-[#ed1c24] outline-none"
                            value={formData.termination_date}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextStatus = val ? 'Inativo' : formData.status;
                              setFormData({
                                ...formData, 
                                termination_date: val,
                                status: nextStatus
                              });
                            }}
                          />
                          {formData.termination_date && (
                            <p className="text-[9px] text-[#ed1c24] font-bold">Inativará o usuário automaticamente</p>
                          )}
                        </div>

                        {/* Data de Óbito */}
                        <div className="space-y-1.5 sm:space-y-2">
                          <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-1">Data de Óbito</label>
                          <input 
                            type="date" 
                            className="w-full bg-white border border-[#f4f3f5] rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-[#ed1c24] outline-none"
                            value={formData.death_date}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextStatus = val ? 'Inativo' : formData.status;
                              setFormData({
                                ...formData, 
                                death_date: val,
                                status: nextStatus
                              });
                            }}
                          />
                          {formData.death_date && (
                            <p className="text-[9px] text-[#ed1c24] font-bold">Inativará o usuário automaticamente</p>
                          )}
                        </div>

                      </div>
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
                      className="flex-1 bg-[#ed1c24] text-white font-bold py-3 rounded-xl text-sm shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d01920] transition-all disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
                    >
                      {isSaving ? 'Salvando...' : (editingUser ? 'Salvar Alterações' : 'Criar Usuário')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      {/* Attendance History Modal */}
      {isAttendanceModalOpen && viewingAttendanceUser && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsAttendanceModalOpen(false)}
            className="absolute inset-0 bg-[#1a1c1d]/40 backdrop-blur-sm"
          />
          <div 
            className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 sm:p-8 border-b border-[#f4f3f5] flex justify-between items-center bg-[#f4f3f5]/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#ed1c24] shadow-sm">
                  <History size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#1a1c1d]">Histórico de Atendimentos</h2>
                  <p className="text-xs font-bold text-[#ed1c24] uppercase tracking-widest">{viewingAttendanceUser.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAttendanceModalOpen(false)}
                className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-thin">
              {isLoadingAttendance ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-4 border-[#ed1c24]/20 border-t-[#ed1c24] rounded-full animate-spin" />
                  <p className="text-[10px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest">Carregando histórico...</p>
                </div>
              ) : attendanceHistory.length > 0 ? (
                <div className="space-y-4">
                  {attendanceHistory.map((item, index) => (
                    <div 
                      key={item.id || index}
                      className="bg-[#f4f3f5]/50 border border-[#e8bcb7]/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white flex flex-col items-center justify-center shadow-sm text-[#1a1c1d] group-hover:bg-[#ed1c24] group-hover:text-white transition-colors">
                          <span className="text-[14px] font-black leading-none">{String(item.day).padStart(2, '0')}</span>
                          <span className="text-[8px] font-bold uppercase">{new Date(2000, item.month - 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-[#ed1c24]" />
                            <span className="text-xs font-bold text-[#1a1c1d]">
                              {String(item.day).padStart(2, '0')}/{String(item.month).padStart(2, '0')}/{item.year}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 opacity-70">
                            <Layers size={12} className="text-[#5e3f3b]" />
                            <span className="text-[10px] font-medium text-[#5e3f3b]">
                              {item.projects?.name} • {item.modalities?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-[#e8bcb7]/5">
                        <UserCheck size={14} className="text-green-600" />
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-50">Profissional</span>
                          <span className="text-[10px] font-bold text-[#1a1c1d]">{item.professionals?.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-[#f4f3f5] rounded-full flex items-center justify-center mx-auto text-[#5e3f3b] opacity-20">
                    <History size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[#1a1c1d]">Nenhum atendimento registrado</p>
                    <p className="text-xs text-[#5e3f3b] opacity-60">Este usuário ainda não possui registros de presença no sistema.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-[#f4f3f5]/30 border-t border-[#f4f3f5]">
              <button 
                onClick={() => setIsAttendanceModalOpen(false)}
                className="w-full bg-[#1a1c1d] text-white font-bold py-3 rounded-xl text-sm shadow-lg hover:bg-[#2a2c2d] transition-all active:scale-95"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

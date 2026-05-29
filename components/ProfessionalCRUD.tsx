'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Edit2, 
  Trash2, 
  UserPlus,
  X,
  AlertCircle,
  Contact,
  User,
  Briefcase,
  Lock,
  CheckCircle2,
  Shield,
  Layers,
  Activity,
  Building2,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { validateCPF, maskCPF } from '@/lib/validators';
import { motion, AnimatePresence } from 'motion/react';
import { ActivityLogger } from '@/lib/activity_logger';

interface Professional {
  id: string;
  name: string;
  specialty: string;
  registration: string;
  cpf: string;
  status: 'Ativo' | 'Inativo';
  modalities: string[];
  projects: string[];
  units: string[];
  created_at: string;
  username?: string;
  hasPassword?: boolean;
  password?: string;
  userId?: string;
}

interface ProfessionalCRUDProps {
  onUpdate?: () => void;
  permission: string;
  onNavigateToSystemUsers?: (username: string) => void;
}

export function ProfessionalCRUD({ onUpdate, permission, onNavigateToSystemUsers }: ProfessionalCRUDProps) {
  const isReadOnly = permission === 'Profissional';
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [availableModalities, setAvailableModalities] = useState<any[]>([]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [projectGoals, setProjectGoals] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Professional | null>(null);
  const [selectedProfessionalForDetails, setSelectedProfessionalForDetails] = useState<Professional | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [hasExistingUser, setHasExistingUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Inativo'>('Todos');
  const [accessFilter, setAccessFilter] = useState<'Todos' | 'com_senha' | 'sem_senha'>('Todos');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [unitSearchWord, setUnitSearchWord] = useState('');
  
  const [formData, setFormData] = useState<{
    name: string;
    specialty: string;
    registration: string;
    cpf: string;
    status: 'Ativo' | 'Inativo';
    modalities: string[];
    projects: string[];
    units: string[];
    username?: string;
    password?: string;
  }>({
    name: '',
    specialty: '',
    registration: '',
    cpf: '',
    status: 'Ativo',
    modalities: [],
    projects: [],
    units: [],
    username: '',
    password: '',
  });

  useEffect(() => {
    if (!selectedProfessionalForDetails) {
      setIsPasswordVisible(false);
    }
  }, [selectedProfessionalForDetails]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch system users usernames, passwords, emails and ids to assess if professional has passwords/users
      const { data: usersData } = await supabase
        .from('system_users')
        .select('id, username, password, email');

      // Helper to generate expected username for a given name
      const getProfessionalUsername = (name: string) => {
        const nameParts = name.trim().split(' ');
        let username = '';
        if (nameParts.length >= 2) {
          username = `${nameParts[0].toLowerCase()}.${nameParts[nameParts.length - 1].toLowerCase()}`;
        } else {
          username = nameParts[0].toLowerCase();
        }
        return username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, "");
      };

      // Fetch professionals
      const { data: profs, error: profsError } = await supabase
        .from('professionals')
        .select(`
          *,
          professional_projects(project_id, projects(name)),
          professional_modalities(modality_id, modalities(name)),
          professional_units(unit_id, units(name))
        `)
        .order('name');
      
      if (profsError) throw profsError;

      // Map relationships
      const mappedProfs = (profs || []).map((p: any) => {
        // Find associated system user
        // 1. Try by email starting with prof_UUID to support custom usernames
        let associatedUser = (usersData || []).find((u: any) => u.email && u.email.startsWith(`prof_${p.id}`));
        
        const defaultUsername = getProfessionalUsername(p.name);
        
        // 2. Fallback: match by default computed username
        if (!associatedUser) {
          associatedUser = (usersData || []).find((u: any) => u.username.toLowerCase() === defaultUsername.toLowerCase());
        }

        const username = associatedUser ? associatedUser.username : defaultUsername;
        const hasPassword = !!associatedUser;
        return {
          ...p,
          projects: p.professional_projects.map((pp: any) => pp.projects.name),
          modalities: p.professional_modalities.map((pm: any) => pm.modalities.name),
          units: p.professional_units.map((pu: any) => pu.units.name),
          username: username,
          hasPassword: hasPassword,
          password: hasPassword ? associatedUser.password : undefined,
          userId: associatedUser ? associatedUser.id : undefined
        };
      });
      setProfessionals(mappedProfs);

      // Fetch modalities, projects and units for the form
      const { data: mods } = await supabase.from('modalities').select('*').eq('status', 'Ativo');
      const { data: projs } = await supabase.from('projects').select('*').eq('status', 'Ativo');
      const { data: unts } = await supabase.from('units').select('*').eq('status', 'Ativo');
      const { data: goals } = await supabase.from('project_goals').select('project_id, modality_id');
      
      setAvailableModalities(mods || []);
      setAvailableProjects(projs || []);
      setAvailableUnits(unts || []);
      setProjectGoals(goals || []);
    } catch (err) {
      console.error('Erro ao buscar profissionais:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = async (item?: Professional) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        specialty: item.specialty,
        registration: item.registration,
        cpf: item.cpf,
        status: item.status,
        modalities: item.modalities || [],
        projects: item.projects || [],
        units: item.units || [],
        username: item.username || '',
        password: '',
      });

      setHasExistingUser(!!item.userId);
    } else {
      setEditingItem(null);
      setHasExistingUser(false);
      setFormData({
        name: '',
        specialty: '',
        registration: '',
        cpf: '',
        status: 'Ativo',
        modalities: [],
        projects: [],
        units: [],
        username: '',
        password: '',
      });
    }
    setIsModalOpen(true);
  };

  const toggleModality = (modalityName: string) => {
    if (formData.projects.length === 0) return;
    
    setFormData(prev => {
      const isSelected = prev.modalities.includes(modalityName);
      if (isSelected) {
        return { ...prev, modalities: prev.modalities.filter(m => m !== modalityName) };
      } else {
        return { ...prev, modalities: [...prev.modalities, modalityName] };
      }
    });
  };

  const toggleUnit = (unitName: string) => {
    setFormData(prev => {
      const isSelected = prev.units.includes(unitName);
      let newUnits;
      if (isSelected) {
        newUnits = prev.units.filter(u => u !== unitName);
      } else {
        newUnits = [...prev.units, unitName];
      }
      
      // Filter out projects that are not in the selected units
      const selectedUnitIds = availableUnits
        .filter(u => newUnits.includes(u.name))
        .map(u => u.id);
      
      const newProjects = prev.projects.filter(projName => {
        const project = availableProjects.find(p => p.name === projName);
        return project && (!project.unit_id || selectedUnitIds.includes(project.unit_id));
      });

      // Filter out modalities that are not in the remaining projects
      const remainingProjectIds = availableProjects
        .filter(p => newProjects.includes(p.name))
        .map(p => p.id);
      
      const newModalities = prev.modalities.filter(modalityName => {
        const modality = availableModalities.find(m => m.name === modalityName);
        return modality && projectGoals.some(goal => 
          remainingProjectIds.includes(goal.project_id) && 
          goal.modality_id === modality.id
        );
      });

      return { 
        ...prev, 
        units: newUnits, 
        projects: newProjects,
        modalities: newModalities
      };
    });
  };

  const toggleProject = (projectName: string) => {
    setFormData(prev => {
      const isSelected = prev.projects.includes(projectName);
      let newProjects;
      if (isSelected) {
        newProjects = prev.projects.filter(p => p !== projectName);
      } else {
        newProjects = [...prev.projects, projectName];
      }
      
      // Se nenhum projeto estiver selecionado, limpa as modalidades
      const newModalities = newProjects.length === 0 ? [] : prev.modalities;
      
      return { ...prev, projects: newProjects, modalities: newModalities };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    // Validate CPF
    const cpfValidation = validateCPF(formData.cpf);
    if (!cpfValidation.isValid) {
      alert('CPF inválido. Por favor, verifique o número digitado.');
      return;
    }

    setIsSaving(true);
    try {
      const formattedCPF = cpfValidation.formatted;
      const profData = {
        name: formData.name.trim(),
        specialty: formData.specialty.trim(),
        registration: formData.registration.trim(),
        cpf: formattedCPF,
        status: formData.status
      };

      let profId = editingItem?.id;

      if (editingItem) {
        const { error } = await supabase
          .from('professionals')
          .update(profData)
          .eq('id', editingItem.id);
        if (error) throw error;
        
        ActivityLogger.logEdition(
          'profissionais', 
          editingItem, 
          { ...editingItem, ...profData }, 
          `Editou o cadastro do profissional "${editingItem.name}".`
        );
      } else {
        const { data, error } = await supabase
          .from('professionals')
          .insert([profData])
          .select()
          .single();
        if (error) throw error;
        if (!data) throw new Error('Falha ao criar profissional: Nenhum dado retornado.');
        profId = data.id;
        
        ActivityLogger.logCreation(
          'profissionais', 
          profData, 
          `Criou o novo cadastro do profissional "${profData.name}".`
        );
      }

      // Update relationships
      // 1. Delete existing
      const { error: delProjError } = await supabase.from('professional_projects').delete().eq('professional_id', profId);
      if (delProjError) throw delProjError;

      const { error: delModError } = await supabase.from('professional_modalities').delete().eq('professional_id', profId);
      if (delModError) throw delModError;

      const { error: delUnitError } = await supabase.from('professional_units').delete().eq('professional_id', profId);
      if (delUnitError) throw delUnitError;

      // 2. Insert new
      const projectIds = availableProjects
        .filter(p => formData.projects.includes(p.name))
        .map(p => ({ professional_id: profId, project_id: p.id }));
      
      const modalityIds = availableModalities
        .filter(m => formData.modalities.includes(m.name))
        .map(m => ({ professional_id: profId, modality_id: m.id }));

      const unitIds = availableUnits
        .filter(u => formData.units.includes(u.name))
        .map(u => ({ professional_id: profId, unit_id: u.id }));

      if (projectIds.length > 0) {
        const { error: insProjError } = await supabase.from('professional_projects').insert(projectIds);
        if (insProjError) throw insProjError;
      }
      
      if (modalityIds.length > 0) {
        const { error: insModError } = await supabase.from('professional_modalities').insert(modalityIds);
        if (insModError) throw insModError;
      }

      if (unitIds.length > 0) {
        const { error: insUnitError } = await supabase.from('professional_units').insert(unitIds);
        if (insUnitError) throw insUnitError;
      }

      // Auto-create or update system user
      const customUsername = (formData.username || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, "");
      
      const getProfessionalUsername = (name: string) => {
        const nameParts = name.trim().split(' ');
        let username = '';
        if (nameParts.length >= 2) {
          username = `${nameParts[0].toLowerCase()}.${nameParts[nameParts.length - 1].toLowerCase()}`;
        } else {
          username = nameParts[0].toLowerCase();
        }
        return username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, "");
      };

      const finalUsername = customUsername || getProfessionalUsername(formData.name);

      if (editingItem && (editingItem as any).userId) {
        // We have an existing user linked! Let's check if the username was changed.
        if (finalUsername && finalUsername !== editingItem.username?.toLowerCase()) {
          // Check if the new custom username is already taken by a different system user
          const { data: duplicateUser } = await supabase
            .from('system_users')
            .select('id')
            .eq('username', finalUsername)
            .neq('id', (editingItem as any).userId)
            .maybeSingle();

          if (duplicateUser) {
            alert('Este nome de usuário já está em uso por outro usuário do sistema.');
            setIsSaving(false);
            return;
          }

          // Update username and email with prof_ prefix to ensure dynamic link is set
          const { error: userUpdateError } = await supabase
            .from('system_users')
            .update({
              username: finalUsername,
              email: `prof_${profId}@sistema.com`
            })
            .eq('id', (editingItem as any).userId);

          if (userUpdateError) {
            console.error('Erro ao atualizar nome de usuário:', userUpdateError);
            alert(`Erro ao atualizar nome de usuário: ${userUpdateError.message}`);
          } else {
            ActivityLogger.logEdition(
              'usuarios',
              { id: (editingItem as any).userId, username: editingItem.username },
              { id: (editingItem as any).userId, username: finalUsername },
              `Alterou o nome de usuário do profissional "${editingItem.name}" de "${editingItem.username}" para "${finalUsername}".`
            );
          }
        }
      } else if (formData.password && formData.password.trim() !== '') {
        // Create new user since they entered a password
        const { data: duplicateUser } = await supabase
          .from('system_users')
          .select('id')
          .eq('username', finalUsername)
          .maybeSingle();

        if (duplicateUser) {
          alert('Este nome de usuário já está em uso por outro usuário do sistema.');
          setIsSaving(false);
          return;
        }

        const userPayload = {
          username: finalUsername,
          password: formData.password,
          permission: 'Profissional',
          email: `prof_${profId}@sistema.com` // Link clearly to the professional's ID!
        };

        const { error: userError } = await supabase
          .from('system_users')
          .insert([userPayload]);
        
        if (userError) {
          console.error('Erro ao criar usuário automático:', userError);
          alert(`Erro ao criar acesso do sistema: ${userError.message}`);
        } else {
          ActivityLogger.logCreation(
            'usuarios',
            userPayload,
            `Criou o acesso do sistema com o usuário "${finalUsername}".`
          );
        }
      }

      fetchData();
      if (onUpdate) onUpdate();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao salvar profissional:', err);
      if (err.code === '23505') {
        alert('Erro ao salvar profissional. Este CPF ou registro já está em uso por outro profissional.');
      } else {
        alert(`Erro ao salvar profissional: ${err.message || 'Erro desconhecido'}`);
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
    if (itemToDelete) {
      try {
        // Integrity check: check if professional has attendances
        const { data: attendanceData, error: attendanceCheckError } = await supabase
          .from('attendance')
          .select('id')
          .eq('professional_id', itemToDelete)
          .limit(1);

        if (attendanceCheckError) throw attendanceCheckError;

        if (attendanceData && attendanceData.length > 0) {
          alert('Este profissional possui atendimentos registrados no sistema e não pode ser excluído por razões de integridade de dados. Por favor, remova ou reatribua os atendimentos antes de tentar excluir.');
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
          return;
        }

        const deletedObj = professionals.find(p => p.id === itemToDelete);
        
        const { error } = await supabase
          .from('professionals')
          .delete()
          .eq('id', itemToDelete);
        
        if (error) throw error;
        
        if (deletedObj) {
          ActivityLogger.logDeletion(
            'profissionais', 
            deletedObj, 
            `Excluiu o cadastro do profissional "${deletedObj.name}".`
          );
        }
        
        fetchData();
        if (onUpdate) onUpdate();
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
      } catch (err) {
        console.error('Erro ao excluir profissional:', err);
        alert('Ocorreu um erro ao excluir o profissional.');
      }
    }
  };

  const filteredItems = professionals.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cpf.includes(searchTerm);
    const matchesUnit = selectedUnitFilter === 'all' || (p.units && p.units.includes(selectedUnitFilter));
    const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter;
    const matchesAccess = accessFilter === 'Todos' || 
      (accessFilter === 'com_senha' && p.hasPassword) || 
      (accessFilter === 'sem_senha' && !p.hasPassword);
    
    return matchesSearch && matchesUnit && matchesStatus && matchesAccess;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full lg:flex-1 relative">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-40 md:opacity-30" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome, função ou CPF..."
              className="w-full bg-white border border-[#e8bcb7]/10 sm:border-0 rounded-2xl sm:rounded-xl py-3.5 sm:py-3 pl-11 sm:pl-10 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Unit Filter Dropdown */}
          <div className="relative shrink-0 z-[45]">
            <button
              type="button"
              onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
              className={cn(
                "flex items-center gap-2 bg-white px-4 py-3 sm:py-3 rounded-2xl sm:rounded-xl border text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] transition-all duration-300 hover:bg-[#faeff0] select-none w-full sm:w-auto min-w-[200px] justify-between shadow-sm",
                isUnitDropdownOpen ? "border-[#ed1c24]/30 shadow-md ring-4 ring-[#ed1c24]/5" : "border-[#e8bcb7]/10"
              )}
            >
              <div className="flex items-center gap-2 truncate">
                {selectedUnitFilter !== 'all' && availableUnits.find(u => u.name === selectedUnitFilter)?.logo_url ? (
                  <div className="w-4 h-4 rounded bg-white overflow-hidden border border-[#e8bcb7]/20 p-0.5 shrink-0 flex items-center justify-center">
                    <img src={availableUnits.find(u => u.name === selectedUnitFilter).logo_url} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <Building2 size={16} className="text-[#ed1c24] shrink-0" />
                )}
                <span className="truncate max-w-[130px]">
                  {selectedUnitFilter === 'all' ? 'Todas as Unidades' : selectedUnitFilter}
                </span>
              </div>
              <svg
                className={cn("w-3 h-3 text-[#ed1c24] transition-transform duration-300 ml-1 shrink-0", isUnitDropdownOpen ? "rotate-180" : "")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Card */}
            {isUnitDropdownOpen && (
              <div className="absolute z-50 left-0 sm:right-0 mt-2 w-72 bg-white rounded-2xl border border-[#e8bcb7]/25 shadow-xl shadow-[#5e3f3b]/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Search Input */}
                <div className="p-3 border-b border-[#faf9fb] bg-[#faf9fb]/50 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-[#ed1c24] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar unidade..."
                    value={unitSearchWord}
                    onChange={(e) => setUnitSearchWord(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent border-none text-[10px] font-black text-gray-700 placeholder-gray-400 focus:ring-0 p-1 cursor-text uppercase tracking-wider"
                  />
                  {unitSearchWord && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUnitSearchWord('');
                      }}
                      className="text-[9px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest shrink-0"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Options List */}
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUnitFilter('all');
                      setIsUnitDropdownOpen(false);
                      setUnitSearchWord('');
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-[#faeff0]/30 transition-all flex items-center justify-between gap-3 group",
                      selectedUnitFilter === 'all' ? "bg-[#faeff0]/70" : ""
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-[#ed1c24]" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-700 group-hover:text-gray-900">Todas as Unidades</span>
                    </div>
                    {selectedUnitFilter === 'all' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ed1c24]" />
                    )}
                  </button>

                  {availableUnits
                    .filter(u => u.name.toLowerCase().includes(unitSearchWord.toLowerCase()))
                    .map((u) => {
                      const isSelected = selectedUnitFilter === u.name;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUnitFilter(u.name);
                            setIsUnitDropdownOpen(false);
                            setUnitSearchWord('');
                          }}
                          className={cn(
                            "w-full text-left px-4 py-3 hover:bg-[#faeff0]/40 transition-all flex items-center justify-between gap-3 group",
                            isSelected ? "bg-[#faeff0]/70" : ""
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[#f4f3f5] p-1 border border-[#e8bcb7]/10 shrink-0 flex items-center justify-center relative overflow-hidden group-hover:bg-white transition-colors">
                              {u.logo_url ? (
                                <img src={u.logo_url} alt="Logo" className="w-full h-full object-contain" />
                              ) : (
                                <Building2 size={14} className="text-[#ed1c24] opacity-40 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className={cn(
                                "text-[10px] font-black uppercase tracking-wider truncate transition-colors",
                                isSelected ? "text-[#ed1c24]" : "text-gray-700 group-hover:text-gray-900"
                              )}>
                                {u.name}
                              </p>
                              {u.cnpj && (
                                <p className="text-[8px] font-bold text-gray-400 mt-0.5 tracking-tight font-mono">
                                  CNPJ: {u.cnpj}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <span className={cn(
                                "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full",
                                u.status === "Ativo" 
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                  : "bg-amber-50 text-amber-600 border border-amber-100"
                              )}>
                              {u.status || "Ativo"}
                            </span>
                            {isSelected && (
                              <div className="w-1.5 h-1.5 rounded-full bg-[#ed1c24]" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  
                  {availableUnits.filter(u => u.name.toLowerCase().includes(unitSearchWord.toLowerCase())).length === 0 && (
                    <div className="px-4 py-6 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">
                      Nenhuma unidade encontrada
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative w-full sm:w-40 z-40">
            <select 
              className="w-full bg-white border border-[#e8bcb7]/10 sm:border-0 rounded-2xl sm:rounded-xl py-3.5 sm:py-3 px-4 text-sm shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer transition-all pr-10"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="Todos">Todos Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
              <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-[#5e3f3b] rotate-45" />
            </div>
          </div>

          {/* Password Filter */}
          <div className="relative w-full sm:w-56 z-40">
            <select 
              className="w-full bg-white border border-[#e8bcb7]/10 sm:border-0 rounded-2xl sm:rounded-xl py-3.5 sm:py-3 px-4 text-sm shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer transition-all pr-10"
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value as any)}
            >
              <option value="Todos">Todos Acessos</option>
              <option value="com_senha">Com Senha Cadastrada</option>
              <option value="sem_senha">Sem Senha Cadastrada</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
              <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-[#5e3f3b] rotate-45" />
            </div>
          </div>
        </div>
        
        {!isReadOnly && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-[#ed1c24] text-white px-6 py-4 sm:py-3 rounded-2xl sm:rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(237,28,36,0.2)] hover:bg-[#d11920] transition-all active:scale-95 shrink-0 z-10"
          >
            <UserPlus size={18} />
            <span className="inline">Novo Profissional</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#e8bcb7]/10">
        <div className="overflow-x-auto scrollbar-thin hidden md:block">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f4f3f5]">
                <th className="px-3 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Profissional</th>
                <th className="px-3 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Função</th>
                <th className="px-3 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Documentos</th>
                <th className="px-3 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Status</th>
                <th className="px-3 py-3 text-right text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f3f5]">
              {filteredItems.map((item, index) => (
                <motion.tr 
                  key={item.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedProfessionalForDetails(item)}
                  className="hover:bg-[#faf9fb]/80 active:bg-[#f4f3f5] cursor-pointer transition-colors group"
                  title="Clique para visualizar a ficha do profissional"
                >
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-xl bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24] font-black text-[10px] shrink-0 shadow-sm group-hover:shadow-md transition-all">
                         {item.name.charAt(0).toUpperCase()}
                       </div>
                       <div className="flex flex-col min-w-0">
                         <span className="text-xs font-bold text-[#1a1c1d] truncate group-hover:text-[#ed1c24] transition-colors">{item.name}</span>
                       </div>
                     </div>
                   </td>
                   <td className="px-3 py-4">
                     <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-[#ed1c24]/30" />
                      <span className="text-[11px] text-[#1a1c1d] font-bold whitespace-nowrap">{item.specialty}</span>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <Shield size={9} className="text-[#5e3f3b] opacity-40" />
                        <span className="text-[11px] text-[#1a1c1d] font-bold whitespace-nowrap">{item.registration}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Contact size={9} className="text-[#5e3f3b] opacity-40" />
                        <span className="text-[10px] text-[#5e3f3b] font-medium whitespace-nowrap">{item.cpf}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
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
                  <td className="px-3 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    {!isReadOnly ? (
                      <div className="flex justify-end gap-1 lg:opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleOpenModal(item)}
                          className="p-1.5 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/5 rounded-lg transition-all"
                          title="Editar Profissional"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(item.id)}
                          className="p-1.5 text-[#5e3f3b] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir Profissional"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-30">Visualização</span>
                    )}
                  </td>
                </motion.tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <AlertCircle size={32} />
                      <p className="text-sm font-medium">Nenhum profissional encontrado.</p>
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
              onClick={() => setSelectedProfessionalForDetails(item)}
              className="p-4 sm:p-5 space-y-4 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-all"
              title="Clique para visualizar a ficha do profissional"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24] font-black text-sm sm:text-base shrink-0 shadow-sm">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-black text-[#1a1c1d] truncate tracking-tight">{item.name}</span>
                    <div className="flex items-center gap-1.5 min-w-0 mt-1">
                      <Activity size={10} className="text-[#ed1c24] opacity-60 shrink-0" />
                      <span className="text-[10px] font-bold text-[#5e3f3b] opacity-60 uppercase tracking-widest truncate">{item.specialty}</span>
                    </div>
                  </div>
                </div>
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shrink-0",
                  item.status === 'Ativo' 
                    ? "bg-green-50 text-green-600 border-green-100" 
                    : "bg-gray-50 text-gray-400 border-gray-100"
                )}>
                  {item.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-[#f4f3f5]/50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl space-y-1 border border-[#e8bcb7]/5">
                  <div className="flex items-center gap-1.5 opacity-40">
                    <Shield size={9} />
                    <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest">Registro</p>
                  </div>
                  <p className="text-[10px] sm:text-xs font-bold text-[#1a1c1d] truncate">{item.registration}</p>
                </div>
                <div className="bg-[#f4f3f5]/50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl space-y-1 border border-[#e8bcb7]/5">
                  <div className="flex items-center gap-1.5 opacity-40">
                    <Contact size={9} />
                    <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest">CPF</p>
                  </div>
                  <p className="text-[10px] sm:text-xs font-bold text-[#1a1c1d] truncate">{item.cpf}</p>
                </div>
              </div>

              {!isReadOnly && (
                <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => handleOpenModal(item)}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#f4f3f5] text-[#1a1c1d] py-3.5 rounded-xl text-[10px] font-black active:scale-95 transition-all outline-none focus:ring-2 focus:ring-[#ed1c24]/20"
                  >
                    <Edit2 size={14} />
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(item.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3.5 rounded-xl text-[10px] font-black active:scale-95 transition-all outline-none focus:ring-2 focus:ring-red-100"
                  >
                    <Trash2 size={14} />
                    Excluir
                  </button>
                </div>
              )}
            </motion.div>
          ))}
          {filteredItems.length === 0 && (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-2 opacity-40">
                <AlertCircle size={32} />
                <p className="text-xs font-bold">Nenhum profissional encontrado.</p>
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
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#ed1c24]/10 text-[#ed1c24] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Trash2 size={24} className="sm:w-8 sm:h-8" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#1a1c1d] mb-2">Excluir Profissional</h2>
              <p className="text-xs sm:text-sm text-[#5e3f3b] mb-6 sm:mb-8">
                Tem certeza que deseja excluir este profissional? Esta ação não pode ser desfeita.
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
              className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-white sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-screen sm:max-h-[90vh]">
                {/* Header */}
                <div className="px-5 py-4 sm:p-6 border-b border-[#e8bcb7]/10 flex justify-between items-center bg-[#faf9fb] shrink-0">
                  <div className="min-w-0 pr-4">
                    <h2 className="text-lg sm:text-2xl font-black text-[#1a1c1d] tracking-tight truncate">
                      {editingItem ? 'Editar Profissional' : 'Novo Profissional'}
                    </h2>
                    <p className="text-[9px] sm:text-[10px] font-bold text-[#5e3f3b] opacity-40 sm:opacity-50 uppercase tracking-widest mt-0.5 sm:mt-1 truncate">
                      {editingItem ? 'Atualize os dados do colaborador' : 'Cadastre um novo colaborador'}
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-thin">
                  <div className="space-y-6 sm:space-y-8">
                  
                  {/* Section: Dados Pessoais */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-2 border-b border-[#e8bcb7]/10">
                      <div className="w-8 h-8 rounded-xl bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24]">
                        <User size={16} />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-[#1a1c1d]">Dados Pessoais</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Nome Completo</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-30" size={16} />
                          <input 
                            required
                            type="text" 
                            className="w-full bg-[#f4f3f5] border-2 border-transparent rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:border-[#ed1c24]/20 focus:bg-white focus:ring-4 focus:ring-[#ed1c24]/5 outline-none transition-all"
                            value={formData.name}
                            onChange={(e) => {
                              const newName = e.target.value;
                              setFormData(prev => {
                                const getProfessionalUsername = (name: string) => {
                                  const nameParts = name.trim().split(' ');
                                  let username = '';
                                  if (nameParts.length >= 2) {
                                    username = `${nameParts[0].toLowerCase()}.${nameParts[nameParts.length - 1].toLowerCase()}`;
                                  } else {
                                    username = nameParts[0].toLowerCase();
                                  }
                                  return username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, "");
                                };
                                const oldComputed = getProfessionalUsername(prev.name);
                                const newComputed = getProfessionalUsername(newName);
                                const updatedUsername = (!editingItem && (prev.username === oldComputed || !prev.username))
                                  ? newComputed
                                  : prev.username;
                                return {
                                  ...prev,
                                  name: newName,
                                  username: updatedUsername
                                };
                              });
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">CPF</label>
                        <div className="relative">
                          <Contact className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-30" size={16} />
                          <input 
                            required
                            type="text" 
                            inputMode="numeric"
                            placeholder="000.000.000-00"
                            className={cn(
                              "w-full bg-[#f4f3f5] border-2 border-transparent rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium outline-none transition-all",
                              formData.cpf && !validateCPF(formData.cpf).isValid 
                                ? "border-red-200 bg-red-50 text-red-900 focus:border-red-300 focus:ring-red-100" 
                                : "focus:border-[#ed1c24]/20 focus:bg-white focus:ring-4 focus:ring-[#ed1c24]/5"
                            )}
                            value={formData.cpf}
                            onChange={(e) => setFormData({...formData, cpf: maskCPF(e.target.value)})}
                            onBlur={(e) => {
                              const val = validateCPF(e.target.value);
                              if (val.isValid) setFormData({...formData, cpf: val.formatted});
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Dados Profissionais */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-2 border-b border-[#e8bcb7]/10">
                      <div className="w-8 h-8 rounded-xl bg-[#004a7a]/10 flex items-center justify-center text-[#004a7a]">
                        <Briefcase size={16} />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-[#1a1c1d]">Dados Profissionais</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Função / Especialidade</label>
                        <div className="relative">
                          <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-30" size={16} />
                          <input 
                            required
                            type="text" 
                            placeholder="Ex: Psicólogo, Fonoaudiólogo"
                            className="w-full bg-[#f4f3f5] border-2 border-transparent rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:border-[#ed1c24]/20 focus:bg-white focus:ring-4 focus:ring-[#ed1c24]/5 outline-none transition-all"
                            value={formData.specialty}
                            onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Registro Profissional</label>
                        <div className="relative">
                          <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-30" size={16} />
                          <input 
                            required
                            type="text" 
                            placeholder="Ex: CRP 06/12345"
                            className="w-full bg-[#f4f3f5] border-2 border-transparent rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:border-[#ed1c24]/20 focus:bg-white focus:ring-4 focus:ring-[#ed1c24]/5 outline-none transition-all"
                            value={formData.registration}
                            onChange={(e) => setFormData({...formData, registration: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Status Contratual</label>
                        <select 
                          className="w-full bg-[#f4f3f5] border-2 border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:border-[#ed1c24]/20 focus:bg-white focus:ring-4 focus:ring-[#ed1c24]/5 outline-none appearance-none cursor-pointer transition-all"
                          value={formData.status}
                          onChange={(e) => setFormData({...formData, status: e.target.value as 'Ativo' | 'Inativo'})}
                        >
                          <option value="Ativo">Ativo</option>
                          <option value="Inativo">Inativo</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section: Acesso ao Sistema */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-2 border-b border-[#e8bcb7]/10">
                      <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
                        <Lock size={16} />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-[#1a1c1d]">Acesso ao Sistema</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Nome de Usuário</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-30" size={16} />
                          <input 
                            type="text" 
                            placeholder="usuario.profissional"
                            className="w-full bg-[#f4f3f5] border-2 border-transparent rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:border-[#ed1c24]/20 focus:bg-white focus:ring-4 focus:ring-[#ed1c24]/5 outline-none transition-all"
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1 flex items-center gap-2">
                          Senha de Acesso
                          {hasExistingUser ? (
                            <span className="normal-case font-medium text-[9px] text-[#0d9488] font-bold italic">(Já possui senha)</span>
                          ) : (
                            <span className="normal-case font-medium text-[9px] opacity-40 italic">(Opcional novo)</span>
                          )}
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-30" size={16} />
                          <input 
                            type="password" 
                            placeholder={hasExistingUser ? "Senha já definida. Altere em Acessos" : "Defina uma senha"}
                            disabled={hasExistingUser}
                            className="w-full bg-[#f4f3f5] border-2 border-transparent rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:border-[#ed1c24]/20 focus:bg-white focus:ring-4 focus:ring-[#ed1c24]/5 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Vinculações */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 pb-2 border-b border-[#e8bcb7]/10">
                      <div className="w-8 h-8 rounded-xl bg-[#004a7a]/5 flex items-center justify-center text-[#004a7a]">
                        <Layers size={16} />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-[#1a1c1d]">Vinculações</h3>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Unidade(s) de Atendimento</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {availableUnits.map(unit => (
                            <button
                              key={unit.id}
                              type="button"
                              onClick={() => toggleUnit(unit.name)}
                              className={cn(
                                "flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-bold transition-all border-2 text-left group",
                                formData.units.includes(unit.name)
                                  ? "bg-[#ed1c24] text-white border-[#ed1c24] shadow-lg shadow-[#ed1c24]/20"
                                  : "bg-white text-[#5e3f3b] border-[#f4f3f5] hover:border-[#ed1c24]/30 hover:bg-[#f4f3f5]/50"
                              )}
                            >
                              <span className="truncate pr-2">{unit.name}</span>
                              <div className={cn(
                                "w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                                formData.units.includes(unit.name) 
                                  ? "bg-white border-white text-[#ed1c24]" 
                                  : "border-[#e8bcb7]/30 group-hover:border-[#ed1c24]/50"
                              )}>
                                {formData.units.includes(unit.name) && <CheckCircle2 size={12} strokeWidth={3} />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Projetos Atribuídos</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {availableProjects
                            .filter(project => {
                              if (formData.units.length === 0) return true;
                              const selectedUnitIds = availableUnits
                                .filter(u => formData.units.includes(u.name))
                                .map(u => u.id);
                              return !project.unit_id || selectedUnitIds.includes(project.unit_id);
                            })
                            .map(project => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => toggleProject(project.name)}
                              className={cn(
                                "flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-bold transition-all border-2 text-left group",
                                formData.projects.includes(project.name)
                                  ? "bg-[#004a7a] text-white border-[#004a7a] shadow-lg shadow-[#004a7a]/20"
                                  : "bg-white text-[#5e3f3b] border-[#f4f3f5] hover:border-[#004a7a]/30 hover:bg-[#f4f3f5]/50"
                              )}
                            >
                              <span className="truncate pr-2">{project.name}</span>
                              <div className={cn(
                                "w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                                formData.projects.includes(project.name) 
                                  ? "bg-white border-white text-[#004a7a]" 
                                  : "border-[#e8bcb7]/30 group-hover:border-[#004a7a]/50"
                              )}>
                                {formData.projects.includes(project.name) && <CheckCircle2 size={12} strokeWidth={3} />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {formData.projects.length > 0 && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">Modalidades Autorizadas</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {availableModalities
                              .filter(modality => {
                                const selectedProjectIds = availableProjects
                                  .filter(p => formData.projects.includes(p.name))
                                  .map(p => p.id);
                                return projectGoals.some(goal => 
                                  selectedProjectIds.includes(goal.project_id) && 
                                  goal.modality_id === modality.id
                                );
                              })
                              .map(modality => (
                              <button
                                key={modality.id}
                                type="button"
                                onClick={() => toggleModality(modality.name)}
                                className={cn(
                                  "flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-bold transition-all border-2 text-left group",
                                  formData.modalities.includes(modality.name)
                                    ? "bg-[#ed1c24] text-white border-[#ed1c24] shadow-lg shadow-[#ed1c24]/20"
                                    : "bg-white text-[#5e3f3b] border-[#f4f3f5] hover:border-[#ed1c24]/30 hover:bg-[#f4f3f5]/50"
                                )}
                              >
                                <span className="truncate pr-2">{modality.name}</span>
                                <div className={cn(
                                  "w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                                  formData.modalities.includes(modality.name) 
                                    ? "bg-white border-white text-[#ed1c24]" 
                                    : "border-[#e8bcb7]/30 group-hover:border-[#ed1c24]/50"
                                )}>
                                  {formData.modalities.includes(modality.name) && <CheckCircle2 size={12} strokeWidth={3} />}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
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
                      className="flex-[2] bg-[#ed1c24] text-white font-black py-3.5 rounded-2xl text-sm shadow-[0_12px_24px_rgba(237,28,36,0.2)] hover:bg-[#d01920] hover:shadow-[0_16px_32px_rgba(237,28,36,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        editingItem ? 'Salvar Alterações' : 'Finalizar Cadastro'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Professional Details Modal */}
      <AnimatePresence>
        {selectedProfessionalForDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProfessionalForDetails(null)}
              className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
            >
              {/* Header */}
              <div className="p-6 sm:p-8 border-b border-[#f4f3f5] flex justify-between items-center shrink-0 bg-[#faf9fb]">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-[#ed1c24]/10 flex items-center justify-center font-black text-[#ed1c24] text-lg shrink-0 shadow-sm">
                    {selectedProfessionalForDetails.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-[#1a1c1d] tracking-tight truncate" title={selectedProfessionalForDetails.name}>{selectedProfessionalForDetails.name}</h2>
                    <p className="text-[10px] font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest mt-0.5 truncate">{selectedProfessionalForDetails.specialty}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProfessionalForDetails(null)}
                  className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 scrollbar-thin">
                
                {/* Section: Cadastro */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-[#f4f3f5]">
                    <User size={14} className="text-[#ed1c24]" />
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-[#1a1c1d]">Informações Cadastrais</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-[#faf9fb]/50 border border-[#e8bcb7]/10 rounded-xl">
                      <p className="text-[8px] font-black text-[#5e3f3b]/50 uppercase tracking-widest">CPF</p>
                      <p className="text-xs font-bold text-[#1a1c1d] mt-1">{selectedProfessionalForDetails.cpf || 'Não cadastrado'}</p>
                    </div>

                    <div className="p-3 bg-[#faf9fb]/50 border border-[#e8bcb7]/10 rounded-xl">
                      <p className="text-[8px] font-black text-[#5e3f3b]/50 uppercase tracking-widest">Registro Profissional</p>
                      <p className="text-xs font-bold text-[#1a1c1d] mt-1">{selectedProfessionalForDetails.registration || 'Não cadastrado'}</p>
                    </div>

                    <div className="p-3 bg-[#faf9fb]/50 border border-[#e8bcb7]/10 rounded-xl">
                      <p className="text-[8px] font-black text-[#5e3f3b]/50 uppercase tracking-widest">Status Contratual</p>
                      <div>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide mt-1",
                          selectedProfessionalForDetails.status === 'Ativo' 
                            ? "bg-green-50 text-green-700 border border-green-100" 
                            : "bg-gray-50 text-gray-500 border border-gray-100"
                        )}>
                          <span className={cn("w-1 h-1 rounded-full", selectedProfessionalForDetails.status === 'Ativo' ? "bg-green-600" : "bg-gray-400")} />
                          {selectedProfessionalForDetails.status}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#faf9fb]/50 border border-[#e8bcb7]/10 rounded-xl">
                      <p className="text-[8px] font-black text-[#5e3f3b]/50 uppercase tracking-widest">Data de Cadastro</p>
                      <p className="text-xs font-bold text-[#1a1c1d] mt-1">
                        {selectedProfessionalForDetails.created_at ? new Date(selectedProfessionalForDetails.created_at).toLocaleDateString('pt-BR') : 'Sem data'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section: Acesso */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-[#f4f3f5]">
                    <Lock size={14} className="text-[#ed1c24]" />
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-[#1a1c1d]">Dados de Acesso ao Sistema</h4>
                  </div>

                  <div className="bg-[#faf9fb] border border-[#e8bcb7]/15 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-bold text-[#5e3f3b]/60 uppercase tracking-widest shrink-0">Nome de Usuário</span>
                      <span className="text-xs font-mono font-bold text-[#1a1c1d] bg-white border border-[#e8bcb7]/10 px-2 py-1 rounded-md lowercase truncate">
                        {selectedProfessionalForDetails.username || 'n/a'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-bold text-[#5e3f3b]/60 uppercase tracking-widest shrink-0">Perfil de Permissão</span>
                      <span className="text-[10px] font-bold text-gray-700 bg-white border border-[#e8bcb7]/10 px-2.5 py-1 rounded-md uppercase tracking-wide shrink-0 font-sans">
                        Profissional
                      </span>
                    </div>

                    {!selectedProfessionalForDetails.hasPassword && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-bold text-[#5e3f3b]/60 uppercase tracking-widest shrink-0">Status da Credencial</span>
                        <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-600 text-[9px] font-bold rounded uppercase tracking-wide inline-flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Sem Senha
                        </span>
                      </div>
                    )}

                    {selectedProfessionalForDetails.hasPassword && (
                      <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#f4f3f5]/50">
                        <span className="text-[10px] font-bold text-[#5e3f3b]/60 uppercase tracking-widest shrink-0">Senha de Acesso</span>
                        <div className="flex items-center gap-2 bg-white border border-[#e8bcb7]/10 px-2.5 py-1.5 rounded-md">
                          <span className="text-xs font-mono font-bold text-[#1a1c1d]">
                            {isPasswordVisible ? selectedProfessionalForDetails.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                            className="p-0.5 text-[#5e3f3b]/60 hover:text-[#ed1c24] transition-colors rounded hover:bg-slate-50"
                            title={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {isPasswordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {onNavigateToSystemUsers && (
                    <button
                      type="button"
                      onClick={() => {
                        const username = selectedProfessionalForDetails.username || '';
                        setSelectedProfessionalForDetails(null);
                        onNavigateToSystemUsers(username);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#ed1c24]/5 hover:bg-[#ed1c24]/10 border border-[#ed1c24]/10 hover:border-[#ed1c24]/20 text-[#ed1c24] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-98"
                    >
                      <Shield size={14} />
                      Gerenciar Credencial de Acesso
                    </button>
                  )}
                </div>

                {/* Section: Vinculações */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-[#f4f3f5]">
                    <Layers size={14} className="text-[#ed1c24]" />
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-[#1a1c1d]">Vinculações Ativas</h4>
                  </div>

                  <div className="space-y-4">
                    {/* Units */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]/60 flex items-center gap-1.5">
                        <Building2 size={12} className="text-[#ed1c24]" /> Unidades de Atendimento ({selectedProfessionalForDetails.units?.length || 0})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProfessionalForDetails.units && selectedProfessionalForDetails.units.length > 0 ? (
                          selectedProfessionalForDetails.units.map((unit, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-[#ed1c24]/5 border border-[#ed1c24]/10 text-[#ed1c24] text-[10px] font-black rounded-lg uppercase tracking-wide">
                              {unit}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-[#5e3f3b]/50 italic font-semibold">Nenhuma unidade vinculada</span>
                        )}
                      </div>
                    </div>

                    {/* Projects */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]/60 flex items-center gap-1.5">
                        <Briefcase size={12} className="text-[#004a7a]" /> Projetos Atribuídos ({selectedProfessionalForDetails.projects?.length || 0})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProfessionalForDetails.projects && selectedProfessionalForDetails.projects.length > 0 ? (
                          selectedProfessionalForDetails.projects.map((proj, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-[#004a7a]/5 border border-[#004a7a]/10 text-[#004a7a] text-[10px] font-black rounded-lg uppercase tracking-wide">
                              {proj}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-[#5e3f3b]/50 italic font-semibold">Nenhum projeto atribuído</span>
                        )}
                      </div>
                    </div>

                    {/* Modalities */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]/60 flex items-center gap-1.5">
                        <Layers size={12} className="text-pink-600" /> Modalidades Autorizadas ({selectedProfessionalForDetails.modalities?.length || 0})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProfessionalForDetails.modalities && selectedProfessionalForDetails.modalities.length > 0 ? (
                          selectedProfessionalForDetails.modalities.map((mod, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-pink-50 border border-pink-100 text-pink-700 text-[10px] font-black rounded-lg uppercase tracking-wide">
                              {mod}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-[#5e3f3b]/50 italic font-semibold">Nenhuma modalidade autorizada</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-6 bg-[#faf9fb] border-t border-[#f4f3f5] shrink-0">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProfessionalForDetails(null)}
                    className="flex-1 px-6 py-3.5 bg-white border border-[#e8bcb7]/20 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#faeff0] font-black rounded-2xl text-[10px] uppercase tracking-wider transition-all cursor-pointer select-none active:scale-95 shadow-sm text-center"
                  >
                    Fechar Ficha
                  </button>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const prof = selectedProfessionalForDetails;
                        setSelectedProfessionalForDetails(null);
                        handleOpenModal(prof);
                      }}
                      className="flex-1 bg-[#ed1c24] text-white font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-wider shadow-[0_8px_20px_rgba(237,28,36,0.15)] hover:bg-[#d01920] transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Edit2 size={13} />
                      Editar Profissional
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

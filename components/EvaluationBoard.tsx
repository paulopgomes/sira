'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Calendar, 
  User, 
  MapPin, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  History,
  AlertCircle,
  TrendingUp,
  Filter,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Printer,
  Building2
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface Evaluation {
  id: string;
  professional_id: string;
  patient_id: string;
  unit_id: string;
  date: string;
  title: string;
  content: string;
  is_private: boolean;
  created_at: string;
  deleted_at?: string | null;
  professional_name?: string;
  professional_registration?: string;
  professional_specialty?: string;
  patient?: { name: string };
  unit?: { name: string; logo_url?: string | null };
  system_user_id?: string;
}

interface EvaluationBoardProps {
  currentUser: {
    id: string;
    username: string;
    permission: string;
    email?: string;
  };
  unitLogoUrl?: string | null;
  activeEvaluationId?: string | null;
  onClearActiveEvaluation?: () => void;
}

export function EvaluationBoard({ 
  currentUser, 
  unitLogoUrl,
  activeEvaluationId,
  onClearActiveEvaluation
}: EvaluationBoardProps) {
  const isAdmin = currentUser?.permission === 'Administrador';
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [allowedUnitIds, setAllowedUnitIds] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDevNoticeOpen, setIsDevNoticeOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Evaluation | null>(null);
  const [viewingItem, setViewingItem] = useState<Evaluation | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [professionalFilter, setProfessionalFilter] = useState('');
  const [professionalsList, setProfessionalsList] = useState<any[]>([]);
  const [professionalUnits, setProfessionalUnits] = useState<any[]>([]);
  const [showOnlyPrivate, setShowOnlyPrivate] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Pagination State (quebra de página de registros)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, unitFilter, professionalFilter, patientFilter, showOnlyPrivate, showTrash]);
  
  const [formData, setFormData] = useState({
    patient_id: '',
    unit_id: '',
    date: new Date().toISOString().split('T')[0],
    title: '',
    content: '',
    is_private: false
  });

  const [matchingProfId, setMatchingProfId] = useState<string | null>(null);
  const [availableAttendances, setAvailableAttendances] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const fetchAvailableAttendances = async (patientId: string, currentEditingItem?: Evaluation | null) => {
    if (!patientId || !matchingProfId) return;
    setAttendanceLoading(true);
    const activeEditItem = currentEditingItem !== undefined ? currentEditingItem : editingItem;
    try {
      // 1. Fetch all attendances for this patient by this professional
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('day, month, year')
        .eq('patient_id', patientId)
        .eq('professional_id', matchingProfId);
      
      if (attendanceError) throw attendanceError;

      // 2. Fetch existing evaluations for this patient by this user/professional
      // Note: we filter by system_user_id since evaluations are linked to the system user
      const { data: existingEvals, error: evalsError } = await supabase
        .from('patient_evaluations')
        .select('date, deleted_at')
        .eq('patient_id', patientId)
        .eq('system_user_id', currentUser.id);

      if (evalsError) throw evalsError;

      const activeEvals = (existingEvals || []).filter((e: any) => !e.deleted_at);
      const evalDates = new Set(activeEvals.map((e: any) => e.date));

      const formattedDates = (attendanceData || []).map((a: any) => {
        const d = a.day.toString().padStart(2, '0');
        const m = a.month.toString().padStart(2, '0');
        const y = a.year.toString();
        return `${y}-${m}-${d}`;
      });

      // Sort unique dates descending
      const sortedUniqueDates = (Array.from(new Set(formattedDates)) as string[])
        .sort((a, b) => b.localeCompare(a));

      // 3. Filter out dates that already have an evaluation and limit to 15
      // If we are editing, we should keep the current date of the item being edited in the list
      const filteredDates = sortedUniqueDates.filter(date => {
        if (activeEditItem && activeEditItem.date === date) return true;
        return !evalDates.has(date);
      }).slice(0, 15);
      
      setAvailableAttendances(filteredDates.map(d => ({ date: d })));
      
      // Auto-select the latest available date only if creating new (no activeEditItem) or if current date is not in list
      if (!activeEditItem && filteredDates.length > 0) {
        if (!filteredDates.includes(formData.date)) {
          setFormData(prev => ({ ...prev, date: filteredDates[0] }));
        }
      }
    } catch (err) {
      console.error('Erro ao buscar atendimentos:', err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      // Fetch system users to map user IDs to usernames and match with professionals
      const { data: usersData } = await supabase
        .from('system_users')
        .select('id, username, email');

      // Fetch all professionals (active and inactive) so we don't fail mapping historical/deleted evolutions
      const { data: allProfessionalsData } = await supabase
        .from('professionals')
        .select('id, name, status, specialty, registration')
        .order('name');
      
      const allProfs = allProfessionalsData || [];
      const professionalsData = allProfs.filter((p: any) => p.status === 'Ativo');
      
      setProfessionalsList(professionalsData);

      // Fetch professional unit associations for selecting filter
      const { data: profUnitsData } = await supabase
        .from('professional_units')
        .select('professional_id, unit_id');
      setProfessionalUnits(profUnitsData || []);
      
      const sanitize = (str: string) => 
        str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
      
      const userEmail = sanitize(currentUser.username);
      const matchingProf = professionalsData?.find((p: any) => {
        if (currentUser.email && currentUser.email.startsWith('prof_')) {
          const expectedProfId = currentUser.email.replace('prof_', '').split('@')[0];
          if (p.id === expectedProfId) return true;
        }

        const profName = sanitize(p.name);
        const nameParts = p.name.trim().split(/\s+/);
        
        // Try different matching strategies: exact same as app/page.tsx
        const variations = [];
        variations.push(profName); // Full name sanitized
        
        if (nameParts.length >= 2) {
          variations.push(sanitize(`${nameParts[0]}.${nameParts[nameParts.length - 1]}`)); // first.last
          variations.push(sanitize(`${nameParts[0]}${nameParts[nameParts.length - 1]}`)); // firstlast
        } else {
          variations.push(sanitize(nameParts[0])); // first only
        }
        
        return variations.some(v => v === userEmail || userEmail.includes(v) || v.includes(userEmail));
      });

      if (matchingProf) {
        setMatchingProfId(matchingProf.id);
      }

      // 1. Fetch allowed units
      let unitsData: any[] = [];
      let allowedIds: string[] = [];

      if (isAdmin) {
        const { data: allUnits } = await supabase.from('units').select('id, name').eq('status', 'Ativo');
        unitsData = allUnits || [];
        allowedIds = unitsData.map(u => u.id);
      } else {
        if (matchingProf) {
          // Use units assigned to the professional
          const { data: profUnits } = await supabase
            .from('professional_units')
            .select('unit_id, units(name)')
            .eq('professional_id', matchingProf.id);
          
          allowedIds = (profUnits || []).map((p: any) => p.unit_id);
          unitsData = (profUnits || []).map((p: any) => ({ id: p.unit_id, name: p.units?.name }));
        } else {
          // Fallback to system_user_units if professional profile not matched
          const { data: perms } = await supabase
            .from('system_user_units')
            .select('unit_id, units(name)')
            .eq('system_user_id', currentUser.id);
          
          allowedIds = (perms || []).map((p: any) => p.unit_id);
          unitsData = (perms || []).map((p: any) => ({ id: p.unit_id, name: p.units?.name }));
        }
      }
      
      setUnits(unitsData);
      setAllowedUnitIds(allowedIds);

      // 2. Fetch Patients for these units
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, name, unit_id')
        .in('unit_id', allowedIds)
        .eq('status', 'Ativo')
        .order('name');
      setPatients(patientsData || []);

      // 3. Fetch Evaluations
      let query = supabase
        .from('patient_evaluations')
        .select(`
          *,
          patient:patients(name, unit_id),
          unit:units(name, logo_url),
          system_user:system_users(id, username, email)
        `);
      
      if (!isAdmin) {
        // Non-admins see:
        // 1. Their own evolutions (private or public)
        // 2. Public evolutions in the units they have access to
        const unitConditions = allowedIds.length > 0 
          ? `and(unit_id.in.(${allowedIds.join(',')}),is_private.eq.false)`
          : '';
        
        const conditions = [`system_user_id.eq.${currentUser.id}`];
        if (unitConditions) conditions.push(unitConditions);
        
        query = query.or(conditions.join(','));
      }

      const { data: evals, error: evalError } = await query.order('date', { ascending: false });
      
      if (evalError) {
        // Handle common "table missing" errors
        const isTableMissing = 
          evalError.code === '42P01' || 
          evalError.code === 'PGRST116' || 
          evalError.code === 'PGRST205' || // Schema cache error
          evalError.message.includes('relation "patient_evaluations" does not exist') ||
          evalError.message.includes('Could not find the table') ||
          evalError.message.includes('não existe');

        if (isTableMissing) {
          console.warn('TABELA AUSENTE: A tabela "patient_evaluations" não foi encontrada no banco de dados. Por favor, execute o script SQL de migração no Supabase.');
          setEvaluations([]);
          return;
        } else {
          throw evalError;
        }
      }
      
      // Centralized robust helper to match a user to a professional
      const getProfessionalForUser = (u: any, profsList: any[]) => {
        if (!u) return null;

        // 1. Direct match by email starting with prof_UUID
        if (u.email && u.email.toLowerCase().startsWith('prof_')) {
          const expectedProfId = u.email.toLowerCase().replace('prof_', '').split('@')[0];
          const match = profsList.find(p => p.id === expectedProfId);
          if (match) return match;
        }

        const sanitizeStr = (str: string) => 
          str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";

        const userUsernameSanitized = sanitizeStr(u.username);

        // 2. Match computed username for professional
        const getProfessionalUsername = (name: string) => {
          const nameParts = name.trim().split(/\s+/);
          let username = '';
          if (nameParts.length >= 2) {
            username = `${nameParts[0].toLowerCase()}.${nameParts[nameParts.length - 1].toLowerCase()}`;
          } else {
            username = nameParts[0].toLowerCase();
          }
          return username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, "");
        };

        // Find exact computed username match first
        const exactUsernameMatch = profsList.find(p => {
          const pUsername = getProfessionalUsername(p.name);
          return sanitizeStr(pUsername) === userUsernameSanitized;
        });
        if (exactUsernameMatch) return exactUsernameMatch;

        // 3. Fuzzy lookup fallback using name segments
        const fuzzyMatch = profsList.find(p => {
          const profNameSanitized = sanitizeStr(p.name);
          const nameParts = p.name.trim().split(/\s+/);
          let firstLast = "";
          if (nameParts.length >= 2) {
            firstLast = sanitizeStr(`${nameParts[0]}.${nameParts[nameParts.length - 1]}`);
          } else {
            firstLast = sanitizeStr(nameParts[0]);
          }
          return profNameSanitized === userUsernameSanitized || firstLast === userUsernameSanitized || userUsernameSanitized.startsWith(firstLast);
        });
        return fuzzyMatch || null;
      };

      const mappedEvals = (evals || []).map((ev: any) => {
        const u = (usersData || []).find((usr: any) => usr.id === ev.system_user_id) || ev.system_user;
        let profName = u?.username || 'Profissional';
        let profId = '';
        let profRegistration = '';
        let profSpecialty = '';
        if (u) {
          const matchedProf = getProfessionalForUser(u, allProfs);
          if (matchedProf) {
            profName = matchedProf.name;
            profId = matchedProf.id;
            profRegistration = matchedProf.registration || '';
            profSpecialty = matchedProf.specialty || '';
          }
        }
        return {
          ...ev,
          professional_name: profName,
          professional_id: profId,
          professional_registration: profRegistration,
          professional_specialty: profSpecialty
        };
      });

      setEvaluations(mappedEvals);
    } catch (err: any) {
      console.error('ERRO EM FETCHDATA (EvaluationBoard):', err);
      // Helpful error message for the developer
      if (err.message) console.error('Mensagem:', err.message);
      if (err.code) console.error('Código:', err.code);
      if (err.details) console.error('Detalhes:', err.details);
      if (err.hint) console.error('Dica:', err.hint);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeEvaluationId && evaluations.length > 0) {
      const found = evaluations.find(e => e.id === activeEvaluationId);
      if (found) {
        setViewingItem(found);
        if (onClearActiveEvaluation) {
          onClearActiveEvaluation();
        }
      }
    }
  }, [activeEvaluationId, evaluations, onClearActiveEvaluation]);

  const handleOpenModal = (item?: Evaluation) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        patient_id: item.patient_id,
        unit_id: item.unit_id,
        date: item.date,
        title: item.title,
        content: item.content,
        is_private: !!item.is_private
      });
      fetchAvailableAttendances(item.patient_id, item);
    } else {
      setEditingItem(null);
      setFormData({
        patient_id: '',
        unit_id: units.length === 1 ? units[0].id : '',
        date: new Date().toISOString().split('T')[0],
        title: '',
        content: '',
        is_private: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    if (!formData.patient_id || !formData.date || !formData.title || !formData.content) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // New validation: check if an attendance exists for this professional and date
    // If editing and the date is the same, allow it
    const hasAttendance = availableAttendances.some(a => a.date === formData.date) || !!(editingItem && formData.date === editingItem.date);
    if (!hasAttendance && !isAdmin) {
      alert('Você só pode registrar evoluções para datas em que realizou um atendimento a este usuário.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        system_user_id: currentUser.id,
        created_at: editingItem ? editingItem.created_at : new Date().toISOString()
      };

      if (editingItem) {
        if (editingItem.system_user_id !== currentUser.id) {
          alert('Você só pode editar suas próprias evoluções.');
          return;
        }
        const { error } = await supabase
          .from('patient_evaluations')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('patient_evaluations')
          .insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Erro ao salvar avaliação:', err);
      alert(`Erro ao salvar avaliação: ${err.message || 'Verifique se a tabela de avaliações foi criada.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const evaluation = evaluations.find(e => e.id === itemToDelete);
      const isCurrentlyDeleted = !!evaluation?.deleted_at;

      if (isCurrentlyDeleted) {
        // Permanent delete
        const { error } = await supabase.from('patient_evaluations').delete().eq('id', itemToDelete);
        if (error) throw error;
      } else {
        // Soft delete (send to trash)
        const { error } = await supabase
          .from('patient_evaluations')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', itemToDelete);
        if (error) throw error;
      }
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Erro ao excluir avaliação:', err);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase
        .from('patient_evaluations')
        .update({ deleted_at: null })
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Erro ao restaurar avaliação:', err);
      alert('Erro ao restaurar a evolução.');
    }
  };

  const filteredEvaluations = evaluations.filter(ev => {
    // Privacy Mode rule: only the creator (system_user_id) has access when private (admin permission is excluded)
    if (ev.is_private && ev.system_user_id !== currentUser.id) {
      return false;
    }

    // Filter by Trash State
    if (showTrash) {
      if (!ev.deleted_at) return false;
    } else {
      if (ev.deleted_at) return false;
    }

    const searchMatch = (ev.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         ev.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    const unitMatch = !unitFilter || ev.unit_id === unitFilter;
    const patientMatch = !patientFilter || ev.patient_id === patientFilter;
    const professionalMatch = !professionalFilter || ev.professional_id === professionalFilter;
    const privacyMatch = !showOnlyPrivate || ev.is_private;
    return searchMatch && unitMatch && patientMatch && professionalMatch && privacyMatch;
  });

  const trashCount = evaluations.filter(ev => !!ev.deleted_at).length;
  const deletingItemData = itemToDelete ? evaluations.find(e => e.id === itemToDelete) : null;
  const isDeletingFromTrash = !!deletingItemData?.deleted_at;

  // Pagination bounds safety and computations (quebra de página de registros)
  const totalItems = filteredEvaluations.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedEvaluations = filteredEvaluations.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6 select-text animate-in fade-in duration-300" style={{ touchAction: 'pan-x pan-y' }}>
      {/* Interactive Page View - Hidden when printing */}
      <div className="space-y-6 no-print">
        {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm border border-[#e8bcb7]/10">
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-black text-[#1a1c1d]">
              {showTrash ? 'Lixeira de Evoluções' : 'Evoluções de Atendimento'}
            </h2>
            {showTrash && (
              <p className="text-[10px] font-black text-[#ed1c24] uppercase tracking-widest animate-pulse">
                Visualizando itens na lixeira
              </p>
            )}
          </div>
          
          {!showTrash && (
            <button 
              onClick={() => handleOpenModal()}
              className="lg:hidden flex items-center justify-center gap-1.5 bg-[#1a1c1d] text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-black/15 active:scale-95 transition-all shrink-0"
            >
              <Plus size={14} />
              <span>Nova</span>
            </button>
          )}
        </div>
        
        <div className="flex flex-col gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 w-full">
            <div className="relative group flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-40 group-focus-within:text-[#ed1c24] group-focus-within:opacity-100 transition-all" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por título ou usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#f4f3f5] rounded-xl text-xs sm:text-sm border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all font-semibold"
              />
            </div>

            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={cn(
                "lg:hidden flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 shrink-0 select-none h-[42px]",
                showMobileFilters || unitFilter || professionalFilter || patientFilter || showOnlyPrivate
                  ? "bg-[#ed1c24]/10 text-[#ed1c24] border-[#ed1c24]/25"
                  : "bg-[#f4f3f5] text-[#5e3f3b] border-transparent"
              )}
            >
              <Filter size={16} />
              <span>Filtros</span>
              {(unitFilter || professionalFilter || patientFilter || showOnlyPrivate) && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#ed1c24] animate-pulse" />
              )}
            </button>
          </div>

          <div className={cn(
            "w-full transition-all duration-300 lg:flex lg:flex-row lg:items-center gap-3",
            showMobileFilters ? "flex flex-col opacity-100 mt-2" : "hidden lg:flex"
          )}>
            <select
              value={unitFilter}
              onChange={(e) => {
                setUnitFilter(e.target.value);
                setPatientFilter('');
                setProfessionalFilter('');
              }}
              className="w-full lg:w-auto px-4 py-2.5 sm:py-3 bg-[#f4f3f5] rounded-xl text-xs sm:text-sm border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all font-bold text-[#5e3f3b]"
            >
              <option value="">Todas as Unidades</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>

            <select
              value={professionalFilter}
              onChange={(e) => setProfessionalFilter(e.target.value)}
              disabled={!unitFilter}
              className="w-full lg:w-auto px-4 py-2.5 sm:py-3 bg-[#f4f3f5] rounded-xl text-xs sm:text-sm border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all font-bold text-[#5e3f3b] lg:max-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed text-ellipsis overflow-hidden"
            >
              {unitFilter ? (
                <>
                  <option value="">Todos os Profissionais</option>
                  {professionalsList
                    .filter(p => professionalUnits.some(pu => pu.professional_id === p.id && pu.unit_id === unitFilter))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))
                  }
                </>
              ) : (
                <option value="">Selecione uma Unidade primeiro</option>
              )}
            </select>

            <select
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              disabled={!unitFilter}
              className="w-full lg:w-auto px-4 py-2.5 sm:py-3 bg-[#f4f3f5] rounded-xl text-xs sm:text-sm border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all font-bold text-[#5e3f3b] lg:max-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed text-ellipsis overflow-hidden"
            >
              {unitFilter ? (
                <>
                  <option value="">Todos os Usuários Atendidos</option>
                  {patients
                    .filter(p => p.unit_id === unitFilter)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))
                  }
                </>
              ) : (
                <option value="">Selecione uma Unidade primeiro</option>
              )}
            </select>

            <div className="grid grid-cols-2 lg:flex gap-2 w-full lg:w-auto mt-2 lg:mt-0">
              {!isAdmin && (
                <button
                  onClick={() => setShowOnlyPrivate(!showOnlyPrivate)}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95",
                    showOnlyPrivate 
                      ? "bg-[#1a1c1d] text-white shadow-sm" 
                      : "bg-[#f4f3f5] text-[#5e3f3b] hover:bg-[#e8bcb7]/10"
                  )}
                >
                  {showOnlyPrivate ? <Lock size={14} /> : <Unlock size={14} />}
                  <span>{showOnlyPrivate ? 'Privados' : 'Todos'}</span>
                </button>
              )}

              <button
                onClick={() => setShowTrash(!showTrash)}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 border",
                  showTrash
                    ? "bg-[#ed1c24] text-white border-[#ed1c24] shadow-sm"
                    : "bg-[#f4f3f5] text-[#5e3f3b] border-transparent hover:bg-[#e8bcb7]/10"
                )}
              >
                <Trash2 size={14} />
                <span>Lixeira</span>
                {trashCount > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none",
                    showTrash ? "bg-white text-[#ed1c24]" : "bg-[#ed1c24] text-white"
                  )}>
                    {trashCount}
                  </span>
                )}
              </button>

              {filteredEvaluations.length > 0 && !showTrash && (
                <button 
                  onClick={() => window.print()}
                  title="Imprimir evoluções filtradas com quebra de página"
                  className="col-span-2 lg:col-span-1 flex items-center justify-center gap-2 bg-[#ed1c24] text-white hover:bg-[#d11920] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-[#ed1c24]/15 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Printer size={14} className="text-white" />
                  <span>Imprimir</span>
                </button>
              )}

              {!showTrash && (
                <button 
                  onClick={() => handleOpenModal()}
                  className="hidden lg:flex items-center justify-center gap-2 bg-[#1a1c1d] text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md hover:bg-[#2a2c2d] transition-all active:scale-95 whitespace-nowrap"
                >
                  <Plus size={14} />
                  <span>Nova Evolução</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Evaluations */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-[#ed1c24]/20 border-t-[#ed1c24] rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest">Carregando avaliações...</p>
        </div>
      ) : filteredEvaluations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {paginatedEvaluations.map((ev, index) => {
              const isCurrentlyDeleted = !!ev.deleted_at;
              const canDelete = (ev.is_private ? ev.system_user_id === currentUser.id : (isAdmin || ev.system_user_id === currentUser.id));

              return (
                <motion.div 
                  key={ev.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setViewingItem(ev)}
                  className={cn(
                    "bg-white rounded-[2rem] p-6 border shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all duration-300 group flex flex-col h-full relative overflow-hidden",
                    isCurrentlyDeleted 
                      ? "border-red-200 bg-red-50/5 hover:border-red-300" 
                      : "border-[#e8bcb7]/10"
                  )}
                >
                  {/* Background Accent */}
                  <div className={cn(
                    "absolute top-0 right-0 w-24 h-24 rounded-bl-[4rem] -mr-8 -mt-8 transition-colors",
                    isCurrentlyDeleted 
                      ? "bg-red-500/5 group-hover:bg-red-500/10"
                      : "bg-[#ed1c24]/5 group-hover:bg-[#ed1c24]/10"
                  )} />

                  <div className="flex justify-between items-start mb-4 relative">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="flex items-center gap-1 text-[#ed1c24]">
                          <Calendar size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{formatDate(ev.date)}</span>
                        </div>
                        {ev.is_private && (
                          <div className="flex items-center gap-1 text-black bg-black/10 px-2 py-0.5 rounded-full">
                            <Lock size={10} />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Privado</span>
                          </div>
                        )}
                        {/* Trash state badge */}
                        {isCurrentlyDeleted && (
                          <div className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                            <Trash2 size={10} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Lixeira</span>
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-[#1a1c1d] leading-tight line-clamp-1">{ev.title}</h3>
                    </div>
                    {canDelete && (
                      <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity shrink-0">
                        {isCurrentlyDeleted ? (
                          <>
                            {/* Restore Button */}
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleRestore(ev.id); 
                              }}
                              title="Restaurar Evolução"
                              className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all"
                            >
                              <History size={16} />
                            </button>
                            {/* Permanent Delete Button */}
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setItemToDelete(ev.id); 
                                setIsDeleteModalOpen(true); 
                              }}
                              title="Excluir Definitivamente"
                              className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Edit Button */}
                            {ev.system_user_id === currentUser.id && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleOpenModal(ev); }}
                                className="p-1.5 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/10 rounded-lg transition-all"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {/* Delete Button */}
                            <button 
                              onClick={(e) => { e.stopPropagation(); setItemToDelete(ev.id); setIsDeleteModalOpen(true); }}
                              className="p-1.5 text-[#5e3f3b] hover:text-[#ed1c24] hover:bg-[#ed1c24]/10 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-4 mb-6 relative">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#ed1c24] shadow-sm">
                          <User size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest">Usuário</span>
                          <span className="text-xs font-bold text-[#1a1c1d]">{ev.patient?.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#5e3f3b] shadow-sm">
                          <MapPin size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest">Unidade</span>
                          <span className="text-xs font-bold text-[#1a1c1d]">{ev.unit?.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#f4f3f5] flex items-center justify-between mt-auto bg-white/50 -mx-6 -mb-6 px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest">Profissional</span>
                      <span className="text-[10px] font-black text-[#ed1c24]">{ev.professional_name || 'Sistema'}</span>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                      isCurrentlyDeleted 
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : (ev.is_private ? "bg-[#1a1c1d] text-white" : "bg-green-100 text-green-700")
                    )}>
                      {isCurrentlyDeleted ? 'Excluído' : (ev.is_private ? 'Privado' : 'Público')}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] p-20 text-center space-y-6 border border-[#e8bcb7]/10 shadow-sm">
          <div className="w-24 h-24 bg-[#f4f3f5] rounded-full flex items-center justify-center mx-auto text-[#5e3f3b] opacity-20">
            <TrendingUp size={48} />
          </div>
          <div className="max-w-xs mx-auto space-y-2">
            <h3 className="text-lg font-black text-[#1a1c1d]">Nenhuma evolução encontrada</h3>
            <p className="text-sm text-[#5e3f3b] opacity-60">
              {searchTerm || unitFilter 
                ? "Não foram encontradas evoluções para os filtros selecionados." 
                : "Comece criando sua primeira evolução para acompanhar o desenvolvimento dos usuários."}
            </p>
          </div>
          {(!searchTerm && !unitFilter) && (
            <button 
              onClick={() => handleOpenModal()}
              className="bg-[#1a1c1d] text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg hover:bg-[#2a2c2d] transition-all active:scale-95"
            >
              Criar Evolução
            </button>
          )}
        </div>
      )}

      {/* Pagination Controls - Controles de paginação de registros na listagem */}
      {filteredEvaluations.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl sm:rounded-[1.5rem] shadow-sm border border-[#e8bcb7]/10">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <span className="text-xs font-bold text-[#5e3f3b] opacity-60">
              Evoluções por página:
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-[#f4f3f5] rounded-lg text-xs font-bold text-[#5e3f3b] border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all cursor-pointer"
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs font-bold text-[#5e3f3b]">
              Página <span className="text-[#ed1c24]">{activePage}</span> de {totalPages} <span className="opacity-40 font-normal">({totalItems} registros)</span>
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={activePage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-2 border border-transparent bg-[#f4f3f5] hover:bg-[#e8bcb7]/15 text-[#5e3f3b] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#f4f3f5] rounded-xl transition-all active:scale-95 shrink-0"
                title="Página Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-2 border border-transparent bg-[#f4f3f5] hover:bg-[#e8bcb7]/15 text-[#5e3f3b] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#f4f3f5] rounded-xl transition-all active:scale-95 shrink-0"
                title="Próxima Página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      </div> {/* Finaliza a div .no-print iniciada no topo do return */}

      {/* Modal - Create/Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 no-print">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-sm"
            />
            <motion.div 
              style={{ touchAction: 'pan-x pan-y' }}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 sm:p-8 border-b border-[#f4f3f5] flex justify-between items-center bg-[#f4f3f5]/30">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white flex items-center justify-center text-[#ed1c24] shadow-sm shrink-0">
                    <TrendingUp size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-black text-[#1a1c1d] truncate">
                      {editingItem ? 'Editar Evolução' : 'Nova Evolução'}
                    </h2>
                    <p className="text-[10px] sm:text-xs font-bold text-[#ed1c24] uppercase tracking-widest truncate">Preencha os detalhes do acompanhamento</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 sm:p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90 shrink-0 ml-2"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-5 sm:space-y-6 scrollbar-thin">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-2 sm:ml-4">Unidade de Destino</label>
                    <select
                      value={formData.unit_id}
                      onChange={(e) => {
                        const unitId = e.target.value;
                        setFormData(prev => ({ ...prev, unit_id: unitId, patient_id: '' }));
                      }}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#f4f3f5] rounded-xl sm:rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all font-bold"
                      required
                    >
                      <option value="">Selecione a Unidade</option>
                      {units.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-2 sm:ml-4">Usuário Atendido</label>
                    <select
                      value={formData.patient_id}
                      onChange={(e) => {
                        const pid = e.target.value;
                        setFormData(prev => ({ ...prev, patient_id: pid }));
                        if (pid) fetchAvailableAttendances(pid);
                      }}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#f4f3f5] rounded-xl sm:rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all disabled:opacity-50 font-bold"
                      required
                      disabled={!formData.unit_id}
                    >
                      <option value="">Selecione o Usuário</option>
                      {patients
                        .filter(p => !formData.unit_id || p.unit_id === formData.unit_id)
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))
                      }
                    </select>
                  </div>

                  {formData.patient_id && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between ml-2 sm:ml-4 gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#ed1c24]">Datas Disponíveis</label>
                        {attendanceLoading && <div className="w-3 h-3 border-2 border-[#ed1c24]/20 border-t-[#ed1c24] rounded-full animate-spin shrink-0" />}
                      </div>
                      
                      {availableAttendances.length > 0 ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2 p-3 sm:p-4 bg-[#f4f3f5] rounded-xl sm:rounded-2xl border border-[#e8bcb7]/10">
                            {availableAttendances.map(a => {
                              const date = a.date;
                              const isSelected = formData.date === date;
                              return (
                                <button
                                  key={date}
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, date }))}
                                  className={cn(
                                    "px-3.5 sm:px-4 py-2 rounded-xl text-[10px] font-black transition-all active:scale-95 border",
                                    isSelected 
                                      ? "bg-[#ed1c24] text-white border-[#ed1c24] shadow-md shadow-[#ed1c24]/20" 
                                      : "bg-white text-[#5e3f3b] border-[#e8bcb7]/20 hover:border-[#ed1c24]/40"
                                  )}
                                >
                                  {formatDate(date)}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[9px] font-bold text-[#5e3f3b] opacity-40 ml-2 sm:ml-4 italic">
                            * Exibindo apenas as 15 datas mais recentes com atendimento realizado e sem evolução registrada.
                          </p>
                        </div>
                      ) : !attendanceLoading ? (
                        <div className="p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl border border-orange-100 flex items-start sm:items-center gap-3">
                          <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5 sm:mt-0" />
                          <p className="text-[10px] font-bold text-orange-700 leading-normal">
                            Não encontramos atendimentos pendentes de evolução para este usuário sob sua responsabilidade. Verifique se todos os atendimentos já possuem evoluções ou se você realizou atendimentos para este usuário.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-2 sm:ml-4">Data da Evolução</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-[#ed1c24]" size={18} />
                      <input 
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className={cn(
                          "w-full pl-11 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-[#f4f3f5] rounded-xl sm:rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all uppercase",
                          formData.patient_id && !availableAttendances.some(a => a.date === formData.date) && !(editingItem && formData.date === editingItem.date) && !isAdmin && "text-red-500 ring-2 ring-red-500/20"
                        )}
                        required
                        disabled={!formData.patient_id && !isAdmin}
                      />
                    </div>
                    {formData.patient_id && !availableAttendances.some(a => a.date === formData.date) && !(editingItem && formData.date === editingItem.date) && !isAdmin && (
                      <p className="text-[9px] font-bold text-red-500 ml-2 sm:ml-4 mt-1">
                        ⚠️ Escolha uma das datas destacadas acima que possuem registro de atendimento.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-2 sm:ml-4">Título da Evolução</label>
                  <input 
                    type="text"
                    placeholder="Ex: Evolução Motora, Comportamento em Grupo..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#f4f3f5] rounded-xl sm:rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-2 sm:ml-4">Conteúdo da Evolução</label>
                  <textarea 
                    placeholder="Descreva detalhadamente o atendimento e observações..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#f4f3f5] rounded-xl sm:rounded-2xl text-sm font-medium border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all min-h-[140px] sm:min-h-[160px] resize-none"
                    required
                  />
                </div>

                <div className="space-y-2 bg-[#f4f3f5]/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#e8bcb7]/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={cn(
                        "w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors shadow-sm shrink-0",
                        formData.is_private ? "bg-[#1a1c1d] text-white" : "bg-white text-[#ed1c24]"
                      )}>
                        {formData.is_private ? <Lock size={16} /> : <Unlock size={16} />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] truncate">Privacidade da Evolução</span>
                        <span className="text-[8px] sm:text-[9px] font-medium text-[#5e3f3b] opacity-60 truncate sm:whitespace-normal">
                          {formData.is_private 
                            ? "Apenas você poderá visualizar este registro." 
                            : "Visível para todos os profissionais da unidade."}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, is_private: !prev.is_private }))}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0",
                        formData.is_private ? "bg-[#1a1c1d]" : "bg-[#5e3f3b]/20"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          formData.is_private ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:flex-1 bg-[#f4f3f5] text-[#5e3f3b] font-bold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm hover:bg-[#e9e8ea] transition-all active:scale-95 order-2 sm:order-1"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:flex-[2] bg-[#1a1c1d] text-white font-bold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm shadow-lg hover:bg-[#2a2c2d] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check size={18} />
                        {editingItem ? 'Salvar Alterações' : 'Publicar Evolução'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal - Detail/View */}
      <AnimatePresence>
        {viewingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 no-print">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingItem(null)}
              className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-sm"
            />
            <motion.div 
              style={{ touchAction: 'pan-x pan-y' }}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 sm:p-8 border-b border-[#f4f3f5] flex justify-between items-center bg-[#f4f3f5]/30">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white flex items-center justify-center text-[#ed1c24] shadow-sm shrink-0">
                    <TrendingUp size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-black text-[#1a1c1d] truncate">
                      Detalhes da Evolução
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[#5e3f3b] opacity-60 min-w-0">
                      <Calendar size={12} className="text-[#ed1c24] shrink-0" />
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest truncate">{formatDate(viewingItem.date)}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingItem(null)}
                  className="p-2 sm:p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90 shrink-0 ml-2"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-5 sm:space-y-6 scrollbar-thin">
                {/* Title */}
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40 ml-1">Título</span>
                  <h3 className="text-xl sm:text-2xl font-black text-[#1a1c1d] leading-snug">{viewingItem.title}</h3>
                </div>

                {/* Grid details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-[#f4f3f5]/50 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] border border-[#e8bcb7]/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#ed1c24] shadow-sm shrink-0 font-medium">
                      <User size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] sm:text-[9px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest truncate">Usuário Atendido</span>
                      <span className="text-xs font-bold text-[#1a1c1d] truncate">{viewingItem.patient?.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#5e3f3b] shadow-sm shrink-0 font-medium">
                      <MapPin size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] sm:text-[9px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest truncate">Unidade de Atendimento</span>
                      <span className="text-xs font-bold text-[#1a1c1d] truncate">{viewingItem.unit?.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#ed1c24] shadow-sm shrink-0 font-medium">
                      <User size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] sm:text-[9px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest truncate">Profissional Responsável</span>
                      <span className="text-xs font-bold text-[#ed1c24] truncate">{viewingItem.professional_name || 'Sistema'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#5e3f3b] shadow-sm shrink-0 font-medium">
                      {viewingItem.is_private ? <Lock size={18} className="text-[#1a1c1d]" /> : <Unlock size={18} className="text-green-600" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] sm:text-[9px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest truncate">Privacidade</span>
                      <span className="text-xs font-bold text-[#1a1c1d] truncate">
                        {viewingItem.is_private ? 'Privado' : 'Público'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content paragraph */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40 ml-2 sm:ml-4">Conteúdo da Evolução</span>
                  <div className="w-full px-5 py-4 sm:px-8 sm:py-6 bg-white rounded-xl sm:rounded-[2rem] text-sm text-[#1a1c1d] font-semibold leading-relaxed border border-[#e8bcb7]/20 shadow-inner whitespace-pre-wrap min-h-[140px] sm:min-h-[160px]">
                    {viewingItem.content}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 sm:p-8 border-t border-[#f4f3f5] flex flex-col sm:flex-row gap-2 sm:gap-3 bg-[#f4f3f5]/10">
                <button 
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="w-full sm:flex-1 bg-[#ed1c24] text-white hover:bg-[#d11920] font-bold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm shadow-[0_4px_12px_rgba(237,28,36,0.25)] transition-all active:scale-95 order-3 sm:order-2 flex items-center justify-center gap-2"
                >
                  <Printer size={16} className="text-white" />
                  Imprimir esta Evolução
                </button>
                <button 
                   type="button"
                   onClick={() => setViewingItem(null)}
                   className="w-full sm:flex-1 bg-[#f4f3f5] text-[#5e3f3b] font-bold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm hover:bg-[#e9e8ea] transition-all active:scale-95 order-2 sm:order-1"
                >
                  Fechar
                </button>
                {!!viewingItem.deleted_at ? (
                  (viewingItem.is_private ? viewingItem.system_user_id === currentUser.id : (isAdmin || viewingItem.system_user_id === currentUser.id)) && (
                    <div className="w-full sm:flex-[2] flex flex-col sm:flex-row gap-2 sm:gap-3 order-1 sm:order-2">
                      <button 
                        type="button"
                        onClick={async () => {
                          const id = viewingItem.id;
                          setViewingItem(null);
                          await handleRestore(id);
                        }}
                        className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <History size={18} />
                        Restaurar
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          const id = viewingItem.id;
                          setViewingItem(null);
                          setItemToDelete(id);
                          setIsDeleteModalOpen(true);
                        }}
                        className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Trash2 size={18} />
                        Excluir para Sempre
                      </button>
                    </div>
                  )
                ) : (
                  viewingItem.system_user_id === currentUser.id && (
                    <button 
                      type="button"
                      onClick={() => {
                        const item = viewingItem;
                        setViewingItem(null);
                        handleOpenModal(item);
                      }}
                      className="w-full sm:flex-[2] bg-[#1a1c1d] text-white font-bold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm shadow-lg hover:bg-[#2a2c2d] transition-all active:scale-95 flex items-center justify-center gap-2 order-1 sm:order-2"
                    >
                      <Edit2 size={18} />
                      Editar Evolução
                    </button>
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 no-print">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-sm"
            />
            <motion.div 
              style={{ touchAction: 'pan-x pan-y' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl sm:rounded-[2rem] p-6 sm:p-8 max-w-sm w-full text-center space-y-5 sm:space-y-6 shadow-2xl"
            >
              <div className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto shrink-0",
                isDeletingFromTrash ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
              )}>
                <Trash2 className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-black text-[#1a1c1d]">
                  {isDeletingFromTrash ? 'Excluir Definitivamente?' : 'Mover para a Lixeira?'}
                </h3>
                <p className="text-xs sm:text-sm text-[#5e3f3b] opacity-60 font-medium leading-relaxed">
                  {isDeletingFromTrash 
                    ? 'Esta ação não poderá ser desfeita. A evolução será apagada do banco de dados permanentemente.' 
                    : 'A evolução será movida para a lixeira. Você poderá restaurá-la ou excluí-la definitivamente a qualquer momento.'}
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 bg-[#f4f3f5] text-[#5e3f3b] font-bold py-3 rounded-xl text-sm hover:bg-[#e9e8ea] transition-all"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleDelete}
                  className={cn(
                    "flex-1 text-white font-bold py-3 rounded-xl text-sm shadow-lg transition-all active:scale-95",
                    isDeletingFromTrash ? "bg-red-600 hover:bg-red-700 hover:shadow-red-600/20" : "bg-amber-500 hover:bg-amber-600 hover:shadow-amber-500/20"
                  )}
                >
                  {isDeletingFromTrash ? 'Sim, Excluir' : 'Enviar para Lixeira'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Development Notice Modal */}
      <AnimatePresence>
        {isDevNoticeOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 no-print">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#1a1c1d]/80 backdrop-blur-md"
            />
            <motion.div 
              style={{ touchAction: 'pan-x pan-y' }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden p-6 sm:p-8 text-center space-y-5 sm:space-y-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#ed1c24]/10 text-[#ed1c24] rounded-full flex items-center justify-center mx-auto animate-pulse shrink-0">
                <AlertCircle className="w-9 h-9 sm:w-10 sm:h-10" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-xl sm:text-2xl font-black text-[#1a1c1d] tracking-tighter">Módulo em Desenvolvimento</h2>
                <div className="space-y-4">
                  <p className="text-xs sm:text-sm text-[#5e3f3b] font-medium leading-relaxed">
                    Olá! O módulo de <span className="font-black text-[#ed1c24]">Evoluções</span> encontra-se em desenvolvimento.
                  </p>
                  <div className="bg-[#f4f3f5] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#e8bcb7]/10 text-left">
                    <p className="text-[10px] sm:text-[11px] font-bold text-[#5e3f3b] opacity-70 uppercase tracking-widest text-center sm:text-left">
                      ⚠️ Aviso Importante
                    </p>
                    <p className="text-xs text-[#5e3f3b] mt-1 font-medium leading-normal">
                      Por favor, não utilize esta funcionalidade para registros reais no momento. Os dados inseridos aqui podem ser perdidos ou sofrer alterações estruturais sem aviso prévio.
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsDevNoticeOpen(false)}
                className="w-full bg-[#1a1c1d] text-white font-black py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm shadow-xl hover:bg-[#2a2c2d] transition-all active:scale-95 flex items-center justify-center gap-2 group"
              >
                Entendi, continuar
                <Check size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print View: formatted specifically for PDF and A4 print with page-breaks (quebra de página de impressão) */}
      <div className="print-only w-full text-[#1a1c1d] bg-white select-text">
        {/* If printing a single item */}
        {viewingItem ? (
          <div 
            className="flex flex-col font-sans"
            style={{ 
              paddingBottom: '20px'
            }}
          >
            {/* Page Header (with logo) */}
            <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-[#ed1c24]/10">
              <div className="flex items-center gap-6 font-sans">
                {(viewingItem.unit?.logo_url || unitLogoUrl) ? (
                  <div className="w-20 h-20 flex items-center justify-center p-2 bg-white rounded-2xl shadow-sm border border-[#e8bcb7]/10 overflow-hidden">
                    <img src={viewingItem.unit?.logo_url || unitLogoUrl || ''} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-20 h-20 flex items-center justify-center p-2 bg-[#f4f3f5] rounded-2xl border border-[#e8bcb7]/10">
                    <Building2 size={32} className="text-[#ed1c24] opacity-20" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black text-[#ed1c24] uppercase tracking-tight">Relatório de Evolução Individual</h1>
                  <p className="text-xs font-bold text-[#5e3f3b] opacity-60 uppercase tracking-widest mt-1">SIRA - Sistema Integrado de Registro de Atendimentos</p>
                </div>
              </div>
              <div className="text-right text-[10px] text-[#5e3f3b] font-medium mt-2">
                <p>Data de Emissão: {formatDate(new Date().toISOString().split('T')[0])}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-[#e8bcb7]/20 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-[#5e3f3b] opacity-60 uppercase tracking-widest">Evolução de Atendimento - Registro de Acompanhamento</span>
                  <h2 className="text-2xl font-black text-[#1a1c1d] mt-1">{viewingItem.title}</h2>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#ed1c24]">{formatDate(viewingItem.date)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-[#f4f3f5] p-5 rounded-2xl border border-[#e8bcb7]/20 mb-8 font-sans">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Usuário Atendido</p>
                  <p className="text-sm font-bold text-[#1a1c1d]">{viewingItem.patient?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Unidade</p>
                  <p className="text-sm font-bold text-[#1a1c1d]">{viewingItem.unit?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Profissional Responsável</p>
                  <p className="text-sm font-bold text-[#1a1c1d]">{viewingItem.professional_name || 'Sistema'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Tipo de Privacidade</p>
                  <p className="text-sm font-bold text-[#1a1c1d]">{viewingItem.is_private ? 'Privado (Confidencial)' : 'Público'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-[#5e3f3b] opacity-60 uppercase tracking-widest w-full border-b border-[#e8bcb7]/15 pb-1">Descrição da Evolução</h4>
                <div className="text-sm text-[#1a1c1d] leading-relaxed whitespace-pre-wrap p-6 border border-[#e8bcb7]/25 rounded-2xl bg-white min-h-[150px]">
                  {viewingItem.content}
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center pt-8 border-t border-[#e8bcb7]/20 print-signature font-sans break-inside-avoid">
              <div className="w-72 border-b border-[#1a1c1d] mb-3"></div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#1a1c1d]">{viewingItem.professional_name || '_____________________________'}</p>
                <p className="text-[10px] font-medium text-[#5e3f3b] opacity-60">
                  {viewingItem.professional_specialty || 'Profissional'} 
                  {viewingItem.professional_registration ? ` - ${viewingItem.professional_registration}` : ''}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* If printing selected / filtered list with page breaks */
          filteredEvaluations.map((ev, index) => (
            <div 
              key={`print-${ev.id}`} 
              className="flex flex-col font-sans text-[#1a1c1d] bg-white bg-transparent"
              style={{ 
                pageBreakAfter: index === filteredEvaluations.length - 1 ? 'auto' : 'always', 
                breakAfter: index === filteredEvaluations.length - 1 ? 'auto' : 'page', 
                paddingTop: index > 0 ? '40px' : '0px',
                paddingBottom: '20px'
              }}
            >
              {/* Page Header for each sheet (with logo) */}
              <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-[#ed1c24]/10">
                <div className="flex items-center gap-6 font-sans">
                  {(ev.unit?.logo_url || unitLogoUrl) ? (
                    <div className="w-20 h-20 flex items-center justify-center p-2 bg-white rounded-2xl shadow-sm border border-[#e8bcb7]/10 overflow-hidden">
                      <img src={ev.unit?.logo_url || unitLogoUrl || ''} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 flex items-center justify-center p-2 bg-[#f4f3f5] rounded-2xl border border-[#e8bcb7]/10">
                      <Building2 size={32} className="text-[#ed1c24] opacity-20" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-black text-[#ed1c24] uppercase tracking-tight">Relatório de Evolução Individual</h1>
                    <p className="text-xs font-bold text-[#5e3f3b] opacity-60 uppercase tracking-widest mt-1">SIRA - Sistema Integrado de Registro de Atendimentos</p>
                  </div>
                </div>
                <div className="text-right text-[10px] text-[#5e3f3b] font-medium mt-2">
                  <p>Data de Emissão: {formatDate(new Date().toISOString().split('T')[0])}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-start border-b border-[#e8bcb7]/20 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-[#5e3f3b] opacity-60 uppercase tracking-widest">Evolução de Atendimento - Registro #{index + 1} de {filteredEvaluations.length}</span>
                    <h2 className="text-2xl font-black text-[#1a1c1d] mt-1">{ev.title}</h2>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#ed1c24]">{formatDate(ev.date)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-[#f4f3f5] p-5 rounded-2xl border border-[#e8bcb7]/20 mb-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Usuário Atendido</p>
                    <p className="text-sm font-bold text-[#1a1c1d]">{ev.patient?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Unidade</p>
                    <p className="text-sm font-bold text-[#1a1c1d]">{ev.unit?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Profissional Responsável</p>
                    <p className="text-sm font-bold text-[#1a1c1d]">{ev.professional_name || 'Sistema'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Tipo de Privacidade</p>
                    <p className="text-sm font-bold text-[#1a1c1d]">{ev.is_private ? 'Privado (Confidencial)' : 'Público'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-[#5e3f3b] opacity-60 uppercase tracking-widest w-full border-b border-[#e8bcb7]/15 pb-1">Descrição de Evolução</h4>
                  <div className="text-sm text-[#1a1c1d] leading-relaxed whitespace-pre-wrap p-6 border border-[#e8bcb7]/25 rounded-2xl bg-white min-h-[150px]">
                    {ev.content}
                  </div>
                </div>
              </div>

              <div className="mt-12 flex flex-col items-center pt-8 border-t border-[#e8bcb7]/20 print-signature font-sans break-inside-avoid">
                <div className="w-72 border-b border-[#1a1c1d] mb-3"></div>
                <div className="text-center">
                  <p className="text-sm font-bold text-[#1a1c1d]">{ev.professional_name || '_____________________________'}</p>
                  <p className="text-[10px] font-medium text-[#5e3f3b] opacity-60">
                    {ev.professional_specialty || 'Profissional'} 
                    {ev.professional_registration ? ` - ${ev.professional_registration}` : ''}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

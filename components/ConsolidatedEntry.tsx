'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Calendar, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { ActivityLogger } from '@/lib/activity_logger';

interface Patient {
  id: string;
  name: string;
  record_number: string;
  status: string;
}

interface ConsolidatedEntryProps {
  currentUser: any;
  filters: {
    project: string;
    professional: string;
    modality: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onSave?: () => void;
  isArchived?: boolean;
}

export function ConsolidatedEntry({ currentUser, filters, onFilterChange, onSave, isArchived = false }: ConsolidatedEntryProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [modalities, setModalities] = useState<any[]>([]);

  // Load initial options
  useEffect(() => {
    const fetchOptions = async () => {
      // 0. Fetch unit permissions for unit admin
      let allowedUnitIds: string[] = [];
      if (currentUser?.id && currentUser?.permission === 'Administrador por Unidade') {
        const { data: userUnits, error: userUnitsError } = await supabase
          .from('system_user_units')
          .select('unit_id')
          .eq('system_user_id', currentUser.id);
        
        if (!userUnitsError && userUnits) {
          allowedUnitIds = userUnits.map((u: any) => u.unit_id);
        }
      }

      // 1. Fetch active projects
      const { data: projs } = await supabase.from('projects').select('*, units(name)').eq('status', 'Ativo').order('name');
      
      let filteredProjects = projs || [];
      if (currentUser?.permission === 'Administrador por Unidade') {
        filteredProjects = filteredProjects.filter((p: any) => allowedUnitIds.includes(p.unit_id));
      }
      setProjects(filteredProjects);

      // 2. Fetch active professionals
      const { data: profs } = await supabase
        .from('professionals')
        .select(`
          *,
          professional_projects(project_id, projects(name)),
          professional_modalities(modality_id, modalities(name)),
          professional_units(unit_id)
        `)
        .eq('status', 'Ativo')
        .order('name');
      
      let mappedProfs = profs?.map((p: any) => ({
        ...p,
        projects: p.professional_projects?.map((pp: any) => {
          const proj = Array.isArray(pp.projects) ? pp.projects[0] : pp.projects;
          return proj?.name;
        }).filter(Boolean) || [],
        modalities: p.professional_modalities?.map((pm: any) => {
          const mod = Array.isArray(pm.modalities) ? pm.modalities[0] : pm.modalities;
          return mod?.name;
        }).filter(Boolean) || []
      })) || [];

      if (currentUser?.permission === 'Administrador por Unidade') {
        mappedProfs = mappedProfs.filter((p: any) => {
          const profUnitIds = p.professional_units?.map((pu: any) => pu.unit_id) || [];
          return profUnitIds.some((uid: string) => allowedUnitIds.includes(uid));
        });
      }
      setProfessionals(mappedProfs);

      // 3. Fetch active modalities
      const { data: mods } = await supabase.from('modalities').select('*').eq('status', 'Ativo').order('name');
      setModalities(mods || []);
    };
    fetchOptions();
  }, [currentUser]);

  const currentProf = professionals.find(p => {
    if (!currentUser || (currentUser.permission !== 'Profissional' && currentUser.permission !== 'Professional')) return false;
    
    if (currentUser.email && currentUser.email.startsWith('prof_')) {
      const expectedProfId = currentUser.email.replace('prof_', '').split('@')[0];
      if (p.id === expectedProfId) return true;
    }
    if (p.username && p.username.toLowerCase() === currentUser.username.toLowerCase()) {
      return true;
    }

    const sanitize = (str: string) => 
      str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";

    const userEmail = sanitize(currentUser.username);

    const profName = sanitize(p.name);
    const nameParts = p.name.trim().split(/\s+/);
    
    // Try mapping username format: first.last
    let firstLast = "";
    if (nameParts.length >= 2) {
      firstLast = sanitize(`${nameParts[0]}.${nameParts[nameParts.length - 1]}`);
    } else {
      firstLast = sanitize(nameParts[0]);
    }

    return profName === userEmail || firstLast === userEmail || userEmail.startsWith(firstLast);
  });

  const isProfessional = currentUser?.permission === 'Profissional' || currentUser?.permission === 'Professional';

  // Logic to restrict projects if user is a Professional or a Professional is selected
  const getRestrictedProjects = () => {
    // 1. If currently logged in user is a Professional, only show their projects
    if (isProfessional && currentProf) {
      return projects.filter(p => currentProf.projects?.includes(p.name));
    }

    // 2. If a professional is selected in filters, only show projects assigned to them
    if (filters.professional) {
      const selectedProf = professionals.find(p => p.name === filters.professional);
      if (selectedProf) {
        return projects.filter(p => selectedProf.projects?.includes(p.name));
      }
    }

    return projects;
  };

  const restrictedProjects = getRestrictedProjects();

  // Auto-set professional if user is a Professional
  // AND prevent changing it
  useEffect(() => {
    if (isProfessional && currentProf && filters.professional !== currentProf.name) {
      onFilterChange('professional', currentProf.name);
    }
  }, [isProfessional, currentProf, filters.professional, onFilterChange]);

  // Effect to auto-populate project and modality if selected professional has only one project and one modality
  useEffect(() => {
    if (filters.professional && professionals.length > 0) {
      const prof = professionals.find(p => p.name === filters.professional);
      if (prof) {
        const activeProfProjects = prof.projects?.filter((pName: string) => 
          projects.some(p => p.name === pName && p.status === 'Ativo')
        ) || [];
        
        const activeProfModalities = prof.modalities?.filter((mName: string) => 
          modalities.some(m => m.name === mName && m.status === 'Ativo')
        ) || [];

        if (activeProfProjects.length === 1 && activeProfModalities.length === 1) {
          if (filters.project !== activeProfProjects[0]) {
            handleProjectChange(activeProfProjects[0]);
          }
          if (filters.modality !== activeProfModalities[0]) {
            onFilterChange('modality', activeProfModalities[0]);
          }
        }
      }
    }
  }, [filters.professional, professionals, onFilterChange, filters.project, filters.modality, projects, modalities]);

  // Load patients and current attendance for the selected date
  useEffect(() => {
    fetchData();
  }, [selectedDate, filters.project, filters.professional, filters.modality]);

  const fetchData = async () => {
    if (!filters.project || !filters.professional || !filters.modality) {
      setAttendance({});
      return;
    }

    setIsLoading(true);
    try {
      // Security: If professional, ensure we only fetch for them
      let enforcedProfessionalName = filters.professional;
      if (isProfessional && currentProf) {
        enforcedProfessionalName = currentProf.name;
      }

      // 1. Get project unit_id
      let selectedProject = projects.find(p => p.name === filters.project);
      let projectUnitId = selectedProject?.unit_id;

      // If project is selected but not found in state yet, fetch it specifically
      if (filters.project && !projectUnitId) {
        const { data: projData } = await supabase
          .from('projects')
          .select('id, unit_id')
          .eq('name', filters.project)
          .maybeSingle();
        
        if (projData) {
          projectUnitId = projData.unit_id;
          // Also useful for the attendance query later
          if (!selectedProject) {
            selectedProject = projData as any;
          }
        }
      }

      // 2. Fetch all active patients
      let patientsQuery = supabase
        .from('patients')
        .select('id, name, record_number, status, unit_id')
        .eq('status', 'Ativo')
        .order('name');
      
      if (projectUnitId) {
        patientsQuery = patientsQuery.eq('unit_id', projectUnitId);
      } else if (filters.project) {
        // If we have a project but no unit ID yet, and we failed to fetch it, 
        // we should probably not show any patients to be safe, or wait.
        // For now, let's just return if we can't identify the unit for a selected project
        setPatients([]);
        setIsLoading(false);
        return;
      }

      const { data: patientsData, error: patientsError } = await patientsQuery;

      if (patientsError) throw patientsError;
      setPatients(patientsData || []);

      // 3. Fetch attendance for the selected date
      const date = new Date(selectedDate + 'T12:00:00');
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      let professional = professionals.find(p => p.name === enforcedProfessionalName);
      if (enforcedProfessionalName && !professional) {
        const { data: profData } = await supabase.from('professionals').select('id').eq('name', enforcedProfessionalName).maybeSingle();
        professional = profData;
      }

      let modality = modalities.find(m => m.name === filters.modality);
      if (filters.modality && !modality) {
        const { data: modData } = await supabase.from('modalities').select('id').eq('name', filters.modality).maybeSingle();
        modality = modData;
      }

      let attendanceQuery = supabase
        .from('attendance')
        .select('patient_id')
        .eq('day', day)
        .eq('month', month)
        .eq('year', year);
      
      if (selectedProject) attendanceQuery = attendanceQuery.eq('project_id', selectedProject.id);
      if (professional) attendanceQuery = attendanceQuery.eq('professional_id', professional.id);
      if (modality) attendanceQuery = attendanceQuery.eq('modality_id', modality.id);

      const { data: attendanceData, error: attendanceError } = await attendanceQuery;

      if (attendanceError) throw attendanceError;

      const attendanceMap: Record<string, boolean> = {};
      (attendanceData || []).forEach((a: any) => {
        attendanceMap[a.patient_id] = true;
      });
      setAttendance(attendanceMap);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAttendance = async (patientId: string) => {
    if (!filters.project || !filters.professional || !filters.modality) return;

    // Security Check: If user is Professional, ensure they are only saving for themselves
    if (currentUser?.permission === 'Profissional') {
      const currentProfRecord = professionals.find(p => {
        const nameParts = p.name.trim().split(' ');
        let generatedUsername = '';
        if (nameParts.length >= 2) {
          generatedUsername = `${nameParts[0].toLowerCase()}.${nameParts[nameParts.length - 1].toLowerCase()}`;
        } else {
          generatedUsername = nameParts[0].toLowerCase();
        }
        generatedUsername = generatedUsername.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, "");
        return generatedUsername === currentUser.username;
      });

      if (!currentProfRecord || filters.professional !== currentProfRecord.name) {
        alert('Acesso negado: Você só pode registrar atendimentos em seu próprio nome.');
        return;
      }
    }

    // Validate if date is within project period
    const project = projects.find(p => p.name === filters.project);
    if (project) {
      const date = new Date(selectedDate + 'T12:00:00');
      if (project.start_date) {
        const start = new Date(project.start_date + 'T00:00:00');
        if (date < start) {
          alert(`A data selecionada é anterior ao início do projeto (${formatDate(project.start_date)})`);
          return;
        }
      }
      if (project.end_date) {
        const end = new Date(project.end_date + 'T23:59:59');
        if (date > end) {
          alert(`A data selecionada é posterior ao término do projeto (${formatDate(project.end_date)})`);
          return;
        }
      }
    }

    const isAdding = !attendance[patientId];
    const date = new Date(selectedDate + 'T12:00:00');
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    setIsSaving(patientId);
    
    // Optimistic update
    setAttendance(prev => ({ ...prev, [patientId]: isAdding }));

    try {
      // Find the correct professional object, enforcing role restriction
      let enforcedProfessional = professionals.find(p => p.name === filters.professional);
      if (isProfessional && currentProf) {
        enforcedProfessional = currentProf;
      }

      const patientObj = patients.find(p => p.id === patientId);
      const patientName = patientObj?.name || 'Assistido';
      const project = projects.find(p => p.name === filters.project);
      const modality = modalities.find(m => m.name === filters.modality);
      const unitNameLocal = project?.units?.name || project?.unit_name || null;

      if (isAdding) {
        // Find IDs for the selected names
        await supabase.from('attendance').insert({
          patient_id: patientId,
          project_id: project?.id,
          professional_id: enforcedProfessional?.id,
          modality_id: modality?.id,
          day,
          month,
          year
        });

        ActivityLogger.logCreation(
          'atendimentos', 
          { patient_id: patientId, day, month, year, project: filters.project, modality: filters.modality, professional: enforcedProfessional?.name }, 
          `Registrou atendimento em Registro Diário para "${patientName}" no dia ${day}/${month}/${year}.`,
          unitNameLocal
        );
      } else {
        await supabase.from('attendance').delete()
          .eq('patient_id', patientId)
          .eq('day', day)
          .eq('month', month)
          .eq('year', year)
          .eq('project_id', project?.id)
          .eq('professional_id', enforcedProfessional?.id)
          .eq('modality_id', modality?.id);

        ActivityLogger.logDeletion(
          'atendimentos', 
          { patient_id: patientId, day, month, year, project: filters.project, modality: filters.modality, professional: enforcedProfessional?.name }, 
          `Removeu atendimento em Registro Diário para "${patientName}" no dia ${day}/${month}/${year}.`,
          unitNameLocal
        );
      }
    } catch (err) {
      console.error('Erro ao salvar atendimento:', err);
      // Revert optimistic update
      setAttendance(prev => ({ ...prev, [patientId]: !isAdding }));
    } finally {
      setIsSaving(null);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.record_number.includes(searchTerm)
  );

  const handleProjectChange = (projectName: string) => {
    onFilterChange('project', projectName);
    
    if (projectName) {
      const project = projects.find(p => p.name === projectName);
      
      // Check if current professional is valid for the new project
      if (filters.professional) {
        const prof = professionals.find(p => p.name === filters.professional);
        if (prof && !prof.projects?.includes(projectName)) {
          onFilterChange('professional', '');
          onFilterChange('modality', '');
        }
      }

      // Validate selected date for the new project
      if (project) {
        const date = new Date(selectedDate + 'T12:00:00');
        if (project.start_date) {
          const start = new Date(project.start_date + 'T00:00:00');
          if (date < start) {
            setSelectedDate(project.start_date);
          }
        }
        if (project.end_date) {
          const end = new Date(project.end_date + 'T23:59:59');
          if (date > end) {
            setSelectedDate(project.end_date);
          }
        }
      }
    } else {
      onFilterChange('professional', '');
      onFilterChange('modality', '');
    }
  };

  const handleProfessionalChange = (professionalName: string) => {
    onFilterChange('professional', professionalName);
    
    if (professionalName) {
      const prof = professionals.find(p => p.name === professionalName);
      if (prof) {
        // Clear project if the selected professional is not assigned to it
        if (filters.project && !prof.projects?.includes(filters.project)) {
          onFilterChange('project', '');
        }
        // Clear modality if the selected professional is not assigned to it
        if (filters.modality && !prof.modalities?.includes(filters.modality)) {
          onFilterChange('modality', '');
        }
      }
    } else {
      onFilterChange('modality', '');
    }
  };

  const selectedProject = projects.find(p => p.name === filters.project);

  const handleDateChange = (date: string) => {
    if (selectedProject) {
      const selected = new Date(date + 'T12:00:00');
      if (selectedProject.start_date) {
        const start = new Date(selectedProject.start_date + 'T00:00:00');
        if (selected < start) {
          const d = selectedProject.start_date;
          setSelectedDate(d);
          const parts = d.split('-');
          onFilterChange('month', parseInt(parts[1]).toString());
          onFilterChange('year', parts[0]);
          return;
        }
      }
      if (selectedProject.end_date) {
        const end = new Date(selectedProject.end_date + 'T23:59:59');
        if (selected > end) {
          const d = selectedProject.end_date;
          setSelectedDate(d);
          const parts = d.split('-');
          onFilterChange('month', parseInt(parts[1]).toString());
          onFilterChange('year', parts[0]);
          return;
        }
      }
    }
    setSelectedDate(date);
    const parts = date.split('-');
    onFilterChange('month', parseInt(parts[1]).toString());
    onFilterChange('year', parts[0]);
  };

  const [showSuccess, setShowSuccess] = useState(false);

  const handleSaveClick = () => {
    setShowSuccess(true);
    if (onSave) onSave();
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const isFiltersComplete = !!(filters.project && filters.professional && filters.modality);

  return (
    <div className="space-y-6">
      <div className="bg-[#f4f3f5] rounded-[2rem] p-5 sm:p-6 flex flex-col lg:flex-row flex-wrap items-stretch lg:items-end gap-5 sm:gap-6 shadow-sm border border-[#e8bcb7]/10">
        <div className="flex-1 min-w-full lg:min-w-[200px] space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1.5 opacity-60">Projeto</label>
          <select 
            value={filters.project}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="w-full bg-white border-0 rounded-xl text-sm h-12 lg:h-11 px-4 shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer"
          >
            <option value="">Selecione o Projeto</option>
            {restrictedProjects.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-full lg:min-w-[200px] space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1.5 opacity-60">Profissional</label>
          <select 
            value={filters.professional}
            onChange={(e) => handleProfessionalChange(e.target.value)}
            disabled={isProfessional}
            className={cn(
              "w-full bg-white border-0 rounded-xl text-sm h-12 lg:h-11 px-4 shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
              isProfessional && "bg-gray-50 border border-gray-100"
            )}
          >
            {!isProfessional && <option value="">Selecione o Profissional</option>}
            {professionals
              .filter(p => {
                if (isProfessional && currentProf) return p.id === currentProf.id;
                if (isProfessional && !currentProf) return p.name === filters.professional;
                if (!filters.project) return true;
                return p.projects?.includes(filters.project);
              })
              .map(p => (
                <option key={p.id} value={p.name}>{p.name} ({p.specialty})</option>
              ))}
          </select>
        </div>

        <div className="flex-1 min-w-full lg:min-w-[180px] space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1.5 opacity-60">Modalidade</label>
          <select 
            value={filters.modality}
            onChange={(e) => onFilterChange('modality', e.target.value)}
            disabled={!filters.professional}
            className="w-full bg-white border-0 rounded-xl text-sm h-12 lg:h-11 px-4 shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Selecione a Modalidade</option>
            {modalities
              .filter(m => {
                if (!filters.professional) return true;
                const prof = professionals.find(p => p.name === filters.professional);
                return prof?.modalities?.includes(m.name);
              })
              .map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
          </select>
        </div>

        <div className="flex-1 min-w-full lg:min-w-[150px] space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1.5 opacity-60 flex items-center gap-2">
            <Calendar size={12} className="text-[#ed1c24]" />
            Data
          </label>
          <input 
            type="date" 
            className="w-full bg-white border-0 rounded-xl text-sm h-12 lg:h-11 px-4 shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none cursor-pointer"
            value={selectedDate}
            min={selectedProject?.start_date}
            max={selectedProject?.end_date}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>
      </div>

      {!isFiltersComplete ? (
        <div className="bg-white rounded-[2rem] p-12 flex flex-col items-center justify-center text-center gap-4 border-2 border-dashed border-[#e8bcb7]/20">
          <div className="w-16 h-16 rounded-3xl bg-[#f4f3f5] flex items-center justify-center text-[#ed1c24]">
            <Search size={32} strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#1a1c1d]">Aguardando Filtros</h3>
            <p className="text-sm text-[#5e3f3b] opacity-60 max-w-xs">
              Selecione o projeto, profissional e modalidade para visualizar a lista de usuários.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] shadow-sm border border-[#e8bcb7]/10">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-40" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar por nome ou prontuário..."
                className="w-full bg-[#f4f3f5] border-0 rounded-xl py-3.5 sm:py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] shadow-sm overflow-hidden border border-[#e8bcb7]/10">
            <div className="p-4 sm:p-6 border-b border-[#f4f3f5] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-[#1a1c1d]">Lista de Usuários</h3>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] bg-[#f4f3f5] px-3 py-1.5 rounded-full">
                {filteredPatients.length} Usuários Encontrados
              </span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-[#ed1c24] animate-spin opacity-20" />
                <p className="text-xs font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest">Buscando usuários...</p>
              </div>
            ) : (
              <div className="divide-y divide-[#f4f3f5]">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map(patient => (
                    <div 
                      key={patient.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 hover:bg-[#f4f3f5]/30 transition-colors group gap-4"
                    >
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#f4f3f5] flex items-center justify-center text-[10px] sm:text-xs font-black text-[#5e3f3b] group-hover:bg-white transition-colors shrink-0">
                          {patient.record_number.padStart(3, '0')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm sm:text-base font-bold text-[#1a1c1d] truncate">{patient.name}</p>
                          <p className="text-[9px] sm:text-[10px] font-bold text-[#ed1c24] uppercase tracking-widest opacity-70">Prontuário: {patient.record_number}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleAttendance(patient.id)}
                        disabled={isSaving === patient.id || isArchived}
                        className={cn(
                          "flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 min-h-[44px]",
                          attendance[patient.id]
                            ? "bg-[#ed1c24] text-white shadow-[0_4px_12px_rgba(237,28,36,0.2)]"
                            : "bg-[#f4f3f5] text-[#5e3f3b] hover:bg-[#e9e8ea]",
                          isArchived && !attendance[patient.id] && "opacity-50",
                          isArchived && "cursor-not-allowed active:scale-100"
                        )}
                      >
                        {isSaving === patient.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : attendance[patient.id] ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <Circle size={16} />
                        )}
                        <span>{attendance[patient.id] ? 'Atendido' : 'Marcar Presença'}</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center">
                    <p className="text-sm font-bold text-[#5e3f3b] opacity-40">Nenhum usuário encontrado com os termos da pesquisa.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 pt-4">
        <div className="flex flex-wrap gap-4 sm:gap-8 items-center justify-center bg-[#f4f3f5] px-6 py-4 rounded-2xl border border-[#e8bcb7]/10 w-full lg:w-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b]">Legenda:</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#ed1c24]"></div>
            <span className="text-xs font-semibold text-[#1a1c1d]">Realizado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border border-[#e8bcb7]/40 bg-white"></div>
            <span className="text-xs font-semibold text-[#1a1c1d]">Ausência</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <button 
            onClick={() => {
              onFilterChange('project', '');
              onFilterChange('professional', '');
              onFilterChange('modality', '');
              setSearchTerm('');
            }}
            className="flex-1 bg-[#e9e8ea] text-[#1a1c1d] font-bold px-6 py-4 rounded-xl text-sm hover:bg-[#f4f3f5] transition-all active:scale-95 min-h-[44px]"
          >
            Limpar Filtros
          </button>
          <button 
            onClick={handleSaveClick}
            disabled={!filters.project || !filters.professional || !filters.modality || showSuccess || isArchived}
            className={cn(
              "flex-1 font-bold px-8 py-4 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 min-h-[44px]",
              showSuccess 
                ? "bg-green-600 text-white shadow-[0_8px_20px_rgba(22,163,74,0.25)]" 
                : "bg-[#ed1c24] text-white shadow-[0_8px_20px_rgba(237,28,36,0.25)] hover:bg-[#d11920]"
            )}
          >
            {showSuccess ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 size={18} />
                <span>Alterações Salvas!</span>
              </div>
            ) : (
              'Salvar Alterações'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

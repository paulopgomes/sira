'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar, ViewType, SubViewType } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { StatsCards } from '@/components/StatsCards';
import { Filters } from '@/components/Filters';
import { AttendanceTable } from '@/components/AttendanceTable';
import { UserCRUD } from '@/components/UserCRUD';
import { ProfessionalCRUD } from '@/components/ProfessionalCRUD';
import { ProjectCRUD } from '@/components/ProjectCRUD';
import { ModalityCRUD } from '@/components/ModalityCRUD';
import { UnitCRUD } from '@/components/UnitCRUD';
import { SystemUserCRUD } from '@/components/SystemUserCRUD';
import { EvaluationBoard } from '@/components/EvaluationBoard';
import { ConsolidatedEntry } from '@/components/ConsolidatedEntry';
import { MonthlyReport } from '@/components/MonthlyReport';
import { CustomReports } from '@/components/CustomReports';
import { LoginPage } from '@/components/LoginPage';
import { ActivityHistory } from '@/components/ActivityHistory';
import { ActivityLogger } from '@/lib/activity_logger';
import { LoadingScreen } from '@/components/LoadingScreen';
import { BottomNav } from '@/components/BottomNav';
import { Building2, Contact, FolderKanban, Settings as SettingsIcon, ShieldCheck, CheckCircle2, AlertCircle, ClipboardList } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface AttendanceData {
  id: string | number;
  name: string;
  record_number: string;
  status: 'Ativo' | 'Inativo';
  attendance: number[];
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; email?: string; permission: string; session_version?: number } | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('atendimentos');
  const [currentSubView, setCurrentSubView] = useState<SubViewType>('profissionais');
  const [targetSubViewUsername, setTargetSubViewUsername] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [hasUnitPermission, setHasUnitPermission] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [filters, setFilters] = useState({
    project: '',
    professional: '',
    modality: '',
    month: (new Date().getMonth() + 1).toString(),
    year: new Date().getFullYear().toString()
  });

  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [modalities, setModalities] = useState<any[]>([]);
  const [unitLogoUrl, setUnitLogoUrl] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [archivedPeriods, setArchivedPeriods] = useState<any[]>([]);
  const [activeEvaluationId, setActiveEvaluationId] = useState<string | null>(null);

  // Compute first and last name for current logged-in user
  const userDisplayName = useMemo(() => {
    if (!currentUser) return '';
    
    const sanitize = (str: string) => 
      str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
    
    const userEmail = sanitize(currentUser.username);
    const matchedProf = professionals.find((p: any) => {
      if (currentUser.email && currentUser.email.startsWith('prof_')) {
        const expectedProfId = currentUser.email.replace('prof_', '').split('@')[0];
        if (p.id === expectedProfId) return true;
      }
      if (p.username && p.username.toLowerCase() === currentUser.username.toLowerCase()) {
        return true;
      }

      const profName = sanitize(p.name);
      const nameParts = p.name.trim().split(/\s+/);
      let firstLast = "";
      if (nameParts.length >= 2) {
        firstLast = sanitize(`${nameParts[0]}.${nameParts[nameParts.length - 1]}`);
      } else {
        firstLast = sanitize(nameParts[0]);
      }
      return profName === userEmail || firstLast === userEmail || userEmail.startsWith(firstLast);
    });

    if (matchedProf) {
      const nameParts = matchedProf.name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        return `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
      }
      return nameParts[0];
    }

    if (currentUser.username.includes('.')) {
      const parts = currentUser.username.split('.');
      const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const last = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
      return `${first} ${last}`;
    }

    return currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
  }, [currentUser, professionals]);

  // Fetch archived periods
  const fetchArchivedPeriods = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('archived_periods').select('*');
      if (!error) setArchivedPeriods(data || []);
    } catch (err) {
      console.error('Error fetching archived periods:', err);
    }
  }, []);

  // Fetch options for mapping names to IDs
  const fetchOptions = useCallback(async () => {
    setDbError(null);
    try {
      // 0. Fetch unit permissions for unit admin or professional
      let allowedUnitIds: string[] = [];
      if (currentUser?.id) {
        const { data: userUnits, error: userUnitsError } = await supabase
          .from('system_user_units')
          .select('unit_id')
          .eq('system_user_id', currentUser.id);
        
        if (!userUnitsError && userUnits) {
          allowedUnitIds = userUnits.map((u: any) => u.unit_id);
        }
      }

      // 1. Fetch projects
      const { data: projs, error: projsErr } = await supabase.from('projects').select('*, units(*)').order('name');
      if (projsErr) throw projsErr;

      let filteredProjs = projs || [];
      if (currentUser?.permission === 'Administrador por Unidade') {
        filteredProjs = filteredProjs.filter((p: any) => allowedUnitIds.includes(p.unit_id));
      }
      setProjects(filteredProjs);

      // 2. Fetch professionals and their usernames from system_users
      const { data: usersData } = await supabase
        .from('system_users')
        .select('username, email');

      const { data: profs, error: profsErr } = await supabase
        .from('professionals')
        .select(`
          *,
          professional_projects(project_id, projects(name)),
          professional_modalities(modality_id, modalities(name)),
          professional_units(unit_id)
        `)
        .order('name');
      if (profsErr) throw profsErr;
      
      const mappedProfs = profs?.map((p: any) => {
        // Find associated system user
        const associatedUser = (usersData || []).find((u: any) => {
          if (u.email && u.email.startsWith(`prof_${p.id}`)) {
            return true;
          }
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
          return u.username.toLowerCase() === getProfessionalUsername(p.name).toLowerCase();
        });

        return {
          ...p,
          username: associatedUser ? associatedUser.username : undefined,
          projects: p.professional_projects?.map((pp: any) => {
            const proj = Array.isArray(pp.projects) ? pp.projects[0] : pp.projects;
            return proj?.name;
          }).filter(Boolean) || [],
          modalities: p.professional_modalities?.map((pm: any) => {
            const mod = Array.isArray(pm.modalities) ? pm.modalities[0] : pm.modalities;
            return mod?.name;
          }).filter(Boolean) || []
        };
      });

      let filteredProfs = mappedProfs || [];
      if (currentUser?.permission === 'Administrador por Unidade') {
        filteredProfs = filteredProfs.filter((p: any) => {
          const profUnitIds = p.professional_units?.map((pu: any) => pu.unit_id) || [];
          return profUnitIds.some((uid: string) => allowedUnitIds.includes(uid));
        });
      }
      setProfessionals(filteredProfs || []);

      // Check unit permission if professional
      if (currentUser?.permission === 'Profissional' && mappedProfs) {
        const sanitize = (str: string) => 
          str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
        
        const userEmail = sanitize(currentUser.username);
        const currentProf = mappedProfs.find((p: any) => {
          if (currentUser.email && currentUser.email.startsWith('prof_')) {
            const expectedProfId = currentUser.email.replace('prof_', '').split('@')[0];
            if (p.id === expectedProfId) return true;
          }
          if (p.username && p.username.toLowerCase() === currentUser.username.toLowerCase()) {
            return true;
          }

          const profName = sanitize(p.name);
          const nameParts = p.name.trim().split(/\s+/);
          let firstLast = "";
          if (nameParts.length >= 2) {
            firstLast = sanitize(`${nameParts[0]}.${nameParts[nameParts.length - 1]}`);
          } else {
            firstLast = sanitize(nameParts[0]);
          }
          return profName === userEmail || firstLast === userEmail || userEmail.startsWith(firstLast);
        });

        if (currentProf && currentProf.professional_units?.length > 0) {
          setHasUnitPermission(currentProf.professional_units.length > 0);
        } else {
          setHasUnitPermission(false);
        }
      } else {
        setHasUnitPermission(false);
      }

      // 3. Fetch modalities
      const { data: mods, error: modsErr } = await supabase.from('modalities').select('*').order('name');
      if (modsErr) throw modsErr;
      setModalities(mods || []);
    } catch (err: any) {
      console.error('Database connection error:', err);
      setDbError(err.message || 'Erro de conexão com o banco de dados.');
    }
  }, [currentUser]);

  useEffect(() => {
    setIsMounted(true);
    
    // On mobile and tablet, force 'Registro Diário de Atendimentos' (lancamento)
    if (window.innerWidth < 1024) {
      setCurrentView('lancamento');
    } else {
      // Check for view parameter in URL on desktop
      const view = searchParams.get('view') as ViewType;
      if (view) {
        setCurrentView(view);
      }
    }

    // Check for existing session
    const savedUser = localStorage.getItem('sira_user');
    if (savedUser && !isLoggedIn) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsLoggedIn(true);
      } catch (e) {
        localStorage.removeItem('sira_user');
      }
    }

    if (isLoggedIn) {
      fetchOptions();
      fetchArchivedPeriods();
    }
  }, [searchParams, fetchOptions, fetchArchivedPeriods, isLoggedIn]);

  // Handle unit logo update when project filter changes
  useEffect(() => {
    if (filters.project && projects.length > 0) {
      const selectedProject = projects.find(p => p.name === filters.project);
      if (selectedProject?.units?.logo_url) {
        setUnitLogoUrl(selectedProject.units.logo_url);
      } else {
        setUnitLogoUrl(null);
      }
    } else {
      setUnitLogoUrl(null);
    }
  }, [filters.project, projects]);

  // Handle logout
  const handleLogout = useCallback(() => {
    if (currentUser) {
      ActivityLogger.logLogout(currentUser.username, currentUser.id);
    }
    setIsLoggedIn(false);
    setCurrentUser(null);
    setAttendanceData([]);
    setFilters({
      project: '',
      professional: '',
      modality: '',
      month: (new Date().getMonth() + 1).toString(),
      year: new Date().getFullYear().toString()
    });
    setProjects([]);
    setProfessionals([]);
    setModalities([]);
    setUnitLogoUrl(null);
    setCurrentView('atendimentos');
    setCurrentSubView('profissionais');
    setIsMobileMenuOpen(false);
    setShowSuccess(false);
    localStorage.clear();
    sessionStorage.clear();
  }, [currentUser]);

  // Check active session status (force logout logic)
  useEffect(() => {
    if (!isMounted || !isLoggedIn || !currentUser?.id) return;

    let isActive = true;

    const checkSessionStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('system_users')
          .select('session_version, status')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          // If the user's account is missing or has been deleted, log them out automatically
          if (error.code === 'PGRST116') {
            console.log('[Session Check] User account not found (deleted). Logging out...');
            handleLogout();
            alert('Sua conta ou acesso ao sistema foi removido.');
            return;
          }

          // If column doesn't exist yet, ignore
          const isMissingCol = 
            error.code === 'P0002' || 
            error.code === 'PGRST204' || 
            error.code === '42703' || 
            error.message?.includes('session_version') || 
            error.message?.includes('column "session_version" does not exist');
          
          if (isMissingCol) {
            return;
          }
          console.error('[Session Check] Error reading system_user details:', error);
          return;
        }

        if (!isActive) return;

        if (data) {
          if (data.status === 'Inativo') {
            console.log('[Session Check] User is inactive. Logging out...');
            handleLogout();
            alert('Sua conta foi desativada pelo administrador.');
            return;
          }

          const localUser = JSON.parse(localStorage.getItem('sira_user') || '{}');
          const localVer = localUser.session_version || 1;
          const remoteVer = data.session_version || 1;

          if (remoteVer > localVer) {
            console.log('[Session Check] Stale session detected. Force logout...');
            handleLogout();
            alert('Sessão encerrada. Faça login novamente.');
          }
        }
      } catch (err) {
        console.error('[Session Check] Unexpected error:', err);
      }
    };

    // Run immediately
    checkSessionStatus();

    // Check every 15 seconds
    const intervalId = setInterval(checkSessionStatus, 15000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [isMounted, isLoggedIn, currentUser?.id, handleLogout]);

  // Sync data whenever filters or permission changes
  const syncData = useCallback(async () => {
    if (!isMounted || !isLoggedIn || !currentUser) return;
    
    // Professionals MUST have their professional filter set
    if (currentUser.permission === 'Profissional' && !filters.professional) {
      // Logic to auto-set will happen in Filters, but we wait here
      return;
    }

    if (!filters.project || !filters.professional || !filters.modality || !filters.month || !filters.year) {
      setAttendanceData([]);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Find the professional associated with current user if they are a record-locked professional
      let enforcedProfessionalId: string | null = null;
      if (currentUser.permission === 'Profissional') {
        const sanitize = (str: string) => 
          str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
        
        const userEmail = sanitize(currentUser.username);
        
        const currentProf = professionals.find(p => {
          if (currentUser.email && currentUser.email.startsWith('prof_')) {
            const expectedProfId = currentUser.email.replace('prof_', '').split('@')[0];
            if (p.id === expectedProfId) return true;
          }
          if (p.username && p.username.toLowerCase() === currentUser.username.toLowerCase()) {
            return true;
          }

          const profName = sanitize(p.name);
          const nameParts = p.name.trim().split(/\s+/);
          let firstLast = "";
          if (nameParts.length >= 2) {
            firstLast = sanitize(`${nameParts[0]}.${nameParts[nameParts.length - 1]}`);
          } else {
            firstLast = sanitize(nameParts[0]);
          }
          return profName === userEmail || firstLast === userEmail || userEmail.startsWith(firstLast);
        });

        if (currentProf) {
          enforcedProfessionalId = currentProf.id;
        } else {
          // If profile not found, they shouldn't see anything
          setAttendanceData([]);
          return;
        }
      }

      // 2. Find selected project to get its unit_id
      const selectedProject = projects.find(p => p.name === filters.project);
      const projectUnitId = selectedProject?.unit_id;

      // 3. Fetch patients
      let patientsQuery = supabase
        .from('patients')
        .select('id, name, record_number, status, unit_id')
        .order('name');
      
      // Filter by unit if project has one
      if (projectUnitId) {
        patientsQuery = patientsQuery.eq('unit_id', projectUnitId);
      }

      const { data: patients, error: patientsError } = await patientsQuery;

      if (patientsError) throw patientsError;

      // 4. Fetch attendance for current filters
      const project = projects.find(p => p.name === filters.project);
      const professional = professionals.find(p => p.name === filters.professional);
      const modality = modalities.find(m => m.name === filters.modality);

      // Security check: ensure professional matches if enforced
      if (enforcedProfessionalId && professional?.id !== enforcedProfessionalId) {
        setAttendanceData([]);
        return;
      }

      let attendanceQuery = supabase
        .from('attendance')
        .select('patient_id, day')
        .eq('month', parseInt(filters.month))
        .eq('year', parseInt(filters.year));
      
      if (project) attendanceQuery = attendanceQuery.eq('project_id', project.id);
      if (professional) attendanceQuery = attendanceQuery.eq('professional_id', professional.id);
      if (modality) attendanceQuery = attendanceQuery.eq('modality_id', modality.id);

      const { data: attendance, error: attendanceError } = await attendanceQuery;

      if (attendanceError) throw attendanceError;

      // 3. Merge data
      const attendanceMap: Record<string, number[]> = {};
      (attendance || []).forEach((a: any) => {
        if (!attendanceMap[a.patient_id]) attendanceMap[a.patient_id] = [];
        attendanceMap[a.patient_id].push(a.day);
      });

      const mergedData: AttendanceData[] = (patients || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        record_number: p.record_number || '',
        status: p.status,
        attendance: attendanceMap[p.id] || []
      }));

      setAttendanceData(mergedData);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Initial load and sync on filter change or view change
  useEffect(() => {
    if (currentView === 'atendimentos') {
      syncData();
    }
  }, [syncData, currentView]);

  const handleToggleAttendance = async (userId: string | number, day: number) => {
    // Security Check: If user is Professional, ensure they are only saving for themselves
    if (currentUser?.permission === 'Profissional') {
      const sanitize = (str: string) => 
        str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
      
      const userEmail = sanitize(currentUser.username);
      
      const currentProf = professionals.find(p => {
        if (currentUser.email && currentUser.email.startsWith('prof_')) {
          const expectedProfId = currentUser.email.replace('prof_', '').split('@')[0];
          if (p.id === expectedProfId) return true;
        }
        if (p.username && p.username.toLowerCase() === currentUser.username.toLowerCase()) {
          return true;
        }

        const profName = sanitize(p.name);
        const nameParts = p.name.trim().split(/\s+/);
        let firstLast = "";
        if (nameParts.length >= 2) {
          firstLast = sanitize(`${nameParts[0]}.${nameParts[nameParts.length - 1]}`);
        } else {
          firstLast = sanitize(nameParts[0]);
        }
        return profName === userEmail || firstLast === userEmail || userEmail.startsWith(firstLast);
      });

      if (!currentProf || filters.professional !== currentProf.name) {
        alert('Acesso negado: Você só pode registrar atendimentos em seu próprio nome.');
        return;
      }
    }

    const isAdding = !attendanceData.find(p => p.id === userId)?.attendance.includes(day);
    
    // Optimistic update
    setAttendanceData(prev => prev.map(p => {
      if (p.id === userId) {
        return {
          ...p,
          attendance: isAdding 
            ? [...p.attendance, day]
            : p.attendance.filter(d => d !== day)
        };
      }
      return p;
    }));

    try {
      if (isAdding) {
        // Find IDs for the selected names in filters
        const project = projects.find(p => p.name === filters.project);
        const professional = professionals.find(p => p.name === filters.professional);
        const modality = modalities.find(m => m.name === filters.modality);
        
        await supabase.from('attendance').insert({
          patient_id: userId,
          project_id: project?.id,
          professional_id: professional?.id,
          modality_id: modality?.id,
          day,
          month: parseInt(filters.month),
          year: parseInt(filters.year)
        });
      } else {
        const project = projects.find(p => p.name === filters.project);
        const professional = professionals.find(p => p.name === filters.professional);
        const modality = modalities.find(m => m.name === filters.modality);

        await supabase.from('attendance').delete()
          .eq('patient_id', userId)
          .eq('day', day)
          .eq('month', parseInt(filters.month))
          .eq('year', parseInt(filters.year))
          .eq('project_id', project?.id)
          .eq('professional_id', professional?.id)
          .eq('modality_id', modality?.id);
      }
    } catch (err) {
      console.error('Erro ao atualizar atendimento:', err);
      // Revert optimistic update on error
      syncData();
    }
  };

  const handleSaveAttendance = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleClearFilters = () => {
    setFilters({
      project: '',
      professional: '',
      modality: '',
      month: (new Date().getMonth() + 1).toString(),
      year: new Date().getFullYear().toString()
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const isFiltersComplete = !!(filters.project && filters.professional && filters.modality && filters.month && filters.year);

  const selectedProject = projects.find(p => p.name === filters.project);
  const currentUnitId = selectedProject?.unit_id;
  const selectedModality = modalities.find(m => m.name === filters.modality);
  const currentModalityId = selectedModality?.id;

  const isArchived = archivedPeriods.some(ap => 
    ap.month === parseInt(filters.month) && 
    ap.year === parseInt(filters.year) && 
    (ap.unit_id === currentUnitId || ap.unit_id === null) &&
    (ap.modality_id === currentModalityId || ap.modality_id === null)
  );

  const isAdmin = currentUser?.permission === 'Administrador';

  const handleToggleArchive = async () => {
    if (!isAdmin || !filters.month || !filters.year || !currentUnitId || !currentModalityId) return;

    try {
      const monthNum = parseInt(filters.month);
      const yearNum = parseInt(filters.year);
      const activeUnitName = selectedProject?.units?.name || 'Unidade';
      const activeModalityName = filters.modality || 'Modalidade';

      if (isArchived) {
        // Unarchive
        await supabase.from('archived_periods').delete()
          .eq('month', monthNum)
          .eq('year', yearNum)
          .eq('unit_id', currentUnitId)
          .eq('modality_id', currentModalityId);

        ActivityLogger.logRestore(
          'atendimentos',
          `Desarquivou/reabriu o período de ${filters.month}/${filters.year} para a unidade "${activeUnitName}" e modalidade "${activeModalityName}".`,
          { month: monthNum, year: yearNum, unit_id: currentUnitId, modality_id: currentModalityId },
          activeUnitName
        );
      } else {
        // Archive
        await supabase.from('archived_periods').insert({
          month: monthNum,
          year: yearNum,
          unit_id: currentUnitId,
          modality_id: currentModalityId,
          archived_by: currentUser?.id
        });

        ActivityLogger.logArchive(
          'atendimentos',
          `Arquivou/fechou o período de ${filters.month}/${filters.year} para a unidade "${activeUnitName}" e modalidade "${activeModalityName}".`,
          { month: monthNum, year: yearNum, unit_id: currentUnitId, modality_id: currentModalityId },
          activeUnitName
        );
      }
      fetchArchivedPeriods();
    } catch (err) {
      console.error('Error toggling archive:', err);
    }
  };

  if (!isMounted) {
    return <LoadingScreen userName={userDisplayName} />;
  }

  if (isTransitioning) {
    return <LoadingScreen userName={userDisplayName} />;
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={(user) => {
      ActivityLogger.logLogin(user.username, user.id, 'Sucesso');
      setIsTransitioning(true);
      setCurrentUser(user);
      setFilters({
        project: '',
        professional: '',
        modality: '',
        month: (new Date().getMonth() + 1).toString(),
        year: new Date().getFullYear().toString()
      });
      setIsLoggedIn(true);
      localStorage.setItem('sira_user', JSON.stringify(user));
      
      // Force 'Registro Diário de Atendimentos' (lancamento) on mobile/tablet upon login
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setCurrentView('lancamento');
      } else {
        setCurrentView('atendimentos');
      }
      
      // Artificial delay for smoothness as requested
      setTimeout(() => {
        setIsTransitioning(false);
      }, 1500);
    }} />;
  }

  return (
    <div className="flex min-h-screen bg-[#faf9fb]">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        permission={currentUser?.permission || ''}
        hasUnitPermission={hasUnitPermission}
      />
      
      <main className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out min-w-0 overflow-x-hidden",
        "lg:ml-20",
        !isSidebarCollapsed && "lg:ml-72",
        "ml-0"
      )}>
        <Header 
          showPrintButton={currentView === 'atendimentos' || currentView === 'relatorio'} 
          isPrintDisabled={!isFiltersComplete}
          user={{
            name: userDisplayName || currentUser?.username || '',
            role: currentUser?.permission || ''
          }}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onLogout={handleLogout}
        />
        
        {dbError && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-6 bg-[#ed1c24]/5 border border-[#ed1c24]/20 rounded-2xl p-4 flex items-center gap-3 text-[#ed1c24] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-[#ed1c24]/10 p-2 rounded-full shrink-0">
              <AlertCircle size={20} className="text-[#ed1c24]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Erro de Comunicação com o Banco de Dados</p>
              <p className="text-xs opacity-80">{dbError}</p>
            </div>
            <button 
              onClick={() => fetchOptions()}
              className="text-xs font-bold uppercase tracking-widest bg-white px-4 py-2 rounded-lg border border-[#ed1c24]/20 hover:bg-[#ed1c24]/5 transition-all"
            >
              Recarregar
            </button>
          </div>
        )}
        
        <div className={cn(
          "p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8 print:p-0 print:space-y-0 print:pb-0",
          currentView === 'configuracoes' && "max-w-[1440px] px-4 sm:px-6 lg:px-8"
        )}>
          {currentView === 'atendimentos' && (
            <div className="print-only w-full">
              <div className="print-header">
                <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-[#ed1c24]/10">
                  <div className="flex items-center gap-6">
                    {unitLogoUrl ? (
                      <div className="w-24 h-24 flex items-center justify-center p-2 bg-white rounded-2xl shadow-sm border border-[#e8bcb7]/10 overflow-hidden">
                        <img src={unitLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center p-2 bg-[#f4f3f5] rounded-2xl border border-[#e8bcb7]/10">
                        <Building2 size={40} className="text-[#ed1c24] opacity-20" />
                      </div>
                    )}
                    <div>
                      <h1 className="text-2xl font-black text-[#ed1c24] uppercase tracking-tight">Registro de Presença em Atendimento</h1>
                      <p className="text-xs font-bold text-[#5e3f3b] opacity-60 uppercase tracking-widest mt-1">SIRA - Sistema Integrado de Registro de Atendimentos</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-[#5e3f3b] font-medium mt-2">
                    <p>Data de Emissão: {formatDate(new Date().toISOString().split('T')[0])}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 bg-[#f4f3f5] p-5 rounded-2xl border border-[#e8bcb7]/20 mb-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Projeto</p>
                    <p className="text-sm font-bold text-[#1a1c1d]">{filters.project || 'Todos'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Profissional</p>
                    <p className="text-sm font-bold text-[#1a1c1d]">
                      {filters.professional || 'Todos'}
                      {(() => {
                        const prof = professionals.find(p => p.name === filters.professional);
                        return prof?.registration ? ` (${prof.registration})` : '';
                      })()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Modalidade</p>
                    <p className="text-sm font-bold text-[#1a1c1d]">{filters.modality || 'Todas'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Período</p>
                    <p className="text-sm font-bold text-[#1a1c1d]">{(() => {
                      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                      return monthNames[parseInt(filters.month) - 1] || filters.month;
                    })()} / {filters.year}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-white p-5 rounded-2xl border border-[#e8bcb7]/20 mb-8">
                  {(() => {
                    const printData = attendanceData.filter(p => p.attendance.length > 0);
                    const totalUsers = printData.length;
                    const totalAttendances = printData.reduce((acc, curr) => acc + curr.attendance.length, 0);
                    const averagePerUser = totalUsers > 0 ? totalAttendances / totalUsers : 0;
                    
                    return (
                      <>
                        <div className="space-y-1 text-center border-r border-[#e8bcb7]/20">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Usuários Atendidos</p>
                          <p className="text-sm font-black text-[#ed1c24]">{totalUsers}</p>
                        </div>
                        <div className="space-y-1 text-center border-r border-[#e8bcb7]/20">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Total Atendimentos</p>
                          <p className="text-sm font-black text-[#ed1c24]">{totalAttendances}</p>
                        </div>
                        <div className="space-y-1 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Média por Usuário</p>
                          <p className="text-sm font-black text-[#ed1c24]">{averagePerUser.toFixed(1)}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <AttendanceTable 
                data={attendanceData.filter(p => p.attendance.length > 0)} 
                onToggle={() => {}} 
                month={filters.month}
                year={filters.year}
                showAttendanceDays={true}
              />
              
              <div className="mt-20 flex flex-col items-center pt-12 print-signature">
                <div className="w-72 border-b border-[#1a1c1d] mb-3"></div>
                <div className="text-center">
                  {(() => {
                    const selectedProf = professionals.find(p => p.name === filters.professional);
                    return (
                      <>
                        <p className="text-sm font-bold text-[#1a1c1d]">{selectedProf?.name || '_____________________________'}</p>
                        <p className="text-[10px] font-medium text-[#5e3f3b] opacity-60">
                          {selectedProf?.specialty || 'Profissional'} 
                          {selectedProf?.registration ? ` - ${selectedProf.registration}` : ''}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1 no-print">
            <h1 className="text-3xl font-black tracking-tight text-[#1a1c1d]">
              {currentView === 'atendimentos' ? 'Registro Mensal de Atendimentos' : 
               currentView === 'lancamento' ? 'Registro Diário de Atendimentos' :
               currentView === 'usuarios' ? 'Gestão de Usuários' :
               currentView === 'avaliacoes' ? 'Quadro de Evoluções' :
               currentView === 'relatorio' ? 'Relatório Mensal' :
               currentView === 'relatorios_personalizados' ? 'Relatórios Personalizados' :
               currentView === 'projetos' ? 'Gestão de Projetos' :
               currentView === 'configuracoes' ? 'Configurações do Sistema' : 'Configurações'}
            </h1>
            <p className="text-sm text-[#5e3f3b] font-medium opacity-70">
              {currentView === 'atendimentos' 
                ? 'Gerencie a presença e acompanhe o progresso dos atendimentos institucionais.'
                : currentView === 'lancamento'
                ? 'Realize lançamentos rápidos selecionando uma data específica e pesquisando por usuário.'
                : currentView === 'usuarios'
                ? 'Cadastre, edite e gerencie as informações dos usuários atendidos.'
                : currentView === 'avaliacoes'
                ? ''
                : currentView === 'relatorio'
                ? 'Elabore relatórios detalhados das atividades mensais com anexos fotográficos.'
                : currentView === 'relatorios_personalizados'
                ? 'Analise dados e gere relatórios customizados para gestão estratégica.'
                : currentView === 'projetos'
                ? 'Gerencie projetos, metas, vigências e acompanhe a execução estratégica.'
                : 'Ajuste as configurações, gerencie profissionais e modalidades.'}
            </p>
          </div>

          <div>
            {currentView === 'atendimentos' ? (
              <div className="space-y-8">
                <div className="no-print">
                  <Filters 
                    filters={filters} 
                    onChange={handleFilterChange} 
                    currentUser={currentUser}
                    projects={projects}
                    professionals={professionals}
                    modalities={modalities}
                  />
                </div>

                {/* Archive Status / Admin Control */}
                {(isAdmin || isArchived) && isFiltersComplete && (
                  <div className={cn(
                    "no-print p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500",
                    isArchived 
                      ? "bg-[#ed1c24]/5 border border-[#ed1c24]/20" 
                      : "bg-[#f4f3f5] border border-[#e8bcb7]/20"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl shrink-0",
                        isArchived ? "bg-[#ed1c24] text-white" : "bg-white text-[#5e3f3b]"
                      )}>
                        {isArchived ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-[#5e3f3b] opacity-60">Status do Período</p>
                        <p className={cn(
                          "text-sm font-bold",
                          isArchived ? "text-[#ed1c24]" : "text-[#5e3f3b]"
                        )}>
                          {isArchived ? 'ARQUIVADO - Edição bloqueada' : 'Período aberto para lançamentos'}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={handleToggleArchive}
                        className={cn(
                          "w-full md:w-auto px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                          isArchived 
                            ? "bg-white text-[#ed1c24] border border-[#ed1c24]/20 hover:bg-[#ed1c24] hover:text-white" 
                            : "bg-[#ed1c24] text-white shadow-lg shadow-[#ed1c24]/20 hover:bg-[#d11920]"
                        )}
                      >
                        {isArchived ? 'Reabrir Período' : 'Arquivar Lançamentos'}
                      </button>
                    )}
                  </div>
                )}
                <div className="no-print">
                  <StatsCards data={attendanceData} currentUser={currentUser} filters={filters} />
                </div>
                
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-12 h-12 border-4 border-[#ed1c24]/20 border-t-[#ed1c24] rounded-full animate-spin" />
                    <p className="text-sm font-bold text-[#5e3f3b] opacity-60 uppercase tracking-widest">Carregando dados...</p>
                  </div>
                ) : (
                  <div className="no-print">
                    <AttendanceTable 
                      data={attendanceData} 
                      onToggle={handleToggleAttendance} 
                      disabled={!isFiltersComplete}
                      readOnly={isArchived}
                      month={filters.month}
                      year={filters.year}
                      showAttendanceDays={true}
                    />
                  </div>
                )}
                
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6 pt-4 no-print">
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
                      onClick={handleClearFilters}
                      className="flex-1 bg-[#e9e8ea] text-[#1a1c1d] font-bold px-6 py-4 rounded-xl text-sm hover:bg-[#f4f3f5] transition-all active:scale-95 min-h-[44px]"
                    >
                      Limpar Filtros
                    </button>
                    <button 
                      onClick={handleSaveAttendance}
                      disabled={!isFiltersComplete || showSuccess || isArchived}
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
            ) : currentView === 'lancamento' ? (
              <div>
                <ConsolidatedEntry 
                  currentUser={currentUser} 
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onSave={syncData}
                  isArchived={isArchived}
                />
              </div>
            ) : currentView === 'relatorio' ? (
              <div className="space-y-8">
                <div className="no-print">
                  <Filters 
                    filters={filters} 
                    onChange={handleFilterChange} 
                    currentUser={currentUser}
                    projects={projects}
                    professionals={professionals}
                    modalities={modalities}
                  />
                </div>

                {/* Archive Status / Admin Control */}
                {(isAdmin || isArchived) && isFiltersComplete && (
                  <div className={cn(
                    "no-print p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500",
                    isArchived 
                      ? "bg-[#ed1c24]/5 border border-[#ed1c24]/20" 
                      : "bg-[#f4f3f5] border border-[#e8bcb7]/20"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl shrink-0",
                        isArchived ? "bg-[#ed1c24] text-white" : "bg-white text-[#5e3f3b]"
                      )}>
                        {isArchived ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-[#5e3f3b] opacity-60">Status do Período</p>
                        <p className={cn(
                          "text-sm font-bold",
                          isArchived ? "text-[#ed1c24]" : "text-[#5e3f3b]"
                        )}>
                          {isArchived ? 'ARQUIVADO - Edição bloqueada' : 'Período aberto para lançamentos'}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={handleToggleArchive}
                        className={cn(
                          "w-full md:w-auto px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                          isArchived 
                            ? "bg-white text-[#ed1c24] border border-[#ed1c24]/20 hover:bg-[#ed1c24] hover:text-white" 
                            : "bg-[#ed1c24] text-white shadow-lg shadow-[#ed1c24]/20 hover:bg-[#d11920]"
                        )}
                      >
                        {isArchived ? 'Reabrir Período' : 'Arquivar Lançamentos'}
                      </button>
                    )}
                  </div>
                )}
                <MonthlyReport 
                  currentUser={currentUser} 
                  filters={filters}
                  unitLogoUrl={unitLogoUrl}
                  professionals={professionals}
                  isArchived={isArchived}
                />
              </div>
            ) : currentView === 'avaliacoes' ? (
              <div>
                <EvaluationBoard 
                  currentUser={currentUser!} 
                  unitLogoUrl={unitLogoUrl} 
                  activeEvaluationId={activeEvaluationId}
                  onClearActiveEvaluation={() => setActiveEvaluationId(null)}
                />
              </div>
            ) : currentView === 'relatorios_personalizados' ? (
              <div>
                <CustomReports currentUser={currentUser} />
              </div>
            ) : currentView === 'usuarios' ? (
              <div>
                <UserCRUD 
                  onUpdate={syncData} 
                  permission={currentUser?.permission || ''} 
                  userId={currentUser?.id || ''}
                  onNavigateToEvaluation={(evaluationId: string) => {
                    setActiveEvaluationId(evaluationId);
                    setCurrentView('avaliacoes');
                  }}
                />
              </div>
            ) : currentView === 'projetos' ? (
              <div>
                <ProjectCRUD 
                  onUpdate={fetchOptions}
                  permission={currentUser?.permission || ''} 
                  userId={currentUser?.id || ''}
                />
              </div>
            ) : currentView === 'configuracoes' ? (
              <div className="space-y-6">
                {/* Settings Sub-navigation - Centered & Optimized */}
                <div className="flex justify-center no-print w-full py-1">
                  <div className="bg-[#f4f3f5] p-1 rounded-xl sm:rounded-2xl w-full max-w-4xl border border-[#e8bcb7]/10 overflow-x-auto scrollbar-none">
                    <div className="flex gap-1 sm:gap-2 justify-start md:justify-center min-w-max">
                      <button
                        onClick={() => setCurrentSubView('profissionais')}
                        className={cn(
                          "flex-1 md:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap",
                          currentSubView === 'profissionais'
                            ? "bg-white text-[#ed1c24] shadow-sm"
                            : "text-[#5e3f3b] opacity-40 hover:bg-white/50"
                        )}
                      >
                        <Contact size={14} className="sm:w-4 sm:h-4 shrink-0" />
                        <span>Profissionais</span>
                      </button>
                      <button
                        onClick={() => setCurrentSubView('modalidades')}
                        className={cn(
                          "flex-1 md:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap",
                          currentSubView === 'modalidades'
                            ? "bg-white text-[#ed1c24] shadow-sm"
                            : "text-[#5e3f3b] opacity-40 hover:bg-white/50"
                        )}
                      >
                        <SettingsIcon size={14} className="sm:w-4 sm:h-4 shrink-0" />
                        <span>Modalidades</span>
                      </button>
                      <button
                        onClick={() => setCurrentSubView('unidades')}
                        className={cn(
                          "flex-1 md:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap",
                          currentSubView === 'unidades'
                            ? "bg-white text-[#ed1c24] shadow-sm"
                            : "text-[#5e3f3b] opacity-40 hover:bg-white/50"
                        )}
                      >
                        <Building2 size={14} className="sm:w-4 sm:h-4 shrink-0" />
                        <span>Unidades</span>
                      </button>
                      <button
                        onClick={() => setCurrentSubView('usuarios_sistema')}
                        className={cn(
                          "flex-1 md:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap",
                          currentSubView === 'usuarios_sistema'
                            ? "bg-white text-[#ed1c24] shadow-sm"
                            : "text-[#5e3f3b] opacity-40 hover:bg-white/50"
                        )}
                      >
                        <ShieldCheck size={14} className="sm:w-4 sm:h-4 shrink-0" />
                        <span>Acessos</span>
                      </button>
                      <button
                        onClick={() => setCurrentSubView('historico_atividades')}
                        className={cn(
                          "flex-1 md:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap",
                          currentSubView === 'historico_atividades'
                            ? "bg-white text-[#ed1c24] shadow-sm"
                            : "text-[#5e3f3b] opacity-40 hover:bg-white/50"
                        )}
                      >
                        <ClipboardList size={14} className="sm:w-4 sm:h-4 shrink-0" />
                        <span>Histórico</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 sm:mt-8">
                  {currentSubView === 'profissionais' ? (
                    <ProfessionalCRUD 
                      onUpdate={fetchOptions}
                      permission={currentUser?.permission || ''} 
                      onNavigateToSystemUsers={(username) => {
                        setTargetSubViewUsername(username);
                        setCurrentSubView('usuarios_sistema');
                      }}
                    />
                  ) : currentSubView === 'projetos' ? (
                    <ProjectCRUD 
                      onUpdate={fetchOptions}
                      permission={currentUser?.permission || ''} 
                    />
                  ) : currentSubView === 'modalidades' ? (
                    <ModalityCRUD 
                      onUpdate={fetchOptions}
                      permission={currentUser?.permission || ''} 
                    />
                  ) : currentSubView === 'unidades' ? (
                    <UnitCRUD 
                      onUpdate={fetchOptions}
                      permission={currentUser?.permission || ''} 
                    />
                  ) : currentSubView === 'usuarios_sistema' ? (
                    <SystemUserCRUD 
                      permission={currentUser?.permission || ''} 
                      currentUsername={currentUser?.username || ''}
                      targetUsername={targetSubViewUsername}
                      onClearTargetUsername={() => setTargetSubViewUsername(null)}
                    />
                  ) : (
                    <ActivityHistory />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <BottomNav 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        permission={currentUser?.permission || ''}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-[#faf9fb] items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#ed1c24]/20 border-t-[#ed1c24] rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

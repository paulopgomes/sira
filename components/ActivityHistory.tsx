'use client';

import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Calendar, 
  User, 
  MapPin, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  RefreshCw, 
  Info,
  Smartphone,
  CheckCircle,
  XCircle,
  SlidersHorizontal,
  ChevronDown,
  FileCode,
  ShieldAlert,
  Users,
  Power,
  Clock,
  Settings2,
  RotateCcw,
  EyeOff,
  Activity,
  Award,
  AlertTriangle
} from 'lucide-react';
import { ActivityLogger, ActivityLog } from '@/lib/activity_logger';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function ActivityHistory() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showSqlTip, setShowSqlTip] = useState(false);
  
  // Advanced filters state
  const [selectedUser, setSelectedUser] = useState('Todos');
  const [selectedUnit, setSelectedUnit] = useState('Todos');
  const [selectedActionType, setSelectedActionType] = useState('Todos');
  const [selectedModule, setSelectedModule] = useState('Todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Sorting & Pagination
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  
  // Selected log for detailed view modal
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Lists for population
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [allUnits, setAllUnits] = useState<string[]>([]);

  // Session management states
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; permission: string } | null>(null);
  const [hasSessionCol, setHasSessionCol] = useState<boolean | null>(null);
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [sessionActionSuccess, setSessionActionSuccess] = useState<string | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [selectedUserToDisconnect, setSelectedUserToDisconnect] = useState<string>('');
  const [dbUsersList, setDbUsersList] = useState<{ id: string; username: string; permission: string }[]>([]);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [keepMeOnGlobalLogout, setKeepMeOnGlobalLogout] = useState(true);

  // Activity Monitoring module states
  const [activeTab, setActiveTab] = useState<'logs' | 'monitoramento'>('logs');
  const [monitoringUsers, setMonitoringUsers] = useState<any[]>([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);
  const [atendimentosThreshold, setAtendimentosThreshold] = useState<number>(7);
  const [relatoriosThreshold, setRelatoriosThreshold] = useState<number>(30);
  const [evolucoesThreshold, setEvolucoesThreshold] = useState<number>(15);
  const [selectedMonitoringUnit, setSelectedMonitoringUnit] = useState<string>('all');
  const [ignoredUserIds, setIgnoredUserIds] = useState<string[]>([]);
  const [showIgnoredOnly, setShowIgnoredOnly] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem('sira_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setCurrentUser(u);

        // Check if session_version exists
        const checkCol = async () => {
          const { data, error } = await supabase
            .from('system_users')
            .select('session_version')
            .eq('id', u.id)
            .limit(1)
            .maybeSingle();
          if (error) {
            console.warn('[Session Check] Column check failed:', error);
            setHasSessionCol(false);
            setShowSessionManager(true); // Auto expand to show the instructions
          } else {
            setHasSessionCol(true);
          }
        };
        checkCol();

        // Fetch user list
        const fetchSystemUsersList = async () => {
          const { data } = await supabase
            .from('system_users')
            .select('id, username, permission')
            .order('username');
          if (data) {
            setDbUsersList(data);
          }
        };
        fetchSystemUsersList();
      } catch (err) {
        console.error('Error loading current user context in ActivityHistory:', err);
      }
    }
  }, []);

  // Monitoring Persistence & Threshold Helpers
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAtendimentos = localStorage.getItem('sira_threshold_atendimentos');
      const savedRelatorios = localStorage.getItem('sira_threshold_relatorios');
      const savedEvolucoes = localStorage.getItem('sira_threshold_evolucoes');
      const savedIgnored = localStorage.getItem('sira_ignored_monitoring_users');

      if (savedAtendimentos) setAtendimentosThreshold(Number(savedAtendimentos));
      if (savedRelatorios) setRelatoriosThreshold(Number(savedRelatorios));
      if (savedEvolucoes) setEvolucoesThreshold(Number(savedEvolucoes));
      if (savedIgnored) {
        try {
          setIgnoredUserIds(JSON.parse(savedIgnored));
        } catch (e) {
          console.error('[Monitoring] Error parsing ignored users:', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'monitoramento') {
      loadMonitoringData();
    }
  }, [activeTab]);

  const saveThreshold = (key: string, value: number, setter: (val: number) => void) => {
    setter(value);
    localStorage.setItem(key, value.toString());
  };

  const handleToggleIgnoreUser = (userId: string) => {
    let updated;
    if (ignoredUserIds.includes(userId)) {
      updated = ignoredUserIds.filter(id => id !== userId);
    } else {
      updated = [...ignoredUserIds, userId];
    }
    setIgnoredUserIds(updated);
    localStorage.setItem('sira_ignored_monitoring_users', JSON.stringify(updated));
  };

  const loadMonitoringData = async () => {
    setMonitoringLoading(true);
    setMonitoringError(null);
    try {
      // 1. Fetch system users who are professionals
      const { data: usersData, error: usersErr } = await supabase
        .from('system_users')
        .select('id, username, permission, email')
        .in('permission', ['Profissional', 'Professional', 'profissional', 'professional']);
      
      if (usersErr) throw usersErr;

      // 2. Fetch units
      const { data: unitsData, error: unitsErr } = await supabase
        .from('units')
        .select('id, name')
        .eq('status', 'Ativo');

      if (unitsErr) throw unitsErr;

      // 3. Fetch system_user_units links
      const { data: userUnitsData, error: uuErr } = await supabase
        .from('system_user_units')
        .select('system_user_id, unit_id');

      if (uuErr) throw uuErr;

      // 4. Fetch professionals
      const { data: professionalsData, error: profsErr } = await supabase
        .from('professionals')
        .select('id, name, status')
        .eq('status', 'Ativo');

      if (profsErr) throw profsErr;

      // 5. Fetch professional_units links
      const { data: professionalUnitsData, error: puErr } = await supabase
        .from('professional_units')
        .select('professional_id, unit_id');

      if (puErr) throw puErr;

      // 5b. Fetch projects
      const { data: projectsData, error: projErr } = await supabase
        .from('projects')
        .select('id, name, unit_id')
        .eq('status', 'Ativo');

      if (projErr) throw projErr;

      // 5c. Fetch professional_projects links
      const { data: professionalProjectsData, error: ppErr } = await supabase
        .from('professional_projects')
        .select('professional_id, project_id');

      if (ppErr) throw ppErr;

      // 5d. Fetch professional_modalities links
      const { data: professionalModalitiesData, error: pmErr } = await supabase
        .from('professional_modalities')
        .select('professional_id, modality_id');

      if (pmErr) throw pmErr;

      // 6. Fetch attendances (latest dates)
      const { data: attendanceData, error: attendanceErr } = await supabase
        .from('attendance')
        .select('professional_id, day, month, year, created_at')
        .order('created_at', { ascending: false });

      if (attendanceErr) throw attendanceErr;

      // 7. Fetch monthly reports
      const { data: reportsData, error: reportsErr } = await supabase
        .from('monthly_reports')
        .select('created_by, professional_name, month, year, created_at')
        .order('created_at', { ascending: false });

      if (reportsErr) {
        console.warn('Could not load monthly_reports, continuing with empty list for reports', reportsErr);
      }

      // 8. Fetch patient evaluations (evolutions)
      const { data: evaluationsData, error: evalsErr } = await supabase
        .from('patient_evaluations')
        .select('system_user_id, date, created_at')
        .order('created_at', { ascending: false });

      if (evalsErr) throw evalsErr;

      // 8b. Fetch system operational logs to capture "demais registros operacionais relevantes"
      const logsData = await ActivityLogger.fetchLogs();

      // Sanitize helper to perform fuzzy matches
      const sanitize = (str: string) => 
        str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";

      // Group latest records of Attendance
      const latestAttendanceByProf: Record<string, { date: Date; label: string }> = {};
      attendanceData?.forEach((item: any) => {
        const profId = item.professional_id;
        if (!profId) return;

        const phyDate = item.created_at ? new Date(item.created_at) : null;
        const calDate = new Date(item.year, item.month - 1, item.day);
        
        let maxDate = calDate;
        if (phyDate && phyDate > calDate) {
          maxDate = phyDate;
        }

        const formattedLabel = `${item.day.toString().padStart(2, '0')}/${item.month.toString().padStart(2, '0')}/${item.year}`;

        if (!latestAttendanceByProf[profId] || maxDate > latestAttendanceByProf[profId].date) {
          latestAttendanceByProf[profId] = { date: maxDate, label: formattedLabel };
        }
      });

      // Group latest records of Reports
      const latestReportByUser: Record<string, { date: Date; label: string }> = {};
      reportsData?.forEach((item: any) => {
        let dateObj = item.created_at ? new Date(item.created_at) : null;
        
        const reportYear = parseInt(item.year) || 2026;
        const reportMonth = parseInt(item.month) || 1;
        const calDate = new Date(reportYear, reportMonth, 0); // last day of that month
        
        if (!dateObj) {
          dateObj = calDate;
        } else if (calDate > dateObj) {
          dateObj = calDate;
        }

        const info = {
          date: dateObj,
          label: `${reportMonth.toString().padStart(2, '0')}/${reportYear}`
        };

        const keyUserId = item.created_by;
        const keyProfName = item.professional_name ? sanitize(item.professional_name) : '';

        if (keyUserId) {
          if (!latestReportByUser[keyUserId] || dateObj > latestReportByUser[keyUserId].date) {
            latestReportByUser[keyUserId] = info;
          }
        }
        if (keyProfName) {
          if (!latestReportByUser[keyProfName] || dateObj > latestReportByUser[keyProfName].date) {
            latestReportByUser[keyProfName] = info;
          }
        }
      });

      // Group latest records of Evaluations
      const latestEvaluationByUser: Record<string, { date: Date; label: string }> = {};
      evaluationsData?.forEach((item: any) => {
        const userId = item.system_user_id;
        if (!userId) return;

        const phyDate = item.created_at ? new Date(item.created_at) : null;
        let calDate = item.date ? new Date(item.date) : null;
        if (item.date && typeof item.date === 'string') {
          const [yr, mn, dy] = item.date.split('-').map(Number);
          calDate = new Date(yr, mn - 1, dy);
        }

        let maxDate = phyDate || calDate || new Date(0);
        if (calDate && calDate > maxDate) {
          maxDate = calDate;
        }

        const formattedLabel = maxDate.toLocaleDateString('pt-BR');

        if (!latestEvaluationByUser[userId] || maxDate > latestEvaluationByUser[userId].date) {
          latestEvaluationByUser[userId] = { date: maxDate, label: formattedLabel };
        }
      });

      // Group latest records of system logs for the user (to map the remaining operational actions)
      const latestOperationalLogByUser: Record<string, { date: Date; label: string }> = {};
      logsData?.forEach((item: any) => {
        const userId = item.user_id;
        const username = item.username;
        if (!userId && !username) return;

        const dateObj = item.timestamp ? new Date(item.timestamp) : null;
        if (!dateObj) return;

        // Custom action formatting in Portuguese
        const actionLabels: Record<string, string> = {
          'LOGIN': 'Login',
          'LOGOUT': 'Logout',
          'CREATION': 'Criação',
          'EDITION': 'Edição',
          'DELETION': 'Exclusão',
          'ARCHIVE': 'Arquivamento',
          'RESTORE': 'Restauração',
          'VIEW': 'Visualização',
          'FAILURE': 'Tentativa'
        };

        const actionText = actionLabels[item.action_type] || item.action_type;
        const moduleLabel = getModuleLabel(item.module);
        const label = `${actionText} (${moduleLabel})`;

        const info = { date: dateObj, label };

        if (userId) {
          if (!latestOperationalLogByUser[userId] || dateObj > latestOperationalLogByUser[userId].date) {
            latestOperationalLogByUser[userId] = info;
          }
        }
        if (username) {
          const userKey = sanitize(username);
          if (!latestOperationalLogByUser[userKey] || dateObj > latestOperationalLogByUser[userKey].date) {
            latestOperationalLogByUser[userKey] = info;
          }
        }
      });

      // Assemble monitoring models
      const now = new Date();
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Base monitoring on all active professionals
      const assembled = (professionalsData || []).map((prof: any) => {
        // Find associated system user match
        const matchingUser = (usersData || []).find((u: any) => {
          if (u.email && u.email.startsWith('prof_')) {
            const expectedProfId = u.email.replace('prof_', '').split('@')[0];
            if (prof.id === expectedProfId) return true;
          }
          if (prof.username && u.username && prof.username.toLowerCase() === u.username.toLowerCase()) {
            return true;
          }
          const profName = sanitize(prof.name);
          const userEmailSanitized = sanitize(u.username);
          const nameParts = prof.name.trim().split(/\s+/);
          let firstLast = "";
          if (nameParts.length >= 2) {
            firstLast = sanitize(`${nameParts[0]}.${nameParts[nameParts.length - 1]}`);
          } else {
            firstLast = sanitize(nameParts[0]);
          }
          return profName === userEmailSanitized || firstLast === userEmailSanitized || userEmailSanitized.startsWith(firstLast);
        });

        // Determine associated Projects of the professional
        const profProjectIds = (professionalProjectsData || [])
          .filter((pp: any) => pp.professional_id === prof.id)
          .map((pp: any) => pp.project_id);

        const associatedProjectsDetailed = (projectsData || [])
          .filter((proj: any) => profProjectIds.includes(proj.id))
          .map((proj: any) => {
            const unitObj = (unitsData || []).find((u: any) => u.id === proj.unit_id);
            return {
              name: proj.name,
              unitName: unitObj ? unitObj.name : ''
            };
          });

        const associatedProjects = associatedProjectsDetailed.map((pd: any) => pd.name);

        // Determine associated Units of the user and the professional
        const explicitUnitIds = matchingUser
          ? (userUnitsData || [])
              .filter((uu: any) => uu.system_user_id === matchingUser.id)
              .map((uu: any) => uu.unit_id)
          : [];

        const profUnitIds = (professionalUnitsData || [])
          .filter((pu: any) => pu.professional_id === prof.id)
          .map((pu: any) => pu.unit_id);

        // All linked unit ids
        const allLinkedUnitIds = Array.from(new Set([...explicitUnitIds, ...profUnitIds]));
        const associatedUnits = (unitsData || [])
          .filter((u: any) => allLinkedUnitIds.includes(u.id))
          .map((u: any) => u.name);

        // Track Activities
        // Item 1: Attendance (Atendimentos)
        let attendanceDateObj: Date | null = null;
        let attendanceLabel = 'Nenhum lançamento';
        let daysSinceAttendance = 9999;

        if (latestAttendanceByProf[prof.id]) {
          const record = latestAttendanceByProf[prof.id];
          attendanceDateObj = record.date;
          attendanceLabel = record.date.toLocaleDateString('pt-BR') + ` (${record.label})`;
          daysSinceAttendance = Math.floor((now.getTime() - record.date.getTime()) / oneDayMs);
        }

        // Item 2: Reports (Relatórios Mensais)
        let reportDateObj: Date | null = null;
        let reportLabel = 'Nenhum lançamento';
        let daysSinceReport = 9999;

        const reportRecord = (matchingUser ? latestReportByUser[matchingUser.id] : null) || latestReportByUser[sanitize(prof.name)];
        if (reportRecord) {
          reportDateObj = reportRecord.date;
          reportLabel = reportRecord.date.toLocaleDateString('pt-BR') + ` (${reportRecord.label})`;
          daysSinceReport = Math.floor((now.getTime() - reportRecord.date.getTime()) / oneDayMs);
        }

        // Item 3: Evaluations (Evoluções)
        let evaluationDateObj: Date | null = null;
        let evaluationLabel = 'Nenhum lançamento';
        let daysSinceEvaluation = 9999;

        const evalRecord = matchingUser ? latestEvaluationByUser[matchingUser.id] : null;
        if (evalRecord) {
          evaluationDateObj = evalRecord.date;
          evaluationLabel = evalRecord.date.toLocaleDateString('pt-BR');
          daysSinceEvaluation = Math.floor((now.getTime() - evalRecord.date.getTime()) / oneDayMs);
        }

        // Item 4: Operational Logs (Demais Registros)
        let operationalDateObj: Date | null = null;
        let operationalLabel = 'Nenhum lançamento';
        let daysSinceOperational = 9999;

        const pEmailSanitized = sanitize(prof.username || '');
        const opRecord = (matchingUser ? latestOperationalLogByUser[matchingUser.id] : null) || 
          latestOperationalLogByUser[pEmailSanitized] || 
          latestOperationalLogByUser[sanitize(prof.name)];
        if (opRecord) {
          operationalDateObj = opRecord.date;
          operationalLabel = opRecord.date.toLocaleString('pt-BR') + ` (${opRecord.label})`;
          daysSinceOperational = Math.floor((now.getTime() - opRecord.date.getTime()) / oneDayMs);
        }

        // Calculate dynamic overall last activity
        const activityDates = [attendanceDateObj, reportDateObj, evaluationDateObj, operationalDateObj].filter(Boolean) as Date[];
        const lastGlobalActivityDate = activityDates.length > 0 ? new Date(Math.max(...activityDates.map(d => d.getTime()))) : null;
        const daysSinceLastActivity = lastGlobalActivityDate 
          ? Math.floor((now.getTime() - lastGlobalActivityDate.getTime()) / oneDayMs)
          : 9999;

        return {
          id: prof.id,
          username: matchingUser?.username || prof.username || sanitize(prof.name),
          professionalName: prof.name,
          units: associatedUnits,
          unitIds: allLinkedUnitIds,
          projects: associatedProjects,
          projectsDetailed: associatedProjectsDetailed,
          
          attendanceDate: attendanceDateObj,
          attendanceLabel,
          daysSinceAttendance: daysSinceAttendance < 0 ? 0 : daysSinceAttendance,

          reportDate: reportDateObj,
          reportLabel,
          daysSinceReport: daysSinceReport < 0 ? 0 : daysSinceReport,

          evaluationDate: evaluationDateObj,
          evaluationLabel,
          daysSinceEvaluation: daysSinceEvaluation < 0 ? 0 : daysSinceEvaluation,

          operationalDate: operationalDateObj,
          operationalLabel,
          daysSinceOperational: daysSinceOperational < 0 ? 0 : daysSinceOperational,

          lastGlobalActivityDate,
          daysSinceLastActivity: daysSinceLastActivity < 0 ? 0 : daysSinceLastActivity
        };
      }).filter((item: any) => item !== null);

      setMonitoringUsers(assembled);

    } catch (err: any) {
      console.error('[Monitoring] Loading failed:', err);
      setMonitoringError(err.message || 'Falha ao carregar dados de monitoramento.');
    } finally {
      setMonitoringLoading(false);
    }
  };

  const handleForceLogoutMe = async () => {
    setSessionActionLoading(true);
    setSessionActionSuccess(null);
    setSessionActionError(null);
    try {
      const saved = localStorage.getItem('sira_user');
      if (!saved) throw new Error('Usuário não autenticado.');
      const userObj = JSON.parse(saved);

      const { data: userData, error: fetchErr } = await supabase
        .from('system_users')
        .select('session_version')
        .eq('id', userObj.id)
        .single();
      
      if (fetchErr) throw fetchErr;

      const currentVer = userData?.session_version || 1;
      const nextVer = currentVer + 1;

      const { error: updateErr } = await supabase
        .from('system_users')
        .update({ session_version: nextVer })
        .eq('id', userObj.id);

      if (updateErr) throw updateErr;

      // Update locally
      userObj.session_version = nextVer;
      localStorage.setItem('sira_user', JSON.stringify(userObj));
      setCurrentUser(userObj);

      await ActivityLogger.log({
        action_type: 'EDITION',
        module: 'usuarios_sistema',
        username: userObj.username,
        user_id: userObj.id,
        status: 'Sucesso',
        details: 'Usuário solicitou desconexão de todas as suas outras sessões ativas (logout de seus logins em outros dispositivos).'
      });

      setSessionActionSuccess('Suas outras sessões foram desconectadas com sucesso! Este aparelho continua conectado.');
      loadData();
    } catch (err: any) {
      setSessionActionError(err.message || 'Erro ao processar desconexão.');
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleForceLogoutTargetUser = async (targetId: string, targetUsername: string) => {
    if (!targetId) return;
    setSessionActionLoading(true);
    setSessionActionSuccess(null);
    setSessionActionError(null);
    try {
      const saved = localStorage.getItem('sira_user');
      if (!saved) throw new Error('Usuário não autenticado.');
      const creatorObj = JSON.parse(saved);

      const { data: userData, error: fetchErr } = await supabase
        .from('system_users')
        .select('session_version')
        .eq('id', targetId)
        .single();
      
      if (fetchErr) throw fetchErr;

      const currentVer = userData?.session_version || 1;
      const nextVer = currentVer + 1;

      const { error: updateErr } = await supabase
        .from('system_users')
        .update({ session_version: nextVer })
        .eq('id', targetId);

      if (updateErr) throw updateErr;

      await ActivityLogger.log({
        action_type: 'EDITION',
        module: 'usuarios_sistema',
        username: creatorObj.username,
        user_id: creatorObj.id,
        status: 'Sucesso',
        details: `Administrador revogou logins/sessões e forçou logout completo de todas as sessões do usuário: ${targetUsername}`
      });

      setSessionActionSuccess(`Sessões do usuário "${targetUsername}" foram revogadas com sucesso.`);
      setSelectedUserToDisconnect('');
      loadData();
    } catch (err: any) {
      setSessionActionError(err.message || 'Erro ao processar desconexão do usuário selecionado.');
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleForceLogoutAllUsers = async (keepMeLoggedIn: boolean) => {
    if (!window.confirm('Tem certeza absoluta que deseja desconectar TODOS os logins ativos do sistema em massa? Todos os usuários precisarão realizar o login novamente.')) {
      return;
    }
    setSessionActionLoading(true);
    setSessionActionSuccess(null);
    setSessionActionError(null);
    try {
      const saved = localStorage.getItem('sira_user');
      if (!saved) throw new Error('Usuário não autenticado.');
      const creatorObj = JSON.parse(saved);

      // Generate a new unique, high-value version number (epoch timestamp works perfectly)
      const nextVer = Math.floor(Date.now() / 1000);

      // Single high-performance bulk update for all users in the system table
      const { error: upErr } = await supabase
        .from('system_users')
        .update({ session_version: nextVer })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy filter satisfying Supabase safety checks
      
      if (upErr) throw upErr;

      if (keepMeLoggedIn) {
        creatorObj.session_version = nextVer;
        localStorage.setItem('sira_user', JSON.stringify(creatorObj));
        setCurrentUser(creatorObj);
      }

      await ActivityLogger.log({
        action_type: 'EDITION',
        module: 'usuarios_sistema',
        username: creatorObj.username,
        user_id: creatorObj.id,
        status: 'Sucesso',
        details: 'Administrador executou revogação e logout global EM MASSA de todas as sessões ativas do SIRA para todos os usuários com única transação.'
      });

      if (!keepMeLoggedIn) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
        return;
      }

      setSessionActionSuccess('Sessões de todos os usuários do SIRA foram revogadas e encerradas em massa com sucesso (exceto a sua atual).');
      loadData();
    } catch (err: any) {
      setSessionActionError(err.message || 'Erro ao processar logout global de logins.');
    } finally {
      setSessionActionLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Test if table exists first to diagnose DB issues
      const { error: schemaErr } = await supabase.from('activity_logs').select('id').limit(1);
      if (schemaErr) {
        setFetchError(`${schemaErr.code || 'UNKNOWN'}: ${schemaErr.message || 'Erro inesperado'}`);
        console.warn('Database error when testing activity_logs schema:', schemaErr);
      }

      const fetchedLogs = await ActivityLogger.fetchLogs();
      setLogs(fetchedLogs);

      // Populate unique user list from logs and system_users
      const usersSet = new Set<string>();
      fetchedLogs.forEach(l => {
        if (l.username) usersSet.add(l.username);
      });
      
      // Get additional users from db
      const { data: dbUsers } = await supabase.from('system_users').select('username');
      if (dbUsers) {
        dbUsers.forEach((u: any) => usersSet.add(u.username));
      }
      setAllUsers(Array.from(usersSet).sort());

      // Populate units list from db and logs
      const unitsSet = new Set<string>();
      fetchedLogs.forEach(l => {
        if (l.unit_name) unitsSet.add(l.unit_name);
      });
      const { data: dbUnits } = await supabase.from('units').select('name');
      if (dbUnits) {
        dbUnits.forEach((u: any) => unitsSet.add(u.name));
      }
      setAllUnits(Array.from(unitsSet).sort());

    } catch (err) {
      console.error('Error loading activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResetFilters = () => {
    setSelectedUser('Todos');
    setSelectedUnit('Todos');
    setSelectedActionType('Todos');
    setSelectedModule('Todos');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Map modules to descriptive labels
  const getModuleLabel = (moduleName: string) => {
    const modules: { [key: string]: string } = {
      'usuarios_sistema': 'Usuários do Sistema',
      'usuarios': 'Gestão de Usuários (Pacientes)',
      'pacientes': 'Gestão de Usuários (Pacientes)',
      'profissionais': 'Profissionais',
      'projetos': 'Projetos',
      'modalidades': 'Modalidades',
      'unidades': 'Unidades',
      'atendimentos': 'Atendimentos',
      'relatorio': 'Relatórios',
      'acessos': 'Acessos/Sessões'
    };
    return modules[moduleName.toLowerCase()] || moduleName;
  };

  // Map actions to labels & colors
  const getActionBadge = (action: string, status: string) => {
    if (status === 'Falha' || action === 'FAILURE') {
      return (
        <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
          Falha
        </span>
      );
    }
    
    switch (action.toUpperCase()) {
      case 'LOGIN':
        return (
          <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            Entrada
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            Saída
          </span>
        );
      case 'CREATION':
        return (
          <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            Criação
          </span>
        );
      case 'EDITION':
        return (
          <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            Edição
          </span>
        );
      case 'DELETION':
        return (
          <span className="bg-red-50 text-red-600 border border-red-100 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            Exclusão
          </span>
        );
      case 'ARCHIVE':
        return (
          <span className="bg-purple-50 text-purple-600 border border-purple-100 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            Arquivamento
          </span>
        );
      case 'RESTORE':
        return (
          <span className="bg-teal-50 text-teal-600 border border-teal-100 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            Restauração
          </span>
        );
      default:
        return (
          <span className="bg-gray-50 text-gray-600 border border-gray-100 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            {action}
          </span>
        );
    }
  };

  // Filter & sort logic
  const filteredLogs = logs.filter(log => {
    // Search Term matching
    const matchesSearch = searchTerm === '' || 
      (log.username && log.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (getModuleLabel(log.module).toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.ip_device && log.ip_device.toLowerCase().includes(searchTerm.toLowerCase()));

    // Advanced Filters
    const matchesUser = selectedUser === 'Todos' || log.username === selectedUser;
    
    // Unit match (either directly assigned unit, or can match within details)
    let matchesUnit = true;
    if (selectedUnit !== 'Todos') {
      matchesUnit = log.unit_name === selectedUnit || 
        (log.details && log.details.toLowerCase().includes(selectedUnit.toLowerCase())) ||
        (log.new_values && JSON.stringify(log.new_values).toLowerCase().includes(selectedUnit.toLowerCase())) ||
        (log.previous_values && JSON.stringify(log.previous_values).toLowerCase().includes(selectedUnit.toLowerCase()));
    }

    const matchesAction = selectedActionType === 'Todos' || log.action_type === selectedActionType;
    const matchesModule = selectedModule === 'Todos' || log.module === selectedModule;

    // Period match
    let matchesPeriod = true;
    if (startDate) {
      const logTime = new Date(log.timestamp).getTime();
      const start = new Date(startDate + 'T00:00:00').getTime();
      if (logTime < start) matchesPeriod = false;
    }
    if (endDate) {
      const logTime = new Date(log.timestamp).getTime();
      const end = new Date(endDate + 'T23:59:59').getTime();
      if (logTime > end) matchesPeriod = false;
    }

    return matchesSearch && matchesUser && matchesUnit && matchesAction && matchesModule && matchesPeriod;
  }).sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortOrder === 'recent' ? timeB - timeA : timeA - timeB;
  });

  // Pagination logic
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    // Reset to page 1 if list changes
    setCurrentPage(1);
  }, [searchTerm, selectedUser, selectedUnit, selectedActionType, selectedModule, startDate, endDate, sortOrder, pageSize]);

  // Generate change-diff analysis table
  const renderValueChanges = (prev: any, next: any) => {
    if (!prev && !next) return <p className="text-xs text-[#5e3f3b] opacity-60">Nenhum dado de valores históricos disponível.</p>;

    const keys = Array.from(new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]))
      .filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');

    if (keys.length === 0) {
      return <p className="text-xs text-[#5e3f3b] opacity-60">Nenhum campo modificado identificado.</p>;
    }

    // Translate database column keys to readable Portuguese labels
    const formatKey = (key: string) => {
      const translations: { [key: string]: string } = {
        name: 'Nome',
        status: 'Status',
        email: 'E-mail',
        permission: 'Permissão',
        username: 'Nome de usuário',
        specialty: 'Especialidade',
        crm: 'CRM/Registro',
        phone: 'Telefone',
        cpf: 'CPF',
        rg: 'RG',
        description: 'Descrição',
        attendance: 'Frequência/Presenças',
        modality_id: 'ID Modalidade',
        project_id: 'ID Projeto',
        birth_date: 'Data de Nascimento',
        gender: 'Gênero',
        contact_number: 'Nº Contato',
        address: 'Endereço',
        responsable_name: 'Responsável',
        responsable_cpf: 'CPF Responsável',
        diagnose: 'Diagnóstico/CID',
        school_shift: 'Turno Escolar',
        school_name: 'Escola',
        special_room: 'Sala de Recursos',
        sus_number: 'Cartão SUS',
        logo_url: 'URL da Logo',
        cnpj: 'CNPJ'
      };
      return translations[key] || key;
    };

    const formatVal = (val: any) => {
      if (val === null || val === undefined) return <span className="text-gray-400 italic">vazio</span>;
      if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
      if (Array.isArray(val)) return val.join(', ');
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    return (
      <div className="border border-[#e8bcb7]/20 rounded-2xl overflow-hidden bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#f4f3f5] border-b border-[#e8bcb7]/10">
              <th className="px-4 py-3 font-semibold text-[#5e3f3b]">Campo</th>
              {prev !== null && <th className="px-4 py-3 font-semibold text-[#5e3f3b]">Valor Anterior</th>}
              {next !== null && <th className="px-4 py-3 font-semibold text-[#5e3f3b]">Novo Valor</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {keys.map(k => {
              const valPrev = prev ? prev[k] : null;
              const valNext = next ? next[k] : null;
              const hasChanged = JSON.stringify(valPrev) !== JSON.stringify(valNext);

              // We only highlight edits, if it's the creation/deletion we show all
              const rowStyle = hasChanged && prev && next ? 'bg-[#ed1c24]/5' : '';

              return (
                <tr key={k} className={cn("hover:bg-gray-50/50 transition-colors", rowStyle)}>
                  <td className="px-4 py-3 font-bold text-[#1a1c1d]">{formatKey(k)}</td>
                  {prev !== null && (
                    <td className="px-4 py-3 text-[#5e3f3b] opacity-80 break-words max-w-[200px]">
                      {formatVal(valPrev)}
                    </td>
                  )}
                  {next !== null && (
                    <td className="px-4 py-3 font-medium text-[#1a1c1d] break-words max-w-[200px]">
                      {hasChanged && prev && next ? (
                        <span className="text-[#ed1c24] font-semibold">{formatVal(valNext)}</span>
                      ) : (
                        formatVal(valNext)
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Container Principal */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-[#e8bcb7]/10">
        
        {/* Header da Seção */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-[#f4f3f5]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#f4f3f5] rounded-2xl text-[#ed1c24]">
              <ClipboardList size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1a1c1d]">Histórico de Atividades</h2>
              <p className="text-xs text-[#5e3f3b] font-medium opacity-70">
                Acompanhe o registro completo de acessos, modificações e auditorias realizadas no sistema.
              </p>
            </div>
          </div>

          {activeTab === 'logs' ? (
            <button 
              onClick={loadData}
              className="self-stretch sm:self-auto flex items-center justify-center gap-2 bg-[#f4f3f5] hover:bg-[#e8bcb7]/20 text-[#5e3f3b] font-bold text-xs py-2.5 px-4 rounded-xl transition-all active:scale-95 border border-[#e8bcb7]/10"
            >
              <RefreshCw size={14} className={cn("animate-none", loading && "animate-spin")} />
              Atualizar
            </button>
          ) : (
            <button 
              onClick={loadMonitoringData}
              disabled={monitoringLoading}
              className="self-stretch sm:self-auto flex items-center justify-center gap-2 bg-[#f4f3f5] hover:bg-[#e8bcb7]/20 text-[#5e3f3b] font-bold text-xs py-2.5 px-4 rounded-xl transition-all active:scale-95 border border-[#e8bcb7]/10"
            >
              <RefreshCw size={14} className={cn("animate-none", monitoringLoading && "animate-spin")} />
              Sincronizar Monitoramento
            </button>
          )}
        </div>

        {/* Tab switch navigation */}
        <div className="flex gap-2 p-1.5 bg-[#f4f3f5] rounded-2xl w-full max-w-md mx-auto mb-6 border border-[#e8bcb7]/10 select-none no-print">
          <button
            onClick={() => setActiveTab('logs')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === 'logs'
                ? "bg-white text-[#ed1c24] shadow-xs"
                : "text-[#5e3f3b] opacity-60 hover:bg-white/50"
            )}
          >
            <ClipboardList size={14} />
            Logs de Auditoria
          </button>
          <button
            onClick={() => setActiveTab('monitoramento')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === 'monitoramento'
                ? "bg-white text-[#ed1c24] shadow-xs"
                : "text-[#5e3f3b] opacity-60 hover:bg-white/50"
            )}
          >
            <Activity size={14} />
            Monitoramento de Atividades
          </button>
        </div>

        {activeTab === 'monitoramento' ? (
          <div className="space-y-6">
            {/* Bloco de Filtros do Monitoramento */}
            <div className="bg-[#faf9fb] p-5 rounded-2xl border border-[#e8bcb7]/10 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#f4f3f5] pb-3">
                <div className="flex items-center gap-2 text-xs font-black text-[#5e3f3b] uppercase tracking-wider opacity-85">
                  <Filter size={14} className="text-[#ed1c24]" />
                  Filtros de Painel
                </div>
                
                <label className="flex items-center gap-2 text-xs font-bold text-[#5e3f3b] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-[#ed1c24] border-gray-300 rounded focus:ring-[#ed1c24] accent-[#ed1c24]"
                    checked={showIgnoredOnly}
                    onChange={(e) => setShowIgnoredOnly(e.target.checked)}
                  />
                  <span>Visualizar profissionais desconsiderados ({ignoredUserIds.length})</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#5e3f3b] uppercase tracking-wider block">Escopo de Visualização</label>
                  <div className="flex bg-white rounded-xl border border-[#e8bcb7]/15 p-1 max-w-md">
                    <button
                      onClick={() => setSelectedMonitoringUnit('all')}
                      className={cn(
                        "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer text-center",
                        selectedMonitoringUnit === 'all'
                          ? "bg-[#ed1c24] text-white shadow-xs"
                          : "text-[#5e3f3b] opacity-60 hover:bg-white/50"
                      )}
                    >
                      Geral (Todos)
                    </button>
                    <button
                      onClick={() => {
                        if (allUnits.length > 0) {
                          setSelectedMonitoringUnit(allUnits[0]);
                        } else {
                          setSelectedMonitoringUnit('all');
                        }
                      }}
                      className={cn(
                        "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer text-center",
                        selectedMonitoringUnit !== 'all'
                          ? "bg-[#ed1c24] text-white shadow-xs"
                          : "text-[#5e3f3b] opacity-60 hover:bg-white/50"
                      )}
                    >
                      Por Unidade
                    </button>
                  </div>
                </div>

                {selectedMonitoringUnit !== 'all' && (
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <label className="text-[10px] font-bold text-[#5e3f3b] uppercase tracking-wider block">Selecionar Unidade Ativa</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-[#e8bcb7]/20 rounded-xl py-2.5 pl-3 pr-8 text-xs font-bold text-[#1a1c1d] outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[#ed1c24]/20 transition-all shadow-xs"
                        value={selectedMonitoringUnit}
                        onChange={(e) => setSelectedMonitoringUnit(e.target.value)}
                      >
                        {allUnits.map(unitName => (
                          <option key={unitName} value={unitName}>{unitName}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Listas e Rankings */}
            {monitoringLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <RefreshCw className="animate-spin text-[#ed1c24]" size={36} />
                <p className="text-xs font-bold text-[#5e3f3b]/70">Calculando tempos e consultando bases de lançamentos...</p>
              </div>
            ) : monitoringError ? (
              <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl text-center space-y-2">
                <span className="text-xl">⚠️</span>
                <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider">Erro ao processar ranking</h4>
                <p className="text-xs text-[#5e3f3b] font-medium leading-relaxed">{monitoringError}</p>
                <button
                  onClick={loadMonitoringData}
                  className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl text-xs font-bold transition-all"
                >
                  Tentar novamente
                </button>
              </div>
            ) : (() => {
              // Filtering and Sorting calculation inside the render block
              let filtered = monitoringUsers;
              
              if (selectedMonitoringUnit !== 'all') {
                filtered = filtered.filter(u => u.units.includes(selectedMonitoringUnit));
              }

              if (showIgnoredOnly) {
                filtered = filtered.filter(u => ignoredUserIds.includes(u.id));
              } else {
                filtered = filtered.filter(u => !ignoredUserIds.includes(u.id));
              }

              // Order descending by period of inactivity (oldest date/time of lastGlobalActivityDate first; null first)
              let sorted = [...filtered].sort((a, b) => {
                if (!a.lastGlobalActivityDate && !b.lastGlobalActivityDate) return 0;
                if (!a.lastGlobalActivityDate) return -1;
                if (!b.lastGlobalActivityDate) return 1;

                // Sort ascending by time (oldest activity timestamp first = highest inactivity period first)
                return a.lastGlobalActivityDate.getTime() - b.lastGlobalActivityDate.getTime();
              });

              // If a specific unit is selected, consider only that unit and filter projects belonging to it
              if (selectedMonitoringUnit !== 'all') {
                sorted = sorted.map(item => {
                  const filteredProjects = (item.projectsDetailed || [])
                    .filter((p: any) => p.unitName === selectedMonitoringUnit)
                    .map((p: any) => p.name);
                  
                  return {
                    ...item,
                    units: [selectedMonitoringUnit],
                    projects: filteredProjects
                  };
                });
              }

              if (sorted.length === 0) {
                return (
                  <div className="p-12 text-center border-2 border-dashed border-gray-100 rounded-3xl space-y-2">
                    <Clock size={32} className="text-[#5e3f3b]/30 mx-auto" />
                    <h4 className="text-xs font-black text-[#1a1c1d] uppercase tracking-wider">Nenhum profissional encontrado</h4>
                    <p className="text-xs text-[#5e3f3b]/70 font-medium">
                      {showIgnoredOnly 
                        ? 'Nenhum profissional com atribuição Profissional foi desconsiderado ainda.' 
                        : 'Não existem profissionais cadastrados que correspondam aos filtros aplicados.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Visualização Mobile (Lista em Cards) - md:hidden */}
                  <div className="grid grid-cols-1 gap-4 md:hidden">
                    {sorted.map((item, index) => {
                      const isAlertAttendance = item.daysSinceAttendance > atendimentosThreshold;
                      const isAlertReport = item.daysSinceReport > relatoriosThreshold;
                      const isAlertEval = item.daysSinceEvaluation > evolucoesThreshold;
                      const isAlertOperational = item.daysSinceOperational > 15;
                      const hasAnyAlert = isAlertAttendance || isAlertReport || isAlertEval || isAlertOperational;

                      return (
                        <div 
                          key={item.id} 
                          className={cn(
                            "p-5 rounded-3xl border transition-all space-y-4 bg-white shadow-xs",
                            hasAnyAlert ? "border-rose-100 bg-[#ed1c24]/5" : "border-gray-55"
                          )}
                        >
                          {/* Top Card Info */}
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shadow-xs text-white",
                                index === 0 ? "bg-[#ed1c24]" : index === 1 ? "bg-slate-500" : index === 2 ? "bg-amber-600" : "bg-[#5e3f3b]"
                              )}>
                                #{index + 1}
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-[#1a1c1d]">{item.professionalName}</h4>
                                <p className="text-[10px] text-[#5e3f3b]/60 font-medium font-mono">@{item.username}</p>
                                {item.projects && item.projects.length > 0 && (
                                  <span className="text-[9px] font-extrabold text-[#ed1c24] mt-1 inline-flex items-center gap-1 bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md border border-red-100 uppercase tracking-wider">
                                    Proj: {item.projects[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleToggleIgnoreUser(item.id)}
                              className="p-2 hover:bg-gray-100 rounded-xl text-[#5e3f3b] transition-all"
                              title={showIgnoredOnly ? "Reconsiderar no Ranking" : "Ocultar do Ranking"}
                            >
                              {showIgnoredOnly ? <RotateCcw size={14} /> : <EyeOff size={14} />}
                            </button>
                          </div>

                          {/* Units Badge */}
                          <div className="flex flex-wrap gap-1">
                            {item.units.map((unitName: string) => (
                              <span key={unitName} className="px-2 py-0.5 bg-[#f4f3f5] border border-gray-100 text-[#5e3f3b] text-[9px] font-bold uppercase rounded-md">
                                {unitName}
                              </span>
                            ))}
                            {item.units.length === 0 && (
                              <span className="text-[9px] text-[#5e3f3b]/50 italic">Sem unidade associada</span>
                            )}
                          </div>

                          {/* Última Atividade Geral */}
                          <div className="text-[11px] text-[#5e3f3b] font-medium bg-[#f4f3f5]/55 px-3 py-2 rounded-xl flex justify-between items-center border border-[#e8bcb7]/5">
                            <span className="font-bold text-[#1a1c1d] flex items-center gap-1">
                              <Activity size={12} className="text-[#ed1c24]" />
                              Última Ação Geral:
                            </span>
                            <span className="font-bold font-mono text-[#5e3f3b]">
                              {item.lastGlobalActivityDate 
                                ? item.lastGlobalActivityDate.toLocaleString('pt-BR') 
                                : 'Sem registros'}
                            </span>
                          </div>

                          {/* Delay Cards */}
                          <div className="space-y-2.5 text-xs">
                            {/* Attendance */}
                            <div className="p-3 bg-white border border-gray-50 rounded-2xl flex flex-col gap-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-[10px] text-[#5e3f3b] uppercase tracking-wider">Atendimentos</span>
                                {isAlertAttendance ? (
                                  <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <AlertTriangle size={10} /> ATENÇÃO
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-md">
                                    Ok
                                  </span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[#5e3f3b]/70 font-medium truncate max-w-[170px]" title={item.attendanceLabel}>
                                  {item.attendanceLabel}
                                </span>
                                <span className={cn("font-bold font-mono", isAlertAttendance ? "text-rose-600 font-black text-xs" : "text-[#1a1c1d]")}>
                                  {item.daysSinceAttendance === 9999 ? 'Nenhum' : `${item.daysSinceAttendance}d sem registro`}
                                </span>
                              </div>
                            </div>

                            {/* Monthly Report */}
                            <div className="p-3 bg-white border border-gray-50 rounded-2xl flex flex-col gap-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-[10px] text-[#5e3f3b] uppercase tracking-wider">Relatório Mensal</span>
                                {isAlertReport ? (
                                  <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <AlertTriangle size={10} /> ATENÇÃO
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-md">
                                    Ok
                                  </span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[#5e3f3b]/70 font-medium truncate max-w-[170px]" title={item.reportLabel}>
                                  {item.reportLabel}
                                </span>
                                <span className={cn("font-bold font-mono", isAlertReport ? "text-rose-600 font-black text-xs" : "text-[#1a1c1d]")}>
                                  {item.daysSinceReport === 9999 ? 'Nenhum' : `${item.daysSinceReport}d sem registro`}
                                </span>
                              </div>
                            </div>

                            {/* Evaluation */}
                            <div className="p-3 bg-white border border-gray-50 rounded-2xl flex flex-col gap-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-[10px] text-[#5e3f3b] uppercase tracking-wider">Evoluções</span>
                                {isAlertEval ? (
                                  <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <AlertTriangle size={10} /> ATENÇÃO
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-md">
                                    Ok
                                  </span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[#5e3f3b]/70 font-medium truncate max-w-[170px]" title={item.evaluationLabel}>
                                  {item.evaluationLabel}
                                </span>
                                <span className={cn("font-bold font-mono", isAlertEval ? "text-rose-600 font-black text-xs" : "text-[#1a1c1d]")}>
                                  {item.daysSinceEvaluation === 9999 ? 'Nenhum' : `${item.daysSinceEvaluation}d sem registro`}
                                </span>
                              </div>
                            </div>

                            {/* Operational Logs / Demais Registros */}
                            <div className="p-3 bg-white border border-gray-50 rounded-2xl flex flex-col gap-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-[10px] text-[#5e3f3b] uppercase tracking-wider">Demais Registros</span>
                                {isAlertOperational ? (
                                  <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <AlertTriangle size={10} /> ATENÇÃO
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-md">
                                    Ok
                                  </span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-[#5e3f3b]/70 font-medium truncate max-w-[170px]" title={item.operationalLabel}>
                                  {item.operationalLabel}
                                </span>
                                <span className={cn("font-bold font-mono", isAlertOperational ? "text-rose-600 font-black text-xs" : "text-[#1a1c1d]")}>
                                  {item.daysSinceOperational === 9999 ? 'Nenhum' : `${item.daysSinceOperational}d sem registro`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Visualização Desktop (Tabela) - hidden md:block */}
                  <div className="hidden md:block border border-gray-100 rounded-3xl overflow-hidden bg-white shadow-xs">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-[#f4f3f5] border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-[#5e3f3b] select-none">
                          <th className="px-5 py-4 w-12 text-center">Rank</th>
                          <th className="px-5 py-4 w-48">Profissional</th>
                          {selectedMonitoringUnit === 'all' && (
                            <th className="px-5 py-4 w-32">Unidades Associadas</th>
                          )}
                          <th className="px-5 py-4 w-52">Atendimentos</th>
                          <th className="px-5 py-4 w-52">Relatórios Mensais</th>
                          <th className="px-5 py-4 w-52">Evoluções</th>
                          <th className="px-5 py-4 w-52">Demais Registros</th>
                          <th className="px-5 py-4 w-16 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs divide-y divide-gray-50/75">
                        {sorted.map((item, index) => {
                          const isAlertAttendance = item.daysSinceAttendance > atendimentosThreshold;
                          const isAlertReport = item.daysSinceReport > relatoriosThreshold;
                          const isAlertEval = item.daysSinceEvaluation > evolucoesThreshold;
                          const isAlertOperational = item.daysSinceOperational > 15;
                          const hasAnyAlert = isAlertAttendance || isAlertReport || isAlertEval || isAlertOperational;

                          return (
                            <tr 
                              key={item.id} 
                              className={cn(
                                "hover:bg-gray-55/40 transition-colors group",
                                hasAnyAlert ? "bg-rose-50/15 hover:bg-rose-50/25" : ""
                              )}
                            >
                              <td className="px-5 py-4 text-center select-none font-bold">
                                <span className={cn(
                                  "w-6 h-6 rounded-full inline-flex items-center justify-center font-black text-[11px] text-white shadow-xs",
                                  index === 0 ? "bg-[#ed1c24]" : index === 1 ? "bg-slate-500" : index === 2 ? "bg-amber-600" : "bg-gray-300 font-semibold"
                                )}>
                                  {index + 1}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <span className="font-bold text-[#1a1c1d] block text-sm leading-tight">{item.professionalName}</span>
                                <span className="text-[10px] text-[#5e3f3b]/60 font-mono font-medium block">@{item.username}</span>
                                {item.projects && item.projects.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.projects.map((proj: string) => (
                                      <span key={proj} className="px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 text-[8px] font-black uppercase rounded-md tracking-wider">
                                        {proj}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2 text-[9px] bg-[#faf9fb] px-2 py-1 rounded-md inline-block max-w-[170px] truncate border border-gray-100">
                                  <span className="font-bold text-[#1a1c1d] block">Atividade Geral:</span>
                                  <span className="text-[#5e3f3b]/80">
                                    {item.lastGlobalActivityDate 
                                      ? item.lastGlobalActivityDate.toLocaleString('pt-BR') 
                                      : 'Sem registros'}
                                  </span>
                                </div>
                              </td>
                              {selectedMonitoringUnit === 'all' && (
                                <td className="px-5 py-4 font-semibold text-[#1a1c1d]">
                                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                                    {item.units.map((unitName: string) => (
                                      <span key={unitName} className="px-1.5 py-0.5 bg-[#f4f3f5] border border-gray-100 text-[#5e3f3b] text-[9px] font-bold uppercase rounded-md tracking-wider">
                                        {unitName}
                                      </span>
                                    ))}
                                    {item.units.length === 0 && (
                                      <span className="text-gray-400 font-normal italic">-</span>
                                    )}
                                  </div>
                                </td>
                              )}
                              {/* Attendance */}
                              <td className="px-5 py-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("font-bold", isAlertAttendance ? "text-rose-600 font-black" : "text-[#1a1c1d]")}>
                                      {item.daysSinceAttendance === 9999 ? (
                                        <span className="text-rose-600 font-bold uppercase text-[10px] tracking-wider">Sem lançamento</span>
                                      ) : (
                                        `${item.daysSinceAttendance} dias sem`
                                      )}
                                    </span>
                                    {isAlertAttendance && (
                                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 text-[8px] font-black uppercase rounded-md animate-pulse">
                                        Critico
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-[#5e3f3b]/60 font-medium truncate max-w-[200px]" title={item.attendanceLabel}>
                                    Último: {item.attendanceLabel}
                                  </p>
                                </div>
                              </td>
                              {/* Reports */}
                              <td className="px-5 py-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("font-bold", isAlertReport ? "text-rose-600 font-black" : "text-[#1a1c1d]")}>
                                      {item.daysSinceReport === 9999 ? (
                                        <span className="text-rose-600 font-bold uppercase text-[10px] tracking-wider">Sem lançamento</span>
                                      ) : (
                                        `${item.daysSinceReport} dias sem`
                                      )}
                                    </span>
                                    {isAlertReport && (
                                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 text-[8px] font-black uppercase rounded-md animate-pulse">
                                        Critico
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-[#5e3f3b]/60 font-medium truncate max-w-[200px]" title={item.reportLabel}>
                                    Último: {item.reportLabel}
                                  </p>
                                </div>
                              </td>
                              {/* Evaluations */}
                              <td className="px-5 py-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("font-bold", isAlertEval ? "text-rose-600 font-black" : "text-[#1a1c1d]")}>
                                      {item.daysSinceEvaluation === 9999 ? (
                                        <span className="text-rose-600 font-bold uppercase text-[10px] tracking-wider">Sem lançamento</span>
                                      ) : (
                                        `${item.daysSinceEvaluation} dias sem`
                                      )}
                                    </span>
                                    {isAlertEval && (
                                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 text-[8px] font-black uppercase rounded-md animate-pulse">
                                        Critico
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-[#5e3f3b]/60 font-medium truncate max-w-[200px]" title={item.evaluationLabel}>
                                    Último: {item.evaluationLabel}
                                  </p>
                                </div>
                              </td>
                              {/* Demais Registros */}
                              <td className="px-5 py-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("font-bold", isAlertOperational ? "text-rose-600 font-black" : "text-[#1a1c1d]")}>
                                      {item.daysSinceOperational === 9999 ? (
                                        <span className="text-rose-600 font-bold uppercase text-[10px] tracking-wider">Sem lançamento</span>
                                      ) : (
                                        `${item.daysSinceOperational} dias sem`
                                      )}
                                    </span>
                                    {isAlertOperational && item.daysSinceOperational !== 9999 && (
                                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 text-[8px] font-black uppercase rounded-md animate-pulse">
                                        Critico
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-[#5e3f3b]/60 font-medium truncate max-w-[200px]" title={item.operationalLabel}>
                                    Último: {item.operationalLabel}
                                  </p>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-center">
                                <button
                                  onClick={() => handleToggleIgnoreUser(item.id)}
                                  className="p-1.5 hover:bg-gray-100 text-[#5e3f3b] rounded-xl transition-all"
                                  title={showIgnoredOnly ? "Adicionar de volta ao Ranking" : "Ocultar/Ignorar"}
                                >
                                  {showIgnoredOnly ? <RotateCcw size={16} /> : <EyeOff size={16} />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <>
            {/* Aviso de erro ou tabela ausente */}
        {fetchError && (
          <div className="mb-6 p-4 sm:p-5 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1 space-y-1">
                <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider">Aviso de Sincronização do Banco de Dados</h4>
                <p className="text-xs text-[#5e3f3b] font-medium leading-relaxed">
                  O sistema está gravando e exibindo suas ações {logs.length > 0 ? "neste navegador (localmente)." : "localmente."} Para salvar os dados permanentemente na nuvem e sincronizar os registros entre múltiplos computadores, a tabela de logs precisa ser criada no Supabase.
                </p>
                <div className="text-[10px] text-rose-700 font-mono mt-1 font-bold">
                  Erro: {fetchError}
                </div>
              </div>
            </div>
            
            <div className="pt-1.5 flex justify-start pl-7">
              <button
                onClick={() => setShowSqlTip(!showSqlTip)}
                className="text-[10px] font-black uppercase text-[#ed1c24] border border-[#ed1c24]/20 bg-white hover:bg-[#ed1c24]/5 px-3 py-1.5 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
              >
                {showSqlTip ? "Ocultar comando SQL de ativação" : "Visualizar comando SQL de ativação"}
              </button>
            </div>
            
            {showSqlTip && (
              <div className="pl-7 pt-1 space-y-2">
                <p className="text-[11px] font-medium text-[#5e3f3b]/70 leading-relaxed">
                  Copie o código SQL abaixo e execute-o no Editor SQL (SQL Editor) do Painel do seu Supabase para criar a tabela de logs e habilitar a sincronização automática:
                </p>
                <div className="relative">
                  <pre className="bg-[#1a1c1d] text-gray-200 p-3 sm:p-4 rounded-xl text-[10px] font-mono overflow-x-auto select-all max-h-48 overflow-y-auto leading-relaxed border border-[#ebd5d5]/10">
{`CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now(),
    username TEXT NOT NULL,
    user_id UUID,
    ip_device TEXT,
    module TEXT NOT NULL,
    unit_name TEXT,
    previous_values JSONB,
    new_values JSONB,
    status TEXT NOT NULL,
    details TEXT
);

-- Habilitar RLS e criar política de acesso público
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all activity logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true);`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Alerta Destacado de Coluna de Controle de Sessões Ausente */}
        {hasSessionCol === false && (
          <div className="mb-6 p-4 sm:p-5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3 shadow-xs animate-pulse">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600 shrink-0 mt-0.5">
                <ShieldAlert size={20} />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-black text-amber-900 uppercase tracking-wider">Ajuste de Banco de Dados de Sessões Requerido</h4>
                <p className="text-xs text-[#5e3f3b] font-medium leading-relaxed">
                  Para habilitar a nova funcionalidade de <strong>Controle de Sessões, Revogação de Login Ativo e Encerramento Remoto de Conexões</strong>, você precisa adicionar a coluna <code className="font-mono bg-white/70 px-1.5 py-0.5 rounded text-[11px] font-bold text-amber-950">session_version</code> à tabela <code className="font-mono bg-white/70 px-1.5 py-0.5 rounded text-[11px] font-bold text-amber-950">system_users</code>.
                </p>
                <p className="text-xs text-[#5e3f3b] font-medium mt-1">
                  Por favor, execute o comando SQL abaixo no <strong>SQL Editor</strong> do painel do seu Supabase para ativar este recurso:
                </p>
                <div className="relative mt-2">
                  <pre className="bg-[#1a1c1d] text-gray-200 p-3 sm:p-4 rounded-xl text-[10px] font-mono select-all overflow-x-auto leading-relaxed border border-white/5 shadow-inner">
{`ALTER TABLE system_users ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 1;`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Painel de Controle de Sessões / Desconexão Geral */}
        <div className="mb-6 bg-white border border-[#e8bcb7]/15 rounded-[1.5rem] overflow-hidden shadow-xs">
          <button 
            onClick={() => setShowSessionManager(!showSessionManager)}
            className="w-full flex justify-between items-center px-5 py-4 bg-[#faf9fb] hover:bg-[#f4f3f5] transition-all text-left outline-none cursor-pointer"
          >
            <div className="flex items-center gap-3 font-sans">
              <div className="p-2 bg-[#ed1c24]/5 rounded-xl text-[#ed1c24] shrink-0">
                <Smartphone size={18} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-[#1a1c1d] uppercase tracking-wide">Controle de Sessões & Logout Coletivo</h3>
                <p className="text-[11px] text-[#5e3f3b] font-medium opacity-70">
                  Gerencie acessos ativos e force o encerramento de logins em outros aparelhos.
                </p>
              </div>
            </div>
            <div className="text-[#5e3f3b] opacity-60">
              <ChevronDown size={18} className={cn("transition-transform duration-300", showSessionManager && "rotate-180")} />
            </div>
          </button>

          {showSessionManager && (
            <div className="p-5 border-t border-[#e8bcb7]/10 space-y-5">
              {/* Messages */}
              {sessionActionSuccess && (
                <div className="p-4 bg-green-50 text-green-800 text-xs font-semibold rounded-xl border border-green-200">
                  {sessionActionSuccess}
                </div>
              )}
              {sessionActionError && (
                <div className="p-4 bg-rose-50 text-rose-800 text-xs font-semibold rounded-xl border border-rose-200">
                  {sessionActionError}
                </div>
              )}

              {hasSessionCol === false && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">Ajuste de Banco de Dados Necessário</h4>
                      <p className="text-xs text-[#5e3f3b] font-medium leading-relaxed">
                        Para habilitar a funcionalidade de logout remoto de dispositivos, a tabela <code className="font-mono bg-white/60 px-1 py-0.5 rounded">system_users</code> necessita receber a coluna de controle. Execute o comando SQL no editor do seu Supabase:
                      </p>
                      <pre className="bg-[#1a1c1d] text-gray-200 p-3 sm:p-4 rounded-xl text-[10px] font-mono select-all overflow-x-auto leading-relaxed border border-[#ebd5d5]/10 mt-2">
                        {`ALTER TABLE system_users ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 1;`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {hasSessionCol !== false && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-[#e8bcb7]/15">
                  {/* Minha conta */}
                  <div className="space-y-4 pr-0 md:pr-6 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-[#1a1c1d] uppercase tracking-wider flex items-center gap-2">
                          <User size={15} className="text-[#ed1c24]" />
                          Minha Conta
                        </h4>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-emerald-800 bg-emerald-50 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Sessão Ativa
                        </span>
                      </div>

                      {/* Info Card Paulo Gomes */}
                      <div className="bg-[#faf9fb] border border-[#e8bcb7]/10 p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#ed1c24]/5 flex items-center justify-center text-[#ed1c24] font-black text-sm uppercase">
                          {currentUser?.username?.substring(0, 2) || 'S'}
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-black text-[#1a1c1d]">
                            {currentUser?.username || 'Carregando...'}
                          </div>
                          <div className="inline-block px-1.5 py-0.5 bg-gray-100 text-[#5e3f3b] text-[9px] font-bold uppercase rounded-md">
                            {currentUser?.permission || 'Nível'}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-[#5e3f3b]/90 font-medium leading-relaxed">
                        Isto forçará o logout da sua conta em <strong>todos os outros dispositivos</strong>, computadores ou celulares ativos, mas <strong className="text-[#1a1c1d]">manterá este navegador atual conectado</strong>.
                      </p>
                    </div>

                    <button
                      onClick={handleForceLogoutMe}
                      disabled={sessionActionLoading}
                      className="w-full flex items-center justify-center gap-2 bg-white hover:bg-[#ed1c24]/5 text-[#ed1c24] border border-[#ed1c24]/25 hover:border-[#ed1c24] font-black uppercase text-[10px] tracking-wider py-3.5 px-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs hover:shadow-xs mt-4"
                    >
                      <Power size={14} />
                      {sessionActionLoading ? 'Processando...' : 'Desconectar outros aparelhos'}
                    </button>
                  </div>

                  {/* Sessões do Sistema */}
                  {(currentUser?.permission === 'Administrador' || currentUser?.permission === 'Administrador por Unidade') ? (
                    <div className="space-y-5 pt-5 md:pt-0 pl-0 md:pl-6">
                      <h4 className="text-xs font-black text-[#1a1c1d] uppercase tracking-wider flex items-center gap-2">
                        <ShieldAlert size={15} className="text-[#ed1c24]" />
                        Controle Administrativo de Logins
                      </h4>
                      
                      {/* Desconectar usuario especifico */}
                      <div className="bg-[#faf9fb] border border-[#e8bcb7]/10 p-4 rounded-2xl space-y-3">
                        <label className="text-[10px] font-black text-[#5e3f3b] uppercase tracking-wider block">
                          Desconectar outro usuário específico:
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <select
                              className="w-full bg-white border border-[#e8bcb7]/20 rounded-xl px-3 py-2.5 text-xs font-medium text-[#1a1c1d] outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[#ed1c24]/10 transition-all shadow-xs pr-8"
                              value={selectedUserToDisconnect}
                              onChange={(e) => setSelectedUserToDisconnect(e.target.value)}
                            >
                              <option value="">Selecione um usuário...</option>
                              {dbUsersList
                                .filter(u => u.id !== currentUser?.id)
                                .map(u => (
                                  <option key={u.id} value={`${u.id}|${u.username}`}>{u.username} ({u.permission})</option>
                                ))
                              }
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                              <ChevronDown size={14} />
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (!selectedUserToDisconnect) return;
                              const [tid, tname] = selectedUserToDisconnect.split('|');
                              if (window.confirm(`Deseja revogar e forçar o logout de todas as sessões de "${tname}"?`)) {
                                handleForceLogoutTargetUser(tid, tname);
                              }
                            }}
                            disabled={sessionActionLoading || !selectedUserToDisconnect}
                            className="bg-[#faf9fb] hover:bg-rose-50 text-[#ed1c24] border border-[#ed1c24]/20 hover:border-[#ed1c24] font-black uppercase text-[10px] tracking-wider py-2.5 px-4 rounded-xl disabled:opacity-40 transition-all shrink-0 cursor-pointer text-center"
                          >
                            Revogar
                          </button>
                        </div>
                      </div>

                      {/* Desconexao global */}
                      <div className="space-y-3 pt-3 border-t border-[#e8bcb7]/10">
                        <label className="text-[10px] font-black text-rose-800 uppercase tracking-widest block">
                          Ação Crítica de Sistema
                        </label>
                        <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-100 flex flex-col gap-3">
                          <p className="text-[11px] text-[#5e3f3b] font-medium leading-relaxed">
                            Forçar o encerramento completo e revogação imediata de <strong>todas as sessões ativas do SIRA</strong> de todos os usuários em uma única ação.
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="keepMe"
                              className="w-4 h-4 text-[#ed1c24] border-gray-300 rounded focus:ring-[#ed1c24] accent-[#ed1c24] cursor-pointer"
                              checked={keepMeOnGlobalLogout}
                              onChange={(e) => setKeepMeOnGlobalLogout(e.target.checked)}
                            />
                            <label htmlFor="keepMe" className="text-xs text-[#5e3f3b] font-bold select-none cursor-pointer">
                              Manter meu login atual conectado
                            </label>
                          </div>
                          <button
                            onClick={() => handleForceLogoutAllUsers(keepMeOnGlobalLogout)}
                            disabled={sessionActionLoading}
                            className="w-full flex items-center justify-center gap-2 bg-[#ed1c24] hover:bg-[#d11920] text-white font-black uppercase text-[10px] tracking-wider py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <Power size={14} />
                            Logoff de todos os logins do SIRA
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-4 md:pt-0 pl-0 md:pl-6 flex flex-col justify-center text-center">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Users size={24} className="text-[#5e3f3b]/35 mx-auto" />
                        <h4 className="text-xs font-bold text-[#1a1c1d]">Painel Administrativo Oculto</h4>
                        <p className="text-[11px] text-[#5e3f3b]/70 font-medium leading-normal">
                          Configurações adicionais de logout em logins de outros usuários são restritas a administradores do SIRA.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtros Integrados */}
        <div className="bg-[#faf9fb] p-5 rounded-2xl border border-[#e8bcb7]/10 space-y-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-black text-[#5e3f3b] uppercase tracking-wider opacity-80">
            <SlidersHorizontal size={14} className="text-[#ed1c24]" />
            Filtros do Painel
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Filtro por Usuário */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#5e3f3b] uppercase tracking-wider block">Usuário</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-[#e8bcb7]/10 rounded-xl py-2.5 pl-3 pr-8 text-xs font-medium text-[#1a1c1d] outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[#ed1c24]/20 transition-all shadow-sm"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="Todos">Todos Usuários</option>
                  {allUsers.map(uname => (
                    <option key={uname} value={uname}>{uname}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* Filtro por Unidade */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#5e3f3b] uppercase tracking-wider block">Unidade</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-[#e8bcb7]/10 rounded-xl py-2.5 pl-3 pr-8 text-xs font-medium text-[#1a1c1d] outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[#ed1c24]/20 transition-all shadow-sm"
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                >
                  <option value="Todos">Todas Unidades</option>
                  {allUnits.map(unitName => (
                    <option key={unitName} value={unitName}>{unitName}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* Filtro por Ação */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#5e3f3b] uppercase tracking-wider block">Tipo de Ação</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-[#e8bcb7]/10 rounded-xl py-2.5 pl-3 pr-8 text-xs font-medium text-[#1a1c1d] outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[#ed1c24]/20 transition-all shadow-sm"
                  value={selectedActionType}
                  onChange={(e) => setSelectedActionType(e.target.value)}
                >
                  <option value="Todos">Todas Ações</option>
                  <option value="LOGIN">Entrada (Login)</option>
                  <option value="LOGOUT">Saída (Logout)</option>
                  <option value="CREATION">Criação de registro</option>
                  <option value="EDITION">Edição de registro</option>
                  <option value="DELETION">Exclusão de registro</option>
                  <option value="ARCHIVE">Arquivamento</option>
                  <option value="RESTORE">Restauração</option>
                  <option value="FAILURE">Falha/Tentativa Inválida</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* Filtro por Módulo */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#5e3f3b] uppercase tracking-wider block">Módulo</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-[#e8bcb7]/10 rounded-xl py-2.5 pl-3 pr-8 text-xs font-medium text-[#1a1c1d] outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[#ed1c24]/20 transition-all shadow-sm"
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                >
                  <option value="Todos">Todos Módulos</option>
                  <option value="usuarios_sistema">Acessos/Aba Acessos</option>
                  <option value="profissionais">Profissionais</option>
                  <option value="projetos">Projetos</option>
                  <option value="modalidades">Modalidades</option>
                  <option value="unidades">Unidades</option>
                  <option value="pacientes">Gestão de Usuários (Pacientes)</option>
                  <option value="atendimentos">Atendimentos/Presenças</option>
                  <option value="relatorio">Relatórios</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* Período (Ordenação Rápida inclusa) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#5e3f3b] uppercase tracking-wider block">Ordem</label>
              <div className="relative">
                <select 
                  className="w-full bg-white border border-[#e8bcb7]/10 rounded-xl py-2.5 pl-3 pr-8 text-xs font-medium text-[#1a1c1d] outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[#ed1c24]/20 transition-all shadow-sm"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                >
                  <option value="recent">Mais Recentes Primeiro</option>
                  <option value="oldest">Mais Antigos Primeiro</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
            {/* Pesquisa rápida */}
            <div className="md:col-span-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e3f3b] opacity-35" size={16} />
              <input 
                type="text" 
                placeholder="Pesquisa rápida de termos (IP, detalhes, ação)..."
                className="w-full bg-white border border-[#e8bcb7]/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium outline-none focus:ring-2 focus:ring-[#bc0010]/20 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtros de data */}
            <div className="md:col-span-4 flex items-center gap-2">
              <div className="relative flex-1">
                <input 
                  type="date"
                  className="w-full bg-white border border-[#e8bcb7]/10 rounded-xl py-2 pl-3 pr-2 text-xs text-[#5e3f3b] outline-none focus:ring-2 focus:ring-[#ed1c24]/20 shadow-sm h-10"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Início"
                />
              </div>
              <span className="text-xs text-[#5e3f3b] opacity-40">até</span>
              <div className="relative flex-1">
                <input 
                  type="date"
                  className="w-full bg-white border border-[#e8bcb7]/10 rounded-xl py-2 pl-3 pr-2 text-xs text-[#5e3f3b] outline-none focus:ring-2 focus:ring-[#ed1c24]/20 shadow-sm h-10"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Fim"
                />
              </div>
            </div>

            {/* Botão limpar filtros */}
            <div className="md:col-span-2 flex items-stretch">
              <button
                onClick={handleResetFilters}
                className="w-full bg-[#f4f3f5] hover:bg-[#e8bcb7]/20 text-[#5e3f3b] font-black uppercase tracking-widest text-[9px] py-2 px-3 rounded-xl transition-colors border border-[#e8bcb7]/5 shadow-sm text-center flex items-center justify-center"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>

        {/* Quantidade Encontrada */}
        <div className="flex justify-between items-center text-xs font-bold text-[#5e3f3b] opacity-60 mb-4 px-1">
          <span>{totalItems} registro(s) encontrado(s)</span>
          {sortOrder === 'recent' ? (
            <span>Ordenado por: Mais recente primeiro</span>
          ) : (
            <span>Ordenado por: Mais antigo primeiro</span>
          )}
        </div>

        {/* Listagem de Atividades Responsiva */}
        {loading ? (
          <div className="bg-white border border-gray-100 p-16 rounded-2xl flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-[#ed1c24]/20 border-t-[#ed1c24] rounded-full animate-spin" />
            <p className="text-[10px] sm:text-xs font-bold text-[#5e3f3b] opacity-45 uppercase tracking-widest text-center mt-2">Carregando histórico de auditoria...</p>
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="bg-white border border-gray-100 p-16 rounded-2xl text-center text-[#5e3f3b] opacity-45 font-medium flex flex-col items-center justify-center">
            <ClipboardList className="text-[#e2b0ac] mb-3 opacity-60" size={40} />
            <p className="text-xs sm:text-sm">Nenhum registro de atividades corresponde aos filtros escolhidos.</p>
          </div>
        ) : (
          <>
            {/* Visualização Mobile (Lista em Cartões) - md:hidden */}
            <div className="md:hidden space-y-3">
              {paginatedLogs.map((log) => {
                const date = new Date(log.timestamp);
                const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const hasStateData = log.previous_values !== null || log.new_values !== null;

                return (
                  <div 
                    key={log.id} 
                    className="bg-[#faf9fb]/50 rounded-2xl border border-[#e8bcb7]/10 p-4 shadow-xs space-y-3"
                  >
                    <div className="flex justify-between items-start gap-1 flex-wrap pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getActionBadge(log.action_type, log.status)}
                        <span className="text-[10px] text-[#5e3f3b]/70 font-mono tracking-tight">
                          {formattedDate} {formattedTime}
                        </span>
                      </div>
                      {log.is_local && (
                        <span className="bg-amber-100/50 text-amber-800 border border-amber-200/40 text-[8px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-lg shrink-0">
                          Local
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[#5e3f3b]/50 font-bold block mb-0.5">Operador</span>
                        <div className="flex items-center gap-1 text-[#1a1c1d] font-bold">
                          <User size={12} className="text-[#5e3f3b] opacity-50 shrink-0" />
                          <span className="truncate max-w-[110px]" title={log.username}>{log.username}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[#5e3f3b]/50 font-bold block mb-0.5">Seção</span>
                        <div className="text-[#5e3f3b] font-bold truncate max-w-[125px]" title={getModuleLabel(log.module)}>
                          {getModuleLabel(log.module)}
                        </div>
                      </div>
                    </div>

                    {log.unit_name && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1a1c1d] opacity-95 bg-[#f4f3f5]/55 p-2 rounded-xl border border-gray-100">
                        <MapPin size={12} className="text-[#ed1c24] shrink-0" />
                        <span className="truncate">{log.unit_name}</span>
                      </div>
                    )}

                    <div className="text-xs text-[#5e3f3b] leading-relaxed bg-white border border-gray-50 p-3 rounded-xl break-words font-medium">
                      {log.details}
                    </div>

                    <div className="pt-1 select-none">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs",
                          hasStateData 
                            ? "bg-[#ed1c24]/5 text-[#ed1c24] hover:bg-[#ed1c24]/10 border border-[#ed1c24]/10" 
                            : "bg-[#f4f3f5] hover:bg-gray-100 text-[#5e3f3b] border border-gray-200/50"
                        )}
                      >
                        {hasStateData ? (
                          <>
                            <FileCode size={14} className="shrink-0" />
                            <span>Inspecionar Alterações</span>
                          </>
                        ) : (
                          <>
                            <Eye size={14} className="shrink-0" />
                            <span>Inspecionar Detalhes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Visualização Desktop (Tabela) - hidden md:block */}
            <div className="hidden md:block border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-xs">
              <table className="w-full min-w-[800px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#f4f3f5]/85 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-[#5e3f3b] select-none">
                    <th className="px-5 py-4 w-32">Horário</th>
                    <th className="px-4 py-4 w-28 text-center">Ação</th>
                    <th className="px-4 py-4 w-36">Usuário</th>
                    <th className="px-4 py-4 w-44">Módulo</th>
                    <th className="px-4 py-4 w-40">Unidade</th>
                    <th className="px-5 py-4 w-max">Detalhes da Ação</th>
                    <th className="px-5 py-4 w-20 text-center">Inspecionar</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-gray-50">
                  {paginatedLogs.map((log) => {
                    const date = new Date(log.timestamp);
                    const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const hasStateData = log.previous_values !== null || log.new_values !== null;

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-[#1a1c1d]">{formattedDate}</div>
                          <div className="text-[10px] text-[#5e3f3b]/60 font-medium font-mono">{formattedTime}</div>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap pt-4">
                          {getActionBadge(log.action_type, log.status)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-[#1a1c1d]">
                          <div className="flex items-center gap-1.5">
                            <User size={12} className="text-[#5e3f3b] opacity-55" />
                            <span>{log.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-[#5e3f3b]">
                          {getModuleLabel(log.module)}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-[#1a1c1d] opacity-90">
                          {log.unit_name ? (
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="text-[#ed1c24] opacity-70 shrink-0" />
                              <span className="truncate max-w-[150px]">{log.unit_name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-normal italic">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[#5e3f3b] font-medium leading-relaxed max-w-[320px] truncate">
                          <span title={log.details}>{log.details}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className={cn(
                              "p-2 rounded-xl transition-all h-9 w-9 flex items-center justify-center text-[#5e3f3b] mx-auto",
                              hasStateData 
                                ? "bg-[#ed1c24]/5 text-[#ed1c24] hover:bg-[#ed1c24]/10 shadow-sm" 
                                : "hover:bg-gray-100 opacity-60 hover:opacity-100"
                            )}
                            title={hasStateData ? "Ver Alteração de Valores" : "Ver Detalhes"}
                          >
                            {hasStateData ? <FileCode size={16} /> : <Eye size={16} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-100 no-print">
            <div className="flex items-center gap-2 text-xs text-[#5e3f3b]">
              <span>Registros por página:</span>
              <select
                className="bg-white border border-[#e8bcb7]/20 rounded-lg px-2 py-1 outline-none text-xs text-[#1a1c1d] focus:ring-2 focus:ring-[#ed1c24]/40"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-[#5e3f3b]">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-2 border border-gray-100 bg-[#f4f3f5] rounded-xl hover:bg-[#e8bcb7]/15 text-[#5e3f3b] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f4f3f5] transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-2 border border-gray-100 bg-[#f4f3f5] rounded-xl hover:bg-[#e8bcb7]/15 text-[#5e3f3b] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f4f3f5] transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Modal / Panel de Detalhes da Auditoria */}
      {selectedLog && (
        <div className="fixed inset-0 bg-[#1a1c1d]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-[#e8bcb7]/15 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center bg-[#faf9fb]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-xl text-[#ed1c24] border border-[#e8bcb7]/10 shadow-xs">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1a1c1d]">Detalhe do Registro de Log</h3>
                  <p className="text-[11px] font-semibold text-[#5e3f3b] opacity-60 uppercase tracking-widest mt-0.5">
                    ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-[#f2eff0] hover:bg-[#ebd5d5]/30 text-[#5e3f3b] opacity-80 hover:opacity-100 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo scrollable */}
            <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
              
              {/* Infobox principal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-[#f4f3f5]/50 border border-[#e8bcb7]/10 p-5 rounded-2xl text-xs font-semibold text-[#5e3f3b]">
                <div className="space-y-1">
                  <p className="uppercase text-[9px] tracking-wider opacity-60">Horário Completo</p>
                  <p className="text-[#1a1c1d] font-bold">
                    {new Date(selectedLog.timestamp).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="uppercase text-[9px] tracking-wider opacity-60">Usuário do Sistema</p>
                  <p className="text-[#1a1c1d] font-bold flex items-center gap-1">
                    <User size={12} className="text-[#ed1c24]" />
                    {selectedLog.username}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="uppercase text-[9px] tracking-wider opacity-60">Módulo e Aba</p>
                  <p className="text-[#1a1c1d] font-bold">
                    {getModuleLabel(selectedLog.module)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="uppercase text-[9px] tracking-wider opacity-60">Status da Transação</p>
                  <div className="flex items-center gap-1 font-bold text-[#1a1c1d]">
                    {selectedLog.status === 'Sucesso' ? (
                      <>
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="text-emerald-600 font-bold">Sucesso</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={14} className="text-rose-500" />
                        <span className="text-rose-600 font-bold">Falha</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Detalhes de Dispositivo e IP */}
              <div className="bg-[#f4f3f5]/20 p-4 rounded-xl border border-dotted border-[#e8bcb7]/20 flex items-center gap-3 text-xs text-[#5e3f3b]">
                <Smartphone size={16} className="text-[#ed1c24] shrink-0" />
                <span className="font-semibold block">
                  IP / Dispositivo de Acesso: <span className="font-mono text-[11px] text-[#1a1c1d]/90 bg-white border border-[#e8bcb7]/10 ml-1.5 px-2 py-0.5 rounded-lg">{selectedLog.ip_device || 'Não Detectado'}</span>
                </span>
                {selectedLog.is_local && (
                  <span className="ml-auto bg-amber-50 text-amber-700 border border-amber-200 text-[8px] uppercase tracking-wide font-black px-1.5 py-0.5 rounded-md">
                    Auditado Localmente
                  </span>
                )}
              </div>

              {/* Mensagem descritiva */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-[#5e3f3b] uppercase tracking-widest block">Mensagem dos Detalhes</h4>
                <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-xs text-xs md:text-sm font-medium leading-relaxed text-[#1a1c1d] opacity-90">
                  {selectedLog.details || 'Nenhum detalhe descritivo extra informado.'}
                </div>
              </div>

              {/* Diferença de Estado (Valores Anteriores vs Novos) */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-[#5e3f3b] uppercase tracking-widest block flex items-center gap-1.5">
                  Visualização de Estado
                  <span className="text-[10px] normal-case opacity-55 italic font-medium">(análise comparativa comparando alterações)</span>
                </h4>
                
                {renderValueChanges(
                  selectedLog.previous_values, 
                  selectedLog.new_values
                )}
              </div>

              {/* Inspect JSON Expandable */}
              {(selectedLog.previous_values || selectedLog.new_values) && (
                <details className="group space-y-2 select-none">
                  <summary className="text-[10px] font-black text-[#5e3f3b] uppercase tracking-widest cursor-pointer hover:text-[#ed1c24] flex items-center gap-1.5 transition-colors">
                    🔍 Visualizar Dados Brutos (JSON)
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-left bg-gray-50 p-4 rounded-xl border border-gray-200 text-[10px] sm:text-[11px] font-mono select-text">
                    <div>
                      <span className="font-sans text-[10px] font-black text-[#5e3f3b] uppercase tracking-widest block mb-1">Estado Anterior</span>
                      <pre className="overflow-x-auto bg-white border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto">
                        {selectedLog.previous_values ? JSON.stringify(selectedLog.previous_values, null, 2) : 'null'}
                      </pre>
                    </div>
                    <div>
                      <span className="font-sans text-[10px] font-black text-[#5e3f3b] uppercase tracking-widest block mb-1">Novo Estado</span>
                      <pre className="overflow-x-auto bg-[#fbf9f9] border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto">
                        {selectedLog.new_values ? JSON.stringify(selectedLog.new_values, null, 2) : 'null'}
                      </pre>
                    </div>
                  </div>
                </details>
              )}

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex justify-end bg-[#faf9fb]">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-[#ed1c24] hover:bg-[#d11920] text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all"
              >
                Concluído
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

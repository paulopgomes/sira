'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  PieChart, 
  Download, 
  Calendar, 
  Filter, 
  User, 
  Building2, 
  TrendingUp,
  FileSpreadsheet,
  File as FileIcon,
  Loader2,
  FolderKanban,
  ClipboardList,
  Printer,
  Phone,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  X,
  Check,
  Plus
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AttendanceTable } from './AttendanceTable';

interface CustomReportsProps {
  currentUser?: {
    id: string;
    username: string;
    permission: string;
  } | null;
}

export function CustomReports({ currentUser }: CustomReportsProps) {
  const [reportType, setReportType] = useState('attendance');
  const [loading, setLoading] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedUnitLogo, setSelectedUnitLogo] = useState<string | null>(null);
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [unitDetailedData, setUnitDetailedData] = useState<any[]>([]);
  const [consolidatedUnitFilter, setConsolidatedUnitFilter] = useState('all');
  const [competence, setCompetence] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [isConsolidatedDropdownOpen, setIsConsolidatedDropdownOpen] = useState(false);
  const [consolidatedUnitSearch, setConsolidatedUnitSearch] = useState('');
  const [consolidatedData, setConsolidatedData] = useState<{
    units: Record<string, number>,
    projects: Record<string, number>,
    modalities: Record<string, number>,
    total: number
  }>({ units: {}, projects: {}, modalities: {}, total: 0 });

  // Beneficiários de Baixa Frequência States
  const [laPatients, setLaPatients] = useState<any[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [modalitiesList, setModalitiesList] = useState<any[]>([]);
  const [professionalsList, setProfessionalsList] = useState<any[]>([]);

  // Modals inside Low Attendance Subtab
  const [selectedPatientForAction, setSelectedPatientForAction] = useState<any | null>(null);
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [observationText, setObservationText] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [contactChannel, setContactChannel] = useState('WhatsApp');
  const [contactResponsible, setContactResponsible] = useState('');

  // History logs loaded from localStorage
  const [observationHistory, setObservationHistory] = useState<any[]>([]);
  const [contactHistory, setContactHistory] = useState<any[]>([]);

  // Low frequency filters state
  const [laFilters, setLaFilters] = useState({
    project: 'all',
    unit: 'all',
    modality: 'all',
    professional: 'all',
    turma: 'all',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    expectedClasses: 8,
  });

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const reportCategories = [
    { id: 'attendance', label: 'Consolidado', icon: BarChart3 },
    { id: 'units', label: 'Por Unidade', icon: Building2 },
    { id: 'low_attendance', label: 'Baixa Frequência', icon: TrendingUp },
  ];

  const fetchConsolidatedData = async () => {
    setLoading(true);
    try {
      // Fetch allowed unit ids if Unit Admin
      let allowedUnitIds: string[] = [];
      if (currentUser?.id && currentUser?.permission === 'Administrador por Unidade') {
        const { data: userUnits } = await supabase
          .from('system_user_units')
          .select('unit_id')
          .eq('system_user_id', currentUser.id);
        if (userUnits) {
          allowedUnitIds = userUnits.map((u: any) => u.unit_id);
        }
      }

      // Fetch attendance with relations, filtering by competence
      const allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('attendance')
          .select(`
            day,
            patient_id,
            project_id,
            projects (id, name, unit_id),
            modality_id,
            modalities (id, name),
            patients (id, name, unit_id)
          `)
          .eq('month', competence.month + 1)
          .eq('year', competence.year)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData.push(...data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      const units: Record<string, number> = {};
      const projects: Record<string, number> = {};
      const modalities: Record<string, number> = {};
      
      // Track unique attendances per user per day to avoid duplicates
      const uniqueDayUser: Set<string> = new Set();
      
      let total = 0;

      allData.forEach((row: any) => {
        const patientNode = Array.isArray(row.patients) ? row.patients[0] : row.patients;
        const projectNode = Array.isArray(row.projects) ? row.projects[0] : row.projects;

        const patientUnitId = patientNode?.unit_id;
        const projectUnitId = projectNode?.unit_id;

        // Skip records if user is an Administrador por Unidade and neither patient nor project belongs to their allowed units
        if (currentUser?.permission === 'Administrador por Unidade') {
          if (!allowedUnitIds.includes(patientUnitId) && !allowedUnitIds.includes(projectUnitId)) {
            return;
          }
        }

        // Unit from patient or project
        const patientUnit = unitsList.find(u => u.id === patientNode?.unit_id);
        const projectUnit = unitsList.find(u => u.id === projectNode?.unit_id);
        const unitName = patientUnit?.name || projectUnit?.name || 'Não Identificado';
        
        // Skip if consolidated unit filter is active and doesn't match
        if (consolidatedUnitFilter !== 'all' && unitName !== consolidatedUnitFilter) return;

        const key = `${row.patient_id}-${row.day}`;
        if (uniqueDayUser.has(key)) return;
        
        uniqueDayUser.add(key);
        total++;
        
        units[unitName] = (units[unitName] || 0) + 1;

        // Project
        const projectName = projectNode?.name || 'Sem Projeto';
        projects[projectName] = (projects[projectName] || 0) + 1;

        // Modality
        const modalityNode = Array.isArray(row.modalities) ? row.modalities[0] : row.modalities;
        const modalityName = modalityNode?.name || 'Sem Modalidade';
        modalities[modalityName] = (modalities[modalityName] || 0) + 1;
      });

      setConsolidatedData({ units, projects, modalities, total });
    } catch (error) {
      console.error('Error loading consolidated report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnitsList = async () => {
    try {
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

      const { data } = await supabase.from('units').select('*').order('name');
      const allUnits = data || [];
      let filteredUnits = allUnits.filter((u: any) => u.status === 'Ativo');

      if (currentUser?.permission === 'Administrador por Unidade') {
        filteredUnits = filteredUnits.filter((u: any) => allowedUnitIds.includes(u.id));
      }

      setUnitsList(filteredUnits);
    } catch (err) {
      console.error('Error fetching units list:', err);
    }
  };

  const fetchUnitDetailedReport = async (unitName: string) => {
    setLoading(true);
    try {
      let allowedUnitIds: string[] = [];
      if (currentUser?.id && currentUser?.permission === 'Administrador por Unidade') {
        const { data: userUnits } = await supabase
          .from('system_user_units')
          .select('unit_id')
          .eq('system_user_id', currentUser.id);
        if (userUnits) {
          allowedUnitIds = userUnits.map((u: any) => u.unit_id);
        }
      }

      const allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('attendance')
          .select(`
            day,
            patient_id,
            patients (
              id,
              name,
              record_number,
              status,
              unit_id
            ),
            projects (
              id,
              name,
              unit_id
            )
          `)
          .eq('month', competence.month + 1)
          .eq('year', competence.year)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData.push(...data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      // Group by patient for AttendanceTable format
      const patientGroups: Record<string, any> = {};
      
      allData.forEach((row: any) => {
        const patientNode = Array.isArray(row.patients) ? row.patients[0] : row.patients;
        const projectNode = Array.isArray(row.projects) ? row.projects[0] : row.projects;

        const patientUnitId = patientNode?.unit_id;
        const projectUnitId = projectNode?.unit_id;

        if (currentUser?.permission === 'Administrador por Unidade') {
          if (!allowedUnitIds.includes(patientUnitId) && !allowedUnitIds.includes(projectUnitId)) {
            return;
          }
        }

        const patientUnit = unitsList.find(u => u.id === patientNode?.unit_id);
        const projectUnit = unitsList.find(u => u.id === projectNode?.unit_id);
        const rowUnitName = patientUnit?.name || projectUnit?.name;
        if (!rowUnitName || rowUnitName.trim().toLowerCase() !== unitName.trim().toLowerCase()) return;

        const patientId = row.patient_id;
        const patient = patientNode;

        if (!patientGroups[patientId]) {
          patientGroups[patientId] = {
            id: patientId,
            name: patient?.name || 'Não identificado',
            record_number: patient?.record_number || '---',
            status: (patient?.status as 'Ativo' | 'Inativo') || 'Ativo',
            attendance: new Set<number>()
          };
        }
        
        patientGroups[patientId].attendance.add(row.day);
      });

      // Convert Sets to arrays and sort
      const formattedData = Object.values(patientGroups)
        .map((p: any) => ({
          ...p,
          attendance: Array.from(p.attendance).sort((a: any, b: any) => a - b)
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setUnitDetailedData(formattedData);
    } catch (error) {
      console.error('Error loading detailed unit report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLowAttendanceMetadata = async () => {
    try {
      const { data: projs } = await supabase.from('projects').select('*').order('name');
      setProjectsList(projs || []);
      const { data: mods } = await supabase.from('modalities').select('*').order('name');
      setModalitiesList(mods || []);
      const { data: profs } = await supabase.from('professionals').select('*').order('name');
      setProfessionalsList(profs || []);
    } catch (err) {
      console.error('Error fetching low attendance metadata:', err);
    }
  };

  const fetchLowAttendanceReport = async () => {
    setLoading(true);
    try {
      // 1. Fetch patients
      let patientsQuery = supabase
        .from('patients')
        .select('id, name, unit_id, record_number, status, phone_1, phone_2, units(id, name)')
        .eq('status', 'Ativo')
        .order('name');

      if (currentUser?.id && currentUser?.permission === 'Administrador por Unidade') {
        const { data: userUnits } = await supabase
          .from('system_user_units')
          .select('unit_id')
          .eq('system_user_id', currentUser.id);
        const allowedUnitIds = (userUnits || []).map((u: any) => u.unit_id);
        patientsQuery = patientsQuery.in('unit_id', allowedUnitIds);
      }

      const { data: pData, error: pError } = await patientsQuery;
      if (pError) throw pError;
      const patients = pData || [];

      // 2. Determine target months & years based on custom period range
      const start = new Date(laFilters.startDate + 'T00:00:00');
      const end = new Date(laFilters.endDate + 'T23:59:59');
      
      const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      const activeMonthsYears: { month: number; year: number }[] = [];
      for (let i = 0; i <= monthsDiff; i++) {
        const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
        activeMonthsYears.push({
          month: date.getMonth() + 1,
          year: date.getFullYear()
        });
      }

      // 3. Fetch attendance
      let laAttendances: any[] = [];
      if (activeMonthsYears.length > 0) {
        const uniqueYears = Array.from(new Set(activeMonthsYears.map(m => m.year)));
        const { data: attData, error: attError } = await supabase
          .from('attendance')
          .select('day, month, year, patient_id, project_id, professional_id, modality_id')
          .in('year', uniqueYears);
        
        if (attError) throw attError;

        if (attData) {
          laAttendances = attData.filter((att: any) => {
            const isMonthActive = activeMonthsYears.some(item => item.month === att.month && item.year === att.year);
            if (!isMonthActive) return false;
            
            const attDate = new Date(att.year, att.month - 1, att.day);
            return attDate >= start && attDate <= end;
          });
        }
      }

      // 4. Calculate stats for each patient
      const calculated: any[] = [];

      patients.forEach((patient: any) => {
        const classes = ['Turma A', 'Turma B', 'Turma C', 'Turma D'];
        const assignedTurma = classes[patient.id.charCodeAt(patient.id.length - 1) % classes.length];

        if (laFilters.unit !== 'all' && patient.unit_id !== laFilters.unit) return;
        if (laFilters.turma !== 'all' && assignedTurma !== laFilters.turma) return;

        const patientAtts = laAttendances.filter(att => att.patient_id === patient.id);

        const matchingAtts = patientAtts.filter(att => {
          if (laFilters.project !== 'all' && att.project_id !== laFilters.project) return false;
          if (laFilters.modality !== 'all' && att.modality_id !== laFilters.modality) return false;
          if (laFilters.professional !== 'all' && att.professional_id !== laFilters.professional) return false;
          return true;
        });

        const uniqueDaysPresent = new Set(matchingAtts.map(att => `${att.year}-${att.month}-${att.day}`));
        const presencesCount = uniqueDaysPresent.size;

        const expected = laFilters.expectedClasses || 1;
        const frequency = Math.min(100, Math.round((presencesCount / expected) * 100));
        
        if (frequency >= 75) return;

        const absences = Math.max(0, expected - presencesCount);

        let latestDate: Date | null = null;
        let latestDateStr = 'Nunca';
        let daysAbsent = 999;

        if (matchingAtts.length > 0) {
          const dates = matchingAtts.map(att => new Date(att.year, att.month - 1, att.day));
          latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
          latestDateStr = latestDate.toLocaleDateString('pt-BR');

          const today = new Date();
          const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const lDate = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate());
          const diffTime = todayDate.getTime() - lDate.getTime();
          daysAbsent = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        let riskLevel: 'crítico' | 'vermelho' | 'amarelo' = 'amarelo';
        if (frequency < 25) {
          riskLevel = 'crítico';
        } else if (frequency < 50) {
          riskLevel = 'vermelho';
        }

        const resolvedUnitNode = Array.isArray(patient.units) ? patient.units[0] : patient.units;
        const unitName = resolvedUnitNode?.name || 'Sem Unidade';

        const pIds = Array.from(new Set(matchingAtts.map(a => a.project_id)));
        const pNames = pIds
          .map(id => projectsList.find(pr => pr.id === id)?.name)
          .filter(Boolean)
          .join(', ');

        calculated.push({
          id: patient.id,
          name: patient.name,
          record_number: patient.record_number || '---',
          frequency,
          presences: presencesCount,
          absences,
          latestDateStr,
          daysAbsent,
          riskLevel,
          unitName,
          projectName: pNames || 'Sem Atendimento',
          turma: assignedTurma,
          patientObj: patient
        });
      });

      const sorted = calculated.sort((a, b) => b.daysAbsent - a.daysAbsent);
      setLaPatients(sorted);

    } catch (err) {
      console.error('Error loading low attendance report:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistories = (patientId: string) => {
    const obsSaved = localStorage.getItem(`sira_obs_${patientId}`);
    if (obsSaved) {
      try {
        setObservationHistory(JSON.parse(obsSaved));
      } catch (e) {
        setObservationHistory([]);
      }
    } else {
      setObservationHistory([]);
    }

    const ctSaved = localStorage.getItem(`sira_contacts_${patientId}`);
    if (ctSaved) {
      try {
        setContactHistory(JSON.parse(ctSaved));
      } catch (e) {
        setContactHistory([]);
      }
    } else {
      setContactHistory([]);
    }
  };

  const saveObservation = () => {
    if (!selectedPatientForAction || !observationText.trim()) return;
    const patientId = selectedPatientForAction.id;
    const author = currentUser?.username || 'Coordenador';
    const newObs = {
      id: Math.random().toString(36).substring(2, 9),
      text: observationText,
      date: new Date().toISOString(),
      author
    };

    const currentHistory = [...observationHistory, newObs];
    localStorage.setItem(`sira_obs_${patientId}`, JSON.stringify(currentHistory));
    setObservationHistory(currentHistory);
    setObservationText('');
  };

  const saveContact = () => {
    if (!selectedPatientForAction || !contactNotes.trim()) return;
    const patientId = selectedPatientForAction.id;
    const author = currentUser?.username || 'Coordenador';
    const newContact = {
      id: Math.random().toString(36).substring(2, 9),
      channel: contactChannel,
      notes: contactNotes,
      responsible: contactResponsible || author,
      date: new Date().toISOString(),
      author
    };

    const currentHistory = [...contactHistory, newContact];
    localStorage.setItem(`sira_contacts_${patientId}`, JSON.stringify(currentHistory));
    setContactHistory(currentHistory);
    setContactNotes('');
    setContactResponsible('');
  };

  useEffect(() => {
    fetchUnitsList();
  }, [currentUser]);

  useEffect(() => {
    if (unitsList.length > 0) {
      if (currentUser?.permission === 'Administrador por Unidade') {
        const isSelectedValid = unitsList.some(u => u.name === selectedUnit);
        if (!isSelectedValid) {
          setSelectedUnit(unitsList[0].name);
          setSelectedUnitLogo(unitsList[0].logo_url || null);
        }
      }
    }
  }, [unitsList, currentUser, selectedUnit]);

  useEffect(() => {
    if (reportType === 'low_attendance') {
      fetchLowAttendanceMetadata();
    }
  }, [reportType]);

  useEffect(() => {
    if (unitsList.length === 0) return;
    if (reportType === 'attendance') {
      fetchConsolidatedData();
    } else if (reportType === 'units' && selectedUnit) {
      fetchUnitDetailedReport(selectedUnit);
    } else if (reportType === 'low_attendance') {
      fetchLowAttendanceReport();
    }
  }, [reportType, competence, selectedUnit, consolidatedUnitFilter, unitsList, currentUser, laFilters, projectsList]);

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-20 px-4 md:px-0">
      {/* Categories Horizontal Navigation Bar */}
      <div className="flex justify-center no-print px-2 sm:px-4">
        <div className="bg-[#f4f3f5] p-1.5 rounded-2xl w-full max-w-full sm:max-w-2xl border border-[#e8bcb7]/10 flex gap-1 sm:gap-1.5 md:gap-2">
          {reportCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setReportType(cat.id);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 md:px-6 py-2.5 rounded-xl text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap select-none",
                reportType === cat.id
                  ? "bg-white text-[#ed1c24] shadow-sm"
                  : "text-[#5e3f3b] opacity-40 hover:bg-white/50"
              )}
            >
              <cat.icon size={14} className="shrink-0 sm:w-4 sm:h-4 text-[#ed1c24]" />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Report Interface */}
      <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] border border-[#e8bcb7]/10 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="p-6 lg:p-8 border-b border-[#e8bcb7]/10 bg-[#faf9fb]/50 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-lg lg:text-xl font-black text-[#1a1c1d] tracking-tight">
                {reportType === 'attendance' 
                  ? 'Relatório Consolidado Mensal' 
                  : reportType === 'units' 
                    ? 'Relatório de Presença em Atendimento Consolidado' 
                    : 'Monitoramento de Evasão e Baixa Frequência'}
              </h2>
              <p className="text-[10px] text-[#5e3f3b] font-bold opacity-60 uppercase tracking-widest leading-relaxed">
                {reportType === 'attendance' 
                  ? `Competência: ${months[competence.month]} / ${competence.year}` 
                  : reportType === 'units' 
                    ? 'Selecione os filtros abaixo para compor seu relatório' 
                    : 'Acompanhamento estratégico de beneficiários com risco potencial de evasão'}
              </p>
            </div>
            
            {/* Competence Selector */}
            <div className="flex flex-wrap items-center gap-3">
              {reportType === 'attendance' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsConsolidatedDropdownOpen(!isConsolidatedDropdownOpen)}
                    className={cn(
                      "flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] transition-all duration-300 hover:bg-[#faeff0] select-none",
                      isConsolidatedDropdownOpen ? "border-[#ed1c24]/30 shadow-md ring-4 ring-[#ed1c24]/5" : "border-[#e8bcb7]/20"
                    )}
                  >
                    {consolidatedUnitFilter !== 'all' && unitsList.find(u => u.name === consolidatedUnitFilter)?.logo_url ? (
                      <div className="w-4 h-4 rounded bg-white overflow-hidden border border-[#e8bcb7]/20 p-0.5 shrink-0 flex items-center justify-center">
                        <img src={unitsList.find(u => u.name === consolidatedUnitFilter)?.logo_url} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <Building2 size={16} className="text-[#ed1c24] shrink-0" />
                    )}
                    <span className="truncate max-w-[150px]">
                      {consolidatedUnitFilter === 'all' ? 'Todas as Unidades' : consolidatedUnitFilter}
                    </span>
                    <svg
                      className={cn("w-3 h-3 text-[#ed1c24] transition-transform duration-300 ml-1 shrink-0", isConsolidatedDropdownOpen ? "rotate-180" : "")}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Card */}
                  {isConsolidatedDropdownOpen && (
                    <div className="absolute z-50 left-0 mt-2 w-72 bg-white rounded-2xl border border-[#e8bcb7]/25 shadow-xl shadow-[#5e3f3b]/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Search Input */}
                      <div className="p-3 border-b border-[#faf9fb] bg-[#faf9fb]/50 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#ed1c24] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Buscar unidade..."
                          value={consolidatedUnitSearch}
                          onChange={(e) => setConsolidatedUnitSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-transparent border-none text-[10px] font-black text-gray-700 placeholder-gray-400 focus:ring-0 p-1 cursor-text uppercase tracking-wider"
                        />
                        {consolidatedUnitSearch && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConsolidatedUnitSearch('');
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
                            setConsolidatedUnitFilter('all');
                            setIsConsolidatedDropdownOpen(false);
                            setConsolidatedUnitSearch('');
                          }}
                          className={cn(
                            "w-full text-left px-4 py-3 hover:bg-[#faeff0]/30 transition-all flex items-center justify-between gap-3 group",
                            consolidatedUnitFilter === 'all' ? "bg-[#faeff0]/70" : ""
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-[#ed1c24]" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-700 group-hover:text-gray-900">Todas as Unidades</span>
                          </div>
                          {consolidatedUnitFilter === 'all' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#ed1c24]" />
                          )}
                        </button>

                        {unitsList
                          .filter(u => u.name.toLowerCase().includes(consolidatedUnitSearch.toLowerCase()))
                          .map((u) => {
                            const isSelected = consolidatedUnitFilter === u.name;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setConsolidatedUnitFilter(u.name);
                                  setIsConsolidatedDropdownOpen(false);
                                  setConsolidatedUnitSearch('');
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
                        
                        {unitsList.filter(u => u.name.toLowerCase().includes(consolidatedUnitSearch.toLowerCase())).length === 0 && (
                          <div className="px-4 py-6 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Nenhuma unidade encontrada
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-[#e8bcb7]/20">
                <Calendar size={16} className="text-[#ed1c24]" />
                <select 
                  value={competence.month}
                  onChange={(e) => setCompetence(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                  className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] focus:ring-0 cursor-pointer"
                >
                  {months.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-[#e8bcb7]/20">
                <select 
                  value={competence.year}
                  onChange={(e) => setCompetence(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] focus:ring-0 cursor-pointer"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button className="bg-white text-[#5e3f3b] p-3 rounded-xl border border-[#e8bcb7]/20 hover:bg-[#faf9fb] transition-all">
                  <FileSpreadsheet size={18} className="text-green-600" />
                </button>
                <button className="bg-[#1a1c1d] text-white p-3 rounded-xl shadow-lg hover:bg-[#2a2c2d] transition-all">
                  <Download size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8">
          {reportType === 'attendance' ? (
            loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={40} className="text-[#ed1c24] animate-spin" />
                <p className="text-[10px] font-black text-[#5e3f3b] uppercase tracking-widest animate-pulse">Consolidando informações...</p>
              </div>
            ) : (
              <div className="space-y-8 lg:space-y-10">
                {/* Total Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                  <div className="bg-[#ed1c24] text-white p-6 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] shadow-xl shadow-[#ed1c24]/10">
                    <div className="flex items-center justify-between mb-4">
                      <ClipboardList size={24} className="opacity-40" />
                      <span className="text-[9px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">PRESENÇAS</span>
                    </div>
                    <p className="text-3xl lg:text-4xl font-black">{consolidatedData.total}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">Neste mês</p>
                  </div>
                  
                  <div className="bg-white p-6 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] border border-[#e8bcb7]/20 shadow-sm flex flex-col justify-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40 mb-2">Unidades com Registro</p>
                    <p className="text-2xl lg:text-3xl font-black text-[#1a1c1d]">{Object.keys(consolidatedData.units).length}</p>
                  </div>

                  <div className="bg-white p-6 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] border border-[#e8bcb7]/20 shadow-sm flex flex-col justify-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40 mb-2">Projetos Atendidos</p>
                    <p className="text-2xl lg:text-3xl font-black text-[#1a1c1d]">{Object.keys(consolidatedData.projects).length}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                  {/* By Unit */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 ml-4">
                      <Building2 size={16} className="text-[#ed1c24]" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Atendimentos por Unidade</h3>
                    </div>
                    <div className="bg-[#faf9fb] rounded-[1.5rem] lg:rounded-[2rem] p-4 lg:p-6 border border-[#e8bcb7]/10">
                      <div className="space-y-2">
                        {Object.entries(consolidatedData.units).length > 0 ? (
                          Object.entries(consolidatedData.units).map(([name, count]) => (
                            <div key={name} className="flex items-center justify-between p-4 bg-white rounded-xl lg:rounded-2xl shadow-sm border border-transparent hover:border-[#ed1c24]/10 transition-all">
                              <span className="text-xs lg:text-sm font-bold text-[#5e3f3b]">{name}</span>
                              <span className="bg-[#ed1c24]/5 text-[#ed1c24] text-[10px] font-black px-4 py-1.5 rounded-full">{count}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 opacity-40 italic text-[10px] uppercase font-black">Nenhum registro encontrado</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* By Project */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 ml-4">
                      <FolderKanban size={16} className="text-[#ed1c24]" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Atendimentos por Projeto</h3>
                    </div>
                    <div className="bg-[#faf9fb] rounded-[1.5rem] lg:rounded-[2rem] p-4 lg:p-6 border border-[#e8bcb7]/10">
                      <div className="space-y-2">
                        {Object.entries(consolidatedData.projects).length > 0 ? (
                          Object.entries(consolidatedData.projects).map(([name, count]) => (
                            <div key={name} className="flex items-center justify-between p-4 bg-white rounded-xl lg:rounded-2xl shadow-sm border border-transparent hover:border-[#ed1c24]/10 transition-all">
                              <span className="text-xs lg:text-sm font-bold text-[#5e3f3b]">{name}</span>
                              <span className="bg-[#5e3f3b]/5 text-[#5e3f3b] text-[10px] font-black px-4 py-1.5 rounded-full">{count}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 opacity-40 italic text-[10px] uppercase font-black">Nenhum registro encontrado</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* By Modality */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-3 ml-4">
                      <PieChart size={16} className="text-[#ed1c24]" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Atendimentos por Modalidade</h3>
                    </div>
                    <div className="bg-[#faf9fb] rounded-[1.5rem] lg:rounded-[2rem] p-4 lg:p-6 border border-[#e8bcb7]/10">
                      {Object.entries(consolidatedData.modalities).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(consolidatedData.modalities).map(([name, count]) => (
                            <div key={name} className="flex items-center justify-between p-4 bg-white rounded-xl lg:rounded-2xl shadow-sm border border-transparent hover:border-[#ed1c24]/10 transition-all">
                              <span className="text-[10px] font-bold text-[#5e3f3b] uppercase tracking-wider flex-1 mr-4 leading-tight">{name}</span>
                              <span className="text-[#ed1c24] text-xs font-black shrink-0">{count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 opacity-40 italic text-[10px] uppercase font-black">Nenhum registro encontrado</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : reportType === 'units' ? (
            <div className="space-y-6">
              {/* Only inject portrait orientation and specific print styles for this report */}
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 1cm;
                  }
                  
                  /* Page numbering in the footer */
                  .print-page-footer {
                    position: fixed;
                    bottom: 0;
                    right: 0;
                    width: 100%;
                    text-align: right;
                    font-size: 8px;
                    font-family: sans-serif;
                    font-weight: bold;
                    text-transform: uppercase;
                    color: #5e3f3b;
                    opacity: 0.5;
                    border-top: 1px solid #e8bcb720;
                    padding-top: 10px;
                  }
                  
                  .print-page-footer::after {
                    content: "Página " counter(page);
                  }

                  body {
                    counter-reset: page;
                  }

                  /* Ensure totals only on last page */
                  tfoot {
                    display: table-row-group !important;
                  }

                  /* Prevent table rows and cells from cutting across pages */
                  tr {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                  }
                }
              ` }} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-4">Selecione a Unidade</label>
                  
                  {/* Custom Selector Trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={cn(
                        "w-full pl-14 pr-12 py-4 bg-[#f4f3f5] rounded-2xl text-sm font-bold border border-transparent text-left focus:outline-none transition-all duration-300 relative select-none flex items-center justify-between",
                        isDropdownOpen ? "bg-white border-[#ed1c24]/20 shadow-md ring-4 ring-[#ed1c24]/5" : "hover:bg-[#faeff0]"
                      )}
                    >
                      <div className="flex items-center gap-3 truncate">
                        {selectedUnitLogo ? (
                          <div className="w-6 h-6 rounded-lg bg-white overflow-hidden border border-[#e8bcb7]/20 p-0.5 shrink-0 flex items-center justify-center">
                            <img src={selectedUnitLogo} alt="Logo" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <Building2 className="text-[#ed1c24] shrink-0" size={18} />
                        )}
                        <span className="truncate text-gray-800">
                          {selectedUnit || "Escolha uma unidade..."}
                        </span>
                      </div>
                      
                      {/* Chevron Indicator */}
                      <svg
                        className={cn("w-4 h-4 text-[#ed1c24] transition-transform duration-300", isDropdownOpen ? "rotate-180" : "")}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Card */}
                    {isDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl border border-[#e8bcb7]/25 shadow-xl shadow-[#5e3f3b]/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Search Input */}
                        <div className="p-3 border-b border-[#faf9fb] bg-[#faf9fb]/50 flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#ed1c24] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input
                            type="text"
                            placeholder="Buscar unidade..."
                            value={unitSearch}
                            onChange={(e) => setUnitSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-transparent border-none text-xs font-bold text-gray-700 placeholder-gray-400 focus:ring-0 p-1 cursor-text"
                          />
                          {unitSearch && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUnitSearch('');
                              }}
                              className="text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest shrink-0"
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
                              setSelectedUnit(null);
                              setSelectedUnitLogo(null);
                              setIsDropdownOpen(false);
                              setUnitSearch('');
                            }}
                            className="w-full text-left px-5 py-3 hover:bg-[#faeff0]/30 transition-all flex items-center justify-between"
                          >
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Limpar seleção</span>
                          </button>

                          {unitsList
                            .filter(u => u.name.toLowerCase().includes(unitSearch.toLowerCase()))
                            .map((u) => {
                              const isSelected = selectedUnit === u.name;
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedUnit(u.name);
                                    setSelectedUnitLogo(u.logo_url || null);
                                    setIsDropdownOpen(false);
                                    setUnitSearch('');
                                  }}
                                  className={cn(
                                    "w-full text-left px-5 py-3.5 hover:bg-[#faeff0]/40 transition-all flex items-center justify-between gap-4 group",
                                    isSelected ? "bg-[#faeff0]/70" : ""
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-[#f4f3f5] p-1 border border-[#e8bcb7]/10 shrink-0 flex items-center justify-center relative overflow-hidden group-hover:bg-white transition-colors">
                                      {u.logo_url ? (
                                        <img src={u.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                      ) : (
                                        <Building2 size={16} className="text-[#ed1c24] opacity-40 group-hover:opacity-100 transition-opacity" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className={cn(
                                        "text-xs font-black truncate transition-colors",
                                        isSelected ? "text-[#ed1c24]" : "text-gray-700 group-hover:text-gray-900"
                                      )}>
                                        {u.name}
                                      </p>
                                      {u.cnpj && (
                                        <p className="text-[9px] font-bold text-gray-400 mt-0.5 tracking-tight font-mono">
                                          CNPJ: {u.cnpj}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-2">
                                    <span className={cn(
                                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                      u.status === "Ativo" 
                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                        : "bg-amber-50 text-amber-600 border border-amber-100"
                                    )}>
                                      {u.status || "Ativo"}
                                    </span>
                                    {isSelected && (
                                      <div className="w-2 h-2 rounded-full bg-[#ed1c24]" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          
                          {unitsList.filter(u => u.name.toLowerCase().includes(unitSearch.toLowerCase())).length === 0 && (
                            <div className="px-5 py-8 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                              Nenhuma unidade encontrada
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedUnit ? (
                loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 size={40} className="text-[#ed1c24] animate-spin" />
                    <p className="text-[10px] font-black text-[#5e3f3b] uppercase tracking-widest animate-pulse">Consolidando lista...</p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Print View: formatted specifically for PDF/A4 Print matching Registro Mensal exactly */}
                    <div className="print-only w-full">
                      <div className="print-header">
                        <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-[#ed1c24]/10">
                          <div className="flex items-center gap-6 font-sans">
                            {selectedUnitLogo ? (
                              <div className="w-24 h-24 flex items-center justify-center p-2 bg-white rounded-2xl shadow-sm border border-[#e8bcb7]/10 overflow-hidden">
                                <img src={selectedUnitLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
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
                          <div className="text-right text-[10px] text-[#5e3f3b] font-medium mt-2 font-sans">
                            <p>Data de Emissão: {formatDate(new Date().toISOString().split('T')[0])}</p>
                          </div>
                        </div>

                        {/* Informacionais/Filtros Grid (following Registro Mensal pattern) */}
                        <div className="grid grid-cols-2 gap-4 bg-[#f4f3f5] p-5 rounded-2xl border border-[#e8bcb7]/20 mb-8 font-sans">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Unidade / Polo</p>
                            <p className="text-sm font-bold text-[#1a1c1d]">{selectedUnit}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Período (Competência)</p>
                            <p className="text-sm font-bold text-[#1a1c1d]">{months[competence.month]} / {competence.year}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Projetos</p>
                            <p className="text-sm font-bold text-[#1a1c1d]">Todos (Consolidado)</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Modalidades</p>
                            <p className="text-sm font-bold text-[#1a1c1d]">Todas (Consolidado)</p>
                          </div>
                        </div>

                        {/* Resumo/Metrics Grid (following Registro Mensal pattern) */}
                        <div className="grid grid-cols-3 gap-4 bg-white p-5 rounded-2xl border border-[#e8bcb7]/20 mb-8 font-sans">
                          {(() => {
                            const totalUsers = unitDetailedData.length;
                            const totalAttendances = unitDetailedData.reduce((acc, curr) => acc + curr.attendance.length, 0);
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
                        data={unitDetailedData}
                        onToggle={() => {}}
                        readOnly={true}
                        month={(competence.month + 1).toString()}
                        year={competence.year.toString()}
                        showAttendanceDays={true}
                      />

                      {/* Resumo da Competência callout */}
                      <div className="mt-12 bg-[#f4f3f5]/55 p-6 rounded-2xl border border-[#e8bcb7]/20 text-left font-sans w-full break-inside-avoid page-break-inside-avoid">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-50 mb-3">Resumo da Competência</p>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-[#1a1c1d]">Total de Usuários: <span className="text-[#ed1c24] ml-1">{unitDetailedData.length}</span></p>
                          <p className="text-sm font-bold text-[#1a1c1d]">Total de Presenças: <span className="text-[#ed1c24] ml-1">{unitDetailedData.reduce((acc, curr) => acc + curr.attendance.length, 0)}</span></p>
                        </div>
                        <p className="text-[9px] font-medium text-[#5e3f3b] opacity-40 mt-4 leading-tight italic">
                          * Este documento é um registro consolidado de presenças para a unidade {selectedUnit} referente ao mês de {months[competence.month]} de {competence.year}.
                        </p>
                      </div>

                      {/* Signature block exactly following the Registro Mensal de Atendimentos pattern */}
                      <div className="mt-20 flex flex-col items-center pt-12 print-signature font-sans">
                        <div className="w-72 border-b border-[#1a1c1d] mb-3"></div>
                        <div className="text-center">
                          <p className="text-sm font-black text-[#1a1c1d] uppercase tracking-tight">Coordenação Responsável</p>
                          <p className="text-[9px] font-black text-[#ed1c24] tracking-[0.2em] mt-1 uppercase">Assinatura e Carimbo</p>
                        </div>
                      </div>
                      
                      {/* Fixed page number element */}
                      <div className="print-page-footer"></div>
                    </div>

                    {/* Interactive Page View - Hidden when printing */}
                    <div className="space-y-6 no-print">
                      <div className="flex items-center justify-between px-4">
                        <div className="space-y-1">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Lista Consolidada Mensal</h3>
                          <p className="text-[9px] font-bold text-[#5e3f3b] opacity-40 uppercase tracking-widest">Sem duplicidades diárias por usuário</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-widest bg-[#ed1c24]/10 text-[#ed1c24] px-4 py-2 rounded-full border border-[#ed1c24]/10 shadow-sm">
                            {unitDetailedData.length} Usuários Atendidos
                          </span>
                          <button 
                            onClick={() => window.print()}
                            className="flex items-center gap-2 bg-[#ed1c24] hover:bg-[#d11920] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-[0_4px_12px_rgba(237,28,36,0.3)] active:scale-95"
                          >
                            <Printer size={16} />
                            <span>Imprimir Relatório</span>
                          </button>
                        </div>
                      </div>

                      <AttendanceTable 
                        data={unitDetailedData}
                        onToggle={() => {}}
                        readOnly={true}
                        month={(competence.month + 1).toString()}
                        year={competence.year.toString()}
                        showAttendanceDays={true}
                      />
                    </div>
                  </div>
                )
              ) : (
                <div className="py-20 text-center bg-[#faf9fb] rounded-[2rem] border border-dashed border-[#e8bcb7]/20">
                   <Building2 size={40} className="mx-auto text-[#ed1c24] opacity-20 mb-4" />
                   <p className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-60">Selecione uma unidade acima para visualizar o relatório consolidado</p>
                </div>
              )}
            </div>
          ) : reportType === 'low_attendance' ? (
            <div className="space-y-6">
              {/* Development Warning Notice */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-[1.5rem] bg-amber-50/70 border border-amber-200/50 text-[#5e3f3b] no-print animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <AlertTriangle size={20} className="animate-bounce" style={{ animationDuration: '3s' }} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">Módulo em Desenvolvimento</h4>
                    <p className="text-[11px] font-semibold text-amber-800/80 mt-0.5 leading-relaxed">
                      Este painel de Monitoramento de Evasão e Baixa Frequência está em fase de desenvolvimento e homologação de dados. Algumas funcionalidades e regras de negócio estão em período de teste piloto.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dynamic Filters Bar */}
              <div className="bg-[#faf9fb] p-6 rounded-[2rem] border border-[#e8bcb7]/10 space-y-4 no-print">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-[#ed1c24]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Painel de Filtros Operacionais</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#5e3f3b] uppercase">Aulas Previstas:</span>
                    <div className="flex items-center gap-1 bg-white border border-[#e8bcb7]/20 rounded-xl px-2 py-1">
                      <button 
                        onClick={() => setLaFilters(prev => ({ ...prev, expectedClasses: Math.max(1, prev.expectedClasses - 1) }))}
                        className="p-1 hover:bg-slate-50 rounded text-[#ed1c24] font-black active:scale-95"
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        value={laFilters.expectedClasses}
                        onChange={(e) => setLaFilters(prev => ({ ...prev, expectedClasses: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-10 text-center border-none focus:ring-0 text-xs font-black text-[#1a1c1d] p-0 shadow-none outline-none"
                      />
                      <button 
                        onClick={() => setLaFilters(prev => ({ ...prev, expectedClasses: prev.expectedClasses + 1 }))}
                        className="p-1 hover:bg-slate-50 rounded text-[#ed1c24] font-black active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Select: Unidade */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-2">Unidade / Polo</label>
                    <select 
                      value={laFilters.unit}
                      onChange={(e) => setLaFilters(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-[#e8bcb7]/20 rounded-xl text-xs font-bold text-[#1a1c1d] focus:ring-2 focus:ring-[#ed1c24]/20 outline-none"
                    >
                      <option value="all">Todas as Unidades</option>
                      {unitsList.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select: Projeto */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-2">Projeto</label>
                    <select 
                      value={laFilters.project}
                      onChange={(e) => setLaFilters(prev => ({ ...prev, project: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-[#e8bcb7]/20 rounded-xl text-xs font-bold text-[#1a1c1d] focus:ring-2 focus:ring-[#ed1c24]/20 outline-none"
                    >
                      <option value="all">Todos os Projetos</option>
                      {projectsList.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select: Modalidade */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-2">Modalidade</label>
                    <select 
                      value={laFilters.modality}
                      onChange={(e) => setLaFilters(prev => ({ ...prev, modality: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-[#e8bcb7]/20 rounded-xl text-xs font-bold text-[#1a1c1d] focus:ring-2 focus:ring-[#ed1c24]/20 outline-none"
                    >
                      <option value="all">Todas as Modalidades</option>
                      {modalitiesList.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select: Profissional */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-2">Profissional</label>
                    <select 
                      value={laFilters.professional}
                      onChange={(e) => setLaFilters(prev => ({ ...prev, professional: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-[#e8bcb7]/20 rounded-xl text-xs font-bold text-[#1a1c1d] focus:ring-2 focus:ring-[#ed1c24]/20 outline-none"
                    >
                      <option value="all">Todos os Profissionais</option>
                      {professionalsList.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select: Turma */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-2">Turma</label>
                    <select 
                      value={laFilters.turma}
                      onChange={(e) => setLaFilters(prev => ({ ...prev, turma: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-[#e8bcb7]/20 rounded-xl text-xs font-bold text-[#1a1c1d] focus:ring-2 focus:ring-[#ed1c24]/20 outline-none"
                    >
                      <option value="all">Todas as Turmas</option>
                      <option value="Turma A">Turma A</option>
                      <option value="Turma B">Turma B</option>
                      <option value="Turma C">Turma C</option>
                      <option value="Turma D">Turma D</option>
                    </select>
                  </div>

                  {/* Date Custom range fields */}
                  <div className="space-y-1.5 col-span-1 md:col-span-1 border-none outline-none">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-2 border-none">Início do Período</label>
                    <input 
                      type="date"
                      value={laFilters.startDate}
                      onChange={(e) => setLaFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-[#e8bcb7]/20 rounded-xl text-xs font-bold text-[#1a1c1d] focus:ring-2 focus:ring-[#ed1c24]/20 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-1 md:col-span-1 border-none outline-none">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-2 border-none">Fim do Período</label>
                    <input 
                      type="date"
                      value={laFilters.endDate}
                      onChange={(e) => setLaFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-[#e8bcb7]/20 rounded-xl text-xs font-bold text-[#1a1c1d] focus:ring-2 focus:ring-[#ed1c24]/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Statistical Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-[1.5rem] bg-amber-50/50 border border-amber-200/50 flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-60">Beneficiários em Risco</p>
                    <h3 className="text-3xl font-black text-amber-600">{laPatients.length}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                    <AlertTriangle size={24} />
                  </div>
                </div>

                <div className="p-6 rounded-[1.5rem] bg-rose-50/50 border border-rose-200/50 flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-60">Status Crítico (&lt;25%)</p>
                    <h3 className="text-3xl font-black text-rose-600">{laPatients.filter(p => p.riskLevel === 'crítico').length}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 shadow-sm">
                    <AlertCircle size={24} />
                  </div>
                </div>

                <div className="p-6 rounded-[1.5rem] bg-indigo-50/50 border border-[#e8bcb7]/15 flex items-center justify-between shadow-sm">
                  <div className="space-y-1 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-60">Frequência Média de Risco</p>
                    <h3 className="text-3xl font-black text-indigo-600 font-sans">
                      {laPatients.length > 0 
                        ? Math.round(laPatients.reduce((acc, curr) => acc + curr.frequency, 0) / laPatients.length)
                        : 0}%
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                    <TrendingUp size={24} />
                  </div>
                </div>
              </div>

              {/* Statistical List Table */}
              <div className="overflow-x-auto rounded-[2rem] border border-[#e8bcb7]/15 bg-white shadow-sm overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#faf9fb] bg-[#f4f3f5]/50 no-print select-none">
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b]">Beneficiário</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b]">Unidade / Polo</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b]">Projeto Participante</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b]">Turma</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] text-center">Faltas</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] text-center">Última Presença</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] text-center">Inatividade (Dias)</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] text-center">Frequência</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] text-center">Grau de Risco</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] text-right">Controles Rápidos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#faf9fb]">
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                          <Loader2 className="animate-spin text-[#ed1c24] mx-auto mb-2" size={24} />
                          Processando monitoramento em tempo real...
                        </td>
                      </tr>
                    ) : laPatients.length > 0 ? (
                      laPatients.map((p) => {
                        let badgeClass = "";
                        let badgeText = "";
                        if (p.riskLevel === 'crítico') {
                          badgeClass = "bg-rose-100 text-rose-700 border border-rose-200 animate-pulse";
                          badgeText = "Crítico (<25%)";
                        } else if (p.riskLevel === 'vermelho') {
                          badgeClass = "bg-red-50 text-red-600 border border-red-100";
                          badgeText = "Vermelho (<50%)";
                        } else {
                          badgeClass = "bg-amber-50 text-amber-700 border border-amber-100";
                          badgeText = "Amarelo (<75%)";
                        }

                        return (
                          <tr key={p.id} className="hover:bg-[#faf9fb]/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="font-bold text-[#1a1c1d] text-xs leading-none">{p.name}</div>
                              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Nº Prontuário: {p.record_number}</div>
                            </td>
                            <td className="py-4 px-6 text-xs text-[#5e3f3b] font-semibold">{p.unitName}</td>
                            <td className="py-4 px-6 text-xs text-[#5e3f3b] font-semibold max-w-[200px] truncate" title={p.projectName}>
                              {p.projectName}
                            </td>
                            <td className="py-4 px-6 text-xs text-indigo-500 font-bold select-none">{p.turma}</td>
                            <td className="py-4 px-6 text-xs font-black text-center text-rose-600">{p.absences}</td>
                            <td className="py-4 px-6 text-xs font-semibold text-center text-slate-700">{p.latestDateStr}</td>
                            <td className="py-4 px-6 text-xs font-semibold text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                p.daysAbsent >= 30 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
                              )}>
                                {p.daysAbsent === 999 ? 'Sem participações' : `${p.daysAbsent} dias`}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-xs font-black text-center text-gray-950">{p.frequency}%</td>
                            <td className="py-4 px-6 text-center select-none">
                              <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider", badgeClass)}>
                                {badgeText}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-1.5 no-print">
                                <button 
                                  onClick={() => {
                                    setSelectedPatientForAction(p);
                                    loadHistories(p.id);
                                    setIsObservationModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-[#f4f3f5] hover:bg-[#faeff0] hover:text-[#ed1c24] text-[#5e3f3b] rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
                                  title="Registrar Observação"
                                >
                                  <MessageSquare size={12} />
                                  Obs
                                </button>
                                <button 
                                  onClick={() => {
                                    setSelectedPatientForAction(p);
                                    loadHistories(p.id);
                                    setIsContactModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-[#f4f3f5] hover:bg-[#faeff0] hover:text-green-600 text-[#5e3f3b] rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
                                  title="Registrar Contato com Responsável"
                                >
                                  <Phone size={12} />
                                  Contato
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={10} className="py-16 text-center">
                          <div className="space-y-3 max-w-sm mx-auto">
                            <AlertCircle size={36} className="mx-auto text-amber-500 opacity-60" />
                            <p className="text-xs font-black text-[#5e3f3b] uppercase tracking-widest">Nenhum beneficiário encontrado</p>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-relaxed">
                              Nenhum participante ativo possui frequência de comparecimento inferior a 75% sob os parâmetros e filtros operacionais configurados.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Filters Section */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-4">Período</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-[#ed1c24]" size={18} />
                    <select className="w-full pl-14 pr-6 py-4 bg-[#f4f3f5] rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all appearance-none cursor-pointer">
                      <option>Últimos 30 dias</option>
                      <option>Mês Atual</option>
                      <option>Trimestre</option>
                      <option>Semestre</option>
                      <option>Personalizado...</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] ml-4">Unidade / Polo</label>
                  <div className="relative">
                    <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 text-[#ed1c24]" size={18} />
                    <select className="w-full pl-14 pr-6 py-4 bg-[#f4f3f5] rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-[#ed1c24]/20 transition-all appearance-none cursor-pointer">
                    <option>Todas as Unidades</option>
                    </select>
                  </div>
                </div>

                <button className="w-full bg-[#faeff0] text-[#ed1c24] py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-[#f5e4e6] transition-all flex items-center justify-center gap-2">
                  <Filter size={16} />
                  <span>Aplicar Filtros Avançados</span>
                </button>
              </div>

              {/* Preview Chart Placeholder */}
              <div className="md:col-span-2 space-y-4">
                <div className="h-full min-h-[300px] bg-[#faf9fb] rounded-[2rem] border border-dashed border-[#e8bcb7]/20 flex flex-col items-center justify-center p-8 text-center gap-4">
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center">
                    <BarChart3 size={40} className="text-[#ed1c24] opacity-20" />
                  </div>
                  <div className="max-w-xs space-y-2">
                    <p className="text-sm font-bold text-[#1a1c1d]">Visualize seus dados aqui</p>
                    <p className="text-[10px] text-[#5e3f3b] font-medium opacity-60 leading-relaxed uppercase tracking-widest">
                      Selecione um tipo de relatório para visualizar as estatísticas personalizadas
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Observation Modal */}
      {isObservationModalOpen && selectedPatientForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-[#e8bcb7]/25 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 bg-[#faf9fb] border-b border-[#e8bcb7]/10 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-[#1a1c1d] uppercase tracking-tight">Histórico de Observações</h4>
                <p className="text-[10px] text-[#5e3f3b] font-bold opacity-60 mt-0.5 uppercase tracking-widest">
                  {selectedPatientForAction.name}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsObservationModalOpen(false);
                  setSelectedPatientForAction(null);
                  setObservationText('');
                }}
                className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Previous History scrollable */}
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {observationHistory.length > 0 ? (
                  observationHistory.map((obs) => (
                    <div key={obs.id} className="p-3 bg-[#f4f3f5]/60 rounded-xl border border-transparent hover:border-[#ed1c24]/10 transition-all space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#5e3f3b]/70">
                        <span>Por: {obs.author}</span>
                        <span>{new Date(obs.date).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-gray-800 leading-relaxed font-semibold">{obs.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-[10px] uppercase font-black tracking-wider text-gray-400">
                    Nenhuma observação registrada
                  </p>
                )}
              </div>

              {/* Input box */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b]">Nova Observação</label>
                <textarea 
                  value={observationText}
                  onChange={(e) => setObservationText(e.target.value)}
                  rows={3}
                  placeholder="Digite os fatos observados sobre a participação..."
                  className="w-full bg-[#f4f3f5] rounded-xl text-xs font-medium border-0 focus:ring-2 focus:ring-[#ed1c24]/20 p-3 outline-none"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsObservationModalOpen(false);
                  setSelectedPatientForAction(null);
                  setObservationText('');
                }}
                className="px-5 py-2.5 bg-[#f4f3f5] hover:bg-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  saveObservation();
                }}
                className="px-5 py-2.5 bg-[#ed1c24] hover:bg-[#d11920] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5"
              >
                <Check size={14} />
                Salvar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {isContactModalOpen && selectedPatientForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-[#e8bcb7]/25 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 bg-[#faf9fb] border-b border-[#e8bcb7]/10 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-[#1a1c1d] uppercase tracking-tight">Registro de Contatos</h4>
                <p className="text-[10px] text-[#5e3f3b] font-bold opacity-60 mt-0.5 uppercase tracking-widest">
                  {selectedPatientForAction.name}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsContactModalOpen(false);
                  setSelectedPatientForAction(null);
                  setContactNotes('');
                  setContactResponsible('');
                }}
                className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Previous History scrollable */}
              <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                {contactHistory.length > 0 ? (
                  contactHistory.map((ct) => (
                    <div key={ct.id} className="p-3 bg-[#f4f3f5]/60 rounded-xl border border-transparent hover:border-[#ed1c24]/10 transition-all space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#5e3f3b]/70 font-mono">
                        <span className="bg-[#ed1c24]/10 text-[#ed1c24] px-1.5 py-0.5 rounded-md text-[8px] font-extrabold">{ct.channel}</span>
                        <span>{new Date(ct.date).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-gray-800 leading-relaxed font-semibold">{ct.notes}</p>
                      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest text-right mt-1">
                        Atendido por: {ct.responsible}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-[10px] uppercase font-black tracking-wider text-gray-400">
                    Nenhum contato registrado
                  </p>
                )}
              </div>

              {/* Input box */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b]">Meio de Contato</label>
                    <select 
                      value={contactChannel}
                      onChange={(e) => setContactChannel(e.target.value)}
                      className="w-full bg-[#f4f3f5] rounded-xl text-xs font-semibold py-2.5 px-3 border-none focus:ring-2 focus:ring-[#ed1c24]/20 outline-none"
                    >
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Ligação Telefônica">Ligação Telefônica</option>
                      <option value="Presencial">Presencial (Visita/Reunião)</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b]">Responsável pela Ação</label>
                    <input 
                      type="text"
                      value={contactResponsible}
                      placeholder={currentUser?.username || "Coordenador"}
                      onChange={(e) => setContactResponsible(e.target.value)}
                      className="w-full bg-[#f4f3f5] rounded-xl text-xs font-semibold py-2.5 px-3 border-none focus:ring-2 focus:ring-[#ed1c24]/20 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b]">Notas sobre o Contato</label>
                  <textarea 
                    value={contactNotes}
                    onChange={(e) => setContactNotes(e.target.value)}
                    rows={3}
                    placeholder="Descreva a conversa, justificativa dada pelo responsável, acordos feitos..."
                    className="w-full bg-[#f4f3f5] rounded-xl text-xs font-medium border-0 focus:ring-2 focus:ring-[#ed1c24]/20 p-3 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsContactModalOpen(false);
                  setSelectedPatientForAction(null);
                  setContactNotes('');
                  setContactResponsible('');
                }}
                className="px-5 py-2.5 bg-[#f4f3f5] hover:bg-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  saveContact();
                }}
                className="px-5 py-2.5 bg-[#ed1c24] hover:bg-[#d11920] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5"
              >
                <Check size={14} />
                Postar Contato
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface FiltersProps {
  filters: {
    project: string;
    professional: string;
    modality: string;
    month: string;
    year: string;
  };
  onChange: (key: string, value: string) => void;
  currentUser?: { username: string; email?: string; permission: string } | null;
  projects?: any[];
  professionals?: any[];
  modalities?: any[];
}

export function Filters({ 
  filters, 
  onChange, 
  currentUser,
  projects: initialProjects,
  professionals: initialProfessionals,
  modalities: initialModalities
}: FiltersProps) {
  const [internalProjects, setInternalProjects] = useState<any[]>([]);
  const [internalProfessionals, setInternalProfessionals] = useState<any[]>([]);
  const [internalModalities, setInternalModalities] = useState<any[]>([]);

  const projects = initialProjects || internalProjects;
  const professionals = initialProfessionals || internalProfessionals;
  const modalities = initialModalities || internalModalities;

  useEffect(() => {
    if (initialProjects && initialProfessionals && initialModalities) return;

    const fetchData = async () => {
      try {
        // Fetch projects
        if (!initialProjects) {
          const { data: projs } = await supabase.from('projects').select('*').eq('status', 'Ativo').order('name');
          setInternalProjects(projs || []);
        }

        // Fetch professionals
        if (!initialProfessionals) {
          const { data: profs } = await supabase
            .from('professionals')
            .select(`
              *,
              professional_projects(project_id, projects(name)),
              professional_modalities(modality_id, modalities(name))
            `)
            .eq('status', 'Ativo')
            .order('name');
          
          const mappedProfs = profs?.map((p: any) => ({
            ...p,
            projects: p.professional_projects?.map((pp: any) => {
              const proj = Array.isArray(pp.projects) ? pp.projects[0] : pp.projects;
              return proj?.name;
            }).filter(Boolean) || [],
            modalities: p.professional_modalities?.map((pm: any) => {
              const mod = Array.isArray(pm.modalities) ? pm.modalities[0] : pm.modalities;
              return mod?.name;
            }).filter(Boolean) || []
          }));
          setInternalProfessionals(mappedProfs || []);
        }

        // Fetch modalities
        if (!initialModalities) {
          const { data: mods } = await supabase.from('modalities').select('*').eq('status', 'Ativo').order('name');
          setInternalModalities(mods || []);
        }
      } catch (err) {
        console.error('Erro ao buscar opções de filtro:', err);
      }
    };

    fetchData();
  }, [initialProjects, initialProfessionals, initialModalities]);

  const months = [
    { name: 'Janeiro', value: '1' },
    { name: 'Fevereiro', value: '2' },
    { name: 'Março', value: '3' },
    { name: 'Abril', value: '4' },
    { name: 'Maio', value: '5' },
    { name: 'Junho', value: '6' },
    { name: 'Julho', value: '7' },
    { name: 'Agosto', value: '8' },
    { name: 'Setembro', value: '9' },
    { name: 'Outubro', value: '10' },
    { name: 'Novembro', value: '11' },
    { name: 'Dezembro', value: '12' }
  ];

  const years = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

  const parseDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    // Force local time parsing by using YYYY/MM/DD
    const date = new Date(dateStr.replace(/-/g, '/'));
    return isNaN(date.getTime()) ? null : date;
  };

  const getAvailableYears = () => {
    if (!filters.project || !projects) return ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];
    const project = Array.isArray(projects) ? projects.find(p => p.name === filters.project) : null;
    if (!project) return ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

    const startDate = parseDate(project.start_date);
    const endDate = parseDate(project.end_date);
    
    const startYear = startDate ? startDate.getFullYear() : 2024;
    const endYear = endDate ? endDate.getFullYear() : 2030;
    
    const yrs = [];
    // Safety limit to avoid infinite loops
    const safeEndYear = Math.min(endYear, 2050);
    const safeStartYear = Math.max(startYear, 2000);

    for (let i = safeStartYear; i <= safeEndYear; i++) {
      yrs.push(i.toString());
    }
    return yrs.length > 0 ? yrs : ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];
  };

  const getAvailableMonths = () => {
    if (!filters.project || !filters.year || !projects) return months;
    const project = Array.isArray(projects) ? projects.find(p => p.name === filters.project) : null;
    if (!project) return months;
    
    const startDate = parseDate(project.start_date) || new Date('2024/01/01');
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();

    const endDate = parseDate(project.end_date);
    const endYear = endDate ? endDate.getFullYear() : 2030;
    const endMonth = endDate ? endDate.getMonth() : 11;

    const selectedYear = parseInt(filters.year);
    if (isNaN(selectedYear)) return months;

    return months.filter((m, index) => {
      if (selectedYear < startYear || selectedYear > endYear) return false;
      if (selectedYear === startYear && selectedYear === endYear) return index >= startMonth && index <= endMonth;
      if (selectedYear === startYear) return index >= startMonth;
      if (selectedYear === endYear) return index <= endMonth;
      return true;
    });
  };

  const availableYears = getAvailableYears();
  const availableMonths = getAvailableMonths();

  // Logic to find current professional
  const getCurrentProf = () => {
    if (!currentUser || (currentUser.permission !== 'Profissional' && currentUser.permission !== 'Professional')) return null;
    
    const sanitize = (str: string) => 
      str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";

    const userEmail = sanitize(currentUser.username); // It might be an email or a username

    return professionals.find(p => {
      if (currentUser.email && currentUser.email.startsWith('prof_')) {
        const expectedProfId = currentUser.email.replace('prof_', '').split('@')[0];
        if (p.id === expectedProfId) return true;
      }
      if (p.username && p.username.toLowerCase() === currentUser.username.toLowerCase()) {
        return true;
      }

      const profName = sanitize(p.name);
      const nameParts = p.name.trim().split(/\s+/);
      
      // Try mapping username format: first.last
      let firstLast = "";
      if (nameParts.length >= 2) {
        firstLast = sanitize(`${nameParts[0]}.${nameParts[nameParts.length - 1]}`);
      } else {
        firstLast = sanitize(nameParts[0]);
      }

      // Try exact name match (joaosilva) or first.last match
      return profName === userEmail || firstLast === userEmail || userEmail.startsWith(firstLast);
    });
  };

  const currentProf = getCurrentProf();
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

  // Effect to auto-set professional filter if user is a Professional
  // AND prevent changing it
  useEffect(() => {
    if (isProfessional && currentProf && filters.professional !== currentProf.name) {
      onChange('professional', currentProf.name);
    }
  }, [isProfessional, currentProf, filters.professional, onChange]);

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
            onChange('modality', activeProfModalities[0]);
          }
        }
      }
    }
  }, [filters.professional, professionals, onChange, filters.project, filters.modality, projects, modalities]);

  const handleProfessionalChange = (professionalName: string) => {
    onChange('professional', professionalName);
    
    if (professionalName) {
      const prof = professionals.find(p => p.name === professionalName);
      if (prof) {
        // Clear project if the selected professional is not assigned to it
        if (filters.project && !prof.projects?.includes(filters.project)) {
          onChange('project', '');
        }
        // Clear modality if the selected professional is not assigned to it
        if (filters.modality && !prof.modalities?.includes(filters.modality)) {
          onChange('modality', '');
        }
      }
    } else {
      onChange('modality', '');
    }
  };

  const handleProjectChange = (projectName: string) => {
    onChange('project', projectName);
    
    if (projectName) {
      const project = projects.find(p => p.name === projectName);
      
      // Check if current professional is valid for the new project
      if (filters.professional) {
        const prof = professionals.find(p => p.name === filters.professional);
        if (prof && !prof.projects?.includes(projectName)) {
          onChange('professional', '');
          onChange('modality', '');
        }
      }

      // Validate Year and Month for the new project
      if (project) {
        const startDate = parseDate(project.start_date);
        const endDate = parseDate(project.end_date);
        const startYear = startDate ? startDate.getFullYear() : 2024;
        const endYear = endDate ? endDate.getFullYear() : 2030;

        let newYear = filters.year;
        if (filters.year) {
          const y = parseInt(filters.year);
          if (y < startYear || y > endYear) {
            newYear = startYear.toString();
            onChange('year', newYear);
          }
        } else {
          newYear = startYear.toString();
          onChange('year', newYear);
        }

        // After year is set (or kept), validate month
        if (newYear) {
          const y = parseInt(newYear);
          const startMonth = (y === startYear && startDate) ? startDate.getMonth() : 0;
          const endMonth = (y === endYear && endDate) ? endDate.getMonth() : 11;
          
          if (filters.month) {
            const m = parseInt(filters.month) - 1;
            if (m < startMonth || m > endMonth) {
              onChange('month', (startMonth + 1).toString());
            }
          } else {
            onChange('month', (startMonth + 1).toString());
          }
        }
      }
    } else {
      onChange('professional', '');
      onChange('modality', '');
      onChange('month', '');
      onChange('year', '');
    }
  };

  const handleYearChange = (year: string) => {
    onChange('year', year);
    
    if (year && filters.project && projects) {
      const project = Array.isArray(projects) ? projects.find(p => p.name === filters.project) : null;
      if (project) {
        const startDate = parseDate(project.start_date);
        const endDate = parseDate(project.end_date);
        const startYear = startDate ? startDate.getFullYear() : 2024;
        const endYear = endDate ? endDate.getFullYear() : 2030;

        const y = parseInt(year);
        if (!isNaN(y)) {
          const startMonth = (y === startYear && startDate) ? startDate.getMonth() : 0;
          const endMonth = (y === endYear && endDate) ? endDate.getMonth() : 11;
          
          if (filters.month) {
            const m = parseInt(filters.month) - 1;
            if (!isNaN(m)) {
              if (m < startMonth) {
                onChange('month', (startMonth + 1).toString());
              } else if (m > endMonth) {
                onChange('month', (endMonth + 1).toString());
              }
            }
          } else {
            onChange('month', (startMonth + 1).toString());
          }
        }
      }
    }
  };

  return (
    <div className="bg-[#f4f3f5] rounded-[2rem] p-5 sm:p-6 flex flex-col lg:flex-row flex-wrap items-stretch lg:items-end gap-5 sm:gap-6 shadow-sm border border-[#e8bcb7]/10">
      <div className="flex-1 min-w-full lg:min-w-[200px] space-y-1.5 sm:space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1.5 opacity-60">Projeto</label>
        <select 
          value={filters.project}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="w-full bg-white border-0 rounded-xl text-sm sm:text-sm h-12 lg:h-11 px-4 shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer"
        >
          <option value="">Selecione o Projeto</option>
          {restrictedProjects
            .filter(p => p.status === 'Ativo')
            .map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
        </select>
      </div>

      <div className="flex-1 min-w-full lg:min-w-[200px] space-y-1.5 sm:space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1.5 opacity-60">Profissional</label>
        <select 
          value={filters.professional}
          onChange={(e) => handleProfessionalChange(e.target.value)}
          disabled={isProfessional}
          className={cn(
            "w-full bg-white border-0 rounded-xl text-sm sm:text-sm h-12 lg:h-11 px-4 shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            isProfessional && "bg-gray-50 border border-gray-100"
          )}
        >
          {!isProfessional && <option value="">Selecione o Profissional</option>}
          {professionals
            .filter(p => {
              if (isProfessional && currentProf) return p.id === currentProf.id;
              if (isProfessional && !currentProf) {
                // If we can't find the exact match but user is professional,
                // we should at least restrict based on what they already have selected if they can't change it
                return p.name === filters.professional;
              }
              if (!filters.project) return true;
              return p.projects?.includes(filters.project);
            })
            .map(p => (
              <option key={p.id} value={p.name}>{p.name} ({p.specialty})</option>
            ))}
        </select>
      </div>

      <div className="flex-1 min-w-full lg:min-w-[180px] space-y-1.5 sm:space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1.5 opacity-60">Modalidade</label>
        <select 
          value={filters.modality}
          onChange={(e) => onChange('modality', e.target.value)}
          disabled={!filters.professional}
          className="w-full bg-white border-0 rounded-xl text-sm sm:text-sm h-12 lg:h-11 px-4 shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

      <div className="flex-1 min-w-[46%] lg:min-w-[100px] space-y-1.5 sm:space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1.5 opacity-60">Ano</label>
        <select 
          value={filters.year}
          onChange={(e) => handleYearChange(e.target.value)}
          disabled={!filters.project}
          className="w-full bg-white border-0 rounded-xl text-sm sm:text-sm h-12 lg:h-11 px-4 shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Selecione o Ano</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[46%] lg:min-w-[120px] space-y-1.5 sm:space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1.5 opacity-60">Mês</label>
        <select 
          value={filters.month}
          onChange={(e) => onChange('month', e.target.value)}
          disabled={!filters.project || !filters.year}
          className="w-full bg-white border-0 rounded-xl text-sm sm:text-sm h-12 lg:h-11 px-4 shadow-sm focus:ring-2 focus:ring-[#ed1c24] outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Selecione o Mês</option>
          {availableMonths.map(m => (
            <option key={m.value} value={m.value}>{m.name}</option>
          ))}
        </select>
      </div>

    </div>
  );
}

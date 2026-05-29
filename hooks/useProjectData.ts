'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Project {
  id: string;
  name: string;
  coordinator: string;
  start_date: string;
  end_date: string;
  status: 'Ativo' | 'Inativo';
  object?: string;
  observations?: string;
  unit_id: string | null;
  units?: { name: string };
  created_at: string;
}

export interface Goal {
  id: string;
  project_id: string;
  modality_id: string;
  type: 'monthly' | 'total';
  target_value: number;
  start_date: string;
  end_date?: string;
}

export interface Extension {
  id: string;
  project_id: string;
  previous_end_date: string;
  new_end_date: string;
  reason: string;
  created_by: string;
  created_at: string;
}

export function useProjectData(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [modalities, setModalities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*, units(name)')
        .eq('id', projectId)
        .single();
      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('project_goals')
        .select('*')
        .eq('project_id', projectId);
      if (goalsError) throw goalsError;
      setGoals(goalsData || []);

      // Fetch extensions
      const { data: extensionsData, error: extensionsError } = await supabase
        .from('project_extensions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (extensionsError) throw extensionsError;
      setExtensions(extensionsData || []);

      // Fetch linked professionals
      const { data: profsData, error: profsError } = await supabase
        .from('professional_projects')
        .select('professional_id, professionals(*)')
        .eq('project_id', projectId);
      if (profsError) throw profsError;
      
      const basicProfs = profsData?.map((p: any) => p.professionals).filter(Boolean) || [];

      // Fetch system users usernames to assess if professional has system login
      const { data: usersData } = await supabase
        .from('system_users')
        .select('username');
      const existingUsernames = new Set((usersData || []).map((u: any) => u.username.toLowerCase()));

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

      if (basicProfs.length > 0) {
        const profIds = basicProfs.map((p: any) => p.id);
        const { data: pmData, error: pmError } = await supabase
          .from('professional_modalities')
          .select('professional_id, modality_id')
          .in('professional_id', profIds);

        if (!pmError && pmData) {
          const profsWithMods = basicProfs.map((p: any) => {
            const username = getProfessionalUsername(p.name);
            const hasUser = existingUsernames.has(username);
            return {
              ...p,
              username: hasUser ? username : null,
              modality_ids: pmData
                .filter((pm: any) => pm.professional_id === p.id)
                .map((pm: any) => pm.modality_id)
            };
          });
          setProfessionals(profsWithMods);
        } else {
          const profsWithMods = basicProfs.map((p: any) => {
            const username = getProfessionalUsername(p.name);
            const hasUser = existingUsernames.has(username);
            return {
              ...p,
              username: hasUser ? username : null,
              modality_ids: []
            };
          });
          setProfessionals(profsWithMods);
        }
      } else {
        setProfessionals([]);
      }

      // Fetch linked modalities (this is indirect through professionals or we might need a direct link)
      // For now, let's assume modalities are linked to professionals who are linked to the project
      // Or we can fetch all modalities and filter if there's a direct link table (which there isn't in schema)
      // Actually, let's just fetch all active modalities for now as a fallback
      const { data: modsData, error: modsError } = await supabase
        .from('modalities')
        .select('*')
        .eq('status', 'Ativo');
      if (modsError) throw modsError;
      setModalities(modsData || []);

    } catch (err: any) {
      console.error('Error fetching project data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();

    // Realtime subscription
    const projectSub = supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_goals', filter: `project_id=eq.${projectId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_extensions', filter: `project_id=eq.${projectId}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(projectSub);
    };
  }, [projectId, fetchData]);

  return { project, goals, extensions, professionals, modalities, isLoading, error, refresh: fetchData };
}

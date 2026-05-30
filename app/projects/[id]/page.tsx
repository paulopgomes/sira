'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  AlertCircle, 
  X, 
  Info, 
  FolderKanban, 
  Edit2, 
  Search, 
  FileText,
  Building2
} from 'lucide-react';
import { useProjectData } from '@/hooks/useProjectData';
import { useProjectMetrics } from '@/hooks/useProjectMetrics';
import { ProjectHeader } from '@/components/project-management/ProjectHeader';
import { ProjectKPICards } from '@/components/project-management/ProjectKPICards';
import { ProjectChart } from '@/components/project-management/ProjectChart';
import { ProjectGoals } from '@/components/project-management/ProjectGoals';
import { ProjectExtensions } from '@/components/project-management/ProjectExtensions';
import { ProjectAlerts } from '@/components/project-management/ProjectAlerts';
import { ProjectInfo } from '@/components/project-management/ProjectInfo';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { Sidebar } from '@/components/Sidebar';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectManagementPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { project, goals, extensions, professionals, modalities, isLoading, error, refresh } = useProjectData(id);
  const { metrics, isLoading: isMetricsLoading } = useProjectMetrics(project, goals);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingExtension, setIsAddingExtension] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; permission: string } | null>(null);
  const isAdmin = currentUser?.permission === 'Administrador';
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchUnits = async () => {
      const { data } = await supabase.from('units').select('id, name').eq('status', 'Ativo').order('name');
      setUnits(data || []);
    };
    fetchUnits();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    coordinator: '',
    start_date: '',
    end_date: '',
    status: 'Ativo' as 'Ativo' | 'Inativo',
    observations: '',
    unit_id: ''
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('sira_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        router.push('/');
      }
    } else {
      router.push('/');
    }
    setIsAuthReady(true);
  }, [router]);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        coordinator: project.coordinator || '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        status: project.status as 'Ativo' | 'Inativo',
        observations: project.observations || '',
        unit_id: project.unit_id || ''
      });
    }
  }, [project]);

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Acesso negado: Apenas administradores podem alterar projetos.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update(formData)
        .eq('id', id);
      if (error) throw error;
      refresh();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Error updating project:', err);
      alert('Erro ao atualizar projeto.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthReady || isLoading) {
    return (
      <div className="flex min-h-screen bg-[#faf9fb] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-[#ed1c24] animate-spin" />
          <p className="text-sm font-bold text-[#5e3f3b] uppercase tracking-widest opacity-60">Carregando Gestão do Projeto...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen bg-[#faf9fb] items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-[#ed1c24]/10 max-w-md text-center space-y-6">
          <div className="w-16 h-16 bg-[#ed1c24]/5 text-[#ed1c24] rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-black text-[#1a1c1d]">Projeto não encontrado</h1>
          <p className="text-sm text-[#5e3f3b] font-medium">
            Não foi possível carregar os dados deste projeto. Ele pode ter sido removido ou o link está incorreto.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-[#ed1c24] text-white font-bold rounded-xl shadow-lg hover:bg-[#d11920] transition-all"
          >
            Voltar para o Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#faf9fb]">
      <Sidebar 
        currentView="projetos" 
        onViewChange={(view) => router.push(`/?view=${view}`)} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      
      <main className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        "lg:ml-20",
        !isSidebarCollapsed && "lg:ml-64",
        "ml-0"
      )}>
        <Header 
          user={{
            name: currentUser?.username || '',
            role: currentUser?.permission || ''
          }}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onLogout={() => {
            localStorage.removeItem('sira_user');
            router.push('/');
          }}
        />
        
        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
          {/* Breadcrumb / Back */}
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[#5e3f3b] hover:text-[#ed1c24] transition-all group"
          >
            <div className="p-2 bg-white rounded-xl shadow-sm border border-[#e8bcb7]/10 group-hover:bg-[#ed1c24] group-hover:text-white transition-all">
              <ChevronLeft size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Voltar para Projetos</span>
          </button>

          {/* Alerts Section */}
          {metrics && <ProjectAlerts metrics={metrics} />}

          {/* Header Section */}
          <ProjectHeader 
            project={project} 
            status={metrics?.status || 'Ativo'} 
            isAdmin={isAdmin}
            onEdit={() => setIsEditModalOpen(true)}
            onExtend={() => {
              if (!isAdmin) {
                alert('Acesso negado: Apenas administradores podem prorrogar prazos.');
                return;
              }
              setIsAddingExtension(true);
              // Scroll to extensions section
              const element = document.getElementById('project-extensions');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          />

          {/* KPI Cards */}
          {metrics && <ProjectKPICards metrics={metrics} />}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2 space-y-6 sm:space-y-8 min-w-0">
              {/* Chart */}
              {metrics && <ProjectChart data={metrics.monthlyEvolution} />}
              
              {/* Goals */}
              <ProjectGoals 
                projectId={project.id} 
                goals={goals} 
                modalities={modalities}
                onUpdate={refresh} 
                projectStartDate={project.start_date}
                projectEndDate={project.end_date}
                isAdmin={isAdmin}
                professionals={professionals}
              />
            </div>

            <div className="space-y-6 sm:space-y-8">
              {/* Project Info Accordion */}
              <ProjectInfo 
                project={project} 
                professionals={professionals} 
                modalities={modalities.filter(mod => goals.some(goal => goal.modality_id === mod.id))} 
              />

              {/* Extensions History */}
              <div id="project-extensions">
                <ProjectExtensions 
                  projectId={project.id} 
                  extensions={extensions} 
                  onUpdate={refresh}
                  currentEndDate={project.end_date}
                  isAdding={isAddingExtension}
                  setIsAdding={setIsAddingExtension}
                  currentUserName={currentUser?.username || 'Sistema'}
                  isAdmin={isAdmin}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsEditModalOpen(false)}
            className="absolute inset-0 bg-[#1a1c1d]/60 backdrop-blur-md transition-all"
          />
          <div 
            className="relative w-[95%] max-w-2xl max-h-[90vh] bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-6 sm:p-8 border-b border-[#f4f3f5] bg-[#faf9fb] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24]">
                  <FolderKanban size={24} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1a1c1d] tracking-tight">Editar Projeto</h2>
                  <p className="text-[10px] font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest mt-1">Atualize as informações estratégicas</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2.5 text-[#5e3f3b] hover:bg-[#f4f3f5] rounded-full transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 scrollbar-thin">
              <form id="edit-project-form" onSubmit={handleUpdateProject} className="space-y-8">
                {/* Seção: Identificação */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5]">
                    <Info size={14} className="text-[#ed1c24]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Identificação Básica</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                        <FolderKanban size={12} className="opacity-50" />
                        Nome do Projeto
                      </label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: Apoio à Inclusão"
                        className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white focus:border-[#ed1c24]/20 outline-none transition-all shadow-sm"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                        <Building2 size={12} className="opacity-50" />
                        Unidade
                      </label>
                      <select 
                        className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white focus:border-[#ed1c24]/20 outline-none appearance-none cursor-pointer transition-all shadow-sm"
                        value={formData.unit_id}
                        onChange={(e) => setFormData({...formData, unit_id: e.target.value})}
                      >
                        <option value="">Selecione uma unidade</option>
                        {units.map(unit => (
                          <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                        <Edit2 size={12} className="opacity-50" />
                        Coordenador
                      </label>
                      <input 
                        type="text" 
                        placeholder="Nome do Coordenador"
                        className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white focus:border-[#ed1c24]/20 outline-none transition-all shadow-sm"
                        value={formData.coordinator}
                        onChange={(e) => setFormData({...formData, coordinator: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção: Vigência e Status */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5]">
                    <AlertCircle size={14} className="text-[#ed1c24]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Vigência e Status</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                        <Search size={12} className="opacity-50" />
                        Início
                      </label>
                      <input 
                        type="date" 
                        className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white focus:border-[#ed1c24]/20 outline-none transition-all shadow-sm"
                        value={formData.start_date}
                        onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                        <Search size={12} className="opacity-50" />
                        Término
                      </label>
                      <input 
                        type="date" 
                        min={formData.start_date}
                        className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white focus:border-[#ed1c24]/20 outline-none transition-all shadow-sm"
                        value={formData.end_date}
                        onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                        <AlertCircle size={12} className="opacity-50" />
                        Status
                      </label>
                      <select 
                        className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-3.5 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white focus:border-[#ed1c24]/20 outline-none appearance-none cursor-pointer transition-all shadow-sm"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as 'Ativo' | 'Inativo'})}
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Seção: Detalhamento */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5]">
                    <FileText size={14} className="text-[#ed1c24]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Detalhamento Estratégico</span>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1">
                        <Info size={12} className="opacity-50" />
                        Observações Adicionais
                      </label>
                      <textarea 
                        placeholder="Notas internas..."
                        className="w-full bg-[#f4f3f5] border border-transparent rounded-2xl py-4 px-4 text-sm font-medium focus:ring-2 focus:ring-[#ed1c24] focus:bg-white focus:border-[#ed1c24]/20 outline-none transition-all shadow-sm min-h-[80px] resize-none"
                        value={formData.observations}
                        onChange={(e) => setFormData({...formData, observations: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-6 sm:p-8 bg-[#faf9fb] border-t border-[#f4f3f5] shrink-0">
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 bg-white border border-[#e8bcb7]/20 text-[#5e3f3b] font-black py-4 rounded-2xl text-sm hover:bg-[#f4f3f5] transition-all order-2 sm:order-1 active:scale-95 shadow-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  form="edit-project-form"
                  disabled={isSaving}
                  className="flex-[2] bg-[#ed1c24] text-white font-black py-4 rounded-2xl text-sm shadow-[0_12px_24px_rgba(237,28,36,0.25)] hover:bg-[#d11920] transition-all disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav currentView="projetos" onViewChange={(view) => router.push(`/?view=${view}`)} />
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  FileText, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  X,
  Printer,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlyReportProps {
  currentUser: any;
  filters: {
    project: string;
    professional: string;
    modality: string;
    month: string;
    year: string;
  };
  unitLogoUrl?: string | null;
  professionals?: any[];
  isArchived?: boolean;
}

export function MonthlyReport({ currentUser, filters, unitLogoUrl, professionals = [], isArchived = false }: MonthlyReportProps) {
  const isFiltersComplete = !!(filters.project && filters.professional && filters.modality && filters.month && filters.year);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [reportData, setReportData] = useState({
    activities: '',
    results: ''
  });

  const [images, setImages] = useState<{ id: string; url: string; file: File | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch existing report when filters change
  useEffect(() => {
    const fetchReport = async () => {
      // Find the correct professional associated with current user if they are a Professional
      let enforcedProfessionalName = filters.professional;
      
      const isProfessional = currentUser?.permission === 'Profissional' || currentUser?.permission === 'Professional';
      
      if (isProfessional) {
        const sanitize = (str: string) => 
          str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
        
        const userEmail = sanitize(currentUser.username);
        
        const currentProfMatch = professionals.find(p => {
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

        if (currentProfMatch) {
          enforcedProfessionalName = currentProfMatch.name;
        }
      }

      if (!filters.project || !enforcedProfessionalName || !filters.modality) {
        setReportData({ activities: '', results: '' });
        setImages([]);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      try {
        const { data, error } = await supabase
          .from('monthly_reports')
          .select('*')
          .match({
            project_name: filters.project,
            professional_name: enforcedProfessionalName,
            modality_name: filters.modality,
            month: filters.month,
            year: filters.year
          })
          .maybeSingle();

        if (data) {
          setReportData({
            activities: data.activities || '',
            results: data.results || ''
          });
          setImages(data.images?.map((url: string) => ({
            id: Math.random().toString(36).substr(2, 9),
            url,
            file: null
          })) || []);
        } else {
          setReportData({ activities: '', results: '' });
          setImages([]);
        }
      } catch (err: any) {
        console.error('Erro ao buscar relatório:', err);
        // We don't set error message here because it might just be that the report doesn't exist yet
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [filters]);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      file
    }));

    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      // Revoke URL to avoid memory leaks
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return filtered;
    });
  };

  const handleSave = async () => {
    if (!filters.project || !filters.professional || !filters.modality) {
      setErrorMessage('Por favor, selecione Projeto, Profissional e Modalidade nos filtros acima.');
      return;
    }

    // Security Check: If user is Professional, ensure they are only saving for themselves
    if (currentUser?.permission === 'Profissional') {
      const sanitize = (str: string) => 
        str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
      
      const userEmail = sanitize(currentUser.username);
      
      const currentProfRecord = professionals.find(p => {
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

      if (!currentProfRecord || filters.professional !== currentProfRecord.name) {
        setErrorMessage('Acesso negado: Você só pode elaborar relatórios em seu próprio nome.');
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      // 1. Upload new images to Supabase Storage
      const imageUrls = [];
      for (const img of images) {
        if (img.file) {
          const fileExt = img.file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `reports/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(filePath, img.file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('reports')
            .getPublicUrl(filePath);
          
          imageUrls.push(publicUrl);
        } else {
          // Existing image URL
          imageUrls.push(img.url);
        }
      }

      // 2. Prepare report payload
      const reportPayload = {
        project_name: filters.project,
        professional_name: filters.professional,
        modality_name: filters.modality,
        month: filters.month,
        year: filters.year,
        activities: reportData.activities,
        results: reportData.results,
        images: imageUrls,
        created_by: currentUser?.id
      };

      // 3. Check if report exists to update or insert
      const { data: existing } = await supabase
        .from('monthly_reports')
        .select('id')
        .match({
          project_name: filters.project,
          professional_name: filters.professional,
          modality_name: filters.modality,
          month: filters.month,
          year: filters.year
        })
        .maybeSingle();

      let error;
      if (existing) {
        const { error: updateError } = await supabase
          .from('monthly_reports')
          .update(reportPayload)
          .eq('id', existing.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('monthly_reports')
          .insert([reportPayload]);
        error = insertError;
      }

      if (error) throw error;
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar relatório:', err);
      setErrorMessage(`Erro ao salvar: ${err.message || 'Tente novamente.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-20">
      {errorMessage && (
        <div className="bg-[#ed1c24]/5 border border-[#ed1c24]/20 text-[#ed1c24] px-6 py-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{errorMessage}</p>
          <button onClick={() => setErrorMessage('')} className="ml-auto p-1 hover:bg-[#ed1c24]/10 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Report Content Section */}
      <div 
        ref={reportRef}
        className="bg-white rounded-[2rem] shadow-sm border border-[#e8bcb7]/10 overflow-hidden print:shadow-none print:border-none"
      >
        {!isFiltersComplete ? (
          <div className="p-10 sm:p-20 flex flex-col items-center justify-center text-center no-print min-h-[350px]">
            <div className="max-w-md bg-[#faf9fb] p-8 sm:p-10 rounded-[2rem] border border-[#e8bcb7]/15 flex flex-col items-center gap-5 shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="w-16 h-16 rounded-full bg-[#ed1c24]/5 flex items-center justify-center shrink-0">
                <FileText className="text-[#ed1c24]" size={28} />
              </div>
              <div className="space-y-3">
                <h3 className="text-sm sm:text-base font-black text-[#1a1c1d] uppercase tracking-wider">Aguardando Filtros de Pesquisa</h3>
                <p className="text-xs text-[#5e3f3b] font-medium leading-relaxed">
                  Para preencher ou visualizar as informações do Relatório Mensal, selecione todos os filtros necessários na barra superior (Projeto, Profissional, Modalidade, Mês e Ano).
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 sm:p-10 space-y-8 relative">
              {isLoading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center no-print">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="text-[#ed1c24] animate-spin" />
                    <p className="text-xs font-bold text-[#5e3f3b] uppercase tracking-widest">Carregando Relatório...</p>
                  </div>
                </div>
              )}

          {/* Report Header (Visible only in print/PDF) */}
          <div className="hidden print:block space-y-3 border-b-2 border-[#ed1c24]/10 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-6">
                {unitLogoUrl ? (
                  <div className="w-20 h-20 flex items-center justify-center p-2 bg-white rounded-2xl shadow-sm border border-[#e8bcb7]/10 overflow-hidden">
                    <img src={unitLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-20 h-20 flex items-center justify-center p-2 bg-[#f4f3f5] rounded-2xl border border-[#e8bcb7]/10">
                    <Building2 size={32} className="text-[#ed1c24] opacity-20" />
                  </div>
                )}
                <div className="text-left">
                  <h1 className="text-xl font-black text-[#ed1c24] uppercase tracking-tight">Relatório Mensal</h1>
                  <p className="text-[10px] font-bold text-[#5e3f3b] opacity-60 uppercase tracking-widest mt-0.5">SIRA - Sistema Integrado de Registro de Atendimentos</p>
                </div>
              </div>
              <div className="text-right text-[9px] text-[#5e3f3b] font-medium mt-1">
                <p>Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>

          <div className="hidden print:grid grid-cols-2 gap-3 bg-[#f4f3f5] p-4 rounded-2xl border border-[#e8bcb7]/20 mb-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Projeto</p>
              <p className="text-sm font-bold text-[#1a1c1d]">{filters.project || '---'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Profissional</p>
              <p className="text-sm font-bold text-[#1a1c1d]">
                {filters.professional || '---'}
                {(() => {
                  const prof = professionals.find(p => p.name === filters.professional);
                  return prof?.registration ? ` (${prof.registration})` : '';
                })()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Modalidade</p>
              <p className="text-sm font-bold text-[#1a1c1d]">{filters.modality || '---'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] opacity-60">Período</p>
              <p className="text-sm font-bold text-[#1a1c1d]">{months.find(m => m.value === filters.month)?.name} / {filters.year}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1 flex items-center gap-2">
                <FileText size={14} className="text-[#ed1c24]" />
                Atividades Desenvolvidas
              </label>
              <textarea 
                placeholder="Descreva as atividades realizadas durante o mês..."
                className="w-full bg-[#f4f3f5] border-0 rounded-[1.5rem] p-5 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none min-h-[150px] resize-none transition-all print:hidden disabled:opacity-70 disabled:cursor-not-allowed"
                value={reportData.activities}
                disabled={isArchived || !isFiltersComplete}
                onChange={(e) => setReportData({...reportData, activities: e.target.value})}
              />
              <div className="hidden print:block bg-[#f4f3f5] rounded-[1rem] p-3 text-[13px] leading-relaxed whitespace-pre-wrap min-h-[60px]">
                {reportData.activities || 'Nenhuma atividade registrada.'}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[#ed1c24]" />
                Resultados Alcançados
              </label>
              <textarea 
                placeholder="Destaque os principais resultados e avanços obtidos..."
                className="w-full bg-[#f4f3f5] border-0 rounded-[1.5rem] p-5 text-sm focus:ring-2 focus:ring-[#ed1c24] outline-none min-h-[120px] resize-none transition-all print:hidden disabled:opacity-70 disabled:cursor-not-allowed"
                value={reportData.results}
                disabled={isArchived || !isFiltersComplete}
                onChange={(e) => setReportData({...reportData, results: e.target.value})}
              />
              <div className="hidden print:block bg-[#f4f3f5] rounded-[1rem] p-3 text-[13px] leading-relaxed whitespace-pre-wrap min-h-[50px]">
                {reportData.results || 'Nenhum resultado registrado.'}
              </div>
            </div>
          </div>

          {/* Image Upload Section */}
          <div className="space-y-4 pt-4 no-print">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5e3f3b] ml-1 flex items-center gap-2">
                <ImageIcon size={14} className="text-[#ed1c24]" />
                Anexos Fotográficos
              </label>
              <span className="text-[10px] font-bold text-[#5e3f3b] opacity-60">
                {images.length} imagem(ns) selecionada(s)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-2xl overflow-hidden group border border-[#f4f3f5]">
                  <img src={img.url} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {!isArchived && isFiltersComplete && (
                      <button 
                        onClick={() => removeImage(img.id)}
                        className="p-2 bg-white text-[#ed1c24] rounded-full hover:bg-[#ed1c24]/5 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => !isArchived && isFiltersComplete && fileInputRef.current?.click()}
                disabled={isArchived || !isFiltersComplete}
                className={cn(
                  "aspect-square rounded-2xl border-2 border-dashed border-[#e8bcb7] flex flex-col items-center justify-center gap-2 text-[#5e3f3b] hover:bg-[#f4f3f5] hover:border-[#ed1c24] transition-all group",
                  (isArchived || !isFiltersComplete) && "opacity-50 cursor-not-allowed grayscale"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-[#f4f3f5] flex items-center justify-center group-hover:bg-white transition-colors">
                  <Plus size={20} className="text-[#ed1c24]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Adicionar Foto</span>
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              multiple
              className="hidden"
            />
          </div>

          {/* Print View Images */}
          {images.length > 0 && (
            <div className="hidden print:block space-y-4 pt-4 break-inside-avoid">
              <div className="flex items-center gap-2 pb-2 border-b border-[#f4f3f5]">
                <ImageIcon size={14} className="text-[#ed1c24]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1c1d]">Anexos Fotográficos</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {images.map((img) => (
                  <div key={img.id} className="break-inside-avoid rounded-xl overflow-hidden border border-[#e8bcb7]/10 shadow-sm bg-white p-1">
                    <img src={img.url} alt="Anexo" className="w-full h-36 object-cover rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="hidden print:flex flex-col items-center mt-12 pt-8 border-t border-[#e8bcb7]/20 break-inside-avoid">
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

        {/* Action Buttons */}
        <div className="p-6 sm:p-10 bg-[#f4f3f5]/30 border-t border-[#f4f3f5] flex flex-col sm:flex-row justify-end gap-4 no-print">
          <button 
            onClick={handlePrint}
            disabled={!isFiltersComplete}
            className={cn(
              "flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#1a1c1d] font-bold rounded-xl text-sm border border-[#e8bcb7]/20 hover:bg-[#f4f3f5] transition-all active:scale-95",
              !isFiltersComplete && "opacity-50 cursor-not-allowed grayscale"
            )}
          >
            <Printer size={18} />
            Imprimir Relatório
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || showSuccess || isArchived || !isFiltersComplete}
            className={cn(
              "flex items-center justify-center gap-2 px-10 py-4 font-bold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]",
              showSuccess 
                ? "bg-green-600 text-white shadow-[0_8px_20px_rgba(22,163,74,0.25)]" 
                : "bg-[#ed1c24] text-white shadow-[0_8px_20px_rgba(237,28,36,0.25)] hover:bg-[#d11920]"
            )}
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : showSuccess ? (
              <CheckCircle2 size={18} />
            ) : (
              <Save size={18} />
            )}
            <span>{isSaving ? 'Salvando...' : showSuccess ? 'Relatório Salvo!' : 'Salvar Relatório'}</span>
          </button>
        </div>
          </>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-[#f4f3f5] rounded-2xl p-6 flex items-start gap-4 border border-[#e8bcb7]/10 no-print">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
          <AlertCircle size={20} className="text-[#ed1c24]" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-[#1a1c1d]">Dica de Elaboração</h4>
          <p className="text-xs text-[#5e3f3b] leading-relaxed opacity-70">
            Para um relatório mais completo, utilize fotos que demonstrem a execução das atividades e os materiais utilizados, dando preferência a imagens no formato horizontal, pois se adaptam melhor ao layout do relatório.
          </p>
        </div>
      </div>
    </div>
  );
}

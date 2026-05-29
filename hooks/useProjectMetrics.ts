'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Project, Goal } from './useProjectData';
import { parseLocalDate, getBusinessDaysBetween } from '@/lib/utils';

export interface ProjectMetrics {
  totalTarget: number;
  totalRealized: number;
  executionPercentage: number;
  monthlyAverage: number;
  daysRemaining: number;
  expectedUntilToday: number;
  monthlyEvolution: { month: string; year: string; target: number; realized: number }[];
  status: 'Ativo' | 'Próximo do vencimento' | 'Encerrado';
}

export function useProjectMetrics(project: Project | null, goals: Goal[]) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAttendance() {
      if (!project) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('project_id', project.id);
        if (error) throw error;
        setAttendance(data || []);
      } catch (err) {
        console.error('Error fetching attendance for metrics:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAttendance();

    // Realtime subscription for attendance
    if (project) {
      const attendanceSub = supabase
        .channel(`attendance-${project.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'attendance', 
          filter: `project_id=eq.${project.id}` 
        }, fetchAttendance)
        .subscribe();

      return () => {
        supabase.removeChannel(attendanceSub);
      };
    }
  }, [project]);

  const metrics = useMemo(() => {
    if (!project) return null;

    const today = new Date();
    const startDate = parseLocalDate(project.start_date);
    const endDate = parseLocalDate(project.end_date);
    
    // Days remaining
    const diffTime = endDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Status
    let status: ProjectMetrics['status'] = 'Ativo';
    if (daysRemaining < 0) status = 'Encerrado';
    else if (daysRemaining <= 30) status = 'Próximo do vencimento';

    // Total Realized
    const totalRealized = attendance.length;

    // Goals calculation
    let totalTarget = 0;
    let expectedUntilToday = 0;

    goals.forEach(goal => {
      const goalStart = parseLocalDate(goal.start_date);
      const goalEnd = goal.end_date ? parseLocalDate(goal.end_date) : endDate;

      if (goal.type === 'total') {
        totalTarget += goal.target_value;
        // Linear expectation based on business days for total goal
        const totalBusDays = getBusinessDaysBetween(goalStart, goalEnd);
        const elapsedBusDays = getBusinessDaysBetween(goalStart, today);
        if (elapsedBusDays > 0) {
          const ratio = Math.min(1, elapsedBusDays / Math.max(1, totalBusDays));
          expectedUntilToday += goal.target_value * ratio;
        }
      } else if (goal.type === 'monthly') {
        // Monthly goals are target_value per month
        const monthsTotal = (goalEnd.getFullYear() - goalStart.getFullYear()) * 12 + (goalEnd.getMonth() - goalStart.getMonth()) + 1;
        totalTarget += goal.target_value * monthsTotal;

        const fullMonthsElapsed = (today.getFullYear() - goalStart.getFullYear()) * 12 + (today.getMonth() - goalStart.getMonth());
        
        if (fullMonthsElapsed >= 0) {
          // Add full months
          expectedUntilToday += goal.target_value * Math.min(monthsTotal, fullMonthsElapsed);
          
          // Add current month proportional if within range
          if (fullMonthsElapsed < monthsTotal) {
            const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            const targetMonthStart = currentMonthStart > goalStart ? currentMonthStart : goalStart;
            const targetMonthEnd = currentMonthEnd < goalEnd ? currentMonthEnd : goalEnd;
            
            if (today >= targetMonthStart && today <= targetMonthEnd) {
                const totalBusInMonth = getBusinessDaysBetween(targetMonthStart, targetMonthEnd);
                const elapsedBusInMonth = getBusinessDaysBetween(targetMonthStart, today);
                expectedUntilToday += goal.target_value * (elapsedBusInMonth / Math.max(1, totalBusInMonth));
            }
          }
        }
      }
    });

    const executionPercentage = totalTarget > 0 ? (totalRealized / totalTarget) * 100 : 0;

    // Monthly Average
    const monthsElapsed = Math.max(1, (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth()) + 1);
    const monthlyAverage = totalRealized / monthsElapsed;

    // Monthly Evolution (last 12 months or project duration)
    const monthlyEvolution: ProjectMetrics['monthlyEvolution'] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short' });
      const month = d.getMonth() + 1;
      const year = d.getFullYear();

      const realizedInMonth = attendance.filter((a: any) => 
        Number(a.month) === month && Number(a.year) === year
      ).length;
      
      // Target in month
      let targetInMonth = 0;
      goals.forEach(goal => {
        const goalStart = parseLocalDate(goal.start_date);
        const goalEnd = goal.end_date ? parseLocalDate(goal.end_date) : endDate;
        
        // Normalize to first of the month for comparison
        const goalStartMonth = new Date(goalStart.getFullYear(), goalStart.getMonth(), 1);
        const goalEndMonth = new Date(goalEnd.getFullYear(), goalEnd.getMonth(), 1);
        const currentIterMonth = new Date(d.getFullYear(), d.getMonth(), 1);

        if (goal.type === 'monthly') {
          if (currentIterMonth >= goalStartMonth && currentIterMonth <= goalEndMonth) {
            targetInMonth += goal.target_value;
          }
        } else if (goal.type === 'total') {
          if (currentIterMonth >= goalStartMonth && currentIterMonth <= goalEndMonth) {
            const monthsTotal = (goalEnd.getFullYear() - goalStart.getFullYear()) * 12 + (goalEnd.getMonth() - goalStart.getMonth()) + 1;
            targetInMonth += goal.target_value / Math.max(1, monthsTotal);
          }
        }
      });

      monthlyEvolution.push({ 
        month: monthLabel, 
        year: year.toString(),
        target: Math.round(targetInMonth), 
        realized: realizedInMonth 
      });
    }

    return {
      totalTarget,
      totalRealized,
      executionPercentage,
      monthlyAverage,
      daysRemaining: Math.max(0, daysRemaining),
      expectedUntilToday: Math.round(expectedUntilToday),
      monthlyEvolution,
      status
    };
  }, [project, goals, attendance]);

  return { metrics, isLoading };
}

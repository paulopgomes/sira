'use client';

import React, { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Bar,
  ComposedChart
} from 'recharts';
import { Calendar, Filter } from 'lucide-react';
import { ProjectMetrics } from '@/hooks/useProjectMetrics';

interface ProjectChartProps {
  data: ProjectMetrics['monthlyEvolution'];
}

export function ProjectChart({ data }: ProjectChartProps) {
  const [range, setRange] = useState(6);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    return data.slice(-range);
  }, [data, range]);

  if (!mounted) {
    return (
      <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-[#e8bcb7]/10 h-[480px]">
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-4 border-[#ed1c24]/20 border-t-[#ed1c24] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-[#e8bcb7]/10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl font-black text-[#1a1c1d] tracking-tight">Evolução de Atendimentos</h2>
          <p className="text-xs font-bold text-[#5e3f3b] opacity-50 uppercase tracking-widest">Análise de desempenho temporal</p>
        </div>

        <div className="flex items-center gap-2 bg-[#f4f3f5] p-1.5 rounded-2xl border border-[#e8bcb7]/5">
          {[3, 6, 12].map((months) => (
            <button
              key={months}
              onClick={() => setRange(months)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                range === months 
                  ? "bg-white text-[#ed1c24] shadow-sm" 
                  : "text-[#5e3f3b] opacity-40 hover:opacity-100"
              }`}
            >
              {months} Meses
            </button>
          ))}
        </div>
      </div>

      <div className="h-[350px] w-full relative outline-none [&_svg]:outline-none overflow-hidden">
        <ResponsiveContainer width="100%" height="100%" debounce={100}>
          <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ed1c24" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#ed1c24" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f3f5" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 900, fill: '#1a1c1d', opacity: 0.6 }}
              dy={15}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 900, fill: '#1a1c1d', opacity: 0.6 }}
            />
            <Tooltip 
              cursor={{ stroke: '#e8bcb7', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  // Filter to show only the specific lines we want
                  const filteredPayload = payload.filter(entry => 
                    entry.name === 'Meta Prevista' || entry.name === 'Realizado'
                  );
                  const targetEntry = filteredPayload.find(p => p.name === 'Meta Prevista');
                  const realizedEntry = filteredPayload.find(p => p.name === 'Realizado');
                  
                  const targetValue = Number(targetEntry?.value || 0);
                  const realizedValue = Number(realizedEntry?.value || 0);
                  const year = payload[0]?.payload?.year || '';

                  return (
                    <div className="bg-white p-5 rounded-[1.5rem] shadow-2xl border border-[#e8bcb7]/20 animate-in fade-in zoom-in-95 duration-200 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f4f3f5]">
                        <div className="w-8 h-8 rounded-xl bg-[#f4f3f5] flex items-center justify-center text-[#ed1c24]">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40 leading-none mb-1">Período</p>
                          <p className="text-sm font-black text-[#1a1c1d] leading-none">{label} / {year}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {filteredPayload.map((entry: any, index: number) => (
                          <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                              <span className="text-xs font-bold text-[#5e3f3b]">{entry.name}</span>
                            </div>
                            <span className="text-sm font-black text-[#1a1c1d]">{entry.value}</span>
                          </div>
                        ))}
                      </div>

                      {targetValue > 0 && (
                        <div className="mt-4 pt-4 border-t border-[#f4f3f5]">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#5e3f3b] opacity-40">Aproveitamento</span>
                            <span className={`text-xs font-black ${realizedValue >= targetValue ? 'text-green-600' : 'text-[#bc0010]'}`}>
                              {Math.round((realizedValue / targetValue) * 100)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#f4f3f5] rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${realizedValue >= targetValue ? 'bg-green-500' : 'bg-[#ed1c24]'}`}
                              style={{ width: `${Math.min(100, (realizedValue / targetValue) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ 
                paddingBottom: '30px', 
                paddingRight: '10px',
                fontSize: '10px', 
                fontWeight: '900', 
                textTransform: 'uppercase', 
                letterSpacing: '1px' 
              }}
            />
            <Area
              type="monotone"
              dataKey="realized"
              stroke="none"
              fillOpacity={1}
              fill="url(#colorRealized)"
              legendType="none"
            />
            <Line 
              type="monotone" 
              dataKey="target" 
              name="Meta Prevista" 
              stroke="#5e3f3b" 
              strokeWidth={2} 
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              opacity={0.4}
            />
            <Line 
              type="monotone" 
              dataKey="realized" 
              name="Realizado" 
              stroke="#ed1c24" 
              strokeWidth={4} 
              dot={{ r: 4, fill: '#ed1c24', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

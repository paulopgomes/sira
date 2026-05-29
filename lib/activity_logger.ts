'use client';

import { supabase } from './supabase';

export interface ActivityLog {
  id: string;
  action_type: 'LOGIN' | 'LOGOUT' | 'CREATION' | 'EDITION' | 'DELETION' | 'ARCHIVE' | 'RESTORE' | 'VIEW' | 'FAILURE';
  timestamp: string;
  username: string;
  user_id?: string | null;
  ip_device: string;
  module: string; // 'usuarios', 'profissionais', 'projetos', 'modalidades', 'unidades', 'pacientes', 'atendimentos', 'relatorio'
  unit_name?: string | null; // Optional unit associated with log
  previous_values?: any;
  new_values?: any;
  status: 'Sucesso' | 'Falha';
  details?: string;
  is_local?: boolean; // flag to identify if it was stored locally
}

// Memory cache for user IP to prevent fetch on every single log
let cachedIpDevice: string | null = null;

const getDeviceAndIp = async (): Promise<string> => {
  if (cachedIpDevice) return cachedIpDevice;

  let ip = 'IP Desconhecido';
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(id);
    if (res.ok) {
      const data = await res.json();
      ip = data.ip || 'IP Desconhecido';
    }
  } catch (err) {
    // Fail silently
  }

  let deviceDetails = 'Navegador Web';
  if (typeof window !== 'undefined' && window.navigator) {
    const ua = window.navigator.userAgent;
    if (/Android/i.test(ua)) {
      deviceDetails = 'Dispositivo Android';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      deviceDetails = 'iOS Device';
    } else if (/Windows/i.test(ua)) {
      deviceDetails = 'Windows PC';
    } else if (/Macintosh/i.test(ua)) {
      deviceDetails = 'Mac';
    } else if (/Linux/i.test(ua)) {
      deviceDetails = 'Linux PC';
    }
  }

  cachedIpDevice = `${ip} / ${deviceDetails}`;
  return cachedIpDevice;
};

// Auto-resolve logged in user metadata
const getActiveUser = (): { username: string; id: string | null } => {
  if (typeof window === 'undefined') return { username: 'Sistema', id: null };
  try {
    const saved = localStorage.getItem('sira_user');
    if (saved) {
      const user = JSON.parse(saved);
      return { 
        username: user.username || 'Sistema', 
        id: user.id || null 
      };
    }
  } catch (err) {
    // Ignore
  }
  return { username: 'Sistema', id: null };
};

const saveLocally = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
  if (typeof window === 'undefined') return;
  try {
    const existing = localStorage.getItem('sira_activity_logs');
    const logs: ActivityLog[] = existing ? JSON.parse(existing) : [];
    
    const newLog: ActivityLog = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      is_local: true
    };
    
    logs.unshift(newLog);
    if (logs.length > 500) {
      logs.pop();
    }
    localStorage.setItem('sira_activity_logs', JSON.stringify(logs));
  } catch (err) {
    console.error('Error saving log locally:', err);
  }
};

export const ActivityLogger = {
  log: async (params: {
    action_type: ActivityLog['action_type'];
    module: string;
    username?: string | null;
    user_id?: string | null;
    unit_name?: string | null;
    previous_values?: any;
    new_values?: any;
    status: ActivityLog['status'];
    details?: string;
  }): Promise<void> => {
    try {
      const ip_device = await getDeviceAndIp();
      const activeUser = getActiveUser();

      const finalUsername = params.username || activeUser.username;
      const finalUserId = params.user_id || activeUser.id;

      // Automap unit from values if not explicitly provided
      let inferredUnit = params.unit_name || null;
      if (!inferredUnit && params.new_values) {
        inferredUnit = params.new_values.unit_name || params.new_values.unit || null;
      }
      if (!inferredUnit && params.previous_values) {
        inferredUnit = params.previous_values.unit_name || params.previous_values.unit || null;
      }

      const payload = {
        action_type: params.action_type,
        username: finalUsername,
        user_id: finalUserId,
        ip_device,
        module: params.module,
        unit_name: inferredUnit,
        previous_values: params.previous_values ? JSON.parse(JSON.stringify(params.previous_values)) : null,
        new_values: params.new_values ? JSON.parse(JSON.stringify(params.new_values)) : null,
        status: params.status,
        details: params.details || ''
      };

      // Save locally as a robust auditing baseline
      saveLocally(payload);

      // Save to Supabase
      const { error } = await supabase.from('activity_logs').insert([payload]);
      if (error) {
        console.warn('DB Log sync fallback active:', error.message);
      }
    } catch (e) {
      console.warn('Silent database logging error (safely logged locally):', e);
    }
  },

  logLogin: async (username: string, userId?: string | null, status: 'Sucesso' | 'Falha' = 'Sucesso', details?: string) => {
    await ActivityLogger.log({
      action_type: status === 'Sucesso' ? 'LOGIN' : 'FAILURE',
      module: 'acessos',
      username,
      user_id: userId,
      status,
      details: details || (status === 'Sucesso' ? 'Usuário efetuou login no sistema.' : 'Tentativa de login malsucedida.')
    });
  },

  logLogout: async (username: string, userId?: string | null) => {
    await ActivityLogger.log({
      action_type: 'LOGOUT',
      module: 'acessos',
      username,
      user_id: userId,
      status: 'Sucesso',
      details: 'Usuário efetuou logout do sistema.'
    });
  },

  logCreation: async (module: string, newValues: any, details?: string, unitName?: string | null, username?: string | null, userId?: string | null) => {
    await ActivityLogger.log({
      action_type: 'CREATION',
      module,
      username,
      user_id: userId,
      unit_name: unitName,
      new_values: newValues,
      status: 'Sucesso',
      details: details || `Registro criado no módulo de ${module}.`
    });
  },

  logEdition: async (module: string, previousValues: any, newValues: any, details?: string, unitName?: string | null, username?: string | null, userId?: string | null) => {
    await ActivityLogger.log({
      action_type: 'EDITION',
      module,
      username,
      user_id: userId,
      unit_name: unitName,
      previous_values: previousValues,
      new_values: newValues,
      status: 'Sucesso',
      details: details || `Registro editado no módulo de ${module}.`
    });
  },

  logDeletion: async (module: string, previousValues: any, details?: string, unitName?: string | null, username?: string | null, userId?: string | null) => {
    await ActivityLogger.log({
      action_type: 'DELETION',
      module,
      username,
      user_id: userId,
      unit_name: unitName,
      previous_values: previousValues,
      status: 'Sucesso',
      details: details || `Registro excluído do módulo de ${module}.`
    });
  },

  logArchive: async (module: string, details?: string, previousValues?: any, unitName?: string | null, username?: string | null, userId?: string | null) => {
    await ActivityLogger.log({
      action_type: 'ARCHIVE',
      module,
      username,
      user_id: userId,
      unit_name: unitName,
      previous_values: previousValues,
      status: 'Sucesso',
      details: details || `Período ou registro arquivado no módulo de ${module}.`
    });
  },

  logRestore: async (module: string, details?: string, newValues?: any, unitName?: string | null, username?: string | null, userId?: string | null) => {
    await ActivityLogger.log({
      action_type: 'RESTORE',
      module,
      username,
      user_id: userId,
      unit_name: unitName,
      new_values: newValues,
      status: 'Sucesso',
      details: details || `Período ou registro restaurado no módulo de ${module}.`
    });
  },

  fetchLogs: async (): Promise<ActivityLog[]> => {
    let dbLogs: ActivityLog[] = [];
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (!error && data) {
        dbLogs = data;
      }
    } catch (err) {
      console.warn('Error reading from activity_logs table:', err);
    }

    let localLogs: ActivityLog[] = [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('sira_activity_logs');
        localLogs = stored ? JSON.parse(stored) : [];
      } catch (err) {
        console.error(err);
      }
    }

    const dbKeys = new Set(
      dbLogs.map(l => `${l.action_type}_${new Date(l.timestamp).getTime()}_${l.username}_${l.module}`)
    );

    const merged = [...dbLogs];
    for (const log of localLogs) {
      const key = `${log.action_type}_${new Date(log.timestamp).getTime()}_${log.username}_${log.module}`;
      if (!dbKeys.has(key)) {
        merged.push(log);
      }
    }

    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
};

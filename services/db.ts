import { Drug, User, UserRole, Notification } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const getEnvVar = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || '';
  }
  return '';
};

// Mode Configuration
const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnvVar('VITE_SUPABASE_KEY');

// We prioritize the Local API (XAMPP) if Supabase is not configured
const isSupabaseEnabled = !!(SUPABASE_URL && SUPABASE_KEY);
// We assume API is enabled if we are not using Supabase, or we can explicit check.
// For this setup: Default is REST API (XAMPP) via Proxy.

let supabase: any = null;
if (isSupabaseEnabled) {
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
      console.error("Supabase init failed:", e);
    }
}

// --- HELPER FOR API CALLS ---
const api = async (endpoint: string, method: string = 'GET', body?: any) => {
    try {
        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) options.body = JSON.stringify(body);
        
        const res = await fetch(`/api${endpoint}`, options);
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        return await res.json();
    } catch (error) {
        console.error(`API Call Failed [${endpoint}]:`, error);
        throw error;
    }
};

export const db = {
  isCloud: true, // Now strictly Database (either XAMPP or Cloud)

  // --- User Operations ---
  getUsers: async (): Promise<User[]> => {
    if (isSupabaseEnabled && supabase) {
        const { data, error } = await supabase.from('users').select('*');
        if (error) { console.error(error); return []; }
        return data;
    }
    // XAMPP API
    return await api('/users');
  },
  
  addUser: async (user: any) => {
    if (isSupabaseEnabled && supabase) {
        const { data } = await supabase.from('users').select('id').or(`username.eq.${user.username},email.eq.${user.email}`);
        if (data && data.length > 0) throw new Error('اسم المستخدم أو البريد موجود مسبقاً');
        const { error } = await supabase.from('users').insert(user);
        if (error) throw error;
        return;
    }
    // XAMPP API
    await api('/users', 'POST', user);
  },

  updateUser: async (updatedUser: Partial<User> & { id: string, password?: string }) => {
    if (isSupabaseEnabled && supabase) {
       const updateData = { ...updatedUser };
       if (!updateData.password) delete updateData.password;
       const { data, error } = await supabase.from('users').update(updateData).eq('id', updatedUser.id).select().single();
       if (error) throw error;
       return data as User;
    }
    // XAMPP API
    await api(`/users/${updatedUser.id}`, 'PUT', updatedUser);
    return updatedUser as User;
  },

  deleteUser: async (id: string) => {
    if (isSupabaseEnabled && supabase) {
        await supabase.from('users').delete().eq('id', id);
        return;
    }
    // XAMPP API
    await api(`/users/${id}`, 'DELETE');
  },

  authenticate: async (identifier: string, pass: string): Promise<User | null> => {
    if (isSupabaseEnabled && supabase) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .or(`username.eq.${identifier},email.eq.${identifier}`)
            .eq('password', pass)
            .single();
        if (error || !data) return null;
        return data as User;
    }
    // XAMPP API
    try {
        const user = await api('/login', 'POST', { identifier, password: pass });
        return user;
    } catch (e) {
        return null;
    }
  },

  // --- Drugs Operations ---
  getDrugs: async (): Promise<Drug[]> => {
    if (isSupabaseEnabled && supabase) {
        const { data, error } = await supabase.from('drugs').select('*');
        if (error) return [];
        return data;
    }
    // XAMPP API
    return await api('/drugs');
  },
  
  addDrug: async (drug: Drug) => {
    if (isSupabaseEnabled && supabase) {
        await supabase.from('drugs').insert(drug);
        return;
    }
    // XAMPP API
    await api('/drugs', 'POST', [drug]);
  },
  
  addDrugsBatch: async (newDrugs: Drug[]) => {
    if (isSupabaseEnabled && supabase) {
        await supabase.from('drugs').insert(newDrugs);
        return;
    }
    // XAMPP API
    await api('/drugs', 'POST', newDrugs);
  },
  
  updateDrug: async (id: string, updates: Partial<Drug>) => {
    if (isSupabaseEnabled && supabase) {
        await supabase.from('drugs').update(updates).eq('id', id);
        return;
    }
    // XAMPP API
    await api(`/drugs/${id}`, 'PUT', updates);
  },
  
  deleteDrug: async (id: string) => {
    if (isSupabaseEnabled && supabase) {
        await supabase.from('drugs').delete().eq('id', id);
        return;
    }
    // XAMPP API
    await api(`/drugs/${id}`, 'DELETE');
  },

  // --- Notifications ---
  getNotifications: async (): Promise<Notification[]> => {
      if (isSupabaseEnabled && supabase) {
          const { data } = await supabase.from('notifications').select('*').order('date', { ascending: false });
          return data || [];
      }
      // XAMPP API
      return await api('/notifications');
  },
  
  markAllNotificationsRead: async () => {
    if (isSupabaseEnabled && supabase) {
        await supabase.from('notifications').update({ read: true }).neq('read', true);
        return;
    }
    // XAMPP API
    await api('/notifications/read', 'POST');
  },

  addNotification: async (note: Notification) => {
      // Logic handled by triggers usually, or simple insert
  },

  // --- Export ---
  exportData: async () => {
      // Simply refetch all data and download
      const users = await db.getUsers();
      const drugs = await db.getDrugs();

      const data = {
          users,
          drugs,
          timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pharma_eye_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
  },

  // --- Biometrics (Stub for API) ---
  registerDeviceForBiometrics: async (userId: string, credentialId: string) => {
     // Save to DB via API
     // For now, simpler implementation keeps this in localStorage or needs a DB column update
     // We implemented `biometricCredentialId` in the SQL schema
     await db.updateUser({ id: userId, biometricCredentialId: credentialId } as any);
  },
  
  authenticateWithDeviceToken: async (credentialId: string): Promise<User | null> => {
     // In a real API, we would query by credentialId
     // For this basic setup, we'll fetch all users and find logic (not efficient but works for small scale)
     const users = await db.getUsers();
     return users.find(u => u.biometricCredentialId === credentialId) || null;
  }
};

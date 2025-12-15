import { Drug, User, UserRole, Notification } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
// Access environment variables safely
const getEnvVar = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || '';
  }
  return '';
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnvVar('VITE_SUPABASE_KEY');

const isCloudEnabled = !!(SUPABASE_URL && SUPABASE_KEY);
let supabase: any = null;

if (isCloudEnabled) {
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
      console.error("Supabase init failed:", e);
    }
}

// Keys for LocalStorage (Fallback)
const KEYS = {
  USERS: 'pharma_users',
  DRUGS: 'pharma_drugs',
  NOTIFICATIONS: 'pharma_notifications',
};

// --- INITIALIZATION ---
const seedLocalData = () => {
  if (!localStorage.getItem(KEYS.USERS)) {
    const admin: User = {
      id: 'admin-1',
      username: 'root',
      email: 'admin@pharma.com',
      fullName: 'المدير العام',
      role: UserRole.ADMIN,
      phone: '966500000000',
      password: 'root1'
    };
    localStorage.setItem(KEYS.USERS, JSON.stringify([admin]));
    
    const welcomeNote: Notification = {
      id: 'note-1',
      title: 'مرحباً بك في PharmaEye',
      message: 'النظام يعمل الآن.',
      read: false,
      date: Date.now()
    };
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([welcomeNote]));
  }
  if (!localStorage.getItem(KEYS.DRUGS)) {
    localStorage.setItem(KEYS.DRUGS, JSON.stringify([]));
  }
};

// Run seed only if offline or first load
seedLocalData();

export const db = {
  isCloud: isCloudEnabled,

  // --- User Operations ---
  getUsers: async (): Promise<User[]> => {
    if (isCloudEnabled && supabase) {
        const { data, error } = await supabase.from('users').select('*');
        if (error) { console.error(error); return []; }
        return data;
    }
    return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
  },
  
  addUser: async (user: any) => {
    if (isCloudEnabled && supabase) {
        // Check duplicates
        const { data } = await supabase.from('users').select('id').or(`username.eq.${user.username},email.eq.${user.email}`);
        if (data && data.length > 0) throw new Error('اسم المستخدم أو البريد موجود مسبقاً');
        
        const { error } = await supabase.from('users').insert(user);
        if (error) throw error;
        return;
    }

    // Local
    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    if (users.some((u: any) => u.username === user.username || u.email === user.email)) {
      throw new Error('اسم المستخدم أو البريد الإلكتروني موجود مسبقاً');
    }
    users.push(user);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  updateUser: async (updatedUser: Partial<User> & { id: string, password?: string }) => {
    if (isCloudEnabled && supabase) {
       // Ideally check duplicates via DB constraint or query, skipping for simplicity in this demo
       const updateData = { ...updatedUser };
       if (!updateData.password) delete updateData.password;
       
       const { data, error } = await supabase.from('users').update(updateData).eq('id', updatedUser.id).select().single();
       if (error) throw error;
       return data as User;
    }

    // Local
    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const index = users.findIndex((u: any) => u.id === updatedUser.id);
    
    if (index !== -1) {
      if (updatedUser.username || updatedUser.email) {
          const duplicate = users.find((u: any) => 
            u.id !== updatedUser.id && 
            ((updatedUser.username && u.username === updatedUser.username) || 
             (updatedUser.email && u.email === updatedUser.email))
          );
          if (duplicate) throw new Error('مستخدم بالفعل');
      }

      const mergedUser = { ...users[index], ...updatedUser };
      if (!updatedUser.password) mergedUser.password = users[index].password;
      users[index] = mergedUser;
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      const { password, ...safeUser } = mergedUser;
      return safeUser as User;
    }
    return null;
  },

  deleteUser: async (id: string) => {
    if (isCloudEnabled && supabase) {
        const { data } = await supabase.from('users').select('username').eq('id', id).single();
        if (data?.username === 'root') throw new Error('لا يمكن حذف المدير الرئيسي');
        await supabase.from('users').delete().eq('id', id);
        return;
    }
    
    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const userToDelete = users.find((u:any) => u.id === id);
    if (userToDelete?.username === 'root') throw new Error('لا يمكن حذف المدير الرئيسي');
    const filtered = users.filter((u: any) => u.id !== id);
    localStorage.setItem(KEYS.USERS, JSON.stringify(filtered));
  },

  authenticate: async (identifier: string, pass: string): Promise<User | null> => {
    if (isCloudEnabled && supabase) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .or(`username.eq.${identifier},email.eq.${identifier}`)
            .eq('password', pass)
            .single();
        
        if (error || !data) return null;
        return data as User;
    }

    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const user = users.find((u: any) => (u.username === identifier || u.email === identifier) && u.password === pass);
    if (user) {
      const { password, ...safeUser } = user;
      return safeUser as User;
    }
    return null;
  },

  // --- Drugs Operations ---
  getDrugs: async (): Promise<Drug[]> => {
    if (isCloudEnabled && supabase) {
        const { data, error } = await supabase.from('drugs').select('*');
        if (error) return [];
        return data;
    }
    return JSON.parse(localStorage.getItem(KEYS.DRUGS) || '[]');
  },
  
  addDrug: async (drug: Drug) => {
    if (isCloudEnabled && supabase) {
        await supabase.from('drugs').insert(drug);
        return;
    }
    const drugs = JSON.parse(localStorage.getItem(KEYS.DRUGS) || '[]');
    drugs.push(drug);
    localStorage.setItem(KEYS.DRUGS, JSON.stringify(drugs));
  },
  
  addDrugsBatch: async (newDrugs: Drug[]) => {
    if (isCloudEnabled && supabase) {
        await supabase.from('drugs').insert(newDrugs);
        return;
    }
    const drugs = JSON.parse(localStorage.getItem(KEYS.DRUGS) || '[]');
    localStorage.setItem(KEYS.DRUGS, JSON.stringify([...drugs, ...newDrugs]));
  },
  
  updateDrug: async (id: string, updates: Partial<Drug>) => {
    if (isCloudEnabled && supabase) {
        await supabase.from('drugs').update(updates).eq('id', id);
        return;
    }
    const drugs = JSON.parse(localStorage.getItem(KEYS.DRUGS) || '[]');
    const idx = drugs.findIndex((d: Drug) => d.id === id);
    if (idx !== -1) {
      drugs[idx] = { ...drugs[idx], ...updates };
      localStorage.setItem(KEYS.DRUGS, JSON.stringify(drugs));
    }
  },
  
  deleteDrug: async (id: string) => {
    if (isCloudEnabled && supabase) {
        await supabase.from('drugs').delete().eq('id', id);
        return;
    }
    const drugs = JSON.parse(localStorage.getItem(KEYS.DRUGS) || '[]');
    const filtered = drugs.filter((d: Drug) => d.id !== id);
    localStorage.setItem(KEYS.DRUGS, JSON.stringify(filtered));
  },

  // --- Notifications ---
  getNotifications: async (): Promise<Notification[]> => {
      if (isCloudEnabled && supabase) {
          const { data } = await supabase.from('notifications').select('*').order('date', { ascending: false });
          return data || [];
      }
      const notes = JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS) || '[]');
      return notes.sort((a: Notification, b: Notification) => b.date - a.date);
  },
  
  markAllNotificationsRead: async () => {
    if (isCloudEnabled && supabase) {
        await supabase.from('notifications').update({ read: true }).neq('read', true);
        return;
    }
    const notes = JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS) || '[]');
    const updated = notes.map((n: Notification) => ({...n, read: true}));
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(updated));
  },

  addNotification: async (note: Notification) => {
    if (isCloudEnabled && supabase) {
        await supabase.from('notifications').insert(note);
        return;
    }
    const notes = JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS) || '[]');
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([note, ...notes]));
  },

  // --- Export ---
  exportData: async () => {
      let users = [], drugs = [];
      if (isCloudEnabled && supabase) {
          const uRes = await supabase.from('users').select('*');
          const dRes = await supabase.from('drugs').select('*');
          users = uRes.data || [];
          drugs = dRes.data || [];
      } else {
          users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
          drugs = JSON.parse(localStorage.getItem(KEYS.DRUGS) || '[]');
      }

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

  // --- Biometrics Helpers (Stubbed for Supabase) ---
  registerDeviceForBiometrics: async (userId: string, credentialId: string) => {
      if (isCloudEnabled && supabase) {
          await supabase.from('users').update({ biometricCredentialId: credentialId }).eq('id', userId);
      }
      const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
      const idx = users.findIndex((u:any) => u.id === userId);
      if (idx !== -1) {
          users[idx].biometricCredentialId = credentialId;
          localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      }
      localStorage.setItem('pharma_bio_cred_id', credentialId);
  },
  
  authenticateWithDeviceToken: async (credentialId: string): Promise<User | null> => {
      if (!credentialId) return null;
      if (isCloudEnabled && supabase) {
          const { data } = await supabase.from('users').select('*').eq('biometricCredentialId', credentialId).single();
          return data as User;
      }
      const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
      const user = users.find((u: any) => u.biometricCredentialId === credentialId);
      if (user) {
          const { password, ...safeUser } = user;
          return safeUser as User;
      }
      return null;
  }
};
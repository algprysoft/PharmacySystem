import { Drug, User, Notification, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// --- LocalStorage Keys (Fallback) ---
const STORAGE_KEYS = {
    USERS: 'pharma_users',
    DRUGS: 'pharma_drugs',
    NOTIFICATIONS: 'pharma_notifications'
};

// تهيئة البيانات المحلية (فقط إذا لم يكن هناك اتصال سحابي)
const initLocalDB = () => {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        const adminUser: User = {
            id: '1',
            username: 'admin',
            password: 'admin123',
            fullName: 'مدير النظام (محلي)',
            role: UserRole.ADMIN,
            email: 'admin@pharma.com'
        };
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([adminUser]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.DRUGS)) localStorage.setItem(STORAGE_KEYS.DRUGS, JSON.stringify([]));
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
};

initLocalDB();

// وظائف مساعدة للمحلي
const getLocal = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};
const setLocal = (key: string, data: any[]) => localStorage.setItem(key, JSON.stringify(data));
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const db = {
  isCloud: isSupabaseConfigured,

  // --- User Operations ---
  getUsers: async (): Promise<User[]> => {
    if (db.isCloud && supabase) {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        return data as User[];
    }
    await delay();
    return getLocal<User>(STORAGE_KEYS.USERS);
  },
  
  addUser: async (user: any) => {
    if (db.isCloud && supabase) {
        // حذف الـ id إذا كان فارغاً ليقوم البوستجريس بتوليده، أو استخدامه إذا تم توليده في الفرونت
        const { error } = await supabase.from('users').insert([user]);
        if (error) throw new Error(error.message);
        return;
    }
    await delay();
    const users = getLocal<User>(STORAGE_KEYS.USERS);
    if (users.find(u => u.username === user.username)) throw new Error('اسم المستخدم موجود مسبقاً');
    users.push(user);
    setLocal(STORAGE_KEYS.USERS, users);
  },

  updateUser: async (updatedUser: Partial<User> & { id: string }) => {
    if (db.isCloud && supabase) {
        const { data, error } = await supabase.from('users').update(updatedUser).eq('id', updatedUser.id).select().single();
        if (error) throw new Error(error.message);
        return data;
    }
    await delay();
    const users = getLocal<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
        users[index] = { ...users[index], ...updatedUser };
        setLocal(STORAGE_KEYS.USERS, users);
        return users[index];
    }
    throw new Error('المستخدم غير موجود');
  },

  deleteUser: async (id: string) => {
    if (db.isCloud && supabase) {
        // التحقق من عدم حذف آخر أدمن
        const { data: admins } = await supabase.from('users').select('id').eq('role', 'ADMIN');
        if (admins && admins.length <= 1) {
             const { data: userToCheck } = await supabase.from('users').select('role').eq('id', id).single();
             if (userToCheck?.role === 'ADMIN') throw new Error('لا يمكن حذف المدير الوحيد');
        }
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        return;
    }
    await delay();
    let users = getLocal<User>(STORAGE_KEYS.USERS);
    const userToDelete = users.find(u => u.id === id);
    if (userToDelete?.role === UserRole.ADMIN) {
        const adminCount = users.filter(u => u.role === UserRole.ADMIN).length;
        if (adminCount <= 1) throw new Error('لا يمكن حذف المدير الوحيد في النظام');
    }
    users = users.filter(u => u.id !== id);
    setLocal(STORAGE_KEYS.USERS, users);
  },

  authenticate: async (identifier: string, pass: string): Promise<User | null> => {
    if (db.isCloud && supabase) {
        // ملاحظة: هذا تحقق بسيط. في الإنتاج يفضل استخدام Supabase Auth المدمج
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .or(`username.eq.${identifier},email.eq.${identifier}`)
            .eq('password', pass) // يجب في التطبيق الحقيقي مقارنة الهاش وليس النص الصريح
            .maybeSingle();
            
        if (error) console.error(error);
        return data as User | null;
    }
    await delay(500);
    const users = getLocal<User>(STORAGE_KEYS.USERS);
    return users.find(u => (u.username === identifier || u.email === identifier) && u.password === pass) || null;
  },

  // --- Drugs Operations ---
  getDrugs: async (): Promise<Drug[]> => {
    if (db.isCloud && supabase) {
        const { data, error } = await supabase.from('drugs').select('*').order('createdAt', { ascending: false });
        if (error) throw error;
        return data as Drug[];
    }
    await delay();
    return getLocal<Drug>(STORAGE_KEYS.DRUGS);
  },
  
  addDrug: async (drug: Drug) => {
    if (db.isCloud && supabase) {
        const { error } = await supabase.from('drugs').insert([drug]);
        if (error) throw error;
        return;
    }
    await delay();
    const drugs = getLocal<Drug>(STORAGE_KEYS.DRUGS);
    drugs.push(drug);
    setLocal(STORAGE_KEYS.DRUGS, drugs);
  },
  
  addDrugsBatch: async (newDrugs: Drug[]) => {
    if (db.isCloud && supabase) {
        const { error } = await supabase.from('drugs').insert(newDrugs);
        if (error) throw error;
        return;
    }
    await delay();
    const drugs = getLocal<Drug>(STORAGE_KEYS.DRUGS);
    setLocal(STORAGE_KEYS.DRUGS, [...drugs, ...newDrugs]);
  },
  
  updateDrug: async (id: string, updates: Partial<Drug>) => {
    if (db.isCloud && supabase) {
        const { error } = await supabase.from('drugs').update(updates).eq('id', id);
        if (error) throw error;
        return;
    }
    await delay();
    const drugs = getLocal<Drug>(STORAGE_KEYS.DRUGS);
    const index = drugs.findIndex(d => d.id === id);
    if (index !== -1) {
        drugs[index] = { ...drugs[index], ...updates };
        setLocal(STORAGE_KEYS.DRUGS, drugs);
    }
  },
  
  deleteDrug: async (id: string) => {
    if (db.isCloud && supabase) {
        const { error } = await supabase.from('drugs').delete().eq('id', id);
        if (error) throw error;
        return;
    }
    await delay();
    let drugs = getLocal<Drug>(STORAGE_KEYS.DRUGS);
    drugs = drugs.filter(d => d.id !== id);
    setLocal(STORAGE_KEYS.DRUGS, drugs);
  },

  // --- Notifications ---
  getNotifications: async (): Promise<Notification[]> => {
      if (db.isCloud && supabase) {
          const { data } = await supabase.from('notifications').select('*').order('date', { ascending: false });
          return data as Notification[] || [];
      }
      return getLocal<Notification>(STORAGE_KEYS.NOTIFICATIONS);
  },
  
  markAllNotificationsRead: async () => {
    if (db.isCloud && supabase) {
        await supabase.from('notifications').update({ read: true }).neq('read', true);
        return;
    }
    const notes = getLocal<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    const updated = notes.map(n => ({ ...n, read: true }));
    setLocal(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  addNotification: async (note: Notification) => {
     if (db.isCloud && supabase) {
         await supabase.from('notifications').insert([note]);
         return;
     }
     const notes = getLocal<Notification>(STORAGE_KEYS.NOTIFICATIONS);
     notes.unshift(note);
     setLocal(STORAGE_KEYS.NOTIFICATIONS, notes);
  },

  // --- Export ---
  exportData: async () => {
      let users, drugs;
      if (db.isCloud && supabase) {
           const usersRes = await supabase.from('users').select('*');
           const drugsRes = await supabase.from('drugs').select('*');
           users = usersRes.data;
           drugs = drugsRes.data;
      } else {
           users = getLocal(STORAGE_KEYS.USERS);
           drugs = getLocal(STORAGE_KEYS.DRUGS);
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

  // --- Biometrics ---
  registerDeviceForBiometrics: async (userId: string, credentialId: string) => {
     if (db.isCloud && supabase) {
         await supabase.from('users').update({ biometricCredentialId: credentialId }).eq('id', userId);
         return;
     }
     const users = getLocal<User>(STORAGE_KEYS.USERS);
     const index = users.findIndex(u => u.id === userId);
     if (index !== -1) {
         users[index].biometricCredentialId = credentialId;
         setLocal(STORAGE_KEYS.USERS, users);
     }
  },
  
  authenticateWithDeviceToken: async (credentialId: string): Promise<User | null> => {
     if (db.isCloud && supabase) {
         const { data } = await supabase.from('users').select('*').eq('biometricCredentialId', credentialId).single();
         return data as User;
     }
     const users = getLocal<User>(STORAGE_KEYS.USERS);
     return users.find(u => u.biometricCredentialId === credentialId) || null;
  }
};
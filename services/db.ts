import { Drug, User, Notification, UserRole } from '../types';

// XAMPP API Configuration
// هام: يجب أن يكون مجلد المشروع بالكامل موجوداً داخل C:\xampp\htdocs\pharma-eye
// إذا غيرت اسم المجلد، قم بتغيير 'pharma-eye' في الرابط أدناه
const PROJECT_FOLDER_NAME = 'pharma-eye'; 
const API_URL = `http://localhost/${PROJECT_FOLDER_NAME}/api/index.php`;

const STORAGE_KEYS = {
    USERS: 'pharma_users',
    DRUGS: 'pharma_drugs',
    NOTIFICATIONS: 'pharma_notifications'
};

// Helper for Fetching from XAMPP
const apiRequest = async (action: string, method: 'GET' | 'POST' = 'GET', body?: any) => {
    try {
        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) options.body = JSON.stringify(body);

        // إضافة Action كـ Query Param
        const url = `${API_URL}?action=${action}${method === 'GET' && body?.id ? `&id=${body.id}` : ''}`;
        
        const response = await fetch(url, options);
        if (!response.ok) {
             // إذا فشل الاتصال، سنرمي خطأ ليتم التقاطه واستخدام LocalStorage كاحتياطي
             throw new Error(`API Error: ${response.statusText}`);
        }
        const json = await response.json();
        if (json && json.error) throw new Error(json.error);
        return json;
    } catch (error) {
        console.error("XAMPP Connection Failed:", error);
        throw error; // Propagate error to trigger fallback or alert
    }
};

// Fallback Local Storage Logic (للاستخدام في حالة انقطاع الاتصال بالسيرفر)
const getLocal = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};
const setLocal = (key: string, data: any[]) => localStorage.setItem(key, JSON.stringify(data));

// تهيئة بيانات محلية وهمية فقط إذا لم نكن نستخدم السيرفر
const initLocalDB = () => {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
         const adminUser: User = { id: '1', username: 'admin', password: 'admin123', fullName: 'مدير محلي', role: UserRole.ADMIN, email: 'admin@local.com' };
         localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([adminUser]));
    }
};
initLocalDB();

export const db = {
  // Flag to indicate we are using a remote DB (Server)
  isCloud: true, 

  // --- User Operations ---
  getUsers: async (): Promise<User[]> => {
    try {
        return await apiRequest('get_users');
    } catch (e) {
        return getLocal<User>(STORAGE_KEYS.USERS);
    }
  },
  
  addUser: async (user: any) => {
    try {
        await apiRequest('add_user', 'POST', user);
    } catch (e) {
        const users = getLocal<User>(STORAGE_KEYS.USERS);
        users.push(user);
        setLocal(STORAGE_KEYS.USERS, users);
    }
  },

  updateUser: async (updatedUser: Partial<User> & { id: string }) => {
    try {
        await apiRequest('update_user', 'POST', updatedUser);
        return updatedUser;
    } catch (e) {
        const users = getLocal<User>(STORAGE_KEYS.USERS);
        const index = users.findIndex(u => u.id === updatedUser.id);
        if (index !== -1) {
            users[index] = { ...users[index], ...updatedUser };
            setLocal(STORAGE_KEYS.USERS, users);
            return users[index];
        }
        throw e;
    }
  },

  deleteUser: async (id: string) => {
    try {
        // نمرر الـ id في الرابط للـ GET request الذي سيتعامل معه الـ PHP
        await fetch(`${API_URL}?action=delete_user&id=${id}`); 
    } catch (e) {
        let users = getLocal<User>(STORAGE_KEYS.USERS);
        users = users.filter(u => u.id !== id);
        setLocal(STORAGE_KEYS.USERS, users);
    }
  },

  authenticate: async (identifier: string, pass: string): Promise<User | null> => {
    try {
        const user = await apiRequest('login', 'POST', { username: identifier, password: pass });
        return user;
    } catch (e) {
        console.warn("Using Local Auth due to connection error");
        const users = getLocal<User>(STORAGE_KEYS.USERS);
        return users.find(u => (u.username === identifier || u.email === identifier) && u.password === pass) || null;
    }
  },

  // --- Drugs Operations ---
  getDrugs: async (): Promise<Drug[]> => {
    try {
        const drugs = await apiRequest('get_drugs');
        // تأكد أن الأسعار أرقام وليست نصوصاً قادمة من الـ API
        return drugs.map((d: any) => ({
            ...d,
            publicPrice: Number(d.publicPrice),
            agentPrice: Number(d.agentPrice),
            priceBeforeDiscount: Number(d.priceBeforeDiscount),
            discountPercent: Number(d.discountPercent),
            createdAt: Number(d.createdAt)
        }));
    } catch (e) {
        return getLocal<Drug>(STORAGE_KEYS.DRUGS);
    }
  },
  
  addDrug: async (drug: Drug) => {
    try {
        await apiRequest('add_drug', 'POST', drug);
    } catch (e) {
        const drugs = getLocal<Drug>(STORAGE_KEYS.DRUGS);
        drugs.push(drug);
        setLocal(STORAGE_KEYS.DRUGS, drugs);
    }
  },
  
  addDrugsBatch: async (newDrugs: Drug[]) => {
    try {
        await apiRequest('add_drugs_batch', 'POST', newDrugs);
    } catch (e) {
        const drugs = getLocal<Drug>(STORAGE_KEYS.DRUGS);
        setLocal(STORAGE_KEYS.DRUGS, [...drugs, ...newDrugs]);
    }
  },
  
  updateDrug: async (id: string, updates: Partial<Drug>) => {
    try {
        await apiRequest('update_drug', 'POST', { id, ...updates });
    } catch (e) {
        const drugs = getLocal<Drug>(STORAGE_KEYS.DRUGS);
        const index = drugs.findIndex(d => d.id === id);
        if (index !== -1) {
            drugs[index] = { ...drugs[index], ...updates };
            setLocal(STORAGE_KEYS.DRUGS, drugs);
        }
    }
  },
  
  deleteDrug: async (id: string) => {
    try {
        await fetch(`${API_URL}?action=delete_drug&id=${id}`);
    } catch (e) {
        let drugs = getLocal<Drug>(STORAGE_KEYS.DRUGS);
        drugs = drugs.filter(d => d.id !== id);
        setLocal(STORAGE_KEYS.DRUGS, drugs);
    }
  },

  // --- Notifications ---
  getNotifications: async (): Promise<Notification[]> => {
      try {
          return await apiRequest('get_notifications');
      } catch(e) {
          return getLocal<Notification>(STORAGE_KEYS.NOTIFICATIONS);
      }
  },
  
  markAllNotificationsRead: async () => {
    // Implement later in PHP if needed
    const notes = getLocal<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    const updated = notes.map(n => ({ ...n, read: true }));
    setLocal(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  addNotification: async (note: Notification) => {
     // Implement later in PHP if needed
     const notes = getLocal<Notification>(STORAGE_KEYS.NOTIFICATIONS);
     notes.unshift(note);
     setLocal(STORAGE_KEYS.NOTIFICATIONS, notes);
  },

  // --- Export ---
  exportData: async () => {
      try {
          const users = await apiRequest('get_users');
          const drugs = await apiRequest('get_drugs');
          const data = { users, drugs, timestamp: new Date().toISOString() };
          
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `pharma_eye_xampp_backup_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
      } catch (e) {
          alert("فشل في التصدير من السيرفر، تأكد من تشغيل XAMPP");
      }
  },

  // --- Biometrics ---
  registerDeviceForBiometrics: async (userId: string, credentialId: string) => {
      // For now, keep local as Biometrics require secure contexts (HTTPS) mostly
      const users = getLocal<User>(STORAGE_KEYS.USERS);
      const index = users.findIndex(u => u.id === userId);
      if (index !== -1) {
          users[index].biometricCredentialId = credentialId;
          setLocal(STORAGE_KEYS.USERS, users);
      }
  },
  
  authenticateWithDeviceToken: async (credentialId: string): Promise<User | null> => {
     const users = getLocal<User>(STORAGE_KEYS.USERS);
     return users.find(u => u.biometricCredentialId === credentialId) || null;
  }
};
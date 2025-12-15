import { Drug, User, Notification } from '../types';

// API Helper
const api = async (endpoint: string, method: string = 'GET', body?: any) => {
    try {
        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) options.body = JSON.stringify(body);
        
        const res = await fetch(`/api${endpoint}`, options);
        const text = await res.text();
        
        if (!res.ok) {
            let errorMsg = res.statusText;
            try {
                const json = JSON.parse(text);
                errorMsg = json.error || json.message || errorMsg;
            } catch(e) {}
            throw new Error(errorMsg);
        }

        try {
            return text ? JSON.parse(text) : {};
        } catch(e) {
            return {};
        }
    } catch (error: any) {
        console.error(`API Call Failed [${endpoint}]:`, error);
        throw error;
    }
};

export const db = {
  isCloud: true, // Always connected to our local SQLite DB

  // --- User Operations ---
  getUsers: async (): Promise<User[]> => {
    return await api('/users');
  },
  
  addUser: async (user: any) => {
    await api('/users', 'POST', user);
  },

  updateUser: async (updatedUser: Partial<User> & { id: string, password?: string }) => {
    await api(`/users/${updatedUser.id}`, 'PUT', updatedUser);
    return updatedUser as User; // Optimistic return
  },

  deleteUser: async (id: string) => {
    await api(`/users/${id}`, 'DELETE');
  },

  authenticate: async (identifier: string, pass: string): Promise<User | null> => {
    try {
        const user = await api('/login', 'POST', { identifier, password: pass });
        return user;
    } catch (e) {
        console.error("Login failed:", e);
        return null;
    }
  },

  // --- Drugs Operations ---
  getDrugs: async (): Promise<Drug[]> => {
    return await api('/drugs');
  },
  
  addDrug: async (drug: Drug) => {
    await api('/drugs', 'POST', [drug]);
  },
  
  addDrugsBatch: async (newDrugs: Drug[]) => {
    await api('/drugs', 'POST', newDrugs);
  },
  
  updateDrug: async (id: string, updates: Partial<Drug>) => {
    await api(`/drugs/${id}`, 'PUT', updates);
  },
  
  deleteDrug: async (id: string) => {
    await api(`/drugs/${id}`, 'DELETE');
  },

  // --- Notifications ---
  getNotifications: async (): Promise<Notification[]> => {
      return await api('/notifications');
  },
  
  markAllNotificationsRead: async () => {
    await api('/notifications/read', 'POST');
  },

  addNotification: async (note: Notification) => {
     // Usually handled by backend triggers or separate endpoint
     console.warn("Client side notification add not fully implemented in API yet");
  },

  // --- Export ---
  exportData: async () => {
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

  // --- Biometrics ---
  registerDeviceForBiometrics: async (userId: string, credentialId: string) => {
     await db.updateUser({ id: userId, biometricCredentialId: credentialId } as any);
  },
  
  authenticateWithDeviceToken: async (credentialId: string): Promise<User | null> => {
     // In a real scenario, the backend should verify the signature. 
     // For this level of implementation, we find the user by credential ID.
     // Since our API currently doesn't search by cred ID specifically, we filter users.
     const users = await db.getUsers();
     const user = users.find(u => u.biometricCredentialId === credentialId);
     return user || null;
  }
};
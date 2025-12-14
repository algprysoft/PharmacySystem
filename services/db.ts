
import { Drug, User, UserRole, Notification } from '../types';

// Keys for LocalStorage
const KEYS = {
  USERS: 'pharma_users',
  DRUGS: 'pharma_drugs',
  NOTIFICATIONS: 'pharma_notifications',
  SETTINGS: 'pharma_settings'
};

// Seed initial admin if not exists
const seedData = () => {
  if (!localStorage.getItem(KEYS.USERS)) {
    const admin: User = {
      id: 'admin-1',
      username: 'root',
      email: 'admin@pharma.com',
      fullName: 'المدير العام',
      role: UserRole.ADMIN,
      phone: '966500000000'
    };
    // Store password inside the object for this local-only demo
    localStorage.setItem(KEYS.USERS, JSON.stringify([{ ...admin, password: 'root1' }]));
    
    // Seed initial notifications
    const welcomeNote: Notification = {
      id: 'note-1',
      title: 'مرحباً بك في PharmaEye',
      message: 'تم تثبيت النظام بنجاح. يمكنك الآن البدء بإضافة الأدوية.',
      read: false,
      date: Date.now()
    };
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([welcomeNote]));
  }
  if (!localStorage.getItem(KEYS.DRUGS)) {
    localStorage.setItem(KEYS.DRUGS, JSON.stringify([]));
  }
};

seedData();

export const db = {
  // --- User Operations ---
  getUsers: (): any[] => JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'),
  
  addUser: (user: any) => {
    const users = db.getUsers();
    if (users.some((u: any) => u.username === user.username || u.email === user.email)) {
      throw new Error('اسم المستخدم أو البريد الإلكتروني موجود مسبقاً');
    }
    users.push(user);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  updateUser: (updatedUser: Partial<User> & { id: string, password?: string }) => {
    const users = db.getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    
    if (index !== -1) {
      // Check for duplicate username/email if they are being changed
      if (updatedUser.username || updatedUser.email) {
          const duplicate = users.find((u: any) => 
            u.id !== updatedUser.id && 
            ((updatedUser.username && u.username === updatedUser.username) || 
             (updatedUser.email && u.email === updatedUser.email))
          );
          if (duplicate) {
              throw new Error('اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل من قبل شخص آخر');
          }
      }

      const mergedUser = { ...users[index], ...updatedUser };
      // Remove empty password field if not provided
      if (!updatedUser.password) {
        mergedUser.password = users[index].password;
      }

      users[index] = mergedUser;
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      
      const { password, ...safeUser } = mergedUser;
      return safeUser as User;
    }
    return null;
  },

  deleteUser: (id: string) => {
    const users = db.getUsers();
    // Prevent deleting the last admin
    const userToDelete = users.find((u:any) => u.id === id);
    if (userToDelete?.username === 'root') {
        throw new Error('لا يمكن حذف المدير الرئيسي');
    }
    const filtered = users.filter((u: any) => u.id !== id);
    localStorage.setItem(KEYS.USERS, JSON.stringify(filtered));
  },

  authenticate: (identifier: string, pass: string): User | null => {
    const users = db.getUsers();
    const user = users.find((u: any) => (u.username === identifier || u.email === identifier) && u.password === pass);
    if (user) {
      const { password, ...safeUser } = user;
      return safeUser as User;
    }
    return null;
  },

  // --- Biometrics Operations ---
  registerDeviceForBiometrics: (userId: string, credentialId: string) => {
    const users = db.getUsers();
    const index = users.findIndex((u: any) => u.id === userId);
    if (index !== -1) {
        users[index] = { ...users[index], biometricCredentialId: credentialId };
        localStorage.setItem(KEYS.USERS, JSON.stringify(users));
        // Save local marker for this device to allow login
        localStorage.setItem('pharma_bio_cred_id', credentialId);
    }
  },

  authenticateWithDeviceToken: (credentialId: string): User | null => {
      if (!credentialId) return null;
      const users = db.getUsers();
      const user = users.find((u: any) => u.biometricCredentialId === credentialId);
      if (user) {
          const { password, ...safeUser } = user;
          return safeUser as User;
      }
      return null;
  },

  // --- Drug Operations ---
  getDrugs: (): Drug[] => JSON.parse(localStorage.getItem(KEYS.DRUGS) || '[]'),
  
  addDrug: (drug: Drug) => {
    const drugs = db.getDrugs();
    drugs.push(drug);
    localStorage.setItem(KEYS.DRUGS, JSON.stringify(drugs));
  },
  
  addDrugsBatch: (newDrugs: Drug[]) => {
    const drugs = db.getDrugs();
    localStorage.setItem(KEYS.DRUGS, JSON.stringify([...drugs, ...newDrugs]));
  },
  
  updateDrug: (id: string, updates: Partial<Drug>) => {
    const drugs = db.getDrugs();
    const idx = drugs.findIndex(d => d.id === id);
    if (idx !== -1) {
      drugs[idx] = { ...drugs[idx], ...updates };
      localStorage.setItem(KEYS.DRUGS, JSON.stringify(drugs));
    }
  },
  
  deleteDrug: (id: string) => {
    const drugs = db.getDrugs();
    const filtered = drugs.filter(d => d.id !== id);
    localStorage.setItem(KEYS.DRUGS, JSON.stringify(filtered));
  },

  // --- Notifications ---
  getNotifications: (): Notification[] => {
      const notes = JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS) || '[]');
      return notes.sort((a: Notification, b: Notification) => b.date - a.date);
  },
  
  markAllNotificationsRead: () => {
    const notes = db.getNotifications();
    const updated = notes.map(n => ({...n, read: true}));
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(updated));
  },

  addNotification: (note: Notification) => {
    const notes = db.getNotifications();
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([note, ...notes]));
  },

  // --- Backup Feature ---
  exportData: () => {
      const data = {
          users: JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'),
          drugs: JSON.parse(localStorage.getItem(KEYS.DRUGS) || '[]'),
          timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pharma_eye_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
  }
};
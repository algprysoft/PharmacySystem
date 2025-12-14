
export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE'
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  // Biometric
  biometricCredentialId?: string;
  avatar?: string;
  phone?: string;
  password?: string; // Optional in type for UI handling, though usually kept safe
}

export interface Drug {
  id: string;
  agentName: string;      // اسم الوكيل
  manufacturer: string;   // الشركة المصنعة
  tradeName: string;      // الإسم التجاري
  publicPrice: number;    // السعر للجمهور
  agentPrice: number;     // سعر الوكيل
  priceBeforeDiscount: number; // السعر قبل التخفيض
  discountPercent: number; // نسبة التخفيض
  addedBy: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  date: number;
}

export interface AppState {
  currentUser: User | null;
  isAuthenticated: boolean;
  theme: 'light' | 'dark';
}
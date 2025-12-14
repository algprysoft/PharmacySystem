
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User, UserRole } from '../types';
import { Save, User as UserIcon, Lock, CheckCircle, AlertTriangle, Mail, Key, Download } from 'lucide-react';

export const Settings: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    password: ''
  });
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = () => {
    const sessionStr = sessionStorage.getItem('pharma_session');
    if (sessionStr) {
        const sessionUser = JSON.parse(sessionStr);
        const users = db.getUsers();
        const freshUser = users.find((u: any) => u.id === sessionUser.id);
        if (freshUser) {
            setCurrentUser(freshUser);
            setFormData({
                username: freshUser.username,
                email: freshUser.email,
                fullName: freshUser.fullName,
                phone: freshUser.phone || '',
                password: freshUser.password || ''
            });
        }
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setMessage(null);
    try {
        const updated = db.updateUser({
            id: currentUser.id,
            username: formData.username,
            email: formData.email,
            fullName: formData.fullName,
            phone: formData.phone,
            password: formData.password
        });
        if (updated) {
            sessionStorage.setItem('pharma_session', JSON.stringify(updated));
            setCurrentUser(updated);
            setMessage({ type: 'success', text: 'تم تحديث البيانات بنجاح' });
            setTimeout(() => setMessage(null), 3000);
        }
    } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء التحديث' });
    }
  };

  const handleExport = () => {
      db.exportData();
      setMessage({ type: 'success', text: 'تم تحميل ملف النسخة الاحتياطية بنجاح' });
      setTimeout(() => setMessage(null), 3000);
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      <h1 className="text-2xl font-bold text-gray-800 border-b pb-4">إعدادات الحساب والنظام</h1>
      
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Settings */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center">
                <UserIcon size={20} />
             </div>
             <h2 className="text-xl font-bold text-gray-700">تعديل الملف الشخصي</h2>
           </div>

           <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-600 mb-1">الاسم الكامل</label>
                <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} 
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary-200 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">اسم المستخدم</label>
                <div className="relative">
                     <UserIcon className="absolute right-3 top-3.5 text-gray-400" size={18} />
                     <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} 
                       className="w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-primary-200 outline-none" />
                </div>
              </div>

               <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">البريد الإلكتروني</label>
                <div className="relative">
                     <Mail className="absolute right-3 top-3.5 text-gray-400" size={18} />
                     <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} 
                       className="w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-primary-200 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">رقم الواتساب</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} 
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary-200 outline-none" placeholder="966..." />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">كلمة المرور</label>
                <div className="relative">
                    <Lock className="absolute right-3 top-3.5 text-gray-400" size={18} />
                    <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} 
                    className="w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-primary-200 outline-none" placeholder="لتغييرها فقط..." />
                </div>
              </div>
              
              <div className="md:col-span-2 mt-4">
                <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2">
                    <Save size={18} />
                    حفظ التغييرات
                </button>
              </div>
           </form>
        </div>

        {/* System Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-fit">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                <Key size={20} />
             </div>
             <h2 className="text-xl font-bold text-gray-700">بيانات النظام</h2>
           </div>

           <div className="space-y-4">
             <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-1">الصلاحية الحالية</h3>
                <span className={`px-2 py-1 rounded text-xs font-bold ${currentUser.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-primary-100 text-primary-700'}`}>
                    {currentUser.role === UserRole.ADMIN ? 'مدير النظام (Admin)' : 'موظف صيدلي'}
                </span>
             </div>
             
             <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-2">نسخة احتياطية</h3>
                <p className="text-xs text-blue-700 mb-3">
                    قم بتحميل نسخة كاملة من بيانات الأدوية والمستخدمين كملف JSON.
                </p>
                <button onClick={handleExport} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                    <Download size={16} />
                    تصدير البيانات
                </button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

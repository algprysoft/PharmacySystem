
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User, UserRole } from '../types';
import { Plus, Edit2, Trash2, Shield, User as UserIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const Users: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: UserRole.EMPLOYEE,
    phone: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    refreshUsers();
  }, []);

  const refreshUsers = () => {
    setUsers(db.getUsers());
  };

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.')) {
        try {
            db.deleteUser(id);
            refreshUsers();
        } catch (e: any) {
            alert(e.message);
        }
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      password: user.password, 
      role: user.role,
      phone: user.phone || ''
    });
    setShowModal(true);
    setError('');
  };

  const handleAdd = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      fullName: '',
      email: '',
      password: '',
      role: UserRole.EMPLOYEE,
      phone: ''
    });
    setShowModal(true);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (editingUser) {
        db.updateUser({
          id: editingUser.id,
          ...formData
        });
      } else {
        const newUser = {
          id: uuidv4(),
          ...formData
        };
        db.addUser(newUser);
      }
      setShowModal(false);
      refreshUsers();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ ما');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">إدارة المستخدمين</h1>
           <p className="text-gray-500 text-sm mt-1">إضافة وتعديل صلاحيات الموظفين والمدراء</p>
        </div>
        
        <button 
          onClick={handleAdd}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-bold shadow-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          <span>مستخدم جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-16 h-16 opacity-10 rounded-bl-full ${user.role === UserRole.ADMIN ? 'bg-purple-600' : 'bg-primary-600'}`}></div>
            
            <div className="flex items-start justify-between mb-4">
               <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md ${user.role === UserRole.ADMIN ? 'bg-purple-600' : 'bg-primary-500'}`}>
                    {user.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{user.fullName}</h3>
                    <div className="flex items-center gap-1 text-xs font-medium mt-1">
                      {user.role === UserRole.ADMIN ? (
                        <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Shield size={10} /> مدير
                        </span>
                      ) : (
                        <span className="text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <UserIcon size={10} /> موظف
                        </span>
                      )}
                    </div>
                  </div>
               </div>
               
               {user.username !== 'root' && (
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(user)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(user.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                 </div>
               )}
            </div>

            <div className="space-y-2 text-sm text-gray-500 border-t border-gray-50 pt-4">
              <div className="flex justify-between">
                <span>اسم المستخدم:</span>
                <span className="font-mono text-gray-700 font-bold">{user.username}</span>
              </div>
              <div className="flex justify-between">
                <span>البريد الإلكتروني:</span>
                <span className="text-gray-700">{user.email}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-gray-800">
                {editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-100">{error}</div>}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">الاسم الكامل</label>
                  <input required className="w-full p-2.5 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none" 
                    value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                </div>
                 <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">الصلاحية</label>
                  <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:border-primary-500 outline-none bg-white"
                    value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}>
                    <option value={UserRole.EMPLOYEE}>موظف (صيدلي)</option>
                    <option value={UserRole.ADMIN}>مدير (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">اسم المستخدم (للدخول)</label>
                <input required className="w-full p-2.5 border border-gray-200 rounded-lg focus:border-primary-500 outline-none" 
                  value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">البريد الإلكتروني</label>
                <input type="email" required className="w-full p-2.5 border border-gray-200 rounded-lg focus:border-primary-500 outline-none" 
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              
               <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">رقم الهاتف (واتساب)</label>
                <input type="tel" className="w-full p-2.5 border border-gray-200 rounded-lg focus:border-primary-500 outline-none" 
                  value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="966..." />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">كلمة المرور</label>
                <input type="text" required={!editingUser} className="w-full p-2.5 border border-gray-200 rounded-lg focus:border-primary-500 outline-none" 
                  value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={editingUser ? "اتركه فارغاً إذا لم ترد التغيير" : ""} />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button type="submit" className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 shadow-md transition-transform hover:scale-[1.01]">حفظ المستخدم</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

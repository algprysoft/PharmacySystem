import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Inventory } from './pages/Inventory';
import { OcrUpload } from './pages/OcrUpload';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';
import { ImportData } from './pages/ImportData';
import { User } from './types';
import { db } from './services/db';
import { Lock, User as UserIcon, Loader, AlertTriangle, Cloud, CloudOff } from 'lucide-react';

// --- Login Page Component ---
const LoginPage = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    
    try {
      const user = await db.authenticate(identifier, password);
      if (user) {
        onLogin(user);
      } else {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch (e) {
      setError('حدث خطأ أثناء الاتصال');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md animate-scale-up border border-gray-100 relative">
        {/* Connection Status Indicator */}
        <div className={`absolute top-4 left-4 p-2 rounded-full ${db.isCloud ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`} title={db.isCloud ? "متصل بقاعدة البيانات السحابية" : "وضع التخزين المحلي"}>
             {db.isCloud ? <Cloud size={20} /> : <CloudOff size={20} />}
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-xl mx-auto flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">P</div>
          <h2 className="text-2xl font-bold text-gray-800">تسجيل الدخول</h2>
          <p className="text-gray-500">أدخل بياناتك للوصول للنظام</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">اسم المستخدم / البريد الإلكتروني</label>
             <div className="relative">
               <UserIcon className="absolute right-3 top-3.5 text-gray-400" size={20} />
               <input 
                 type="text" 
                 value={identifier}
                 onChange={e => setIdentifier(e.target.value)}
                 className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                 placeholder="username"
                 required
               />
             </div>
          </div>
          <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور</label>
             <div className="relative">
               <Lock className="absolute right-3 top-3.5 text-gray-400" size={20} />
               <input 
                 type="password" 
                 value={password}
                 onChange={e => setPassword(e.target.value)}
                 className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                 placeholder="••••••"
                 required
               />
             </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoggingIn}
            className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 shadow-lg transition-transform hover:scale-[1.02] flex justify-center items-center gap-2"
          >
            {isLoggingIn && <Loader className="animate-spin" size={20} />}
            <span>{isLoggingIn ? 'جاري التحقق...' : 'دخول للنظام'}</span>
          </button>
        </form>
        
        <div className="mt-6 text-center text-xs text-gray-400">
             PharmaEye System v1.1 | {db.isCloud ? 'Cloud Mode' : 'Offline Mode'}
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for persisted session
    const session = sessionStorage.getItem('pharma_session');
    if (session) {
      setUser(JSON.parse(session));
    }
    setLoading(false);
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    sessionStorage.setItem('pharma_session', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('pharma_session');
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader className="animate-spin text-primary-600" size={40} /></div>;

  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={!user ? <Landing /> : <Navigate to="/dashboard" />} />
        <Route path="/login" element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/dashboard" />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={user ? <Layout user={user} onLogout={handleLogout}><div className="text-center mt-20 text-gray-400 animate-fade-in"><h1 className="text-3xl font-bold mb-4">مرحباً {user.fullName}</h1><p>اختر من القائمة الجانبية للبدء</p></div></Layout> : <Navigate to="/login" />} />
        
        <Route path="/ocr" element={user ? <Layout user={user} onLogout={handleLogout}><OcrUpload /></Layout> : <Navigate to="/login" />} />
        
        <Route path="/inventory" element={user ? <Layout user={user} onLogout={handleLogout}><Inventory /></Layout> : <Navigate to="/login" />} />

        <Route path="/import" element={user ? <Layout user={user} onLogout={handleLogout}><ImportData /></Layout> : <Navigate to="/login" />} />
        
        <Route path="/users" element={user ? <Layout user={user} onLogout={handleLogout}><Users /></Layout> : <Navigate to="/login" />} />
        
        <Route path="/settings" element={user ? <Layout user={user} onLogout={handleLogout}><Settings /></Layout> : <Navigate to="/login" />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
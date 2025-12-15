import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Scan, 
  Pill, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  Bell,
  WifiOff,
  X,
  Database,
  Upload
} from 'lucide-react';
import { User, UserRole, Notification } from '../types';
import { db } from '../services/db';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Notification State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    
    // Initial fetch
    fetchNotifications();

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchNotifications = async () => {
      try {
          const data = await db.getNotifications();
          setNotifications(data);
      } catch (e) {
          console.error(e);
      }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    await db.markAllNotificationsRead();
    fetchNotifications();
  };

  if (!user) return <>{children}</>;

  const menuItems = [
    { label: 'لوحة التحكم', icon: LayoutDashboard, path: '/dashboard', roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
    { label: 'استخراج ذكي (OCR)', icon: Scan, path: '/ocr', roles: [UserRole.ADMIN] },
    { label: 'المخزون والادوية', icon: Pill, path: '/inventory', roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
    { label: 'استيراد وتصدير', icon: Upload, path: '/import', roles: [UserRole.ADMIN] },
    { label: 'المستخدمين', icon: Users, path: '/users', roles: [UserRole.ADMIN] },
    { label: 'الإعدادات', icon: Settings, path: '/settings', roles: [UserRole.ADMIN, UserRole.EMPLOYEE] },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden relative dir-rtl">
      
      {/* Mobile Overlay (Backdrop) */}
      <div 
        className={`fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 right-0 z-50 h-full bg-primary-900 text-white shadow-2xl 
          transition-all duration-300 ease-in-out
          md:relative md:translate-x-0
          ${/* Mobile: Slide in/out logic */ ''}
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'} 
          ${/* Desktop: Expand/Collapse width logic */ ''}
          ${isSidebarOpen ? 'w-64' : 'w-64 md:w-20'} 
        `}
      >
        <div className="p-4 flex items-center justify-between border-b border-primary-700 h-16">
          <div className={`flex items-center gap-3 ${!isSidebarOpen && 'md:justify-center w-full'} overflow-hidden whitespace-nowrap`}>
            <div className="w-10 h-10 min-w-[2.5rem] bg-white rounded-lg flex items-center justify-center text-primary-600 font-bold text-xl shadow-lg shrink-0">
              P
            </div>
            {(isSidebarOpen) && (
              <div className="transition-opacity duration-300 animate-fade-in overflow-hidden">
                <h1 className="font-bold text-lg leading-tight truncate">PharmaEye</h1>
                <p className="text-xs text-primary-200 truncate">نظام صيدلي ذكي</p>
              </div>
            )}
          </div>
          {/* Close Button (Mobile Only) */}
          <button 
            className="md:hidden text-primary-200 hover:text-white"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 py-6 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-2 px-2">
            {menuItems.filter(item => item.roles.includes(user.role)).map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => handleNavClick(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    location.pathname === item.path 
                      ? 'bg-white text-primary-900 shadow-md font-bold' 
                      : 'text-primary-100 hover:bg-primary-800'
                  } ${!isSidebarOpen && 'md:justify-center'}`}
                  title={!isSidebarOpen ? item.label : ''}
                >
                  <item.icon size={22} className="min-w-[22px] shrink-0" />
                  {isSidebarOpen && <span className="whitespace-nowrap transition-opacity duration-300 animate-fade-in">{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-primary-700">
          <button 
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 text-red-300 hover:bg-red-900/30 rounded-lg transition-colors ${!isSidebarOpen && 'md:justify-center'}`}
          >
            <LogOut size={20} className="min-w-[20px] shrink-0" />
            {isSidebarOpen && <span className="whitespace-nowrap transition-opacity duration-300 animate-fade-in">تسجيل خروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative z-0">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 md:px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 focus:outline-none"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 truncate">
              {menuItems.find(i => i.path === location.pathname)?.label || 'الرئيسية'}
            </h2>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {!isOnline && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                <WifiOff size={16} />
                <span>غير متصل</span>
              </div>
            )}

            {/* DB Status Indicator (Small) */}
             <div className={`hidden md:flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${db.isCloud ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`} title={db.isCloud ? "قاعدة بيانات سحابية" : "تخزين محلي"}>
                <Database size={14} />
                <span>{db.isCloud ? 'Cloud' : 'Local'}</span>
            </div>
            
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute left-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fade-in origin-top-left">
                  <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700">الإشعارات ({unreadCount})</h3>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-primary-600 hover:underline">
                        تحديد الكل كمقروء
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-400">لا توجد إشعارات حالياً</div>
                    ) : (
                      notifications.map(note => (
                        <div key={note.id} className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!note.read ? 'bg-blue-50/50' : ''}`}>
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`text-sm ${!note.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{note.title}</h4>
                            <span className="text-[10px] text-gray-400">{new Date(note.date).toLocaleDateString('ar-EG')}</span>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">{note.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3 ps-3 md:ps-4 border-s border-gray-200">
              <div className="text-left hidden md:block">
                <p className="text-sm font-bold text-gray-800">{user.fullName}</p>
                <p className="text-xs text-gray-500">{user.role === UserRole.ADMIN ? 'مدير النظام' : 'صيدلي'}</p>
              </div>
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border-2 border-primary-200">
                {user.fullName.charAt(0)}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 md:p-6 w-full flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
};
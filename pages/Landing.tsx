import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, ShieldCheck, Zap, Database } from 'lucide-react';

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white text-gray-800 dir-rtl">
      {/* Navbar */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg">
            P
          </div>
          <span className="text-2xl font-bold text-primary-900">PharmaEye</span>
        </div>
        <button 
          onClick={() => navigate('/login')}
          className="px-6 py-2 bg-primary-600 text-white rounded-full font-bold shadow-lg hover:bg-primary-700 transition-transform transform hover:scale-105"
        >
          تسجيل الدخول
        </button>
      </nav>

      {/* Hero Section */}
      <header className="container mx-auto px-6 py-16 md:py-24 flex flex-col-reverse md:flex-row items-center gap-12">
        <div className="flex-1 space-y-8 text-center md:text-right">
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight">
            المستقبل في إدارة <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-primary-500 to-primary-800">
              الصيدليات الذكية
            </span>
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto md:mx-0">
            نظام متكامل يعمل بلا إنترنت، مدعوم بأقوى تقنيات الذكاء الاصطناعي لاستخراج بيانات الأدوية من الصور والفواتير بدقة متناهية.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <button 
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-primary-600 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl hover:bg-primary-700 transition-all flex items-center justify-center gap-3"
            >
              <Zap className="fill-current" />
              ابدأ الآن مجاناً
            </button>
            <button className="px-8 py-4 bg-white text-primary-700 border-2 border-primary-100 rounded-xl font-bold text-lg hover:bg-primary-50 transition-all">
              تعرف على المزيد
            </button>
          </div>
        </div>
        <div className="flex-1 relative">
           {/* Abstract Decoration */}
           <div className="absolute top-0 right-0 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
           <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
           <img 
            src="https://picsum.photos/800/600" 
            alt="Dashboard Preview" 
            className="relative rounded-2xl shadow-2xl border-4 border-white transform rotate-2 hover:rotate-0 transition-all duration-500"
          />
        </div>
      </header>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">لماذا PharmaEye؟</h2>
            <p className="text-gray-500 text-lg">مميزات صممت خصيصاً لتلبية احتياجات الصيدلي العصري</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                icon: Scan,
                title: "OCR عالي الدقة",
                desc: "استخراج بيانات الأدوية من الصور والفواتير المعقدة بدقة 100%، عربي وإنجليزي."
              },
              {
                icon: Database,
                title: "يعمل بلا إنترنت",
                desc: "نظام Offline-First يضمن استمرار العمل حتى عند انقطاع الشبكة تماماً."
              },
              {
                icon: ShieldCheck,
                title: "أمان وموثوقية",
                desc: "دعم للبصمة البيومترية، وصلاحيات متقدمة للمدراء والموظفين."
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-gray-50 p-8 rounded-2xl hover:bg-primary-50 transition-colors group cursor-default">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary-600 shadow-md mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-6 text-center">
          <p>© 2024 PharmaEye. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
};

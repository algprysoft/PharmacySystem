import React, { useState, useRef } from 'react';
import { extractDrugData } from '../services/geminiService';
import { db } from '../services/db';
import { Drug } from '../types';
import { Upload, FileText, Check, AlertCircle, Loader2, Save, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const OcrUpload: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setExtractedData([]); // Reset previous data
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    if (!image) return;
    if (!navigator.onLine) {
        setError("عذراً، هذه الميزة تتطلب اتصالاً بالإنترنت للوصول إلى محركات الذكاء الاصطناعي.");
        return;
    }

    setLoading(true);
    setError(null);
    try {
      // Remove data:image/jpeg;base64, prefix
      const base64Data = image.split(',')[1];
      const data = await extractDrugData(base64Data);
      
      // Add temporary IDs for the UI
      const processed = data.map(item => ({
        ...item,
        tempId: uuidv4()
      }));
      
      setExtractedData(processed);
    } catch (err) {
      setError("فشل في استخراج البيانات. الرجاء التأكد من وضوح الصورة والمحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const saveToInventory = () => {
    const drugs: Drug[] = extractedData.map(item => ({
      id: uuidv4(),
      agentName: item.agentName || 'غير محدد',
      manufacturer: item.manufacturer || 'غير محدد',
      tradeName: item.tradeName || 'منتج جديد',
      publicPrice: Number(item.publicPrice) || 0,
      agentPrice: Number(item.agentPrice) || 0,
      priceBeforeDiscount: Number(item.priceBeforeDiscount) || 0,
      discountPercent: Number(item.discountPercent) || 0,
      addedBy: 'OCR System',
      createdAt: Date.now()
    }));

    db.addDrugsBatch(drugs);
    alert('تم حفظ البيانات بنجاح في المخزون!');
    setExtractedData([]);
    setImage(null);
  };

  const removeRow = (tempId: string) => {
    setExtractedData(prev => prev.filter(item => item.tempId !== tempId));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">الاستخراج الذكي للبيانات (OCR)</h1>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            تأكد من اتصال الإنترنت لهذه الميزة
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upload & Preview */}
        <div className="lg:col-span-1 space-y-4">
          <div 
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
              image ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
            }`}
          >
            {image ? (
              <div className="relative w-full">
                <img src={image} alt="Preview" className="w-full h-auto rounded-lg shadow-sm" />
                <button 
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer w-full">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">اضغط لرفع ملف أو صورة</p>
                <p className="text-xs text-gray-400 mt-1">يدعم JPG, PNG (صور فواتير، قوائم أدوية)</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <button
            onClick={processImage}
            disabled={!image || loading}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${
              !image || loading 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-primary-600 text-white hover:bg-primary-700 hover:scale-[1.02]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                جاري التحليل بالذكاء الاصطناعي...
              </>
            ) : (
              <>
                <FileText />
                استخراج البيانات
              </>
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Results Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
            <h3 className="font-bold text-gray-700">البيانات المستخرجة ({extractedData.length})</h3>
            {extractedData.length > 0 && (
              <button 
                onClick={saveToInventory}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 flex items-center gap-2"
              >
                <Save size={16} />
                حفظ للمخزون
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-auto p-0">
            {extractedData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>لا توجد بيانات مستخرجة بعد</p>
              </div>
            ) : (
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="p-3 bg-gray-50">الإسم التجاري</th>
                    <th className="p-3 bg-gray-50">الوكيل</th>
                    <th className="p-3 bg-gray-50">المصنع</th>
                    <th className="p-3 bg-gray-50">سعر الجمهور</th>
                    <th className="p-3 bg-gray-50">سعر الوكيل</th>
                    <th className="p-3 bg-gray-50">قبل التخفيض</th>
                    <th className="p-3 bg-gray-50">الخصم %</th>
                    <th className="p-3 bg-gray-50">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {extractedData.map((row) => (
                    <tr key={row.tempId} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-bold text-primary-900">{row.tradeName || '-'}</td>
                      <td className="p-3">{row.agentName || '-'}</td>
                      <td className="p-3">{row.manufacturer || '-'}</td>
                      <td className="p-3 font-mono">{row.publicPrice} <span className="text-xs text-gray-400">ريال</span></td>
                      <td className="p-3 font-mono">{row.agentPrice} <span className="text-xs text-gray-400">ريال</span></td>
                      <td className="p-3 font-mono text-gray-500">{row.priceBeforeDiscount}</td>
                      <td className="p-3 text-green-600 font-bold">{row.discountPercent}%</td>
                      <td className="p-3">
                        <button 
                          onClick={() => removeRow(row.tempId)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
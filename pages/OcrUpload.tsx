import React, { useState, useRef, useEffect } from 'react';
import { extractDrugData } from '../services/geminiService';
import { db } from '../services/db';
import { Drug } from '../types';
import { 
  FileText, 
  Loader2, 
  Save, 
  X, 
  Trash2, 
  Plus, 
  CheckCircle, 
  AlertTriangle,
  ScanLine,
  Files,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

interface QueueItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  message?: string;
}

export const OcrUpload: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stopSignal, setStopSignal] = useState(false);
  
  // Stats
  const completedCount = queue.filter(q => q.status === 'success').length;
  const errorCount = queue.filter(q => q.status === 'error').length;
  const progress = queue.length > 0 ? Math.round((completedCount + errorCount) / queue.length * 100) : 0;

  // Ref for auto-scrolling
  const resultsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: generateId(),
        file,
        status: 'pending' as const
      }));
      setQueue(prev => [...prev, ...newFiles]);
    }
    // Reset input so same files can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeQueueItem = (id: string) => {
    if (isProcessing) return; // Prevent removal during processing
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    if (isProcessing) return;
    setQueue([]);
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processQueue = async () => {
    if (!navigator.onLine) {
        alert('لا يوجد اتصال بالإنترنت');
        return;
    }

    setIsProcessing(true);
    setStopSignal(false);

    // Filter pending items
    const pendingItems = queue.filter(item => item.status === 'pending' || item.status === 'error');

    for (const item of pendingItems) {
      if (stopSignal) break; // Check for stop signal

      // Update UI to processing current item
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));

      try {
        const base64Data = await convertFileToBase64(item.file);
        const mimeType = item.file.type || (item.file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        
        const rawData = await extractDrugData(base64Data, mimeType);
        
        if (!rawData || rawData.length === 0) {
           throw new Error("لم يتم العثور على بيانات");
        }

        const processedRows = rawData.map((d: any) => ({
           ...d,
           tempId: generateId(),
           sourceFile: item.file.name, // Track source
           tradeName: d.tradeName || d.ItemName || d.name || 'غير معروف',
           agentName: d.agentName || '-',
           manufacturer: d.manufacturer || '-',
           publicPrice: parseFloat(d.publicPrice) || 0,
           agentPrice: parseFloat(d.agentPrice) || 0,
           priceBeforeDiscount: parseFloat(d.priceBeforeDiscount) || parseFloat(d.publicPrice) || 0,
           discountPercent: parseFloat(d.discountPercent) || 0
        }));

        setExtractedData(prev => [...prev, ...processedRows]);
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));

      } catch (error: any) {
        console.error(`Error processing ${item.file.name}:`, error);
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', message: error.message || 'فشل المعالجة' } : q));
      }
      
      // Small delay to prevent freezing UI and give API breathing room
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsProcessing(false);
  };

  const stopProcessing = () => {
    setStopSignal(true);
    setIsProcessing(false);
  };

  const saveToInventory = async () => {
    if (extractedData.length === 0) return;

    const drugs: Drug[] = extractedData.map(item => ({
      id: generateId(),
      agentName: item.agentName,
      manufacturer: item.manufacturer,
      tradeName: item.tradeName,
      publicPrice: item.publicPrice,
      agentPrice: item.agentPrice,
      priceBeforeDiscount: item.priceBeforeDiscount || item.publicPrice,
      discountPercent: item.discountPercent,
      addedBy: 'OCR Batch',
      createdAt: Date.now()
    }));

    await db.addDrugsBatch(drugs);
    alert('تم حفظ جميع البيانات في المخزون بنجاح!');
    setExtractedData([]);
    // Optionally clear successful items from queue
    setQueue(prev => prev.filter(q => q.status !== 'success'));
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-[600px] gap-6">
      
      {/* Header Area */}
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ScanLine className="text-primary-600" />
            المعالجة الجماعية (Bulk OCR)
          </h1>
          <p className="text-gray-500 mt-1">يمكنك رفع مئات الملفات وسيتم معالجتها تلقائياً</p>
        </div>
        
        <div className="flex gap-3">
             {/* Progress Indicator */}
             {queue.length > 0 && (
                 <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                    <div className="text-sm font-bold text-gray-600">
                        {completedCount} / {queue.length} ملفات
                    </div>
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-300 ${errorCount > 0 ? 'bg-orange-500' : 'bg-primary-500'}`} 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    {isProcessing && <Loader2 size={16} className="animate-spin text-primary-600" />}
                 </div>
             )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Left Panel: Queue Manager */}
        <div className="lg:col-span-4 flex flex-col gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
          {/* Controls */}
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Files size={18} />
                قائمة الملفات
            </h3>
            <div className="flex gap-2">
                <input 
                   ref={fileInputRef}
                   type="file" 
                   multiple // ENABLE MULTIPLE FILES
                   accept="image/*,application/pdf"
                   onChange={handleFileChange}
                   className="hidden"
                   id="bulk-upload"
                   disabled={isProcessing}
                 />
                 <label htmlFor="bulk-upload" className={`p-2 rounded-lg cursor-pointer transition-colors ${isProcessing ? 'bg-gray-200 text-gray-400' : 'bg-white text-primary-600 border border-primary-200 hover:bg-primary-50'}`}>
                    <Plus size={20} />
                 </label>
                 {queue.length > 0 && !isProcessing && (
                    <button onClick={clearQueue} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={20} />
                    </button>
                 )}
            </div>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
             {queue.length === 0 ? (
                 <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl m-2">
                     <Files size={48} className="mb-4 opacity-50" />
                     <p className="font-bold">القائمة فارغة</p>
                     <p className="text-sm mt-2">اضغط على + لإضافة ملفات (PDF أو صور)</p>
                     <p className="text-xs mt-1">يدعم التحديد المتعدد</p>
                 </div>
             ) : (
                 queue.map((item, idx) => (
                     <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                        <div className="font-mono text-xs text-gray-400 w-6">{idx + 1}</div>
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary-600 border border-gray-100 shrink-0">
                            {item.status === 'processing' ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-700 truncate dir-ltr text-right">{item.file.name}</p>
                            <p className={`text-xs ${
                                item.status === 'success' ? 'text-green-600' : 
                                item.status === 'error' ? 'text-red-500' : 
                                item.status === 'processing' ? 'text-blue-600' : 'text-gray-400'
                            }`}>
                                {item.status === 'pending' && 'في الانتظار'}
                                {item.status === 'processing' && 'جاري المعالجة...'}
                                {item.status === 'success' && 'تم بنجاح'}
                                {item.status === 'error' && (item.message || 'فشل')}
                            </p>
                        </div>
                        {item.status === 'success' ? (
                            <CheckCircle size={18} className="text-green-500" />
                        ) : item.status === 'error' ? (
                            <AlertTriangle size={18} className="text-red-500" />
                        ) : (
                            <button onClick={() => removeQueueItem(item.id)} disabled={isProcessing} className="text-gray-300 hover:text-red-500 disabled:opacity-0">
                                <X size={18} />
                            </button>
                        )}
                     </div>
                 ))
             )}
          </div>

          {/* Action Button */}
          <div className="p-4 border-t border-gray-100">
             {!isProcessing ? (
                 <button
                    onClick={processQueue}
                    disabled={queue.length === 0 || queue.every(i => i.status === 'success')}
                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        queue.length === 0 ? 'bg-gray-100 text-gray-400' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg'
                    }`}
                 >
                    <Play size={20} className="fill-current" />
                    {queue.some(i => i.status === 'success' || i.status === 'error') ? 'متابعة المعالجة' : 'بدء المعالجة الجماعية'}
                 </button>
             ) : (
                 <button
                    onClick={stopProcessing}
                    className="w-full py-3 rounded-xl font-bold bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center gap-2 border border-red-200"
                 >
                    <Pause size={20} className="fill-current" />
                    إيقاف مؤقت
                 </button>
             )}
          </div>
        </div>

        {/* Right Panel: Results Table */}
        <div ref={resultsRef} className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
           <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-primary-600 shadow-sm font-bold border border-gray-100">
                  {extractedData.length}
                </div>
                <span className="font-bold text-gray-700">الأصناف المستخرجة</span>
              </div>
              
              {extractedData.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => setExtractedData([])} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="مسح الجدول">
                    <Trash2 size={20} />
                  </button>
                  <button onClick={saveToInventory} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center gap-2">
                    <Save size={18} />
                    حفظ للمخزون
                  </button>
                </div>
              )}
           </div>

           <div className="flex-1 overflow-auto">
             {extractedData.length === 0 ? (
               <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-300">
                 <RefreshCw size={64} className="mb-4 opacity-20" />
                 <p className="font-medium">ابدأ المعالجة لتظهر النتائج هنا</p>
                 <p className="text-sm mt-2 opacity-60">سيتم تجميع النتائج من جميع الملفات في جدول واحد</p>
               </div>
             ) : (
               <table className="w-full text-sm text-right min-w-[900px]">
                 <thead className="bg-gray-50 text-gray-600 font-bold sticky top-0 shadow-sm z-10">
                   <tr>
                     <th className="p-4 border-b">المصدر</th>
                     <th className="p-4 border-b">اسم الصنف</th>
                     <th className="p-4 border-b">الوكيل</th>
                     <th className="p-4 border-b">سعر الجمهور</th>
                     <th className="p-4 border-b">سعر الصيدلي</th>
                     <th className="p-4 border-b">خصم %</th>
                     <th className="p-4 border-b"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {extractedData.map((row) => (
                     <tr key={row.tempId} className="hover:bg-blue-50/50 transition-colors group">
                       <td className="p-4 text-xs text-gray-400 max-w-[150px] truncate dir-ltr text-right" title={row.sourceFile}>{row.sourceFile}</td>
                       <td className="p-4 font-bold text-gray-800">{row.tradeName}</td>
                       <td className="p-4 text-gray-500">{row.agentName}</td>
                       <td className="p-4 font-mono whitespace-nowrap">{row.publicPrice}</td>
                       <td className="p-4 font-mono text-gray-600 whitespace-nowrap">{row.agentPrice}</td>
                       <td className="p-4 text-green-600 font-bold">{row.discountPercent}%</td>
                       <td className="p-4 text-left">
                         <button 
                           onClick={() => setExtractedData(prev => prev.filter(i => i.tempId !== row.tempId))}
                           className="text-gray-300 hover:text-red-500 transition-colors"
                         >
                           <X size={18} />
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
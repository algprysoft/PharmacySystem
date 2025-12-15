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
  Image as ImageIcon, 
  CheckCircle, 
  AlertTriangle,
  ScanLine
} from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

interface SingleFile {
  file: File;
  preview: string | null;
}

export const OcrUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<SingleFile | null>(null);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'error' | 'success' | 'info', text: string} | null>(null);
  
  // Ref for auto-scrolling to results
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile({
        file: file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      });
      setStatusMessage(null);
    }
    e.target.value = '';
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setStatusMessage(null);
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

  const processFile = async () => {
    if (!selectedFile) return;
    if (!navigator.onLine) {
        setStatusMessage({ type: 'error', text: 'لا يوجد اتصال بالإنترنت' });
        return;
    }

    setIsProcessing(true);
    setStatusMessage({ type: 'info', text: 'جاري تحليل الصورة واستخراج البيانات...' });

    try {
      const base64Data = await convertFileToBase64(selectedFile.file);
      const mimeType = selectedFile.file.type || (selectedFile.file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      
      const rawData = await extractDrugData(base64Data, mimeType);
      
      if (!rawData || rawData.length === 0) {
         setStatusMessage({ type: 'error', text: 'لم يتم العثور على أي بيانات أدوية في هذا الملف. حاول بصورة أوضح.' });
         setIsProcessing(false);
         return;
      }

      const processedRows = rawData.map((item: any) => ({
         ...item,
         tempId: generateId(),
         tradeName: item.tradeName || item.ItemName || item.name || 'غير معروف',
         agentName: item.agentName || '-',
         manufacturer: item.manufacturer || '-',
         publicPrice: parseFloat(item.publicPrice) || 0,
         agentPrice: parseFloat(item.agentPrice) || 0,
         priceBeforeDiscount: parseFloat(item.priceBeforeDiscount) || parseFloat(item.publicPrice) || 0,
         discountPercent: parseFloat(item.discountPercent) || 0
      }));

      setExtractedData(prev => [...prev, ...processedRows]);
      setStatusMessage({ type: 'success', text: `تم استخراج ${processedRows.length} صنف بنجاح!` });
      setSelectedFile(null);
      
      // Auto-scroll to results on mobile
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (error) {
      console.error(error);
      setStatusMessage({ type: 'error', text: 'حدث خطأ أثناء المعالجة. تأكد من مفتاح API أو جودة الصورة.' });
    } finally {
      setIsProcessing(false);
    }
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
      addedBy: 'OCR System',
      createdAt: Date.now()
    }));

    await db.addDrugsBatch(drugs);
    setStatusMessage({ type: 'success', text: 'تم حفظ جميع البيانات في المخزون' });
    setExtractedData([]);
  };

  return (
    <div className="flex flex-col lg:h-[calc(100vh-100px)] h-auto gap-6 pb-10 lg:pb-0">
      
      {/* Header Area */}
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ScanLine className="text-primary-600" />
            الماسح الذكي (OCR)
          </h1>
          <p className="text-gray-500 mt-1">قم برفع فاتورة أو صورة أدوية لاستخراج البيانات تلقائياً</p>
        </div>
        
        {/* Status Alert */}
        {statusMessage && (
          <div className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 animate-fade-in ${
            statusMessage.type === 'error' ? 'bg-red-100 text-red-700' : 
            statusMessage.type === 'success' ? 'bg-green-100 text-green-700' : 
            'bg-blue-100 text-blue-700'
          }`}>
            {statusMessage.type === 'error' && <AlertTriangle size={16} />}
            {statusMessage.type === 'success' && <CheckCircle size={16} />}
            {statusMessage.type === 'info' && <Loader2 size={16} className="animate-spin" />}
            {statusMessage.text}
          </div>
        )}
      </div>

      <div className="lg:flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:min-h-0 h-auto">
        
        {/* Left Panel: Upload */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className={`
             lg:flex-1 h-64 lg:h-auto border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all relative overflow-hidden
             ${isProcessing ? 'bg-gray-50 border-gray-300 opacity-75' : 'bg-white border-primary-200 hover:border-primary-400 hover:bg-primary-50'}
             ${selectedFile ? 'border-solid border-primary-500 bg-primary-50/30' : ''}
          `}>
             
             {/* If Processing */}
             {isProcessing && (
               <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                 <Loader2 size={48} className="text-primary-600 animate-spin mb-4" />
                 <p className="font-bold text-gray-700">جاري تحليل البيانات...</p>
                 <p className="text-xs text-gray-500 mt-2">قد يستغرق هذا بضع ثوانٍ</p>
               </div>
             )}

             {/* If File Selected */}
             {!isProcessing && selectedFile ? (
               <div className="w-full h-full flex flex-col items-center">
                  <div className="w-full flex justify-end">
                    <button onClick={removeSelectedFile} className="p-2 bg-white text-red-500 rounded-full shadow-sm hover:bg-red-50 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 flex items-center justify-center w-full overflow-hidden my-4 rounded-lg border border-gray-200 bg-gray-100">
                    {selectedFile.preview ? (
                      <img src={selectedFile.preview} className="max-h-[300px] object-contain" alt="Preview" />
                    ) : (
                      <FileText size={64} className="text-gray-400" />
                    )}
                  </div>
                  <p className="font-bold text-gray-800 truncate max-w-[200px] dir-ltr">{selectedFile.file.name}</p>
               </div>
             ) : (
               /* Default State */
               <>
                 <input 
                   type="file" 
                   accept="image/*,application/pdf"
                   onChange={handleFileChange}
                   className="absolute inset-0 opacity-0 cursor-pointer z-10"
                   disabled={isProcessing}
                 />
                 <div className="w-20 h-20 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                   <Plus size={40} />
                 </div>
                 <h3 className="text-xl font-bold text-gray-800 mb-2">اضغط لإرفاق ملف</h3>
                 <p className="text-gray-400 text-sm max-w-[200px]">يدعم الصور (JPG, PNG) وملفات PDF</p>
               </>
             )}
          </div>

          <button
            onClick={processFile}
            disabled={!selectedFile || isProcessing}
            className={`
              w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-[0.98]
              ${!selectedFile || isProcessing ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-primary-200'}
            `}
          >
             {isProcessing ? 'جاري المعالجة...' : 'بدء الاستخراج'}
             {!isProcessing && <FileText size={20} />}
          </button>
        </div>

        {/* Right Panel: Results Table */}
        <div ref={resultsRef} className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[500px] lg:min-h-0 lg:overflow-hidden">
           <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-primary-600 shadow-sm font-bold border border-gray-100">
                  {extractedData.length}
                </div>
                <span className="font-bold text-gray-700">العناصر المستخرجة</span>
              </div>
              
              {extractedData.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => setExtractedData([])} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="مسح الكل">
                    <Trash2 size={20} />
                  </button>
                  <button onClick={saveToInventory} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center gap-2 transition-transform hover:scale-105">
                    <Save size={18} />
                    حفظ
                  </button>
                </div>
              )}
           </div>

           <div className="flex-1 lg:overflow-auto overflow-x-auto">
             {extractedData.length === 0 ? (
               <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-gray-300">
                 <ImageIcon size={64} className="mb-4 opacity-20" />
                 <p className="font-medium">البيانات المستخرجة ستظهر هنا</p>
               </div>
             ) : (
               <table className="w-full text-sm text-right min-w-[900px]">
                 <thead className="bg-gray-50 text-gray-600 font-bold sticky top-0 shadow-sm">
                   <tr>
                     <th className="p-4 border-b">اسم الصنف</th>
                     <th className="p-4 border-b">الوكيل</th>
                     <th className="p-4 border-b">المصنع</th>
                     <th className="p-4 border-b">سعر الجمهور</th>
                     <th className="p-4 border-b">سعر الصيدلي</th>
                     <th className="p-4 border-b">قبل الخصم</th>
                     <th className="p-4 border-b">خصم %</th>
                     <th className="p-4 border-b"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {extractedData.map((row) => (
                     <tr key={row.tempId} className="hover:bg-blue-50/50 transition-colors group">
                       <td className="p-4 font-bold text-gray-800">{row.tradeName}</td>
                       <td className="p-4 text-gray-500">{row.agentName}</td>
                       <td className="p-4 text-gray-500">{row.manufacturer}</td>
                       <td className="p-4 font-mono whitespace-nowrap">{row.publicPrice}</td>
                       <td className="p-4 font-mono text-gray-600 whitespace-nowrap">{row.agentPrice}</td>
                       <td className="p-4 font-mono text-gray-400 whitespace-nowrap">{row.priceBeforeDiscount}</td>
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
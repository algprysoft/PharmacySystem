import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { Drug } from '../types';
import { Upload, FileSpreadsheet, FileJson, AlertTriangle, CheckCircle, Save, Download, RefreshCw, X, HelpCircle } from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

export const ImportData: React.FC = () => {
  const [previewData, setPreviewData] = useState<Partial<Drug>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanNumber = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    // Keep numbers and decimals, remove everything else
    const clean = val.toString().replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
  };

  // --- SMART KEY MATCHING LOGIC ---
  
  // Normalize text: remove special chars, unify Arabic chars, lowercase
  const normalizeText = (text: string) => {
    if (!text) return '';
    return text.toString().toLowerCase().trim()
      .replace(/[أإآ]/g, 'ا') // Unify Alifs (Important for الإسم vs الاسم)
      .replace(/[ة]/g, 'ه')   // Unify Ta Marbuta
      .replace(/[ى]/g, 'ي')   // Unify Ya
      .replace(/[^a-z0-9\u0621-\u064A]/g, ''); // Remove spaces, symbols (%, -, etc)
  };

  const getValue = (row: any, possibleKeys: string[]): any => {
      const rowKeys = Object.keys(row);
      
      // 1. Try Exact Match first (Fastest)
      for (const key of possibleKeys) {
          if (row[key] !== undefined && row[key] !== null) return row[key];
      }

      // 2. Try Smart Fuzzy Match (Normalization)
      // Create a map of { normalizedKey: originalKey } for the row
      const normalizedRowKeys = rowKeys.reduce((acc, k) => {
          acc[normalizeText(k)] = k;
          return acc;
      }, {} as Record<string, string>);

      for (const key of possibleKeys) {
          const normalizedTarget = normalizeText(key);
          const originalKey = normalizedRowKeys[normalizedTarget];
          
          if (originalKey && row[originalKey] !== undefined && row[originalKey] !== null) {
              return row[originalKey];
          }
      }

      // 3. Super Fuzzy (Contains) - Optional fallback for very messy headers
      // E.g. searching for "Price" in "Unit Price (SAR)"
      for (const key of possibleKeys) {
        const normalizedTarget = normalizeText(key);
        // Skip short keys to avoid false positives
        if (normalizedTarget.length < 3) continue; 
        
        const foundKey = rowKeys.find(rk => normalizeText(rk).includes(normalizedTarget));
        if (foundKey && row[foundKey] !== undefined) return row[foundKey];
      }

      return undefined;
  };

  const mapExcelRowToDrug = (row: any): Partial<Drug> => {
    // List includes variations found in Exports and Common formats
    const tradeName = getValue(row, [
        'Trade Name', 'Name', 'ItemName', 'Drug Name', 'Description', 
        'اسم الدواء', 'الاسم', 'الاسم التجاري', 'الإسم التجاري', 'الصنف', 'المادة'
    ]) || '';
    
    // Skip if no name found
    if (!tradeName) return {};

    const agentName = getValue(row, [
        'Agent', 'Agent Name', 'Distributor', 'Supplier', 
        'الوكيل', 'الموزع', 'المورد', 'اسم الوكيل'
    ]) || '';

    const manufacturer = getValue(row, [
        'Manufacturer', 'Company', 'Brand', 
        'الشركة المصنعة', 'المصنع', 'الشركة'
    ]) || '';
    
    const publicPrice = cleanNumber(getValue(row, [
        'Public Price', 'Price', 'Retail Price', 
        'سعر الجمهور', 'السعر', 'سعر البيع'
    ]));

    const agentPrice = cleanNumber(getValue(row, [
        'Agent Price', 'Cost', 'Pharmacy Price', 'Whole Sale', 
        'سعر الصيدلي', 'التكلفة', 'سعر الشراء'
    ]));

    const priceBeforeDiscount = cleanNumber(getValue(row, [
        'Old Price', 'Price Before', 'Original Price', 
        'السعر قبل الخصم', 'سعر سابق', 'قبل الخصم', 'قبل التخفيض'
    ]));

    const discountPercent = cleanNumber(getValue(row, [
        'Discount', 'Discount %', 'Bonus', 
        'نسبة الخصم', 'الخصم', 'نسبة التخفيض', 'نسبة الخصم %'
    ]));

    return {
        tradeName: String(tradeName).trim(),
        agentName: String(agentName).trim(),
        manufacturer: String(manufacturer).trim(),
        publicPrice,
        agentPrice,
        priceBeforeDiscount: priceBeforeDiscount || publicPrice,
        discountPercent
    };
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    setPreviewData([]);
    setIsProcessing(true);

    try {
      if (file.name.endsWith('.json')) {
         const text = await file.text();
         let json;
         try {
             json = JSON.parse(text);
         } catch(e) {
             throw new Error('ملف JSON غير صالح');
         }
         
         let drugsToImport = [];
         if (json.drugs && Array.isArray(json.drugs)) {
             drugsToImport = json.drugs;
         } else if (Array.isArray(json)) {
             drugsToImport = json;
         } else {
             // Try to find any array property
             const possibleArray = Object.values(json).find(val => Array.isArray(val));
             if (possibleArray) {
                 drugsToImport = possibleArray as any[];
             } else {
                 throw new Error('صيغة ملف JSON غير متوافقة');
             }
         }
         
         const normalized = drugsToImport.map((d: any) => ({
             tradeName: d.tradeName || d.name || d['اسم الدواء'] || d['الإسم التجاري'],
             agentName: d.agentName || d['الوكيل'],
             manufacturer: d.manufacturer || d['المصنع'],
             publicPrice: cleanNumber(d.publicPrice || d['سعر الجمهور']),
             agentPrice: cleanNumber(d.agentPrice || d['سعر الصيدلي']),
             priceBeforeDiscount: cleanNumber(d.priceBeforeDiscount || d['قبل الخصم']),
             discountPercent: cleanNumber(d.discountPercent || d['نسبة الخصم'])
         })).filter((d: any) => d.tradeName);

         setPreviewData(normalized);

      } else {
         // Excel
         const buffer = await file.arrayBuffer();
         const wb = XLSX.read(buffer, { type: 'array' });
         
         if (wb.SheetNames.length === 0) throw new Error('ملف Excel لا يحتوي على صفحات');
         
         const ws = wb.Sheets[wb.SheetNames[0]];
         const rawData = XLSX.utils.sheet_to_json(ws);
         
         if (rawData.length === 0) throw new Error('الملف فارغ أو لا يحتوي على بيانات مقروءة');

         const mappedData = rawData
            .map(mapExcelRowToDrug)
            .filter(d => d.tradeName && d.tradeName.length > 0);
         
         if (mappedData.length === 0) {
             const availableKeys = rawData.length > 0 ? Object.keys(rawData[0] as object).join(', ') : 'لا يوجد';
             throw new Error(`لم يتم العثور على أدوية صالحة. تأكد من الأعمدة. الأعمدة الموجودة: [${availableKeys}]`);
         }

         setPreviewData(mappedData as Partial<Drug>[]);
      }
    } catch (err: any) {
        console.error("Import Error:", err);
        setError(err.message || 'فشل في قراءة الملف');
    } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveToInventory = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);
    
    try {
        const newDrugs: Drug[] = previewData.map(item => ({
            id: generateId(),
            tradeName: item.tradeName || 'غير معروف',
            agentName: item.agentName || '-',
            manufacturer: item.manufacturer || '-',
            publicPrice: item.publicPrice || 0,
            agentPrice: item.agentPrice || 0,
            priceBeforeDiscount: item.priceBeforeDiscount || item.publicPrice || 0,
            discountPercent: item.discountPercent || 0,
            addedBy: 'Import',
            createdAt: Date.now()
        }));

        await db.addDrugsBatch(newDrugs);
        setSuccess(`تم إضافة ${newDrugs.length} صنف بنجاح إلى المخزون!`);
        setPreviewData([]);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
        { 
            "الإسم التجاري": "بنادول اكسترا", 
            "الوكيل": "الشركة المتحدة", 
            "المصنع": "GSK", 
            "سعر الجمهور": 15.5, 
            "سعر الصيدلي": 12.0, 
            "قبل الخصم": 15.5,
            "نسبة الخصم %": 20 
        }
    ];
    const ws = XLSX.utils.json_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "PharmaEye_Template.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col gap-2">
         <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Upload className="text-primary-600" />
            استيراد وتصدير البيانات
         </h1>
         <p className="text-gray-500">
             استخدم هذه الصفحة لإضافة كميات كبيرة من الأدوية عبر Excel/JSON.
         </p>
      </div>

      {/* Backup Section */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm">
                  <Save size={24} />
              </div>
              <div>
                  <h3 className="font-bold text-blue-900 text-lg">النسخ الاحتياطي (Backup)</h3>
                  <p className="text-blue-700 text-sm mt-1 max-w-xl leading-relaxed">
                      بما أن النظام يعمل في وضع التخزين المحلي، يفضل تحميل نسخة احتياطية بانتظام لتجنب فقدان البيانات عند تحديث المتصفح.
                  </p>
              </div>
          </div>
          <button 
            onClick={() => db.exportData()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2 whitespace-nowrap"
          >
              <Download size={20} />
              تحميل نسخة كاملة
          </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Upload Card */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
             <div className="flex justify-between items-start mb-4">
                 <h3 className="font-bold text-gray-800 flex items-center gap-2">
                     <FileSpreadsheet size={20} className="text-green-600" />
                     رفع ملف جديد
                 </h3>
                 <button 
                    onClick={downloadTemplate}
                    className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-800 bg-primary-50 px-2 py-1 rounded-lg"
                 >
                    <Download size={14} /> نموذج Excel
                 </button>
             </div>
             
             <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors relative cursor-pointer group">
                 <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".xlsx,.xls,.json" 
                    onChange={handleFile}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isProcessing}
                 />
                 <Upload size={40} className="mx-auto text-gray-400 mb-4 group-hover:text-primary-500 transition-colors" />
                 <p className="font-bold text-gray-600">اضغط للرفع أو اسحب الملف هنا</p>
                 <p className="text-xs text-gray-400 mt-2">يدعم ملفات Excel (.xlsx) و JSON</p>
             </div>

             <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                 <div className="flex items-center gap-2 font-bold mb-2 text-gray-600">
                    <HelpCircle size={14} />
                    <span>نظام المطابقة الذكي:</span>
                 </div>
                 <p className="leading-relaxed mb-2">
                    يتعرف النظام تلقائياً على الأعمدة حتى لو اختلفت المسميات قليلاً (مثلاً: "الإسم التجاري" = "اسم الدواء"، "الخصم" = "نسبة الخصم").
                 </p>
             </div>
         </div>

         {/* Preview Area */}
         <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-[400px]">
             <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                 <h3 className="font-bold text-gray-700">معاينة البيانات ({previewData.length})</h3>
                 {previewData.length > 0 && (
                     <div className="flex gap-2">
                         <button onClick={() => setPreviewData([])} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><X size={20} /></button>
                         <button onClick={saveToInventory} disabled={isProcessing} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-sm flex items-center gap-2">
                             <Save size={18} />
                             {isProcessing ? 'جاري الحفظ...' : 'حفظ للمخزون'}
                         </button>
                     </div>
                 )}
             </div>
             
             <div className="flex-1 overflow-auto p-4">
                 {error && (
                     <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3 mb-4 animate-fade-in border border-red-100">
                         <AlertTriangle size={24} className="shrink-0 mt-0.5" />
                         <div>
                             <p className="font-bold">خطأ في قراءة الملف</p>
                             <p className="text-sm mt-1">{error}</p>
                         </div>
                     </div>
                 )}

                 {success && (
                     <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-3 mb-4 animate-fade-in border border-green-100">
                         <CheckCircle size={24} />
                         <div>
                             <p className="font-bold">تمت العملية بنجاح</p>
                             <p className="text-sm">{success}</p>
                         </div>
                     </div>
                 )}

                 {previewData.length === 0 && !error && !success ? (
                     <div className="h-full flex flex-col items-center justify-center text-gray-300 min-h-[200px]">
                         <FileJson size={64} className="opacity-20 mb-4" />
                         <p>لا توجد بيانات للمعاينة</p>
                         <p className="text-sm mt-2 opacity-60">قم برفع ملف لإظهار المحتوى</p>
                     </div>
                 ) : (
                     <table className="w-full text-right text-sm">
                         <thead className="text-gray-500 font-bold border-b bg-gray-50 sticky top-0">
                             <tr>
                                 <th className="p-3">اسم الدواء</th>
                                 <th className="p-3">الوكيل</th>
                                 <th className="p-3">سعر الجمهور</th>
                                 <th className="p-3">الخصم</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                             {previewData.slice(0, 100).map((item, idx) => (
                                 <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                     <td className="p-3 font-bold text-gray-800">{item.tradeName}</td>
                                     <td className="p-3 text-gray-600">{item.agentName}</td>
                                     <td className="p-3 font-mono">{item.publicPrice}</td>
                                     <td className="p-3 text-green-600 font-bold">{item.discountPercent}%</td>
                                 </tr>
                             ))}
                             {previewData.length > 100 && (
                                 <tr>
                                     <td colSpan={4} className="p-3 text-center text-gray-500 bg-gray-50 text-xs font-bold">
                                         ... وهناك {previewData.length - 100} صف آخر
                                     </td>
                                 </tr>
                             )}
                         </tbody>
                     </table>
                 )}
             </div>
         </div>
      </div>
    </div>
  );
};
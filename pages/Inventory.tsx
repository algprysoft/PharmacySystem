import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Drug, UserRole } from '../types';
import { Search, Plus, Trash2, Edit2, ChevronUp, ChevronDown, Filter, Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Inventory: React.FC = () => {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Drug; direction: 'asc' | 'desc' } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDrug, setEditingDrug] = useState<Drug | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Drug>>({});

  useEffect(() => {
    refreshData();
    const sessionStr = sessionStorage.getItem('pharma_session');
    if (sessionStr) {
        const user = JSON.parse(sessionStr);
        setCurrentUserRole(user.role);
    }

    const handleClickOutside = (event: MouseEvent) => {
        if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
            setShowExportMenu(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);

  }, []);

  const refreshData = () => {
    setDrugs(db.getDrugs());
  };

  const handleSort = (key: keyof Drug) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedDrugs = React.useMemo(() => {
    let sortableItems = [...drugs];
    if (searchTerm) {
      sortableItems = sortableItems.filter(drug => 
        drug.tradeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        drug.agentName.includes(searchTerm) ||
        drug.manufacturer.includes(searchTerm)
      );
    }
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
           return sortConfig.direction === 'asc' 
             ? aValue.localeCompare(bValue, ['ar', 'en']) 
             : bValue.localeCompare(aValue, ['ar', 'en']);
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [drugs, sortConfig, searchTerm]);

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الدواء؟')) {
      db.deleteDrug(id);
      refreshData();
    }
  };

  const handleEdit = (drug: Drug) => {
    setEditingDrug(drug);
    setFormData(drug);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingDrug(null);
    setFormData({});
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDrug) {
      db.updateDrug(editingDrug.id, formData);
    } else {
      const newDrug: Drug = {
        id: uuidv4(),
        agentName: formData.agentName || '',
        manufacturer: formData.manufacturer || '',
        tradeName: formData.tradeName || '',
        publicPrice: Number(formData.publicPrice) || 0,
        agentPrice: Number(formData.agentPrice) || 0,
        priceBeforeDiscount: Number(formData.priceBeforeDiscount) || 0,
        discountPercent: Number(formData.discountPercent) || 0,
        addedBy: 'Manual',
        createdAt: Date.now()
      };
      db.addDrug(newDrug);
    }
    setShowModal(false);
    refreshData();
  };

  // --- Export Functions ---

  const prepareExportData = () => {
      return sortedDrugs.map(d => ({
          'الإسم التجاري': d.tradeName,
          'الوكيل': d.agentName,
          'المصنع': d.manufacturer,
          'سعر الجمهور': d.publicPrice,
          'سعر الصيدلي': d.agentPrice,
          'قبل الخصم': d.priceBeforeDiscount,
          'نسبة الخصم %': d.discountPercent,
          'تاريخ الإضافة': new Date(d.createdAt).toLocaleDateString('ar-EG')
      }));
  };

  const exportToExcel = () => {
    try {
      const data = prepareExportData();
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "المخزون");
      XLSX.writeFile(wb, `PharmaEye_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
      setShowExportMenu(false);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تصدير Excel');
    }
  };

  const exportToJSON = () => {
    try {
      const data = JSON.stringify(sortedDrugs, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PharmaEye_Inventory_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      setShowExportMenu(false);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تصدير JSON');
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const tableColumn = ["Trade Name", "Agent", "Price (Pub)", "Price (Ag)", "Disc %"];
      const tableRows: any[] = [];

      sortedDrugs.forEach(drug => {
        // Use english headers but keep data as is. 
        // Note: Arabic characters might not render correctly in standard jsPDF without custom fonts.
        const drugData = [
          drug.tradeName,
          drug.agentName,
          drug.publicPrice.toFixed(2),
          drug.agentPrice.toFixed(2),
          drug.discountPercent + '%'
        ];
        tableRows.push(drugData);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        theme: 'grid',
        styles: { fontSize: 8, halign: 'right' },
        headStyles: { fillColor: [13, 148, 136], halign: 'left' } 
      });

      doc.text("PharmaEye Inventory Report", 14, 15);
      doc.save(`PharmaEye_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      setShowExportMenu(false);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("حدث خطأ أثناء تصدير PDF. تأكد من المتصفح.");
    }
  };


  const SortIcon = ({ colKey }: { colKey: keyof Drug }) => {
    if (sortConfig?.key !== colKey) return <div className="w-4 h-4 opacity-20"><Filter size={14} /></div>;
    return sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">إدارة المخزون</h1>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="بحث باسم الدواء، الوكيل..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all outline-none"
            />
          </div>
          
          {/* Admin Export Menu */}
          {currentUserRole === UserRole.ADMIN && (
              <div className="relative" ref={exportMenuRef}>
                  <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Download size={20} />
                    <span className="hidden md:inline">تصدير</span>
                    <ChevronDown size={16} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showExportMenu && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
                        <button onClick={exportToExcel} className="w-full text-right px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors border-b border-gray-50">
                            <FileSpreadsheet size={18} className="text-green-600" />
                            <span>ملف إكسل (Excel)</span>
                        </button>
                         <button onClick={exportToPDF} className="w-full text-right px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors border-b border-gray-50">
                            <FileText size={18} className="text-red-600" />
                            <span>ملف PDF</span>
                        </button>
                         <button onClick={exportToJSON} className="w-full text-right px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                            <FileJson size={18} className="text-yellow-600" />
                            <span>ملف JSON</span>
                        </button>
                    </div>
                  )}
              </div>
          )}

          <button 
            onClick={handleAdd}
            className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-bold shadow-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden md:inline">إضافة يدوي</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
              <tr>
                {[
                  { key: 'tradeName', label: 'الإسم التجاري' },
                  { key: 'agentName', label: 'الوكيل' },
                  { key: 'manufacturer', label: 'الشركة المصنعة' },
                  { key: 'publicPrice', label: 'سعر الجمهور' },
                  { key: 'agentPrice', label: 'سعر الوكيل' },
                  { key: 'priceBeforeDiscount', label: 'قبل التخفيض' },
                  { key: 'discountPercent', label: 'نسبة الخصم' },
                ].map((col) => (
                  <th 
                    key={col.key} 
                    onClick={() => handleSort(col.key as keyof Drug)}
                    className="p-4 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      <SortIcon colKey={col.key as keyof Drug} />
                    </div>
                  </th>
                ))}
                <th className="p-4">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedDrugs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400">
                    لا توجد أدوية مطابقة للبحث
                  </td>
                </tr>
              ) : (
                sortedDrugs.map((drug) => (
                  <tr key={drug.id} className="hover:bg-primary-50/30 transition-colors group">
                    <td className="p-4 font-bold text-gray-800">{drug.tradeName}</td>
                    <td className="p-4 text-gray-600">{drug.agentName}</td>
                    <td className="p-4 text-gray-600">{drug.manufacturer}</td>
                    <td className="p-4 font-mono text-gray-700">{drug.publicPrice} <span className="text-xs text-gray-400">ريال</span></td>
                    <td className="p-4 font-mono text-gray-700">{drug.agentPrice} <span className="text-xs text-gray-400">ريال</span></td>
                    <td className="p-4 font-mono text-gray-500">{drug.priceBeforeDiscount}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                        {drug.discountPercent}%
                      </span>
                    </td>
                    <td className="p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(drug)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(drug.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                {editingDrug ? 'تعديل بيانات دواء' : 'إضافة دواء جديد'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">الإسم التجاري</label>
                <input required className="w-full p-2 border rounded-lg" value={formData.tradeName || ''} onChange={e => setFormData({...formData, tradeName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">الوكيل</label>
                <input className="w-full p-2 border rounded-lg" value={formData.agentName || ''} onChange={e => setFormData({...formData, agentName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">الشركة المصنعة</label>
                <input className="w-full p-2 border rounded-lg" value={formData.manufacturer || ''} onChange={e => setFormData({...formData, manufacturer: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">السعر للجمهور</label>
                <input type="number" step="0.01" className="w-full p-2 border rounded-lg" value={formData.publicPrice || ''} onChange={e => setFormData({...formData, publicPrice: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">سعر الوكيل</label>
                <input type="number" step="0.01" className="w-full p-2 border rounded-lg" value={formData.agentPrice || ''} onChange={e => setFormData({...formData, agentPrice: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">السعر قبل التخفيض</label>
                <input type="number" step="0.01" className="w-full p-2 border rounded-lg bg-gray-50" value={formData.priceBeforeDiscount || ''} onChange={e => setFormData({...formData, priceBeforeDiscount: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">نسبة الخصم (%)</label>
                <input type="number" step="0.01" className="w-full p-2 border rounded-lg" value={formData.discountPercent || ''} onChange={e => setFormData({...formData, discountPercent: Number(e.target.value)})} />
              </div>
              
              <div className="md:col-span-2 pt-4 flex gap-3">
                <button type="submit" className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700">حفظ البيانات</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
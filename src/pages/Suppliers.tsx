import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Plus, Search, FileDown, DollarSign } from 'lucide-react';
import { exportToPDF } from '../lib/pdfExport';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', email: '', amount_payable: 0 });
  const [paymentAmount, setPaymentAmount] = useState(0);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    try {
      const { error } = await supabase.from('suppliers').insert([newSupplier]);
      if (error) throw error;
      setShowAddModal(false);
      setNewSupplier({ name: '', phone: '', email: '', amount_payable: 0 });
      fetchSuppliers();
    } catch (error) {
      console.error('Error adding supplier:', error);
      alert('Failed to add supplier.');
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !selectedSupplier) return;
    try {
      // 1. Record transaction
      const { error: txError } = await supabase.from('transactions').insert([{
        type: 'payment_out',
        entity_id: selectedSupplier.id,
        total_amount: paymentAmount,
        notes: 'Payment to supplier'
      }]);
      if (txError) throw txError;

      // 2. Update supplier balance
      const newBalance = Number(selectedSupplier.amount_payable) - paymentAmount;
      const { error: updateError } = await supabase.from('suppliers')
        .update({ amount_payable: newBalance })
        .eq('id', selectedSupplier.id);
      
      if (updateError) throw updateError;

      setShowPaymentModal(false);
      setPaymentAmount(0);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment.');
    }
  }

  const exportPDF = () => {
    const columns = ['Name', 'Phone', 'Email', 'Amount Payable'];
    const data = filteredSuppliers.map(s => [
      s.name, s.phone || 'N/A', s.email || 'N/A', formatCurrency(s.amount_payable)
    ]);
    exportToPDF('Suppliers Report', columns, data);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.phone && s.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileDown className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search suppliers..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Amount Payable</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center">No suppliers found.</td></tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-6 py-4">
                      <div>{supplier.phone || '-'}</div>
                      <div className="text-xs text-gray-400">{supplier.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${supplier.amount_payable > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(supplier.amount_payable)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setSelectedSupplier(supplier); setShowPaymentModal(true); }}
                        className="text-indigo-600 hover:text-indigo-900 font-medium flex items-center justify-end gap-1 ml-auto"
                      >
                        <DollarSign className="w-4 h-4" /> Make Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add New Supplier</h2>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required type="text" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Amount Payable</label>
                <input type="number" step="0.01" value={newSupplier.amount_payable} onChange={e => setNewSupplier({...newSupplier, amount_payable: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-2">Make Payment</h2>
            <p className="text-gray-600 mb-4">To: <span className="font-semibold">{selectedSupplier.name}</span></p>
            <p className="text-sm text-red-600 mb-4">Current Payable: {formatCurrency(selectedSupplier.amount_payable)}</p>
            
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                <input required type="number" step="0.01" max={selectedSupplier.amount_payable > 0 ? selectedSupplier.amount_payable : undefined} value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

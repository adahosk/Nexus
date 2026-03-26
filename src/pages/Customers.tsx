import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Plus, Search, FileDown, DollarSign } from 'lucide-react';
import { exportToPDF } from '../lib/pdfExport';

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', amount_owed: 0 });
  const [paymentAmount, setPaymentAmount] = useState(0);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('customers').select('*').order('name');
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    try {
      const { error } = await supabase.from('customers').insert([newCustomer]);
      if (error) throw error;
      setShowAddModal(false);
      setNewCustomer({ name: '', phone: '', email: '', amount_owed: 0 });
      fetchCustomers();
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer.');
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !selectedCustomer) return;
    try {
      // 1. Record transaction
      const { error: txError } = await supabase.from('transactions').insert([{
        type: 'payment_in',
        entity_id: selectedCustomer.id,
        total_amount: paymentAmount,
        notes: 'Payment received'
      }]);
      if (txError) throw txError;

      // 2. Update customer balance
      const newBalance = Number(selectedCustomer.amount_owed) - paymentAmount;
      const { error: updateError } = await supabase.from('customers')
        .update({ amount_owed: newBalance })
        .eq('id', selectedCustomer.id);
      
      if (updateError) throw updateError;

      setShowPaymentModal(false);
      setPaymentAmount(0);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment.');
    }
  }

  const exportPDF = () => {
    const columns = ['Name', 'Phone', 'Email', 'Amount Owed'];
    const data = filteredCustomers.map(c => [
      c.name, c.phone || 'N/A', c.email || 'N/A', formatCurrency(c.amount_owed)
    ]);
    exportToPDF('Customers Report', columns, data);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileDown className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search customers..." 
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
                <th className="px-6 py-3">Amount Owed</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center">No customers found.</td></tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{customer.name}</td>
                    <td className="px-6 py-4">
                      <div>{customer.phone || '-'}</div>
                      <div className="text-xs text-gray-400">{customer.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${customer.amount_owed > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(customer.amount_owed)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setSelectedCustomer(customer); setShowPaymentModal(true); }}
                        className="text-indigo-600 hover:text-indigo-900 font-medium flex items-center justify-end gap-1 ml-auto"
                      >
                        <DollarSign className="w-4 h-4" /> Receive Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add New Customer</h2>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required type="text" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Amount Owed</label>
                <input type="number" step="0.01" value={newCustomer.amount_owed} onChange={e => setNewCustomer({...newCustomer, amount_owed: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-2">Receive Payment</h2>
            <p className="text-gray-600 mb-4">From: <span className="font-semibold">{selectedCustomer.name}</span></p>
            <p className="text-sm text-red-600 mb-4">Current Balance: {formatCurrency(selectedCustomer.amount_owed)}</p>
            
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                <input required type="number" step="0.01" max={selectedCustomer.amount_owed > 0 ? selectedCustomer.amount_owed : undefined} value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
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

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { Plus, CheckCircle, XCircle, Clock, FileDown } from 'lucide-react';
import { exportToPDF } from '../lib/pdfExport';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [amountPaid, setAmountPaid] = useState(0);

  // New PO State
  const [newPoSupplier, setNewPoSupplier] = useState('');
  const [newPoDate, setNewPoDate] = useState('');
  const [newPoNotes, setNewPoNotes] = useState('');
  const [newPoItems, setNewPoItems] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    if (!supabase) return;
    try {
      const [
        { data: ordersData },
        { data: suppliersData },
        { data: itemsData }
      ] = await Promise.all([
        supabase.from('purchase_orders').select('*, suppliers(name)').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('items').select('*').order('name')
      ]);
      
      setOrders(ordersData || []);
      setSuppliers(suppliersData || []);
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching POs:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (newPoItems.length === 0) return alert('Please add items to the order');
    
    const totalAmount = newPoItems.reduce((sum, item) => sum + (item.cost * item.quantity), 0);

    try {
      // 1. Create PO
      const { data: poData, error: poError } = await supabase.from('purchase_orders').insert([{
        supplier_id: newPoSupplier,
        expected_date: newPoDate || null,
        notes: newPoNotes,
        total_amount: totalAmount,
        status: 'pending'
      }]).select().single();

      if (poError) throw poError;

      // 2. Add Items
      const itemsPayload = newPoItems.map(item => ({
        po_id: poData.id,
        item_id: item.item_id,
        quantity: item.quantity,
        cost: item.cost
      }));

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsPayload);
      if (itemsError) throw itemsError;

      setShowAddModal(false);
      setNewPoSupplier('');
      setNewPoDate('');
      setNewPoNotes('');
      setNewPoItems([]);
      fetchData();
    } catch (error) {
      console.error('Error creating PO:', error);
      alert('Failed to create Purchase Order');
    }
  };

  const handleReceivePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedOrder) return;

    try {
      const { error } = await supabase.rpc('receive_purchase_order', {
        p_po_id: selectedOrder.id,
        p_amount_paid: amountPaid
      });

      if (error) throw error;

      alert('Purchase Order received and inventory updated!');
      setShowReceiveModal(false);
      setSelectedOrder(null);
      setAmountPaid(0);
      fetchData();
    } catch (error: any) {
      console.error('Error receiving PO:', error);
      alert('Failed to receive PO: ' + error.message);
    }
  };

  const handleCancelPO = async (id: string) => {
    if (!supabase || !confirm('Are you sure you want to cancel this order?')) return;
    try {
      const { error } = await supabase.from('purchase_orders').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error cancelling PO:', error);
    }
  };

  const exportPDF = () => {
    const columns = ['Date', 'Supplier', 'Status', 'Expected', 'Total'];
    const data = orders.map(o => [
      formatDate(o.created_at),
      o.suppliers?.name || 'Unknown',
      o.status.toUpperCase(),
      o.expected_date || 'N/A',
      formatCurrency(o.total_amount)
    ]);
    exportToPDF('Purchase Orders', columns, data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileDown className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Create PO
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Supplier</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Expected</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center">No purchase orders found.</td></tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(order.created_at)}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{order.suppliers?.name}</td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1 w-fit px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'received' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status === 'pending' && <Clock className="w-3 h-3" />}
                        {order.status === 'received' && <CheckCircle className="w-3 h-3" />}
                        {order.status === 'cancelled' && <XCircle className="w-3 h-3" />}
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">{order.expected_date || '-'}</td>
                    <td className="px-6 py-4 font-semibold">{formatCurrency(order.total_amount)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {order.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => { setSelectedOrder(order); setShowReceiveModal(true); }}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            Receive
                          </button>
                          <button 
                            onClick={() => handleCancelPO(order.id)}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Purchase Order</h2>
            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select required value={newPoSupplier} onChange={e => setNewPoSupplier(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select Supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date</label>
                  <input type="date" value={newPoDate} onChange={e => setNewPoDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div className="border-t border-b py-4 my-4">
                <h3 className="font-medium mb-2">Order Items</h3>
                {newPoItems.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-center">
                    <select 
                      required
                      value={item.item_id}
                      onChange={e => {
                        const selected = items.find(i => i.id === e.target.value);
                        const newItems = [...newPoItems];
                        newItems[index] = { ...newItems[index], item_id: selected.id, cost: selected.cost };
                        setNewPoItems(newItems);
                      }}
                      className="flex-1 px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select Item...</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input 
                      type="number" required min="1" placeholder="Qty"
                      value={item.quantity}
                      onChange={e => {
                        const newItems = [...newPoItems];
                        newItems[index].quantity = parseInt(e.target.value) || 0;
                        setNewPoItems(newItems);
                      }}
                      className="w-24 px-3 py-2 border rounded-lg"
                    />
                    <input 
                      type="number" required step="0.01" placeholder="Cost"
                      value={item.cost}
                      onChange={e => {
                        const newItems = [...newPoItems];
                        newItems[index].cost = parseFloat(e.target.value) || 0;
                        setNewPoItems(newItems);
                      }}
                      className="w-32 px-3 py-2 border rounded-lg"
                    />
                    <button type="button" onClick={() => setNewPoItems(newPoItems.filter((_, i) => i !== index))} className="text-red-500 p-2">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setNewPoItems([...newPoItems, { item_id: '', quantity: 1, cost: 0 }])} className="text-sm text-indigo-600 font-medium flex items-center gap-1 mt-2">
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={newPoNotes} onChange={e => setNewPoNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={2}></textarea>
              </div>

              <div className="flex justify-between items-center mt-6">
                <div className="text-lg font-bold">
                  Total: {formatCurrency(newPoItems.reduce((sum, item) => sum + (item.cost * item.quantity), 0))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create Order</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive PO Modal */}
      {showReceiveModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-2">Receive Purchase Order</h2>
            <p className="text-gray-600 mb-4">Supplier: <span className="font-semibold">{selectedOrder.suppliers?.name}</span></p>
            <p className="text-sm font-bold mb-4">Total Amount: {formatCurrency(selectedOrder.total_amount)}</p>
            
            <form onSubmit={handleReceivePO} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid Now</label>
                <input required type="number" step="0.01" max={selectedOrder.total_amount} value={amountPaid} onChange={e => setAmountPaid(parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
                <p className="text-xs text-gray-500 mt-1">
                  Any unpaid amount will be added to the supplier's payable balance.
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowReceiveModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Receive & Update Inventory</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Plus, Search, Camera, FileDown } from 'lucide-react';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { exportToPDF } from '../lib/pdfExport';

export default function Inventory() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', barcode: '', price: 0, cost: 0, stock: 0 });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('items').select('*').order('name');
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    try {
      const { error } = await supabase.from('items').insert([newItem]);
      if (error) throw error;
      setShowAddModal(false);
      setNewItem({ name: '', barcode: '', price: 0, cost: 0, stock: 0 });
      fetchItems();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item. Check if barcode is unique.');
    }
  }

  const handleScan = (decodedText: string) => {
    setSearch(decodedText);
    setShowScanner(false);
  };

  const exportPDF = () => {
    const columns = ['Name', 'Barcode', 'Price', 'Cost', 'Stock'];
    const data = filteredItems.map(item => [
      item.name,
      item.barcode || 'N/A',
      formatCurrency(item.price),
      formatCurrency(item.cost),
      item.stock.toString()
    ]);
    exportToPDF('Inventory Report', columns, data);
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    (item.barcode && item.barcode.includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileDown className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by name or barcode..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <button 
            onClick={() => setShowScanner(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <Camera className="w-5 h-5" />
            <span className="hidden sm:inline">Scan</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Item Name</th>
                <th className="px-6 py-3">Barcode</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Cost</th>
                <th className="px-6 py-3">Stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center">No items found.</td></tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 font-mono text-xs">{item.barcode || '-'}</td>
                    <td className="px-6 py-4">{formatCurrency(item.price)}</td>
                    <td className="px-6 py-4">{formatCurrency(item.cost)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.stock <= 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {item.stock}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add New Item</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode (Optional)</label>
                <input type="text" value={newItem.barcode} onChange={e => setNewItem({...newItem, barcode: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input required type="number" step="0.01" value={newItem.price} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                  <input required type="number" step="0.01" value={newItem.cost} onChange={e => setNewItem({...newItem, cost: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                <input required type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

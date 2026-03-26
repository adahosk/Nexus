import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Search, Plus, Minus, Trash2, ShoppingCart } from 'lucide-react';

export default function Sales() {
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cart, setCart] = useState<any[]>([]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    if (!supabase) return;
    const [{ data: itemsData }, { data: customersData }] = await Promise.all([
      supabase.from('items').select('*').order('name'),
      supabase.from('customers').select('*').order('name')
    ]);
    setItems(itemsData || []);
    setCustomers(customersData || []);
  }

  const addToCart = (item: any) => {
    const existing = cart.find(c => c.item_id === item.id);
    if (existing) {
      setCart(cart.map(c => c.item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { item_id: item.id, name: item.name, price: item.price, quantity: 1, stock: item.stock }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.item_id === id) {
        const newQ = Math.max(1, c.quantity + delta);
        return { ...c, quantity: newQ };
      }
      return c;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(c => c.item_id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCompleteSale = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (!supabase) return;

    setLoading(true);
    try {
      const itemsPayload = cart.map(c => ({ item_id: c.item_id, quantity: c.quantity, price: c.price }));
      
      const { error } = await supabase.rpc('record_sale', {
        p_customer_id: selectedCustomerId || null,
        p_total_amount: totalAmount,
        p_amount_paid: amountPaid,
        p_items: itemsPayload
      });

      if (error) throw error;

      alert('Sale completed successfully!');
      setCart([]);
      setAmountPaid(0);
      setSelectedCustomerId('');
      fetchData(); // Refresh inventory
    } catch (error: any) {
      console.error('Error completing sale:', error);
      alert('Failed to complete sale: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    (item.barcode && item.barcode.includes(search))
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">
      {/* Left Side - Item Selection */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search items to add..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
          {filteredItems.map(item => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              disabled={item.stock <= 0}
              className={`p-4 rounded-xl border text-left transition-all ${
                item.stock > 0 
                  ? 'border-gray-200 hover:border-indigo-500 hover:shadow-md bg-white' 
                  : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="font-semibold text-gray-900 truncate">{item.name}</div>
              <div className="text-indigo-600 font-bold mt-1">{formatCurrency(item.price)}</div>
              <div className="text-xs text-gray-500 mt-2">Stock: {item.stock}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-gray-600" />
          <h2 className="font-bold text-gray-800">Current Sale</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">Cart is empty</div>
          ) : (
            cart.map(item => (
              <div key={item.item_id} className="flex items-center justify-between gap-2 border-b pb-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{item.name}</div>
                  <div className="text-sm text-gray-500">{formatCurrency(item.price)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.item_id, -1)} className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-medium">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.item_id, 1)} className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeFromCart(item.item_id)} className="p-1 ml-2 rounded text-red-500 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer (Optional)</label>
            <select 
              value={selectedCustomerId} 
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Walk-in Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-between items-center text-lg font-bold text-gray-900">
            <span>Total:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
            <input 
              type="number" 
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-semibold"
            />
            {selectedCustomerId && amountPaid < totalAmount && (
              <p className="text-xs text-red-600 mt-1">
                {formatCurrency(totalAmount - amountPaid)} will be added to customer's amount owed.
              </p>
            )}
            {!selectedCustomerId && amountPaid < totalAmount && (
              <p className="text-xs text-red-600 mt-1">
                Warning: Walk-in customers cannot have unpaid balances.
              </p>
            )}
          </div>

          <button 
            onClick={handleCompleteSale}
            disabled={loading || cart.length === 0 || (!selectedCustomerId && amountPaid < totalAmount)}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}

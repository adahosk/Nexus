import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { TrendingUp, TrendingDown, Package, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    inventoryValue: 0,
    totalOwed: 0,
    totalPayable: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!supabase) return;
      
      try {
        // Fetch basic stats
        const [
          { data: items },
          { data: customers },
          { data: suppliers },
          { data: monthlySummary }
        ] = await Promise.all([
          supabase.from('items').select('stock, cost'),
          supabase.from('customers').select('amount_owed'),
          supabase.from('suppliers').select('amount_payable'),
          supabase.from('monthly_summary').select('*').order('month', { ascending: true }).limit(6)
        ]);

        const inventoryValue = (items || []).reduce((sum, item) => sum + (item.stock * item.cost), 0);
        const totalOwed = (customers || []).reduce((sum, c) => sum + Number(c.amount_owed), 0);
        const totalPayable = (suppliers || []).reduce((sum, s) => sum + Number(s.amount_payable), 0);

        // Format monthly data for charts
        const formattedMonthly = (monthlySummary || []).map(m => ({
          name: new Date(m.month).toLocaleDateString('en-US', { month: 'short' }),
          Sales: Number(m.total_sales),
          Purchases: Number(m.total_purchases)
        }));

        setStats({
          totalSales: formattedMonthly.length > 0 ? formattedMonthly[formattedMonthly.length - 1].Sales : 0,
          totalPurchases: formattedMonthly.length > 0 ? formattedMonthly[formattedMonthly.length - 1].Purchases : 0,
          inventoryValue,
          totalOwed,
          totalPayable
        });
        
        setMonthlyData(formattedMonthly);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Current Inventory Value" 
          value={formatCurrency(stats.inventoryValue)} 
          icon={Package} 
          color="bg-blue-50 text-blue-600" 
        />
        <StatCard 
          title="Total Owed (Customers)" 
          value={formatCurrency(stats.totalOwed)} 
          icon={TrendingUp} 
          color="bg-green-50 text-green-600" 
        />
        <StatCard 
          title="Total Payable (Suppliers)" 
          value={formatCurrency(stats.totalPayable)} 
          icon={TrendingDown} 
          color="bg-red-50 text-red-600" 
        />
        <StatCard 
          title="This Month's Sales" 
          value={formatCurrency(stats.totalSales)} 
          icon={DollarSign} 
          color="bg-indigo-50 text-indigo-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Sales vs Purchases (Last 6 Months)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{fill: '#F3F4F6'}}
                />
                <Bar dataKey="Sales" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Purchases" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Cash Flow Trend</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="Sales" stroke="#4F46E5" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  );
}

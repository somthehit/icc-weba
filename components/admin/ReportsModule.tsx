'use client';

import React, { useState, useMemo } from 'react';
import { Product, Order } from '@/types';
import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  Download,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  DollarSign,
  Target,
  PieChart,
} from 'lucide-react';

interface ReportsModuleProps {
  products: Product[];
  orders: Order[];
  totalRevenue: number;
  handleExportOrdersCsv: () => void;
}

type ReportTab = 'sales' | 'products' | 'customers' | 'inventory';

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  products,
  orders,
  totalRevenue,
  handleExportOrdersCsv,
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    return orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      switch (dateRange) {
        case 'week':
          return orderDate >= startOfWeek;
        case 'month':
          return orderDate >= startOfMonth;
        case 'quarter':
          return orderDate >= startOfQuarter;
        case 'year':
          return orderDate >= startOfYear;
        default:
          return true;
      }
    });
  }, [orders, dateRange]);

  // Sales metrics
  const salesMetrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = filteredOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = orders.length > 0 ? (filteredOrders.length / orders.length) * 100 : 0;

    const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'paid');
    const paidRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      conversionRate,
      paidRevenue,
      paidOrders: paidOrders.length,
    };
  }, [filteredOrders, orders]);

  // Product performance
  const productPerformance = useMemo(() => {
    const productSales: Record<string, { name: string; revenue: number; quantity: number }> = {};

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.productName,
            revenue: 0,
            quantity: 0,
          };
        }
        productSales[item.productId].revenue += item.price * item.quantity;
        productSales[item.productId].quantity += item.quantity;
      });
    });

    return Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredOrders]);

  // Top products by stock value
  const topStockProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => b.sellingPrice * b.stockQuantity - a.sellingPrice * a.stockQuantity)
      .slice(0, 10);
  }, [products]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => p.stockQuantity <= 5)
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .slice(0, 10);
  }, [products]);

  // Customer metrics
  const customerMetrics = useMemo(() => {
    const uniqueCustomers = new Set(filteredOrders.map((o) => o.customerPhone)).size;
    const repeatCustomers = filteredOrders.reduce((acc, order) => {
      const phone = order.customerPhone;
      if (!acc[phone]) acc[phone] = 0;
      acc[phone]++;
      return acc;
    }, {} as Record<string, number>);

    const repeatCount = Object.values(repeatCustomers).filter((count) => count > 1).length;

    return {
      uniqueCustomers,
      repeatCustomers: repeatCount,
      repeatRate: uniqueCustomers > 0 ? (repeatCount / uniqueCustomers) * 100 : 0,
    };
  }, [filteredOrders]);

  // Top districts
  const topDistricts = useMemo(() => {
    const districtOrders: Record<string, { count: number; revenue: number }> = {};
    filteredOrders.forEach((order) => {
      const district = order.shippingAddress.district || order.shippingAddress.municipality || 'Unknown';
      if (!districtOrders[district]) {
        districtOrders[district] = { count: 0, revenue: 0 };
      }
      districtOrders[district].count++;
      districtOrders[district].revenue += order.totalAmount;
    });
    return Object.entries(districtOrders)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [filteredOrders]);

  const npr = (value: number) => `NPR ${Math.round(value).toLocaleString('en-IN')}`;

  const tabs: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: 'sales', label: 'Sales Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'products', label: 'Product Reports', icon: <Package className="w-4 h-4" /> },
    { id: 'customers', label: 'Customer Reports', icon: <Users className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory Reports', icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#12151C]">Reports & Analytics</h2>
          <p className="text-xs text-[#6B7280] mt-1">Business intelligence and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="bg-white border border-[#E6E8EE] rounded-xl py-2 px-3 text-xs font-semibold text-[#12151C] focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF] outline-none"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={handleExportOrdersCsv}
            className="bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E6E8EE] pb-3 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors font-bold text-xs whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#4C63FF] text-white border-[#4C63FF]'
                : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sales Reports Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Key Sales Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <ArrowUpRight className="w-3 h-3" />
                  +12.5%
                </span>
              </div>
              <div className="text-2xl font-black text-[#12151C]">{npr(salesMetrics.totalRevenue)}</div>
              <div className="text-xs text-[#6B7280] mt-1">Total Revenue</div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="text-2xl font-black text-[#12151C]">{salesMetrics.totalOrders}</div>
              <div className="text-xs text-[#6B7280] mt-1">Total Orders</div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="text-2xl font-black text-[#12151C]">{npr(salesMetrics.averageOrderValue)}</div>
              <div className="text-xs text-[#6B7280] mt-1">Average Order Value</div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Target className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <div className="text-2xl font-black text-[#12151C]">{salesMetrics.conversionRate.toFixed(1)}%</div>
              <div className="text-xs text-[#6B7280] mt-1">Conversion Rate</div>
            </div>
          </div>

          {/* Revenue by District */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#12151C] mb-4">Revenue by District</h3>
            <div className="space-y-3">
              {topDistricts.map((district, i) => {
                const maxRevenue = Math.max(...topDistricts.map((d) => d.revenue), 1);
                const percentage = (district.revenue / maxRevenue) * 100;
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-24 text-xs font-bold text-[#12151C] truncate">{district.name}</div>
                    <div className="flex-1 h-6 bg-[#F4F5F8] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#4C63FF] to-[#7C5CFF] rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-32 text-right">
                      <div className="text-xs font-bold text-[#12151C]">{npr(district.revenue)}</div>
                      <div className="text-[10px] text-[#6B7280]">{district.count} orders</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#12151C] mb-4">Recent Sales Orders</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E8EE] text-[#6B7280] uppercase font-bold">
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F5F8]">
                  {filteredOrders.slice(0, 10).map((order) => (
                    <tr key={order.id} className="hover:bg-[#F4F5F8]">
                      <td className="py-3 px-3 font-mono font-bold text-[#4C63FF]">{order.id}</td>
                      <td className="py-3 px-3 font-bold text-[#12151C]">{order.customerName}</td>
                      <td className="py-3 px-3 text-[#6B7280]">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#12151C]">{npr(order.totalAmount)}</td>
                      <td className="py-3 px-3 text-[#6B7280] capitalize">{order.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                            order.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-700'
                              : order.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : order.status === 'placed'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {order.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Products Reports Tab */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Top Selling Products */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#12151C] mb-4">Top Selling Products (by Revenue)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E8EE] text-[#6B7280] uppercase font-bold">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">Revenue</th>
                    <th className="py-3 px-3">Units Sold</th>
                    <th className="py-3 px-3">Avg Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F5F8]">
                  {productPerformance.map((product, i) => (
                    <tr key={product.id} className="hover:bg-[#F4F5F8]">
                      <td className="py-3 px-3 font-mono font-bold text-[#6B7280]">{i + 1}</td>
                      <td className="py-3 px-3 font-bold text-[#12151C] max-w-[200px] truncate">
                        {product.name}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-600">{npr(product.revenue)}</td>
                      <td className="py-3 px-3 text-[#12151C]">{product.quantity}</td>
                      <td className="py-3 px-3 text-[#12151C]">
                        {npr(product.quantity > 0 ? product.revenue / product.quantity : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Product Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7280]">Total Products</div>
                  <div className="text-lg font-black text-[#12151C]">{products.length}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7280]">Avg Product Price</div>
                  <div className="text-lg font-black text-[#12151C]">
                    {npr(products.length > 0 ? products.reduce((sum, p) => sum + p.sellingPrice, 0) / products.length : 0)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7280]">In Stock Products</div>
                  <div className="text-lg font-black text-[#12151C]">
                    {products.filter((p) => p.stockQuantity > 0).length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Reports Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          {/* Customer Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7280]">Unique Customers</div>
                  <div className="text-lg font-black text-[#12151C]">{customerMetrics.uniqueCustomers}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7280]">Repeat Customers</div>
                  <div className="text-lg font-black text-[#12151C]">{customerMetrics.repeatCustomers}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7280]">Repeat Rate</div>
                  <div className="text-lg font-black text-[#12151C]">{customerMetrics.repeatRate.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Distribution */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#12151C] mb-4">Customer Distribution by Location</h3>
            <div className="space-y-3">
              {topDistricts.map((district, i) => {
                const maxCount = Math.max(...topDistricts.map((d) => d.count), 1);
                const percentage = (district.count / maxCount) * 100;
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-24 text-xs font-bold text-[#12151C] truncate">{district.name}</div>
                    <div className="flex-1 h-6 bg-[#F4F5F8] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-24 text-right">
                      <div className="text-xs font-bold text-[#12151C]">{district.count} customers</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Customers */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#12151C] mb-4">Top Customers by Spend</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E8EE] text-[#6B7280] uppercase font-bold">
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Orders</th>
                    <th className="py-3 px-3">Total Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F5F8]">
                  {(() => {
                    const customerSpend: Record<string, { name: string; phone: string; orders: number; spend: number }> = {};
                    filteredOrders.forEach((order) => {
                      const key = order.customerPhone;
                      if (!customerSpend[key]) {
                        customerSpend[key] = {
                          name: order.customerName,
                          phone: order.customerPhone,
                          orders: 0,
                          spend: 0,
                        };
                      }
                      customerSpend[key].orders++;
                      customerSpend[key].spend += order.totalAmount;
                    });
                    return Object.values(customerSpend)
                      .sort((a, b) => b.spend - a.spend)
                      .slice(0, 10)
                      .map((customer, i) => (
                        <tr key={i} className="hover:bg-[#F4F5F8]">
                          <td className="py-3 px-3 font-bold text-[#12151C]">{customer.name}</td>
                          <td className="py-3 px-3 text-[#6B7280]">{customer.phone}</td>
                          <td className="py-3 px-3 text-[#12151C]">{customer.orders}</td>
                          <td className="py-3 px-3 font-bold text-emerald-600">{npr(customer.spend)}</td>
                        </tr>
                      ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Reports Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Inventory Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7280]">Total Inventory Value</div>
                  <div className="text-lg font-black text-emerald-600">
                    {npr(products.reduce((sum, p) => sum + p.sellingPrice * p.stockQuantity, 0))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#6B7280]">Total Units in Stock</div>
                  <div className="text-lg font-black text-[#12151C]">
                    {products.reduce((sum, p) => sum + p.stockQuantity, 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Stock Value Products */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#12151C] mb-4">Top Products by Stock Value</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E8EE] text-[#6B7280] uppercase font-bold">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">Unit Price</th>
                    <th className="py-3 px-3">Stock</th>
                    <th className="py-3 px-3">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F5F8]">
                  {topStockProducts.map((product, i) => (
                    <tr key={product.id} className="hover:bg-[#F4F5F8]">
                      <td className="py-3 px-3 font-mono font-bold text-[#6B7280]">{i + 1}</td>
                      <td className="py-3 px-3 font-bold text-[#12151C] max-w-[200px] truncate">
                        {product.name}
                      </td>
                      <td className="py-3 px-3 text-[#12151C]">{npr(product.sellingPrice)}</td>
                      <td className="py-3 px-3 text-[#12151C]">{product.stockQuantity}</td>
                      <td className="py-3 px-3 font-bold text-emerald-600">
                        {npr(product.sellingPrice * product.stockQuantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-red-700 mb-4">Low Stock Alert (5 or less)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-red-200 text-red-700 uppercase font-bold">
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">Current Stock</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {lowStockProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-red-50">
                      <td className="py-3 px-3 font-bold text-[#12151C]">{product.name}</td>
                      <td className="py-3 px-3 font-bold text-red-600">{product.stockQuantity}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                            product.stockQuantity === 0
                              ? 'bg-red-200 text-red-800'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {product.stockQuantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

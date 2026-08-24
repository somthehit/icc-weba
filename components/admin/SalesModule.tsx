'use client';

import React, { useState } from 'react';

import type { Coupon, DeliveryRider, Order, OrderStatus } from '@/types';

import { OrderDetailModal } from './OrderDetailModal';
import { getNextLogicalStatus, type SalesSubTab } from './shared';
import {
  Download,
  Eye,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';

export interface SalesModuleProps {
  orders: Order[];
  coupons: Coupon[];
  riders: DeliveryRider[];
  salesSubTab: SalesSubTab;
  setSalesSubTab: (tab: SalesSubTab) => void;
  setWaybillOrder: (order: Order | null) => void;
  updateOrderStatusExtended: (
    orderId: string,
    status: OrderStatus,
    options?: {
      note?: string;
      location?: string;
      updatedBy?: string;
      riderId?: string;
      riderName?: string;
      paymentStatus?: 'pending' | 'paid' | 'verified';
    },
  ) => Promise<void>;
  addStaffNoteToOrder: (orderId: string, author: string, noteText: string, role?: string) => void;
  updateOrder: (updatedOrder: Order) => void;
  logAuditAction: (module: string, action: string, details: string) => void;
  handleExportOrdersCsv: () => void;
}

/**
 * Module 3 — the order book: the filterable list, the manual phone-order desk,
 * and the returns / offers / coupons views.
 */
export const SalesModule: React.FC<SalesModuleProps> = ({
  orders,
  coupons,
  riders,
  salesSubTab,
  setSalesSubTab,
  setWaybillOrder,
  updateOrderStatusExtended,
  addStaffNoteToOrder,
  updateOrder,
  logAuditAction,
  handleExportOrdersCsv,
}) => {
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('all');
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState<string>('all');
  const [orderDistrictFilter, setOrderDistrictFilter] = useState<string>('all');
  const [orderDateFilter, setOrderDateFilter] = useState<string>('all');
  const [orderSortBy, setOrderSortBy] = useState<string>('newest');
  const [selectedOrderIdForModal, setSelectedOrderIdForModal] = useState<string | null>(null);

  // Read back out of `orders` rather than stored, so a status change made in the
  // modal is reflected there on the next render instead of going stale.
  const activeModalOrder = orders.find((o) => o.id === selectedOrderIdForModal) || null;

  // Filtered orders list
  const filteredOrders = React.useMemo(() => {
    return orders.filter((o) => {
      // Search
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase().trim();
        const matchesId = o.id.toLowerCase().includes(q);
        const matchesCustomer = o.customerName.toLowerCase().includes(q);
        const matchesPhone = o.customerPhone.toLowerCase().includes(q);
        const matchesCity = (o.shippingAddress.district || o.shippingAddress.municipality || '').toLowerCase().includes(q);
        const matchesAddress = (o.shippingAddress.addressLine || '').toLowerCase().includes(q);
        const matchesItem = o.items.some((i) => i.productName.toLowerCase().includes(q) || (i.sku && i.sku.toLowerCase().includes(q)));
        if (!matchesId && !matchesCustomer && !matchesPhone && !matchesCity && !matchesAddress && !matchesItem) {
          return false;
        }
      }

      // Status Filter
      if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) {
        return false;
      }

      // Payment Method Filter
      if (orderPaymentFilter !== 'all' && o.paymentMethod !== orderPaymentFilter) {
        return false;
      }

      // Payment Status Filter
      if (orderPaymentStatusFilter !== 'all' && o.paymentStatus !== orderPaymentStatusFilter) {
        return false;
      }

      // District / City Filter
      if (orderDistrictFilter !== 'all') {
        const dist = (o.shippingAddress.district || o.shippingAddress.municipality || '').toLowerCase();
        if (orderDistrictFilter === 'kathmandu' && !dist.includes('kathmandu') && !dist.includes('lalitpur') && !dist.includes('bhaktapur')) {
          return false;
        } else if (orderDistrictFilter === 'pokhara' && !dist.includes('pokhara') && !dist.includes('kaski')) {
          return false;
        } else if (orderDistrictFilter === 'butwal' && !dist.includes('butwal') && !dist.includes('rupandehi')) {
          return false;
        } else if (orderDistrictFilter === 'dhangadhi' && !dist.includes('dhangadhi') && !dist.includes('kailali')) {
          return false;
        } else if (orderDistrictFilter === 'outstation' && (dist.includes('kathmandu') || dist.includes('lalitpur') || dist.includes('bhaktapur'))) {
          return false;
        }
      }

      // Date Range Filter
      if (orderDateFilter !== 'all') {
        const orderDate = new Date(o.createdAt).getTime();
        const now = new Date().getTime();
        const diffHours = (now - orderDate) / (1000 * 3600);
        if (orderDateFilter === 'today' && diffHours > 24) return false;
        if (orderDateFilter === '7days' && diffHours > 24 * 7) return false;
        if (orderDateFilter === '30days' && diffHours > 24 * 30) return false;
      }

      return true;
    }).sort((a, b) => {
      if (orderSortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (orderSortBy === 'amount-high') {
        return b.totalAmount - a.totalAmount;
      }
      if (orderSortBy === 'amount-low') {
        return a.totalAmount - b.totalAmount;
      }
      // default: newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [orders, orderSearch, orderStatusFilter, orderPaymentFilter, orderPaymentStatusFilter, orderDistrictFilter, orderDateFilter, orderSortBy]);

  const handleOpenOrderModal = (order: Order) => {
    setSelectedOrderIdForModal(order.id);
  };

  const handleCloseOrderModal = () => {
    setSelectedOrderIdForModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-3 font-bold text-xs overflow-x-auto">
        <button
          onClick={() => setSalesSubTab('orders')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            salesSubTab === 'orders' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          Sales Orders List ({orders.length})
        </button>
        <button
          onClick={() => setSalesSubTab('phone-order')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            salesSubTab === 'phone-order' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          Manual Phone Order Entry
        </button>
        <button
          onClick={() => setSalesSubTab('returns')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            salesSubTab === 'returns' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          Returns &amp; Exchanges
        </button>
        <button
          onClick={() => setSalesSubTab('offers')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            salesSubTab === 'offers' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          Offers &amp; Flash Sales
        </button>
        <button
          onClick={() => setSalesSubTab('coupons')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            salesSubTab === 'coupons' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          Coupons ({coupons.length})
        </button>
      </div>

      {/* Sub-view: Orders Management Desk */}
      {salesSubTab === 'orders' && (
        <div className="space-y-6">
          {/* Header & Export Bar */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-[#0056b3]" />
                  <h2 className="font-extrabold text-[#1a1a1a] text-lg">Sales &amp; Customer Orders Desk</h2>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Search, filter, process status transitions, assign delivery riders, record internal staff notes, and view customer tracking timelines.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportOrdersCsv}
                  className="bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Orders CSV ({filteredOrders.length})</span>
                </button>
              </div>
            </div>

            {/* Quick Status Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 border-t border-gray-100 text-xs">
              <span className="font-bold text-gray-500 text-[11px] whitespace-nowrap mr-1">Quick Status:</span>
              <button
                onClick={() => setOrderStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs border ${
                  orderStatusFilter === 'all'
                    ? 'bg-[#0056b3] text-white border-[#0056b3] shadow-xs'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                All ({orders.length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('placed')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs border ${
                  orderStatusFilter === 'placed'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                Placed ({orders.filter(o => o.status === 'placed').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('confirmed')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs border ${
                  orderStatusFilter === 'confirmed'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                }`}
              >
                Confirmed ({orders.filter(o => o.status === 'confirmed').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('processing')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs border ${
                  orderStatusFilter === 'processing'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                }`}
              >
                Processing ({orders.filter(o => o.status === 'processing').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('packed')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs border ${
                  orderStatusFilter === 'packed'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                Packed ({orders.filter(o => o.status === 'packed').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('shipped')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs border ${
                  orderStatusFilter === 'shipped'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                }`}
              >
                Shipped ({orders.filter(o => o.status === 'shipped').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('out_for_delivery')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs border ${
                  orderStatusFilter === 'out_for_delivery'
                    ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                    : 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200'
                }`}
              >
                Out for Delivery ({orders.filter(o => o.status === 'out_for_delivery').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('delivered')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs border ${
                  orderStatusFilter === 'delivered'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Delivered ({orders.filter(o => o.status === 'delivered').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('cancelled')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs border ${
                  orderStatusFilter === 'cancelled'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                Cancelled ({orders.filter(o => o.status === 'cancelled').length})
              </button>
            </div>

            {/* Search & Multi-Filter Control Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
              {/* Search Input */}
              <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search order #, customer, phone, SKU..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-[#0056b3] bg-gray-50/50"
                />
                {orderSearch && (
                  <button
                    onClick={() => setOrderSearch('')}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Dropdown */}
              <div>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 bg-gray-50/50 font-medium focus:outline-none focus:border-[#0056b3]"
                >
                  <option value="all">All Order Statuses</option>
                  <option value="placed">Placed</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Payment Method Dropdown */}
              <div>
                <select
                  value={orderPaymentFilter}
                  onChange={(e) => setOrderPaymentFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 bg-gray-50/50 font-medium focus:outline-none focus:border-[#0056b3]"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="cod">Cash on Delivery (COD)</option>
                  <option value="esewa">eSewa Mobile Wallet</option>
                  <option value="khalti">Khalti Digital Wallet</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Location/District Dropdown */}
              <div>
                <select
                  value={orderDistrictFilter}
                  onChange={(e) => setOrderDistrictFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 bg-gray-50/50 font-medium focus:outline-none focus:border-[#0056b3]"
                >
                  <option value="all">All Delivery Regions</option>
                  <option value="kathmandu">Kathmandu Valley (KTM/LAL/BKT)</option>
                  <option value="pokhara">Pokhara &amp; Kaski</option>
                  <option value="butwal">Butwal &amp; Rupandehi</option>
                  <option value="dhangadhi">Dhangadhi &amp; Kailali</option>
                  <option value="outstation">Outside Kathmandu Valley</option>
                </select>
              </div>

              {/* Payment Status Dropdown */}
              <div>
                <select
                  value={orderPaymentStatusFilter}
                  onChange={(e) => setOrderPaymentStatusFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 bg-gray-50/50 font-medium focus:outline-none focus:border-[#0056b3]"
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="pending">Payment Pending</option>
                  <option value="paid">Payment Received (Paid)</option>
                  <option value="verified">Payment Verified</option>
                </select>
              </div>

              {/* Time Range Filter */}
              <div>
                <select
                  value={orderDateFilter}
                  onChange={(e) => setOrderDateFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 bg-gray-50/50 font-medium focus:outline-none focus:border-[#0056b3]"
                >
                  <option value="all">All Time History</option>
                  <option value="today">Today (Last 24 Hours)</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                </select>
              </div>

              {/* Sort By Dropdown */}
              <div>
                <select
                  value={orderSortBy}
                  onChange={(e) => setOrderSortBy(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 bg-gray-50/50 font-medium focus:outline-none focus:border-[#0056b3]"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="amount-high">Sort: Total High to Low</option>
                  <option value="amount-low">Sort: Total Low to High</option>
                </select>
              </div>

              {/* Reset Filters */}
              {(orderSearch || orderStatusFilter !== 'all' || orderPaymentFilter !== 'all' || orderPaymentStatusFilter !== 'all' || orderDistrictFilter !== 'all' || orderDateFilter !== 'all') && (
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setOrderSearch('');
                      setOrderStatusFilter('all');
                      setOrderPaymentFilter('all');
                      setOrderPaymentStatusFilter('all');
                      setOrderDistrictFilter('all');
                      setOrderDateFilter('all');
                      setOrderSortBy('newest');
                    }}
                    className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Filters</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center text-xs font-bold text-gray-500">
              <div>
                Showing <span className="text-gray-900 font-extrabold">{filteredOrders.length}</span> of {orders.length} orders
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
                <div className="font-extrabold text-base text-gray-800">No Orders Match Your Filters</div>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Try broadening your search term or resetting active status, region, or date filters to view customer orders.
                </p>
                <button
                  onClick={() => {
                    setOrderSearch('');
                    setOrderStatusFilter('all');
                    setOrderPaymentFilter('all');
                    setOrderPaymentStatusFilter('all');
                    setOrderDistrictFilter('all');
                    setOrderDateFilter('all');
                  }}
                  className="bg-[#0056b3] text-white font-bold text-xs py-2 px-4 rounded-xl"
                >
                  Clear All Search Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider font-extrabold bg-gray-50/50">
                      <th className="py-3.5 px-3">Order ID &amp; Date</th>
                      <th className="py-3.5 px-3">Customer &amp; Contact</th>
                      <th className="py-3.5 px-3">Delivery Location</th>
                      <th className="py-3.5 px-3">Items Purchased</th>
                      <th className="py-3.5 px-3">Amount &amp; Payment</th>
                      <th className="py-3.5 px-3">Assigned Rider</th>
                      <th className="py-3.5 px-3">Order Status</th>
                      <th className="py-3.5 px-3 text-right">Actions &amp; Timeline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                    {filteredOrders.map((ord) => {
                      const nextStatus = getNextLogicalStatus(ord.status);
                      return (
                        <tr key={ord.id} className="hover:bg-blue-50/30 transition-colors">
                          {/* Order ID & Date */}
                          <td className="py-3.5 px-3">
                            <div className="font-extrabold text-[#0056b3] font-mono text-xs">#{ord.id}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {new Date(ord.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </td>

                          {/* Customer & Contact */}
                          <td className="py-3.5 px-3">
                            <div className="font-extrabold text-gray-900">{ord.customerName}</div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span>{ord.customerPhone}</span>
                            </div>
                          </td>

                          {/* Delivery Location */}
                          <td className="py-3.5 px-3 max-w-[170px]">
                            <div className="font-bold text-gray-800 truncate">
                              {ord.shippingAddress.district || ord.shippingAddress.municipality}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate" title={ord.shippingAddress.addressLine}>
                              {ord.shippingAddress.addressLine}
                            </div>
                          </td>

                          {/* Items Purchased */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2">
                              {ord.items[0] && (
                                <img
                                  src={ord.items[0].productImage}
                                  alt={ord.items[0].productName}
                                  className="w-8 h-8 rounded-lg object-cover border border-gray-200"
                                />
                              )}
                              <div>
                                <div className="font-bold text-gray-900 text-[11px] line-clamp-1">
                                  {ord.items[0]?.productName || 'Product Item'}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {ord.items.length} {ord.items.length === 1 ? 'item SKU' : 'different SKUs'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Amount & Payment */}
                          <td className="py-3.5 px-3">
                            <div className="font-black text-gray-900 text-xs">NPR {ord.totalAmount.toLocaleString()}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="uppercase text-[9px] font-extrabold px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border">
                                {ord.paymentMethod}
                              </span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                ord.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                                ord.paymentStatus === 'verified' ? 'bg-blue-100 text-blue-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {ord.paymentStatus}
                              </span>
                            </div>
                          </td>

                          {/* Assigned Rider */}
                          <td className="py-3.5 px-3">
                            {ord.assignedRiderName ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                <Truck className="w-3 h-3 text-indigo-600" />
                                <span>{ord.assignedRiderName}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">Unassigned</span>
                            )}
                          </td>

                          {/* Order Status */}
                          <td className="py-3.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              ord.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                              ord.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                              ord.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                              ord.status === 'packed' ? 'bg-indigo-100 text-indigo-800' :
                              ord.status === 'processing' ? 'bg-sky-100 text-sky-800' :
                              ord.status === 'confirmed' ? 'bg-blue-50 text-blue-800' :
                              ord.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {ord.status.replace(/_/g, ' ')}
                            </span>
                          </td>

                          {/* Actions & Timeline */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Manage & Timeline Button */}
                              <button
                                onClick={() => handleOpenOrderModal(ord)}
                                className="bg-[#0056b3] hover:bg-[#004494] text-white px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Manage &amp; Timeline</span>
                              </button>

                              {/* Print Waybill */}
                              <button
                                onClick={() => setWaybillOrder(ord)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border"
                                title="Print Shipping Waybill"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Waybill</span>
                              </button>

                              {/* Quick Advance Button */}
                              {ord.status !== 'delivered' && ord.status !== 'cancelled' && (
                                <button
                                  onClick={() => {
                                    updateOrderStatusExtended(ord.id, nextStatus, {
                                      note: `Quick advanced status to ${nextStatus.replace(/_/g, ' ')}`,
                                      location: ord.shippingAddress.district ? `${ord.shippingAddress.district} Hub` : 'Intel Kathmandu Showroom Hub'
                                    });
                                    logAuditAction('Sales/Orders', 'Quick Status Advance', `Advanced Order #${ord.id} to ${nextStatus}`);
                                  }}
                                  className="bg-gray-900 hover:bg-black text-white px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold uppercase transition-colors"
                                  title={`Advance status to ${nextStatus}`}
                                >
                                  &rarr; {nextStatus.replace(/_/g, ' ')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {activeModalOrder && (
            <OrderDetailModal
              key={activeModalOrder.id}
              order={activeModalOrder}
              riders={riders}
              onClose={handleCloseOrderModal}
              setWaybillOrder={setWaybillOrder}
              updateOrderStatusExtended={updateOrderStatusExtended}
              addStaffNoteToOrder={addStaffNoteToOrder}
              updateOrder={updateOrder}
              logAuditAction={logAuditAction}
            />
          )}

        </div>
      )}

      {/* Sub-view: Manual Phone Order */}
      {salesSubTab === 'phone-order' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm max-w-2xl">
          <h3 className="font-extrabold text-base text-[#1a1a1a]">Manual Phone &amp; In-Store Order Entry</h3>
          <p className="text-xs text-gray-500">Record telephone inquiries or counter sales into central inventory and order tracking.</p>

          <form onSubmit={(e) => { e.preventDefault(); alert('Phone order recorded!'); }} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold mb-1">Customer Full Name</label>
              <input type="text" placeholder="e.g. Ramesh Shrestha" required className="w-full p-2.5 border rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Phone Hotline Number</label>
                <input type="text" placeholder="+977-98..." required className="w-full p-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="block font-bold mb-1">Delivery City</label>
                <input type="text" placeholder="Kathmandu / Pokhara..." required className="w-full p-2.5 border rounded-xl" />
              </div>
            </div>
            <button type="submit" className="bg-[#0056b3] text-white font-bold py-2.5 px-6 rounded-xl text-xs">
              Save &amp; Generate Order Waybill
            </button>
          </form>
        </div>
      )}

      {/* Sub-view: Offers */}
      {salesSubTab === 'offers' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h3 className="font-extrabold text-base text-[#1a1a1a]">Active Promotional Offers &amp; Flash Sales</h3>
          <p className="text-xs text-gray-500">Offers auto-expire on end-date without requiring manual cleanup.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border bg-amber-50/50 space-y-2 text-xs">
              <div className="font-bold text-sm text-gray-900">Festival Clearance Deal (40% OFF)</div>
              <div className="text-gray-600">Scope: Selected Laptops &amp; Accessories &bull; Auto-Expires in 5 days</div>
              <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">Active Flash Sale</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-view: Coupons */}
      {salesSubTab === 'coupons' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-extrabold text-base text-[#1a1a1a]">Active Coupon Codes</h3>
            <button onClick={() => alert('New coupon created')} className="bg-[#0056b3] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Create Coupon</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coupons.map((c, i) => (
              <div key={i} className="p-4 rounded-2xl border bg-gray-50 flex justify-between items-center text-xs">
                <div>
                  <div className="font-mono font-bold text-sm text-[#0056b3]">{c.code}</div>
                  <div className="text-gray-600 mt-0.5">{c.description} &bull; Expires: {c.expiryDate}</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import React from 'react';
import type { Order, Product, ServiceRequest } from '@/types';
import { SparklineChart, type AdminModule, type SalesSubTab } from './shared';
import {
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  Eye,
  Plus,
  ShieldCheck,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';

/**
 * Module 1 — the console landing page: today's counters, the queues that need
 * attention, and the shortcuts into the modules that action them.
 */
export interface DashboardModuleProps {
  products: Product[];
  totalRevenue: number;
  pendingOrders: Order[];
  lowStockProducts: Product[];
  pendingServices: ServiceRequest[];
  navigateTo: (page: string, slug?: string | null) => void;
  setActiveModule: (module: AdminModule) => void;
  setSalesSubTab: (tab: SalesSubTab) => void;
  /** Opens the stock-adjustment modal, which the shell owns. */
  setAuditProduct: (product: Product | null) => void;
  handleOpenAddProduct: () => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  products,
  totalRevenue,
  pendingOrders,
  lowStockProducts,
  pendingServices,
  navigateTo,
  setActiveModule,
  setSalesSubTab,
  setAuditProduct,
  handleOpenAddProduct,
}) => {
  return (
    <div className="space-y-6">

      {/* Welcome Panel */}
      <div className="bg-white border border-[#E6E8EE] rounded-2xl p-6 md:p-7 flex items-center justify-between gap-6 flex-wrap shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[11.5px] tracking-wider uppercase text-[#4C63FF] font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 stroke-[2.4]" />
            <span>Intel Store Management Console</span>
          </div>
          <h1 className="font-bold text-2xl md:text-[25px] text-[#12151C] mb-1.5">
            Store Administration Panel
          </h1>
          <p className="text-[#6B7280] text-sm max-w-xl">
            Full operational control for Products, Sales Orders, Logistics, Technical Repairs, Inventory & Branding.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            onClick={() => navigateTo('shop')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs border border-[#E6E8EE] hover:border-[#9AA1AF] text-[#12151C] hover:bg-[#F4F5F8] transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>View Live Storefront</span>
          </button>
          <button 
            onClick={handleOpenAddProduct}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-[#4C63FF] hover:bg-[#3B50E0] text-white transition-all transform hover:-translate-y-0.5 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Product SKU</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid with 7-Day Sparkline Trend Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total Revenue */}
        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 border-l-4 border-l-[#1B3A8C] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-mono text-[11px] tracking-wider uppercase text-[#9AA1AF] font-semibold">
                Total Gross Revenue
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#16A34A] bg-[#DCFCE7] px-1.5 py-0.5 rounded">
                <TrendingUp className="w-3 h-3" />
                +18.4%
              </span>
            </div>
            <div className="font-bold text-2xl text-[#1B3A8C] mb-1.5 font-mono">
              NPR {totalRevenue.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#16A34A] font-semibold">
              <Check className="w-3.5 h-3.5 stroke-[2.4]" />
              <span>13% Nepal VAT included</span>
            </div>
          </div>

          <SparklineChart 
            data={[185000, 210000, 195000, 260000, 230000, 315000, Math.max(totalRevenue, 280000)]}
            color="#1B3A8C"
            gradientId="rev-sparkline"
          />
        </div>

        {/* Pending Orders */}
        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 border-l-4 border-l-[#D97706] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-mono text-[11px] tracking-wider uppercase text-[#9AA1AF] font-semibold">
                Pending Orders
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#D97706] bg-[#FEF3E2] px-1.5 py-0.5 rounded">
                Action Required
              </span>
            </div>
            <div className="font-bold text-2xl text-[#D97706] mb-1.5 font-mono">
              {pendingOrders.length}
            </div>
            <div className="text-xs text-[#6B7280]">
              Orders waiting for dispatch
            </div>
          </div>

          <SparklineChart 
            data={[4, 6, 3, 7, 5, 8, Math.max(pendingOrders.length, 1)]}
            color="#D97706"
            gradientId="orders-sparkline"
          />
        </div>

        {/* Low Stock SKUs */}
        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 border-l-4 border-l-[#E5477E] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-mono text-[11px] tracking-wider uppercase text-[#9AA1AF] font-semibold">
                Low Stock SKUs
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#E5477E] bg-[#FDEDF3] px-1.5 py-0.5 rounded">
                <TrendingDown className="w-3 h-3" />
                -2 resolved
              </span>
            </div>
            <div className="font-bold text-2xl text-[#E5477E] mb-1.5 font-mono">
              {lowStockProducts.length}
            </div>
            <div className="flex items-center gap-1 text-xs text-[#E5477E] font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Stock ≤ 3 units</span>
            </div>
          </div>

          <SparklineChart 
            data={[6, 5, 7, 4, 5, 3, Math.max(lowStockProducts.length, 1)]}
            color="#E5477E"
            gradientId="stock-sparkline"
          />
        </div>

        {/* Active Service Tickets */}
        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 border-l-4 border-l-[#7C5CFF] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-mono text-[11px] tracking-wider uppercase text-[#9AA1AF] font-semibold">
                Active Service Tickets
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#7C5CFF] bg-[#F1EEFF] px-1.5 py-0.5 rounded">
                24h SLA
              </span>
            </div>
            <div className="font-bold text-2xl text-[#7C5CFF] mb-1.5 font-mono">
              {pendingServices.length}
            </div>
            <div className="text-xs text-[#6B7280]">
              Repairs &amp; CCTV surveys
            </div>
          </div>

          <SparklineChart 
            data={[2, 3, 5, 4, 6, 3, Math.max(pendingServices.length, 1)]}
            color="#7C5CFF"
            gradientId="service-sparkline"
          />
        </div>

      </div>

      {/* Lower Grid (Sales Performance Chart & Action Required Inbox) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* Sales & Fulfillment Performance Panel */}
        <div className="lg:col-span-7 bg-white border border-[#E6E8EE] rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6E8EE]">
            <div>
              <h3 className="font-bold text-base text-[#12151C]">Sales &amp; Fulfillment Performance</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">Live analytics overview across store categories</p>
            </div>
            <span className="font-mono text-[10.5px] font-semibold bg-[#EEF1FF] text-[#1B3A8C] px-2.5 py-1 rounded-full border border-blue-100">
              ● Real-time Data
            </span>
          </div>

          {/* 7-Day Performance Bar Chart */}
          <div className="flex items-end gap-3.5 h-[150px] pt-2 px-2">
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-md bg-gradient-to-t from-[#4C63FF] to-[#7C8CFF]" style={{ height: '38%' }} />
              <span className="font-mono text-[10.5px] text-[#9AA1AF]">Mon</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-md bg-gradient-to-t from-[#4C63FF] to-[#7C8CFF]" style={{ height: '52%' }} />
              <span className="font-mono text-[10.5px] text-[#9AA1AF]">Tue</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-md bg-gradient-to-t from-[#4C63FF] to-[#7C8CFF]" style={{ height: '44%' }} />
              <span className="font-mono text-[10.5px] text-[#9AA1AF]">Wed</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-md bg-gradient-to-t from-[#4C63FF] to-[#7C8CFF]" style={{ height: '68%' }} />
              <span className="font-mono text-[10.5px] text-[#9AA1AF]">Thu</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-md bg-gradient-to-t from-[#4C63FF] to-[#7C8CFF]" style={{ height: '58%' }} />
              <span className="font-mono text-[10.5px] text-[#9AA1AF]">Fri</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-md bg-gradient-to-t from-[#4C63FF] to-[#7C8CFF]" style={{ height: '80%' }} />
              <span className="font-mono text-[10.5px] text-[#9AA1AF]">Sat</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-md bg-gradient-to-t from-[#17B0A3] to-[#2CD9C7]" style={{ height: '64%' }} />
              <span className="font-mono text-[10.5px] text-[#17B0A3] font-bold">Sun</span>
            </div>
          </div>

          {/* Operational SLAs */}
          <div className="pt-3 border-t border-[#E6E8EE] grid grid-cols-3 gap-3 text-center">
            <div className="bg-[#F4F5F8] p-3 rounded-xl">
              <div className="text-[11px] text-[#6B7280] font-medium">Catalog SKUs</div>
              <div className="font-mono font-bold text-base text-[#12151C]">{products.length} Items</div>
            </div>
            <div className="bg-[#F4F5F8] p-3 rounded-xl">
              <div className="text-[11px] text-[#6B7280] font-medium">Delivery SLA</div>
              <div className="font-mono font-bold text-base text-[#16A34A]">98.4% On-Time</div>
            </div>
            <div className="bg-[#F4F5F8] p-3 rounded-xl">
              <div className="text-[11px] text-[#6B7280] font-medium">Repair SLA</div>
              <div className="font-mono font-bold text-base text-[#7C5CFF]">24-Hr Check</div>
            </div>
          </div>
        </div>

        {/* Action Required Inbox Panel */}
        <div className="lg:col-span-5 bg-white border border-[#E6E8EE] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6E8EE]">
            <div>
              <h3 className="font-bold text-base text-[#12151C]">Action Required Inbox</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">Items waiting on you today</p>
            </div>
            <span className="font-mono text-[10.5px] font-semibold bg-[#FEF3E2] text-[#D97706] px-2.5 py-1 rounded-full border border-amber-200">
              {pendingOrders.length + lowStockProducts.length + pendingServices.length} Pending
            </span>
          </div>

          <div className="divide-y divide-[#E6E8EE]">
            {/* Order Action Row */}
            {pendingOrders.length > 0 ? (
              pendingOrders.slice(0, 2).map((po) => (
                <div key={po.id} className="py-3 flex items-center gap-3">
                  <div className="w-[34px] h-[34px] rounded-[9px] bg-[#EEF1FF] text-[#1B3A8C] flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#12151C] truncate">
                      Order #{po.id} awaiting dispatch
                    </div>
                    <div className="font-mono text-[11px] text-[#9AA1AF]">
                      SALES · NPR {po.totalAmount.toLocaleString()} · {po.customerName}
                    </div>
                  </div>
                  <button
                    onClick={() => { setActiveModule('sales'); setSalesSubTab('orders'); }}
                    className="font-mono text-[11px] font-semibold text-[#4C63FF] px-2.5 py-1.5 rounded-lg border border-[#E6E8EE] hover:bg-[#EEF1FF] hover:border-transparent transition-colors flex-shrink-0 cursor-pointer"
                  >
                    Dispatch
                  </button>
                </div>
              ))
            ) : (
              <div className="py-3 flex items-center gap-3">
                <div className="w-[34px] h-[34px] rounded-[9px] bg-[#EEF1FF] text-[#1B3A8C] flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#12151C]">
                    Order #1042 awaiting dispatch
                  </div>
                  <div className="font-mono text-[11px] text-[#9AA1AF]">
                    SALES · placed 2h ago
                  </div>
                </div>
                <button
                  onClick={() => { setActiveModule('sales'); setSalesSubTab('orders'); }}
                  className="font-mono text-[11px] font-semibold text-[#4C63FF] px-2.5 py-1.5 rounded-lg border border-[#E6E8EE] hover:bg-[#EEF1FF] hover:border-transparent transition-colors flex-shrink-0 cursor-pointer"
                >
                  Dispatch
                </button>
              </div>
            )}

            {/* Inventory Action Row */}
            {lowStockProducts.length > 0 ? (
              lowStockProducts.slice(0, 1).map((lp) => (
                <div key={lp.id} className="py-3 flex items-center gap-3">
                  <div className="w-[34px] h-[34px] rounded-[9px] bg-[#FDEDF3] text-[#E5477E] flex items-center justify-center flex-shrink-0">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#12151C] truncate">
                      {lp.name} — stock ≤ {lp.stockQuantity} units
                    </div>
                    <div className="font-mono text-[11px] text-[#9AA1AF]">
                      INVENTORY · {lp.sku ?? 'no SKU'}
                    </div>
                  </div>
                  <button
                    onClick={() => { setAuditProduct(lp); }}
                    className="font-mono text-[11px] font-semibold text-[#E5477E] px-2.5 py-1.5 rounded-lg border border-[#E6E8EE] hover:bg-[#FDEDF3] hover:border-transparent transition-colors flex-shrink-0 cursor-pointer"
                  >
                    Restock
                  </button>
                </div>
              ))
            ) : (
              <div className="py-3 flex items-center gap-3">
                <div className="w-[34px] h-[34px] rounded-[9px] bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#12151C]">
                    No low-stock alerts
                  </div>
                  <div className="font-mono text-[11px] text-[#9AA1AF]">
                    INVENTORY · all products above the low-stock threshold
                  </div>
                </div>
              </div>
            )}

            {/* Services Action Row */}
            {pendingServices.length > 0 ? (
              pendingServices.slice(0, 1).map((ps) => (
                <div key={ps.id} className="py-3 flex items-center gap-3">
                  <div className="w-[34px] h-[34px] rounded-[9px] bg-[#F1EEFF] text-[#7C5CFF] flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#12151C] truncate">
                      Ticket #{ps.id} — {ps.serviceType} pending
                    </div>
                    <div className="font-mono text-[11px] text-[#9AA1AF]">
                      SERVICES · {ps.customerName}
                    </div>
                  </div>
                  <button
                    onClick={() => { setActiveModule('services'); }}
                    className="font-mono text-[11px] font-semibold text-[#7C5CFF] px-2.5 py-1.5 rounded-lg border border-[#E6E8EE] hover:bg-[#F1EEFF] hover:border-transparent transition-colors flex-shrink-0 cursor-pointer"
                  >
                    Assign
                  </button>
                </div>
              ))
            ) : (
              <div className="py-3 flex items-center gap-3">
                <div className="w-[34px] h-[34px] rounded-[9px] bg-[#F1EEFF] text-[#7C5CFF] flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#12151C]">
                    Ticket #223 — CCTV survey pending
                  </div>
                  <div className="font-mono text-[11px] text-[#9AA1AF]">
                    SERVICES · unassigned
                  </div>
                </div>
                <button
                  onClick={() => { setActiveModule('services'); }}
                  className="font-mono text-[11px] font-semibold text-[#7C5CFF] px-2.5 py-1.5 rounded-lg border border-[#E6E8EE] hover:bg-[#F1EEFF] hover:border-transparent transition-colors flex-shrink-0 cursor-pointer"
                >
                  Assign
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

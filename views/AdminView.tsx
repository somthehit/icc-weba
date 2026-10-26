'use client';

// views/AdminView.tsx
//
// The admin console shell: sidebar, topbar, and the switch that picks a module.
//
// Each module lives in `components/admin/` and owns the state only it uses. What
// stays here is what more than one module reads — the module selection, the header
// search box, the two shared modals, and the counters the sidebar badges show.

import React, { useState } from 'react';

import { useStore } from '@/context/StoreContext';
import {
  INITIAL_ADMIN_USERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_DELIVERY_ZONES,
  INITIAL_RIDERS,
  INITIAL_STOCK_ADJUSTMENTS,
} from '@/lib/data/initial-data';
import type {
  AdminUser,
  AuditLogEntry,
  DeliveryRider,
  DeliveryZone,
  Order,
  Product,
  StockAdjustment,
} from '@/types';

import { CatalogModule } from '@/components/admin/CatalogModule';
import { ContentModule } from '@/components/admin/ContentModule';
import { CustomersModule } from '@/components/admin/CustomersModule';
import { InquiriesModule } from '@/components/admin/InquiriesModule';
import { ReviewsModule } from '@/components/admin/ReviewsModule';
import { DashboardModule } from '@/components/admin/DashboardModule';
import { DeliveryModule } from '@/components/admin/DeliveryModule';
import { InventoryModule } from '@/components/admin/InventoryModule';
import { ProductFormModal } from '@/components/admin/ProductFormModal';
import { ReportsModule } from '@/components/admin/ReportsModule';
import { SalesModule } from '@/components/admin/SalesModule';
import { SeoModule } from '@/components/admin/SeoModule';
import { ServicesModule } from '@/components/admin/ServicesModule';
import { SettingsModule } from '@/components/admin/SettingsModule';
import { StaffModule } from '@/components/admin/StaffModule';
import { AccountModule } from '@/components/admin/AccountModule';
import { AccountantDashboard } from '@/components/admin/AccountantDashboard';
import { AdminPosModule } from '@/components/admin/AdminPosModule';
import { AdminAccountingModule } from '@/components/admin/AdminAccountingModule';
import { StockAuditModal } from '@/components/admin/StockAuditModal';
import { WaybillModal } from '@/components/admin/WaybillModal';
import { useProductForm } from '@/components/admin/useProductForm';
import {
  genAdminId,
  type AdminModule,
  type SalesSubTab,
  type StockAuditReason,
} from '@/components/admin/shared';

import {
  BarChart3,
  Boxes,
  DollarSign,
  Eye,
  LayoutDashboard,
  Package,
  Palette,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
  User,
  Wrench,
  MessageSquare,
  Star,
  Globe2,
  Banknote,
  AlertTriangle,
  Trash2,
  Loader2,
  LogOut,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const {
    products,
    orders,
    serviceRequests,
    coupons,
    siteSettings,
    updateSiteSettings,
    // Brands and categories come from the database (`/api/brands`,
    // `/api/categories`) and publish their slug as `id` — which is exactly what
    // the product form has to send back.
    brands,
    categories,
    saveProduct,
    deleteProduct,
    archiveProduct,
    updateProduct,
    updateOrderStatusExtended,
    addStaffNoteToOrder,
    updateOrder,
    updateServiceStatus,
    navigateTo,
    currentUser,
    adminUser,
    logoutAdmin,
  } = useStore();

  const activeAdmin = adminUser || currentUser;

  const handleAdminLogout = () => {
    logoutAdmin();
    navigateTo('admin-login');
  };

  const [activeModule, setActiveModule] = useState<AdminModule>('dashboard');

  /**
   * Sales sub-tab, held here rather than in `SalesModule`.
   *
   * The dashboard's "review pending orders" shortcut opens Sales *on the orders
   * list*, so the selection has to survive the module switch that mounts it.
   */
  const [salesSubTab, setSalesSubTab] = useState<SalesSubTab>('orders');

  /** The topbar search box, which the catalogue table also filters on. */
  const [searchQuery, setSearchQuery] = useState('');

  // Demo state still waiting on an API. Kept in the shell because the sidebar
  // badges and two modules read the same arrays.
  const [deliveryZones] = useState<DeliveryZone[]>(INITIAL_DELIVERY_ZONES);
  const [riders] = useState<DeliveryRider[]>(INITIAL_RIDERS);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(
    INITIAL_STOCK_ADJUSTMENTS,
  );
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(INITIAL_ADMIN_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  // Stock audit modal — opened from both the dashboard's low-stock queue and the
  // catalogue table, so it is the shell that owns it.
  const [auditProduct, setAuditProduct] = useState<Product | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState<number>(0);
  const [auditReason, setAuditReason] = useState<StockAuditReason>('supplier_restock');
  const [auditSuccessMsg, setAuditSuccessMsg] = useState('');

  /** The order whose delivery slip is being printed — opened from two places in Sales. */
  const [waybillOrder, setWaybillOrder] = useState<Order | null>(null);

  // Calculated Metrics
  const totalRevenue = orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const pendingOrders = orders.filter((o) => o.status === 'placed' || o.status === 'confirmed');
  const lowStockProducts = products.filter((p) => p.stockQuantity <= 3);
  const pendingServices = serviceRequests.filter(
    (s) => s.status === 'pending' || s.status === 'assigned',
  );

  const logAuditAction = (module: string, action: string, details: string) => {
    const newEntry: AuditLogEntry = {
      id: genAdminId('log'),
      timestamp: new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }),
      adminName: 'Admin (System Owner)',
      role: 'Super Admin',
      module,
      action,
      details,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };


  const handleStockAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditProduct) return;

    const newQty = Math.max(0, auditProduct.stockQuantity + stockAdjustment);
    const updatedProd: Product = {
      ...auditProduct,
      stockQuantity: newQty,
      inStock: newQty > 0,
    };

    updateProduct(updatedProd);

    // Record stock adjustment log
    const adjustmentRecord: StockAdjustment = {
      id: genAdminId('adj'),
      productId: auditProduct.id,
      productName: auditProduct.name,
      quantityDelta: stockAdjustment,
      reason: auditReason,
      timestamp: new Date().toLocaleString(),
      adminName: 'Admin (System Owner)',
    };

    setStockAdjustments((prev) => [adjustmentRecord, ...prev]);
    logAuditAction('Inventory', 'Stock Adjustment', `Adjusted stock for ${auditProduct.name} by ${stockAdjustment} units (Reason: ${auditReason}).`);

    setAuditSuccessMsg(`Stock updated successfully! New Stock: ${newQty} units.`);
    setTimeout(() => {
      setAuditSuccessMsg('');
      setAuditProduct(null);
      setStockAdjustment(0);
    }, 1500);
  };

  const exportCsv = (filename: string, dataStr: string) => {
    const blob = new Blob([dataStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportProductsCsv = () => {
    let csvStr = 'SKU,ID,Name,Brand,Category,MRP,SellingPrice,Stock,Status\n';
    products.forEach((p) => {
      csvStr += `"${p.sku ?? ''}","${p.id}","${p.name}","${p.brand}","${p.category}",${p.mrp},${p.sellingPrice},${p.stockQuantity},"${p.status || 'active'}"\n`;
    });
    exportCsv('ICE_Products_Catalog_Export', csvStr);
    logAuditAction('Catalog', 'Export CSV', 'Exported products catalog to CSV format.');
  };

  const handleExportOrdersCsv = () => {
    let csvStr = 'OrderID,Customer,Phone,City,TotalNPR,Payment,Status,Date\n';
    orders.forEach((o) => {
      csvStr += `"${o.id}","${o.customerName}","${o.customerPhone}","${o.shippingAddress.district || o.shippingAddress.municipality}",${o.totalAmount},"${o.paymentMethod}","${o.status}","${o.createdAt}"\n`;
    });
    exportCsv('ICE_Orders_Export', csvStr);
    logAuditAction('Sales', 'Export CSV', 'Exported sales orders list to CSV.');
  };

  // In-app confirmation modal state for deleting products
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<{
    id: string;
    name: string;
    permanent: boolean;
  } | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Delete product handler (opens in-app modal instead of fragile window.confirm)
  const handleDeleteProduct = (prodId: string, prodName: string, permanent = true) => {
    setDeleteError(null);
    setDeleteProductConfirm({ id: prodId, name: prodName, permanent });
  };

  const handleConfirmDelete = async () => {
    if (!deleteProductConfirm) return;
    setIsDeletingProduct(true);
    setDeleteError(null);
    try {
      const result = await deleteProduct(deleteProductConfirm.id, deleteProductConfirm.permanent);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      logAuditAction(
        'Catalog',
        deleteProductConfirm.permanent ? 'Delete Product (Permanent)' : 'Discontinue Product',
        `${deleteProductConfirm.permanent ? 'Permanently deleted' : 'Discontinued'} product: ${deleteProductConfirm.name} (ID: ${deleteProductConfirm.id})`,
      );
      setDeleteProductConfirm(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'An error occurred while deleting the product.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const handleSoftDeleteProduct = (prodId: string, prodName: string) => {
    return handleDeleteProduct(prodId, prodName, false);
  };

  /**
   * The add/edit product form.
   *
   * Called here because two modules open it — the dashboard's "Add New Product
   * SKU" button and the catalogue's Add/Edit actions — while the modal that
   * renders it is a sibling of both.
   */
  const productForm = useProductForm({
    products,
    brands,
    categories,
    saveProduct,
    deleteProduct,
    logAuditAction,
  });

  return (
    <div className="h-screen w-full bg-[#F4F5F8] text-[#12151C] flex flex-col md:flex-row font-sans overflow-hidden">
      
      {/* ================= SIDEBAR ================= */}
      <aside className="w-full md:w-[248px] h-auto md:h-full flex-shrink-0 bg-[#0F1420] text-[#C7CBDA] flex flex-col p-4 overflow-y-auto overscroll-contain scrollbar-sidebar border-r border-white/5 select-none z-30">
        
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-2 pb-5 border-b border-white/10 mb-4">
          <div className="w-[34px] h-[34px] rounded-[9px] bg-gradient-to-br from-[#4C63FF] to-[#7C5CFF] flex items-center justify-center font-bold text-white text-[15px] flex-shrink-0 shadow-sm font-mono">
            IC
          </div>
          <div className="leading-tight">
            <div className="font-bold text-[14px] text-white tracking-tight">ICE Console</div>
            <div className="font-mono text-[10px] text-[#7E8AA8] tracking-wider">ADMIN · v2.4</div>
          </div>
        </div>

        {/* Operations Section */}
        <div className="font-mono text-[10px] tracking-widest text-[#5C6580] uppercase px-2.5 pt-3 pb-2 font-semibold">
          Operations
        </div>
        <nav className="flex flex-col gap-1">
          <button
            onClick={() => setActiveModule('dashboard')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'dashboard'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Dashboard</span>
          </button>

          {/* Apex Retail POS Terminal */}
          <button
            onClick={() => setActiveModule('pos')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13px] font-semibold transition-all text-left w-full ${
              activeModule === 'pos'
                ? 'bg-[#006b45] text-white ring-2 ring-[#82d8a9] shadow-md shadow-emerald-950/40 font-bold'
                : 'bg-[#006b45]/90 hover:bg-[#006b45] text-emerald-100 border border-[#82d8a9]/50 shadow-xs'
            }`}
          >
            <Banknote className="w-4 h-4 flex-shrink-0 text-[#82d8a9]" />
            <span className="flex-1">Apex POS Terminal</span>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-[#82d8a9] font-bold">
              LIVE
            </span>
          </button>

          {/* Central Accounting & Invoices Hub */}
          <button
            onClick={() => setActiveModule('accounting')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13px] font-semibold transition-all text-left w-full ${
              activeModule === 'accounting'
                ? 'bg-blue-800 text-white ring-2 ring-blue-400 shadow-md shadow-blue-950/40 font-bold'
                : 'bg-blue-900/70 hover:bg-blue-800/90 text-blue-100 border border-blue-400/40 shadow-xs'
            }`}
          >
            <DollarSign className="w-4 h-4 flex-shrink-0 text-blue-300" />
            <span className="flex-1">Accounting Hub</span>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-blue-500/40 text-blue-100 font-bold">
              ERP
            </span>
          </button>

          <button
            onClick={() => setActiveModule('catalog')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'catalog'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <Package className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Catalog</span>
            <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full ${
              activeModule === 'catalog' ? 'bg-white/20 text-white' : 'bg-white/5 text-[#8891A8]'
            }`}>
              {products.length}
            </span>
          </button>

          <button
            onClick={() => setActiveModule('sales')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'sales'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            {pendingOrders.length > 0 ? (
              <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse flex-shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-[#3D465C] flex-shrink-0" />
            )}
            <ShoppingBag className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Sales</span>
            <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full ${
              activeModule === 'sales' ? 'bg-white/20 text-white' : 'bg-white/5 text-[#8891A8]'
            }`}>
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveModule('delivery')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'delivery'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Delivery</span>
          </button>

          <button
            onClick={() => setActiveModule('services')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'services'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            {pendingServices.length > 0 ? (
              <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse flex-shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-[#3D465C] flex-shrink-0" />
            )}
            <Wrench className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Services</span>
            <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full ${
              activeModule === 'services' ? 'bg-white/20 text-white' : 'bg-white/5 text-[#8891A8]'
            }`}>
              {serviceRequests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveModule('inventory')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'inventory' || activeModule === 'storekeeper'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            {lowStockProducts.length > 0 ? (
              <span className="w-2 h-2 rounded-full bg-[#E5477E] animate-pulse flex-shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-[#3D465C] flex-shrink-0" />
            )}
            <Boxes className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Inventory & Store</span>
            {lowStockProducts.length > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 font-bold">
                {lowStockProducts.length} low
              </span>
            )}
          </button>
        </nav>

        {/* Storefront Section */}
        <div className="font-mono text-[10px] tracking-widest text-[#5C6580] uppercase px-2.5 pt-6 pb-2 font-semibold">
          Storefront & Management
        </div>
        <nav className="flex flex-col gap-1">
          <button
            onClick={() => setActiveModule('content')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'content'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Site & Content</span>
          </button>

          <button
            onClick={() => setActiveModule('seo')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'seo'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <Globe2 className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">SEO & Region</span>
          </button>

          <button
            onClick={() => setActiveModule('customers')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'customers'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Customers</span>
          </button>

          <button
            onClick={() => setActiveModule('inquiries')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'inquiries'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Inquiries</span>
          </button>

          <button
            onClick={() => setActiveModule('reviews')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'reviews'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <Star className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Reviews</span>
          </button>

          <button
            onClick={() => setActiveModule('reports')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'reports'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Reports</span>
          </button>

          <button
            onClick={() => setActiveModule('accountant')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'accountant'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <Banknote className="w-4 h-4 flex-shrink-0 opacity-90 text-emerald-400" />
            <span className="flex-1">Accountant (EOD)</span>
          </button>

          <button
            onClick={() => setActiveModule('settings')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'settings'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Settings</span>
          </button>

          <button
            onClick={() => setActiveModule('staff')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'staff'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">Staff & Roles</span>
          </button>

          <button
            onClick={() => setActiveModule('account')}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-medium transition-all text-left w-full ${
              activeModule === 'account'
                ? 'bg-[#4C63FF] text-white font-semibold shadow-sm'
                : 'text-[#B4BACC] hover:bg-[#181F30] hover:text-white'
            }`}
          >
            <User className="w-4 h-4 flex-shrink-0 opacity-90" />
            <span className="flex-1">My Account</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto pt-4 border-t border-white/10 space-y-1.5">
          <button
            onClick={handleAdminLogout}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-[13px] font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 w-full transition-all text-left group"
            title="Sign Out of Admin Console"
          >
            <LogOut className="w-4 h-4 flex-shrink-0 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
            <span className="flex-1">Sign Out</span>
          </button>

          <div className="flex items-center gap-2 font-mono text-[11px] text-[#8891A8] px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            <span>All systems nominal</span>
          </div>
        </div>
      </aside>

      {/* ================= MAIN AREA ================= */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        
        {/* Topbar */}
        <header className="flex-shrink-0 z-20 flex items-center justify-between gap-4 px-6 md:px-8 py-3.5 bg-white border-b border-[#E6E8EE] shadow-2xs">
          {/* Breadcrumb */}
          <div className="font-mono text-xs text-[#9AA1AF]">
            Console / <b className="text-[#12151C] capitalize">
              {activeModule === 'pos'
                ? 'Apex POS Terminal'
                : activeModule === 'accounting'
                ? 'Accounting Hub (ERP)'
                : activeModule === 'storekeeper' || activeModule === 'inventory'
                ? 'Inventory & Store (GRN)'
                : activeModule.replace('-', ' ')}
            </b>
          </div>

          {/* Quick Search cmdk */}
          <div className="hidden md:flex items-center gap-2 bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl px-3 py-2 text-xs text-[#9AA1AF] w-full max-w-[360px]">
            <Search className="w-3.5 h-3.5 text-[#9AA1AF]" />
            <input 
              type="text"
              placeholder="Search orders, SKUs, customers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-[#12151C] placeholder-[#9AA1AF] focus:outline-none w-full font-sans"
            />
            <kbd className="font-mono text-[10px] bg-white border border-[#E6E8EE] rounded px-1.5 py-0.5 text-[#6B7280] shadow-2xs">
              ⌘K
            </kbd>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => navigateTo('shop')}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E6E8EE] hover:bg-[#F4F5F8] text-[#12151C] transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Storefront</span>
            </button>

            <button 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#F4F5F8] relative transition-colors"
              title="Notifications"
            >
              <ShieldCheck className="w-4 h-4" />
              {(pendingOrders.length > 0 || lowStockProducts.length > 0) && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E5477E] ring-2 ring-white" />
              )}
            </button>

            <button onClick={() => setActiveModule('account')} className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-[#F4F5F8]" title="Open admin profile">
              {activeAdmin?.avatarUrl ? (
                <img
                  src={activeAdmin.avatarUrl}
                  alt={activeAdmin.name}
                  referrerPolicy="no-referrer"
                  className="h-[34px] w-[34px] rounded-full object-cover"
                />
              ) : (
                <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gradient-to-br from-[#4C63FF] to-[#7C5CFF] text-[13px] font-bold text-white shadow-xs">
                  {activeAdmin?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'A'}
                </div>
              )}
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-bold text-[#12151C]">{activeAdmin?.name || 'Admin'}</span>
                <span className="block text-[10px] capitalize text-[#6B7280]">{activeAdmin?.role?.replace('_', ' ') || 'Administrator'}</span>
              </span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleAdminLogout}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-2xs cursor-pointer"
              title="Logout from Admin Console"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Content Container */}
        <main id="admin-main-scroll" className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-main p-6 md:p-8">
          <div className="space-y-6 max-w-7xl w-full mx-auto">

          {activeModule === 'pos' && (
            <AdminPosModule />
          )}

          {activeModule === 'dashboard' && (
            <DashboardModule
              products={products}
              orders={orders}
              totalRevenue={totalRevenue}
              pendingOrders={pendingOrders}
              lowStockProducts={lowStockProducts}
              pendingServices={pendingServices}
              navigateTo={navigateTo}
              setActiveModule={setActiveModule}
              setSalesSubTab={setSalesSubTab}
              setAuditProduct={setAuditProduct}
              handleOpenAddProduct={productForm.handleOpenAddProduct}
            />
          )}

          {activeModule === 'catalog' && (
            <CatalogModule
              products={products}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setAuditProduct={setAuditProduct}
              handleExportProductsCsv={handleExportProductsCsv}
              handleOpenAddProduct={productForm.handleOpenAddProduct}
              handleOpenEditProduct={productForm.handleOpenEditProduct}
              handleDeleteProduct={handleDeleteProduct}
              handleSoftDeleteProduct={handleSoftDeleteProduct}
            />
          )}

          {activeModule === 'sales' && (
            <SalesModule
              orders={orders}
              coupons={coupons}
              riders={riders}
              salesSubTab={salesSubTab}
              setSalesSubTab={setSalesSubTab}
              setWaybillOrder={setWaybillOrder}
              updateOrderStatusExtended={updateOrderStatusExtended}
              addStaffNoteToOrder={addStaffNoteToOrder}
              updateOrder={updateOrder}
              logAuditAction={logAuditAction}
              handleExportOrdersCsv={handleExportOrdersCsv}
            />
          )}

          {activeModule === 'delivery' && (
            <DeliveryModule
              deliveryZones={deliveryZones}
              riders={riders}
              orders={orders}
              logAuditAction={logAuditAction}
            />
          )}

          {activeModule === 'services' && (
            <ServicesModule
              serviceRequests={serviceRequests}
              updateServiceStatus={updateServiceStatus}
              logAuditAction={logAuditAction}
            />
          )}

          {(activeModule === 'inventory' || activeModule === 'storekeeper') && (
            <InventoryModule
              products={products}
              stockAdjustments={stockAdjustments}
            />
          )}

          {activeModule === 'content' && (
            <ContentModule
              siteSettings={siteSettings}
              updateSiteSettings={updateSiteSettings}
              logAuditAction={logAuditAction}
            />
          )}

          {activeModule === 'seo' && <SeoModule logAuditAction={logAuditAction} />}

          {activeModule === 'customers' && <CustomersModule />}

          {activeModule === 'inquiries' && <InquiriesModule />}

          {activeModule === 'reviews' && <ReviewsModule />}

          {activeModule === 'reports' && (
            <ReportsModule
              products={products}
              orders={orders}
              totalRevenue={totalRevenue}
              handleExportOrdersCsv={handleExportOrdersCsv}
            />
          )}

          {activeModule === 'accounting' && (
            <AdminAccountingModule orders={orders} products={products} />
          )}

          {activeModule === 'accountant' && (
            <AccountantDashboard />
          )}

          {activeModule === 'settings' && <SettingsModule />}

          {activeModule === 'staff' && <StaffModule adminUsers={adminUsers} auditLogs={auditLogs} onAdminUsersChange={setAdminUsers} />}

          {activeModule === 'account' && <AccountModule auditLogs={auditLogs} />}

          </div>
        </main>
      </div>

      <StockAuditModal
        auditProduct={auditProduct}
        setAuditProduct={setAuditProduct}
        stockAdjustment={stockAdjustment}
        setStockAdjustment={setStockAdjustment}
        auditReason={auditReason}
        setAuditReason={setAuditReason}
        auditSuccessMsg={auditSuccessMsg}
        handleStockAdjustmentSubmit={handleStockAdjustmentSubmit}
      />

      <WaybillModal waybillOrder={waybillOrder} setWaybillOrder={setWaybillOrder} />

      {productForm.isProductModalOpen && (
        <ProductFormModal form={productForm} brands={brands} categories={categories} />
      )}

      {/* Delete Product Confirmation Modal */}
      {deleteProductConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 id="delete-dialog-title" className="text-base font-bold text-gray-900">
                    {deleteProductConfirm.permanent ? 'Delete Product' : 'Discontinue Product'}
                  </h3>
                  <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
                    {deleteProductConfirm.permanent ? (
                      <>
                        Are you sure you want to permanently delete <strong className="text-gray-900 font-semibold">{deleteProductConfirm.name}</strong>?
                        This will completely remove the product, images, specifications, and inventory records from the database.
                      </>
                    ) : (
                      <>
                        Set product status to discontinued for <strong className="text-gray-900 font-semibold">{deleteProductConfirm.name}</strong>?
                        Past order history will be preserved.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingProduct) {
                    setDeleteProductConfirm(null);
                    setDeleteError(null);
                  }
                }}
                disabled={isDeletingProduct}
                className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200/60 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingProduct}
                data-testid="confirm-delete-product-btn"
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {isDeletingProduct ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleteProductConfirm.permanent ? 'Permanently Delete' : 'Discontinue'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

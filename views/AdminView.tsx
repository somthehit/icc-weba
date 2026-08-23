'use client';

import React, { useMemo, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { SKU_MAX_LENGTH, buildSku, uniqueSku, validateSku } from '@/lib/catalog/sku';
import { 
  Product, 
  OrderStatus, 
  Order, 
  DeliveryZone, 
  DeliveryRider, 
  Technician, 
  StockAdjustment, 
  Supplier, 
  BlogPost, 
  FaqItem, 
  Testimonial, 
  AdminUser, 
  AuditLogEntry,
  ServiceType
} from '@/types';
import { 
  INITIAL_DELIVERY_ZONES,
  INITIAL_RIDERS,
  INITIAL_TECHNICIANS,
  INITIAL_STOCK_ADJUSTMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_BLOG_POSTS,
  INITIAL_FAQS,
  INITIAL_TESTIMONIALS,
  INITIAL_ADMIN_USERS,
  INITIAL_AUDIT_LOGS,
  TECHNICAL_SERVICES
} from '@/lib/data/initial-data';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Truck, 
  Wrench, 
  Boxes, 
  FileText, 
  Users, 
  BarChart3, 
  Settings, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Check, 
  X, 
  AlertTriangle, 
  Printer, 
  FileSpreadsheet, 
  RefreshCw, 
  ArrowRight, 
  Globe, 
  Palette, 
  Save, 
  Store, 
  PhoneCall, 
  CheckCircle2, 
  ShieldAlert, 
  Tag, 
  Sliders, 
  UserCheck, 
  History, 
  Eye, 
  Lock, 
  BookOpen, 
  MessageSquare, 
  HelpCircle,
  FolderTree,
  Award,
  Download,
  Upload,
  Calendar,
  Layers,
  Send,
  Clock,
  CreditCard,
  ArrowUpDown,
  Phone,
  Mail,
  FileCheck,
  MapPin,
  User,
  ClipboardList,
  RotateCcw,
  Filter,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

let uniqueIdSeq = 1;
const genAdminId = (prefix: string) => `${prefix}-${uniqueIdSeq++}`;

const SparklineChart: React.FC<{
  data: number[];
  color: string;
  gradientId: string;
  height?: number;
}> = ({ data, color, gradientId, height = 32 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const width = 120;
  const pad = 3;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - pad - ((val - min) / range) * (height - pad * 2);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const pathStr = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaStr = `${pathStr} L ${width},${height} L 0,${height} Z`;
  const lastPoint = points[points.length - 1];

  return (
    <div className="w-full mt-3 pt-2 border-t border-[#F0F2F6]">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[9px] uppercase tracking-wider text-[#9AA1AF] font-medium">7D Trend</span>
        <span className="font-mono text-[9.5px] text-[#475569] font-semibold">
          {data[data.length - 1].toLocaleString()}
        </span>
      </div>
      <div className="h-[32px] w-full relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaStr} fill={`url(#${gradientId})`} />
          <path
            d={pathStr}
            fill="none"
            stroke={color}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3"
            fill={color}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
};

export const AdminView: React.FC = () => {
  const { 
    products, 
    orders, 
    serviceRequests, 
    coupons, 
    siteSettings,
    updateSiteSettings,
    addProduct, 
    updateProduct, 
    deleteProduct, 
    updateOrderStatus, 
    updateOrderStatusExtended,
    addStaffNoteToOrder,
    updateOrder,
    updateServiceStatus, 
    navigateTo 
  } = useStore();

  // Top Module Tab State (11 Modules)
  const [activeModule, setActiveModule] = useState<
    'dashboard' | 'catalog' | 'sales' | 'delivery' | 'services' | 
    'inventory' | 'content' | 'customers' | 'reports' | 'settings' | 'staff'
  >('dashboard');

  // Sub-tabs state
  const [catalogSubTab, setCatalogSubTab] = useState<'products' | 'categories' | 'brands' | 'attributes' | 'tags'>('products');
  const [salesSubTab, setSalesSubTab] = useState<'orders' | 'phone-order' | 'returns' | 'offers' | 'coupons'>('orders');
  const [deliverySubTab, setDeliverySubTab] = useState<'zones' | 'riders' | 'assignments' | 'failed'>('zones');
  const [servicesSubTab, setServicesSubTab] = useState<'requests' | 'types' | 'technicians'>('requests');
  const [inventorySubTab, setInventorySubTab] = useState<'adjustments' | 'suppliers' | 'low-stock'>('adjustments');
  const [contentSubTab, setContentSubTab] = useState<'branding' | 'banners' | 'pages' | 'blog' | 'testimonials' | 'faqs'>('branding');
  const [settingsSubTab, setSettingsSubTab] = useState<'company' | 'payments' | 'delivery-defaults' | 'tax' | 'notifications'>('company');
  const [staffSubTab, setStaffSubTab] = useState<'users' | 'roles' | 'audit'>('users');

  // Interactive local states for CRUD modules
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>(INITIAL_DELIVERY_ZONES);
  const [riders, setRiders] = useState<DeliveryRider[]>(INITIAL_RIDERS);
  const [technicians, setTechnicians] = useState<Technician[]>(INITIAL_TECHNICIANS);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(INITIAL_STOCK_ADJUSTMENTS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(INITIAL_BLOG_POSTS);
  const [faqs, setFaqs] = useState<FaqItem[]>(INITIAL_FAQS);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(INITIAL_TESTIMONIALS);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(INITIAL_ADMIN_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  // Search & Filter Query
  const [searchQuery, setSearchQuery] = useState('');

  // Branding Form State
  const [settingsForm, setSettingsForm] = useState(siteSettings);
  const [isSettingsSavedMsg, setIsSettingsSavedMsg] = useState(false);

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Stock Audit Modal
  const [auditProduct, setAuditProduct] = useState<Product | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState<number>(0);
  const [auditReason, setAuditReason] = useState<'damaged' | 'recount' | 'supplier_restock' | 'correction'>('supplier_restock');
  const [auditSuccessMsg, setAuditSuccessMsg] = useState('');

  // Waybill Modal
  const [waybillOrder, setWaybillOrder] = useState<Order | null>(null);

  // New Product Form
  const [prodForm, setProdForm] = useState({
    name: '',
    brand: 'Dell',
    sku: '',
    category: 'computers-laptops' as any,
    mrp: 100000,
    sellingPrice: 85000,
    stockQuantity: 10,
    shortDescription: '',
    image: 'https://picsum.photos/seed/intel-laptop1/600/400',
    offerToggle: true,
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 15,
    offerStart: '',
    offerEnd: '',
    flashSaleBadge: false,
    stackableWithCoupons: false,
    isNewArrival: true,
    isFeatured: false,
    isBestSeller: false,
    isTrending: false,
    tags: ['Core i5', '16GB RAM', 'Business laptop'],
  });

  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // ------------------------------------------------------------------ SKU
  //
  // `products.sku` is NOT NULL behind a unique index, so the form has to produce
  // one. It is suggested from brand + title while the field is untouched, and left
  // strictly alone the moment a staff member types their own.

  /** True once the SKU has been typed in by hand — stops the suggestion overwriting it. */
  const [isSkuEdited, setIsSkuEdited] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);

  /**
   * Every SKU in the catalogue apart from the product being edited.
   *
   * The exclusion matters: re-saving an unchanged product must not report its own
   * SKU as a duplicate of itself.
   */
  const otherSkus = useMemo(
    () =>
      products
        .filter((p) => p.id !== editingProduct?.id)
        .map((p) => p.sku)
        .filter((sku): sku is string => Boolean(sku)),
    [products, editingProduct?.id],
  );

  /**
   * The SKU a new product would get from its current brand and title.
   *
   * Only offered while creating. An existing product's SKU is printed on order
   * lines and stock adjustments, so renaming the product must not silently
   * renumber the stock it has already shipped.
   */
  const suggestedSku = useMemo(() => {
    if (editingProduct) return '';
    const base = buildSku(prodForm.brand, prodForm.name);
    return base ? uniqueSku(base, otherSkus) : '';
  }, [editingProduct, prodForm.brand, prodForm.name, otherSkus]);

  /** What the field shows: the typed value, or the live suggestion. */
  const skuValue = isSkuEdited ? prodForm.sku : suggestedSku || prodForm.sku;

  // Categories list
  const categoriesList = [
    { id: 'computers-laptops', name: 'Computers & Laptops', slug: 'computers-laptops', parent: 'None', count: products.filter(p => p.category === 'computers-laptops').length },
    { id: 'pc-components', name: 'PC Components', slug: 'pc-components', parent: 'None', count: products.filter(p => p.category === 'pc-components').length },
    { id: 'peripherals-accessories', name: 'Peripherals & Accessories', slug: 'peripherals-accessories', parent: 'None', count: products.filter(p => p.category === 'peripherals-accessories').length },
    { id: 'printers-scanners', name: 'Printers & Scanners', slug: 'printers-scanners', parent: 'None', count: products.filter(p => p.category === 'printers-scanners').length },
    { id: 'cctv-security', name: 'CCTV & Security Systems', slug: 'cctv-security', parent: 'None', count: products.filter(p => p.category === 'cctv-security').length },
    { id: 'networking', name: 'Networking Equipment', slug: 'networking', parent: 'None', count: products.filter(p => p.category === 'networking').length },
  ];

  // Brands list
  const brandsList = [
    { id: 'dell', name: 'Dell', slug: 'dell', logo: 'https://picsum.photos/seed/dell-logo/120/60', count: products.filter(p => p.brand.toLowerCase() === 'dell').length },
    { id: 'hp', name: 'HP', slug: 'hp', logo: 'https://picsum.photos/seed/hp-logo/120/60', count: products.filter(p => p.brand.toLowerCase() === 'hp').length },
    { id: 'lenovo', name: 'Lenovo', slug: 'lenovo', logo: 'https://picsum.photos/seed/lenovo-logo/120/60', count: products.filter(p => p.brand.toLowerCase() === 'lenovo').length },
    { id: 'epson', name: 'Epson', slug: 'epson', logo: 'https://picsum.photos/seed/epson-logo/120/60', count: products.filter(p => p.brand.toLowerCase() === 'epson').length },
    { id: 'hikvision', name: 'Hikvision', slug: 'hikvision', logo: 'https://picsum.photos/seed/hikvision-logo/120/60', count: products.filter(p => p.brand.toLowerCase() === 'hikvision').length },
  ];

  // Calculated Metrics
  const totalRevenue = orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const pendingOrders = orders.filter((o) => o.status === 'placed' || o.status === 'confirmed');
  const lowStockProducts = products.filter((p) => p.stockQuantity <= 3);
  const pendingServices = serviceRequests.filter((s) => s.status === 'pending' || s.status === 'assigned');

  // Helper to log audit actions
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

  // Sales/Orders Module Specific Filter & Modal State
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('all');
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState<string>('all');
  const [orderDistrictFilter, setOrderDistrictFilter] = useState<string>('all');
  const [orderDateFilter, setOrderDateFilter] = useState<string>('all');
  const [orderSortBy, setOrderSortBy] = useState<string>('newest');

  // Selected Order Modal State
  const [selectedOrderIdForModal, setSelectedOrderIdForModal] = useState<string | null>(null);

  // Modal Interactive Form Inputs
  const [modalNewStaffNote, setModalNewStaffNote] = useState('');
  const [modalStatusNote, setModalStatusNote] = useState('');
  const [modalStatusLocation, setModalStatusLocation] = useState('Intel Kathmandu Hub');
  const [modalTargetStatus, setModalTargetStatus] = useState<OrderStatus>('confirmed');
  const [modalAssignedRider, setModalAssignedRider] = useState('');
  const [modalActiveTab, setModalActiveTab] = useState<'timeline' | 'details' | 'notes'>('timeline');

  // Active selected order object derived from StoreContext
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

  const getNextLogicalStatus = (current: OrderStatus): OrderStatus => {
    switch (current) {
      case 'placed': return 'confirmed';
      case 'confirmed': return 'processing';
      case 'processing': return 'packed';
      case 'packed': return 'shipped';
      case 'shipped': return 'out_for_delivery';
      case 'out_for_delivery': return 'delivered';
      case 'delivered': return 'delivered';
      case 'cancelled': return 'cancelled';
      default: return 'confirmed';
    }
  };

  // Order modal handlers
  const handleOpenOrderModal = (order: Order) => {
    setSelectedOrderIdForModal(order.id);
    setModalTargetStatus(getNextLogicalStatus(order.status));
    setModalStatusLocation(order.shippingAddress.district ? `${order.shippingAddress.district} Delivery Hub` : 'Intel Kathmandu Showroom Hub');
    setModalStatusNote('');
    setModalNewStaffNote('');
    setModalAssignedRider(order.assignedRiderName || '');
    setModalActiveTab('timeline');
  };

  const handleCloseOrderModal = () => {
    setSelectedOrderIdForModal(null);
  };

  const handleApplyStatusTransition = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeModalOrder) return;

    updateOrderStatusExtended(activeModalOrder.id, modalTargetStatus, {
      note: modalStatusNote.trim() || `Status updated to ${modalTargetStatus.replace(/_/g, ' ')}.`,
      location: modalStatusLocation.trim() || 'Intel Kathmandu Showroom Hub',
      updatedBy: 'Admin (Sales Desk)',
      riderName: modalAssignedRider || activeModalOrder.assignedRiderName,
    });

    logAuditAction('Sales/Orders', 'Status Transition', `Updated Order #${activeModalOrder.id} status to ${modalTargetStatus}`);
    setModalStatusNote('');
  };

  const handleAddStaffNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalOrder || !modalNewStaffNote.trim()) return;

    addStaffNoteToOrder(activeModalOrder.id, 'Admin (Sales Desk)', modalNewStaffNote.trim(), 'Sales Officer');
    logAuditAction('Sales/Orders', 'Internal Note Added', `Added internal staff note to Order #${activeModalOrder.id}`);
    setModalNewStaffNote('');
  };

  const handleAssignRiderInModal = (riderName: string) => {
    if (!activeModalOrder) return;
    setModalAssignedRider(riderName);
    const updated = {
      ...activeModalOrder,
      assignedRiderName: riderName,
    };
    updateOrder(updated);
    logAuditAction('Sales/Orders', 'Rider Assignment', `Assigned rider ${riderName} to Order #${activeModalOrder.id}`);
  };

  const handleUpdatePaymentStatusInModal = (newPayStatus: 'pending' | 'paid' | 'verified') => {
    if (!activeModalOrder) return;
    const updated = {
      ...activeModalOrder,
      paymentStatus: newPayStatus,
    };
    updateOrder(updated);
    logAuditAction('Sales/Orders', 'Payment Status Update', `Updated payment status to ${newPayStatus} for Order #${activeModalOrder.id}`);
  };

  // Save branding settings
  const handleSaveSiteSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSiteSettings(settingsForm);
    setIsSettingsSavedMsg(true);
    logAuditAction('Site Elements & Branding', 'Update Branding', 'Updated site name, logo URL, and announcement banner.');
    setTimeout(() => {
      setIsSettingsSavedMsg(false);
    }, 3000);
  };

  // Product Tag handlers
  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    if (!prodForm.tags.includes(newTagInput.trim())) {
      setProdForm({ ...prodForm, tags: [...prodForm.tags, newTagInput.trim()] });
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setProdForm({ ...prodForm, tags: prodForm.tags.filter((t) => t !== tagToRemove) });
  };

  // Stock adjustment handler
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

  // CSV Export utility
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

  // Handle Save Product
  const handleSaveProductModal = (e: React.FormEvent) => {
    e.preventDefault();

    // Checked here rather than only in the markup: `products_sku_idx` is a unique
    // index, so a duplicate that slipped through would come back as an opaque
    // constraint violation instead of something the operator can act on.
    const sku = skuValue.trim();
    const skuProblem = validateSku(sku, otherSkus);
    if (skuProblem) {
      setSkuError(skuProblem);
      return;
    }
    setSkuError(null);

    if (editingProduct && editingProduct.id) {
      // Edit existing
      const updated: Product = {
        ...(editingProduct as Product),
        name: prodForm.name,
        brand: prodForm.brand,
        sku,
        category: prodForm.category,
        mrp: prodForm.mrp,
        sellingPrice: prodForm.sellingPrice,
        stockQuantity: prodForm.stockQuantity,
        inStock: prodForm.stockQuantity > 0,
        shortDescription: prodForm.shortDescription,
        images: [prodForm.image],
        offerToggle: prodForm.offerToggle,
        discountType: prodForm.discountType,
        discountValue: prodForm.discountValue,
        offerStart: prodForm.offerStart,
        offerEnd: prodForm.offerEnd,
        flashSaleBadge: prodForm.flashSaleBadge,
        stackableWithCoupons: prodForm.stackableWithCoupons,
        isNewArrival: prodForm.isNewArrival,
        isFeatured: prodForm.isFeatured,
        isBestSeller: prodForm.isBestSeller,
        isTrending: prodForm.isTrending,
        tags: prodForm.tags,
      };
      updateProduct(updated);
      logAuditAction('Catalog', 'Update Product', `Updated product: ${updated.name} (SKU ${sku})`);
    } else {
      // Create new
      const newProd: Product = {
        id: genAdminId('p'),
        slug: prodForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: prodForm.name,
        brand: prodForm.brand,
        sku,
        category: prodForm.category,
        mrp: prodForm.mrp,
        sellingPrice: prodForm.sellingPrice,
        stockQuantity: prodForm.stockQuantity,
        inStock: prodForm.stockQuantity > 0,
        rating: 5,
        reviewCount: 0,
        shortDescription: prodForm.shortDescription,
        fullDescription: prodForm.shortDescription,
        specifications: { 'Warranty': '1 Year Official Nepal Warranty' },
        features: ['Official Warranty', 'Genuine Import'],
        images: [prodForm.image],
        isNewArrival: prodForm.isNewArrival,
        isFeatured: prodForm.isFeatured,
        isBestSeller: prodForm.isBestSeller,
        isTrending: prodForm.isTrending,
        tags: prodForm.tags,
        warrantyMonths: 12,
        offerToggle: prodForm.offerToggle,
        discountType: prodForm.discountType,
        discountValue: prodForm.discountValue,
        offerStart: prodForm.offerStart,
        offerEnd: prodForm.offerEnd,
        flashSaleBadge: prodForm.flashSaleBadge,
        stackableWithCoupons: prodForm.stackableWithCoupons,
        status: 'active',
      };
      addProduct(newProd);
      logAuditAction('Catalog', 'Create Product', `Created new product: ${newProd.name} (SKU ${sku})`);
    }

    setIsProductModalOpen(false);
    setEditingProduct(null);
    setIsSkuEdited(false);
    setSkuError(null);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    // An existing product's SKU is already on its order lines and stock
    // adjustments, so it is shown as-is and never re-derived from the title.
    setIsSkuEdited(true);
    setSkuError(null);
    setProdForm({
      name: p.name,
      brand: p.brand,
      sku: p.sku || '',
      category: p.category,
      mrp: p.mrp,
      sellingPrice: p.sellingPrice,
      stockQuantity: p.stockQuantity,
      shortDescription: p.shortDescription || '',
      image: p.images[0] || 'https://picsum.photos/seed/intel-laptop1/600/400',
      offerToggle: p.offerToggle || false,
      discountType: p.discountType || 'percentage',
      discountValue: p.discountValue || 10,
      offerStart: p.offerStart || '',
      offerEnd: p.offerEnd || '',
      flashSaleBadge: p.flashSaleBadge || false,
      stackableWithCoupons: p.stackableWithCoupons || false,
      isNewArrival: p.isNewArrival || false,
      isFeatured: p.isFeatured || false,
      isBestSeller: p.isBestSeller || false,
      isTrending: p.isTrending || false,
      tags: p.tags || [],
    });
    setIsProductModalOpen(true);
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    // Back to suggesting from brand + title.
    setIsSkuEdited(false);
    setSkuError(null);
    setProdForm({
      name: '',
      brand: 'Dell',
      sku: '',
      category: 'computers-laptops',
      mrp: 100000,
      sellingPrice: 85000,
      stockQuantity: 10,
      shortDescription: '',
      image: 'https://picsum.photos/seed/intel-laptop1/600/400',
      offerToggle: false,
      discountType: 'percentage',
      discountValue: 10,
      offerStart: '',
      offerEnd: '',
      flashSaleBadge: false,
      stackableWithCoupons: false,
      isNewArrival: true,
      isFeatured: false,
      isBestSeller: false,
      isTrending: false,
      tags: ['Official Warranty'],
    });
    setIsProductModalOpen(true);
  };

  // Soft delete product handler
  const handleSoftDeleteProduct = (prodId: string, prodName: string) => {
    if (confirm(`Set product status to discontinued for "${prodName}"? Past order history will be preserved.`)) {
      deleteProduct(prodId);
      logAuditAction('Catalog', 'Soft Delete Product', `Discontinued product SKU: ${prodName}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-[#12151C] flex flex-col md:flex-row font-sans w-full">
      
      {/* ================= SIDEBAR ================= */}
      <aside className="w-full md:w-[248px] flex-shrink-0 bg-[#0F1420] text-[#C7CBDA] flex flex-col p-4 md:sticky md:top-0 md:h-screen md:overflow-y-auto border-r border-white/5 select-none z-30">
        
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
              activeModule === 'inventory'
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
            <span className="flex-1">Inventory</span>
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
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#8891A8] px-2.5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            <span>All systems nominal</span>
          </div>
        </div>
      </aside>

      {/* ================= MAIN AREA ================= */}
      <div className="flex-1 min-w-0 flex flex-col">
        
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 md:px-8 py-3.5 bg-white border-b border-[#E6E8EE] shadow-2xs">
          {/* Breadcrumb */}
          <div className="font-mono text-xs text-[#9AA1AF]">
            Console / <b className="text-[#12151C] capitalize">{activeModule.replace('-', ' ')}</b>
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
          <div className="flex items-center gap-3">
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

            <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#4C63FF] to-[#7C5CFF] text-white font-bold text-[13px] flex items-center justify-center shadow-xs">
              N
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="p-6 md:p-8 space-y-6 max-w-7xl w-full">

          {/* Module 1: Dashboard */}
          {activeModule === 'dashboard' && (
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
                            onClick={() => { setActiveModule('services'); setServicesSubTab('requests'); }}
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
                          onClick={() => { setActiveModule('services'); setServicesSubTab('requests'); }}
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
          )}

      {/* ========================================================================= */}
      {/* MODULE 2: CATALOG MANAGEMENT */}
      {/* ========================================================================= */}
      {activeModule === 'catalog' && (
        <div className="space-y-6">
          {/* Sub Tab Buttons */}
          <div className="flex gap-2 border-b border-gray-200 pb-3 font-bold text-xs overflow-x-auto">
            <button
              onClick={() => setCatalogSubTab('products')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                catalogSubTab === 'products' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Products SKU Catalog
            </button>
            <button
              onClick={() => setCatalogSubTab('categories')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                catalogSubTab === 'categories' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Category Tree
            </button>
            <button
              onClick={() => setCatalogSubTab('brands')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                catalogSubTab === 'brands' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Brand Directory
            </button>
            <button
              onClick={() => setCatalogSubTab('attributes')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                catalogSubTab === 'attributes' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Attributes &amp; Specs
            </button>
            <button
              onClick={() => setCatalogSubTab('tags')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                catalogSubTab === 'tags' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Faceted Filter Tags
            </button>
          </div>

          {/* Sub-view: Products */}
          {catalogSubTab === 'products' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product name, brand, SKU..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#0056b3] outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportProductsCsv}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Catalog CSV</span>
                  </button>

                  <button
                    onClick={handleOpenAddProduct}
                    className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product</span>
                  </button>
                </div>
              </div>

              {/* Products Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider font-extrabold bg-gray-50/50">
                      <th className="py-3 px-3">Item Photo</th>
                      <th className="py-3 px-3">Product Name &amp; SKU</th>
                      <th className="py-3 px-3">Brand</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Selling Price</th>
                      <th className="py-3 px-3">Stock Units</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                    {products
                      .filter((p) => {
                        // The placeholder above offers SKU search, so it has to
                        // actually look there.
                        const q = searchQuery.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          p.name.toLowerCase().includes(q) ||
                          p.brand.toLowerCase().includes(q) ||
                          (p.sku ?? '').toLowerCase().includes(q)
                        );
                      })
                      .map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-contain rounded-lg border bg-white p-0.5" />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-gray-900">{p.name}</div>
                            {/* The column is "Name & SKU" — show the SKU, not the row id. */}
                            {p.sku ? (
                              <div className="text-[10px] text-gray-500 font-mono font-bold">{p.sku}</div>
                            ) : (
                              <div className="text-[10px] text-amber-600 font-mono font-bold" title="This product has no SKU — add one before stocking or selling it.">
                                no SKU
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">{p.brand}</td>
                          <td className="py-2.5 px-3 capitalize">{p.category.replace('-', ' ')}</td>
                          <td className="py-2.5 px-3 font-bold text-[#0056b3]">NPR {p.sellingPrice.toLocaleString()}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              p.stockQuantity <= 3 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {p.stockQuantity} in stock
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'discontinued' ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {p.status || 'Active'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setAuditProduct(p)}
                                title="Adjust Stock"
                                className="p-1.5 hover:bg-blue-50 text-[#0056b3] rounded-lg transition-colors"
                              >
                                <Boxes className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEditProduct(p)}
                                title="Edit Product"
                                className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSoftDeleteProduct(p.id, p.name)}
                                title="Discontinue Product"
                                className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-view: Categories */}
          {catalogSubTab === 'categories' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-extrabold text-base text-[#1a1a1a]">Category Hierarchy &amp; Navigation Tree</h3>
                <button
                  onClick={() => alert('New category dialog created.')}
                  className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>
              </div>

              <div className="space-y-3">
                {categoriesList.map((cat) => (
                  <div key={cat.id} className="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-[#0056b3]" />
                        <span>{cat.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Slug: <code className="bg-gray-200 px-1 py-0.5 rounded text-[11px]">{cat.slug}</code> &bull; {cat.count} active products assigned
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        Active Menu Item
                      </span>
                      <button
                        onClick={() => {
                          if (cat.count > 0) {
                            alert(`Cannot delete category "${cat.name}". It contains ${cat.count} products. Reassign or remove products first.`);
                          } else {
                            alert(`Category "${cat.name}" deleted.`);
                          }
                        }}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg border border-transparent hover:border-rose-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-view: Brands */}
          {catalogSubTab === 'brands' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-extrabold text-base text-[#1a1a1a]">Official Brand Partners Directory</h3>
                <button
                  onClick={() => alert('Brand creation form opened.')}
                  className="bg-[#0056b3] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Brand</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {brandsList.map((brand) => (
                  <div key={brand.id} className="p-4 rounded-2xl border border-gray-200 bg-white flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-base text-gray-900">{brand.name}</span>
                      <Award className="w-4 h-4 text-[#0056b3]" />
                    </div>
                    <div className="text-xs text-gray-500">
                      {brand.count} verified Nepal warranty SKUs in catalog
                    </div>
                    <div className="pt-2 border-t flex justify-between items-center text-xs">
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                        Authorized Brand
                      </span>
                      <button
                        onClick={() => {
                          if (brand.count > 0) {
                            alert(`Cannot delete brand "${brand.name}". Contains ${brand.count} products.`);
                          } else {
                            alert(`Brand "${brand.name}" removed.`);
                          }
                        }}
                        className="text-rose-600 hover:underline font-bold text-[11px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-view: Attributes & Specs */}
          {catalogSubTab === 'attributes' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-[#1a1a1a]">Product Specifications &amp; Filter Attributes</h3>
                  <p className="text-xs text-gray-500">Drives dynamic faceted shop filters automatically without code changes</p>
                </div>
                <button onClick={() => alert('Attribute key added.')} className="bg-[#0056b3] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Attribute</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 border rounded-2xl bg-gray-50 space-y-1">
                  <div className="font-bold text-gray-900 text-sm">Processor Generation / CPU</div>
                  <div className="text-gray-500">Scope: Computers &amp; Laptops &bull; Type: Select Filter &bull; Filterable: Yes</div>
                </div>
                <div className="p-4 border rounded-2xl bg-gray-50 space-y-1">
                  <div className="font-bold text-gray-900 text-sm">System RAM Memory</div>
                  <div className="text-gray-500">Scope: Computers &amp; Laptops &bull; Type: Select Filter &bull; Filterable: Yes</div>
                </div>
                <div className="p-4 border rounded-2xl bg-gray-50 space-y-1">
                  <div className="font-bold text-gray-900 text-sm">CCTV Camera Resolution (Megapixels)</div>
                  <div className="text-gray-500">Scope: CCTV &amp; Security &bull; Type: Number &bull; Filterable: Yes</div>
                </div>
                <div className="p-4 border rounded-2xl bg-gray-50 space-y-1">
                  <div className="font-bold text-gray-900 text-sm">Printer Ink Type (Tank / Laser)</div>
                  <div className="text-gray-500">Scope: Printers &amp; Scanners &bull; Type: Select Filter &bull; Filterable: Yes</div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-view: Tags */}
          {catalogSubTab === 'tags' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-base text-[#1a1a1a]">Cross-Cutting Faceted Filter Tags</h3>
              <p className="text-xs text-gray-500">Tags enable custom cross-category filter pills like &quot;Gaming&quot;, &quot;Business&quot;, &quot;Student Pick&quot;, &quot;Hot Deal&quot;.</p>
              
              <div className="flex flex-wrap gap-2 pt-2">
                {['Core i5', 'Core i7', '16GB RAM', 'Gaming Laptop', 'Student Pick', 'Office Printer', 'IP Camera', '4K CCTV', 'Nepal Warranty'].map((t, idx) => (
                  <span key={idx} className="bg-blue-50 text-[#0056b3] border border-blue-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    <span>{t}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 3: SALES & ORDERS */}
      {/* ========================================================================= */}
      {activeModule === 'sales' && (
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

              {/* Order Detail, Delivery Tracking & Staff Notes Modal */}
              {selectedOrderIdForModal && activeModalOrder && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
                  <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-100">
                    
                    {/* Modal Header Bar */}
                    <div className="p-5 border-b border-gray-200 bg-gray-50/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xl text-[#0056b3] font-mono">
                            Order #{activeModalOrder.id}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            activeModalOrder.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                            activeModalOrder.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            activeModalOrder.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {activeModalOrder.status.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                            activeModalOrder.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            Payment: {activeModalOrder.paymentStatus} ({activeModalOrder.paymentMethod.toUpperCase()})
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Placed on {new Date(activeModalOrder.createdAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setWaybillOrder(activeModalOrder)}
                          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Waybill</span>
                        </button>
                        <button
                          onClick={handleCloseOrderModal}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 p-2 rounded-full transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Modal Tab Navigation */}
                    <div className="flex border-b border-gray-200 bg-white px-5 text-xs font-bold gap-2">
                      <button
                        onClick={() => setModalActiveTab('timeline')}
                        className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
                          modalActiveTab === 'timeline'
                            ? 'border-[#0056b3] text-[#0056b3]'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        <History className="w-4 h-4" />
                        <span>Delivery Tracking Timeline</span>
                      </button>

                      <button
                        onClick={() => setModalActiveTab('details')}
                        className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
                          modalActiveTab === 'details'
                            ? 'border-[#0056b3] text-[#0056b3]'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        <ClipboardList className="w-4 h-4" />
                        <span>Order Items &amp; Customer Info</span>
                      </button>

                      <button
                        onClick={() => setModalActiveTab('notes')}
                        className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors relative ${
                          modalActiveTab === 'notes'
                            ? 'border-[#0056b3] text-[#0056b3]'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Internal Staff Notes</span>
                        {activeModalOrder.staffNotes && activeModalOrder.staffNotes.length > 0 && (
                          <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full ml-1">
                            {activeModalOrder.staffNotes.length}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Modal Content Area */}
                    <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
                      
                      {/* TAB 1: DELIVERY TRACKING TIMELINE & STATUS TRANSITION */}
                      {modalActiveTab === 'timeline' && (
                        <div className="space-y-6">
                          
                          {/* Status Pipeline Progress Indicator */}
                          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                            <div className="font-extrabold text-sm text-gray-900 flex justify-between items-center">
                              <span>Order Lifecycle Pipeline</span>
                              <span className="text-xs text-[#0056b3]">Current: {activeModalOrder.status.replace(/_/g, ' ').toUpperCase()}</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 text-[10px] font-bold text-center">
                              {[
                                { status: 'placed', label: '1. Placed' },
                                { status: 'confirmed', label: '2. Confirmed' },
                                { status: 'processing', label: '3. Processing' },
                                { status: 'packed', label: '4. Packed' },
                                { status: 'shipped', label: '5. Shipped' },
                                { status: 'out_for_delivery', label: '6. Out for Delivery' },
                                { status: 'delivered', label: '7. Delivered' },
                              ].map((step, idx) => {
                                const stepSequence = ['placed', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
                                const currentIdx = stepSequence.indexOf(activeModalOrder.status);
                                const isDone = stepSequence.indexOf(step.status) <= currentIdx && activeModalOrder.status !== 'cancelled';
                                const isCurrent = step.status === activeModalOrder.status;

                                return (
                                  <div
                                    key={step.status}
                                    className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                                      isCurrent
                                        ? 'bg-[#0056b3] text-white border-[#0056b3] shadow-md scale-102'
                                        : isDone
                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                        : 'bg-white text-gray-400 border-gray-200'
                                    }`}
                                  >
                                    <div className="font-extrabold truncate w-full">{step.label}</div>
                                    {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Status Transition Action Panel */}
                          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-200 space-y-4">
                            <div className="font-extrabold text-sm text-[#0056b3] flex items-center gap-2">
                              <RefreshCw className="w-4 h-4" />
                              <span>Advance Order Status &amp; Notify Customer</span>
                            </div>

                            <form onSubmit={handleApplyStatusTransition} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block font-bold mb-1 text-gray-700">Target New Status</label>
                                <select
                                  value={modalTargetStatus}
                                  onChange={(e) => setModalTargetStatus(e.target.value as OrderStatus)}
                                  className="w-full p-2.5 rounded-xl border border-gray-300 bg-white font-bold text-xs focus:outline-none focus:border-[#0056b3]"
                                >
                                  <option value="placed">Placed</option>
                                  <option value="confirmed">Confirmed (Phone Verified)</option>
                                  <option value="processing">Processing (Stock Allocated)</option>
                                  <option value="packed">Packed &amp; Sealed</option>
                                  <option value="shipped">Shipped (In Transit)</option>
                                  <option value="out_for_delivery">Out for Delivery</option>
                                  <option value="delivered">Delivered &amp; Payment Collected</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </div>

                              <div>
                                <label className="block font-bold mb-1 text-gray-700">Location Tag / Transit Hub</label>
                                <input
                                  type="text"
                                  value={modalStatusLocation}
                                  onChange={(e) => setModalStatusLocation(e.target.value)}
                                  placeholder="e.g., Kathmandu Main Warehouse / Patan Route"
                                  className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs"
                                />
                              </div>

                              <div>
                                <label className="block font-bold mb-1 text-gray-700">Assigned Delivery Rider</label>
                                <select
                                  value={modalAssignedRider}
                                  onChange={(e) => handleAssignRiderInModal(e.target.value)}
                                  className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold"
                                >
                                  <option value="">-- Select Express Rider --</option>
                                  {riders.map((r) => (
                                    <option key={r.id} value={r.name}>
                                      {r.name} ({r.type.replace(/_/g, ' ')} - {r.phone})
                                    </option>
                                  ))}
                                  <option value="Nepal Express Courier Partner">Nepal Express Courier Partner</option>
                                </select>
                              </div>

                              <div className="md:col-span-3">
                                <label className="block font-bold mb-1 text-gray-700">Status Change Description / Customer Tracking Note</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={modalStatusNote}
                                    onChange={(e) => setModalStatusNote(e.target.value)}
                                    placeholder="e.g. Order verified via phone call with customer; handed over to rider Roshan Shrestha."
                                    className="flex-1 p-2.5 rounded-xl border border-gray-300 bg-white text-xs"
                                  />
                                  <button
                                    type="submit"
                                    className="bg-[#0056b3] hover:bg-[#004494] text-white font-extrabold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Apply Status Update</span>
                                  </button>
                                </div>
                              </div>
                            </form>
                          </div>

                          {/* Order Delivery Tracking History Timeline (Customer-Facing View) */}
                          <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4">
                            <div className="flex justify-between items-center">
                              <div className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-[#0056b3]" />
                                <span>Order Delivery Tracking Timeline (Mirrors Customer Experience)</span>
                              </div>
                              <span className="text-[11px] text-gray-500">{activeModalOrder.trackingHistory.length} status events recorded</span>
                            </div>

                            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-100">
                              {activeModalOrder.trackingHistory.map((event, idx) => {
                                const isLatest = idx === activeModalOrder.trackingHistory.length - 1;
                                return (
                                  <div key={idx} className="relative flex items-start gap-4 group">
                                    {/* Timeline Node Point */}
                                    <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                      isLatest
                                        ? 'bg-[#0056b3] border-white ring-4 ring-blue-100 text-white'
                                        : 'bg-emerald-500 border-white text-white'
                                    }`}>
                                      <CheckCircle2 className="w-3 h-3 text-white" />
                                    </div>

                                    {/* Event Body */}
                                    <div className="bg-gray-50/80 hover:bg-gray-50 p-4 rounded-2xl border border-gray-200 flex-1 space-y-1">
                                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                                        <div className="font-extrabold text-sm text-gray-900">{event.title}</div>
                                        <div className="text-[11px] text-gray-500 font-mono font-medium">{event.timestamp}</div>
                                      </div>

                                      <p className="text-gray-700 text-xs font-medium mt-1">{event.description}</p>

                                      <div className="flex items-center gap-3 pt-2 text-[10px] text-gray-500 border-t border-gray-200/60 mt-2">
                                        <span className="inline-flex items-center gap-1 font-bold text-gray-700">
                                          <MapPin className="w-3 h-3 text-gray-400" />
                                          <span>{event.location || 'Intel Kathmandu Hub'}</span>
                                        </span>
                                        {event.updatedBy && (
                                          <span className="inline-flex items-center gap-1">
                                            <User className="w-3 h-3 text-gray-400" />
                                            <span>{event.updatedBy}</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      )}

                      {/* TAB 2: ORDER ITEMS & CUSTOMER DETAILS */}
                      {modalActiveTab === 'details' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          {/* Left Column: Customer & Address Details */}
                          <div className="space-y-4 md:col-span-1">
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                              <div className="font-extrabold text-xs uppercase tracking-wider text-gray-500">Customer Contact</div>
                              <div className="space-y-2">
                                <div className="font-extrabold text-sm text-gray-900">{activeModalOrder.customerName}</div>
                                <div className="flex items-center justify-between text-xs text-gray-700 bg-white p-2 rounded-xl border border-gray-200">
                                  <span>{activeModalOrder.customerPhone}</span>
                                  <a href={`tel:${activeModalOrder.customerPhone}`} className="text-[#0056b3] font-bold flex items-center gap-1 hover:underline">
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>Call</span>
                                  </a>
                                </div>
                                {activeModalOrder.customerEmail && (
                                  <div className="text-xs text-gray-600 flex items-center gap-1">
                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                    <span>{activeModalOrder.customerEmail}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                              <div className="font-extrabold text-xs uppercase tracking-wider text-gray-500">Delivery Address</div>
                              <div className="space-y-1 text-gray-800">
                                <div className="font-bold text-gray-900">{activeModalOrder.shippingAddress.fullName}</div>
                                <div>{activeModalOrder.shippingAddress.addressLine}</div>
                                {activeModalOrder.shippingAddress.landmark && (
                                  <div className="text-gray-500 italic">Landmark: {activeModalOrder.shippingAddress.landmark}</div>
                                )}
                                <div>
                                  {activeModalOrder.shippingAddress.municipality}, Ward {activeModalOrder.shippingAddress.ward}
                                </div>
                                <div className="font-bold text-[#0056b3]">
                                  {activeModalOrder.shippingAddress.district}, {activeModalOrder.shippingAddress.province}
                                </div>
                              </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                              <div className="font-extrabold text-xs uppercase tracking-wider text-gray-500">Payment Status Control</div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold">Method:</span>
                                  <span className="uppercase font-extrabold bg-gray-200 px-2 py-0.5 rounded text-[10px]">{activeModalOrder.paymentMethod}</span>
                                </div>
                                <div>
                                  <label className="block font-bold mb-1 text-gray-600">Update Payment Status:</label>
                                  <select
                                    value={activeModalOrder.paymentStatus}
                                    onChange={(e) => handleUpdatePaymentStatusInModal(e.target.value as any)}
                                    className="w-full p-2 rounded-xl border border-gray-300 bg-white font-bold"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid (Cash / Wallet)</option>
                                    <option value="verified">Verified by Finance</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Order Items Table & Financial Breakdown */}
                          <div className="space-y-4 md:col-span-2">
                            <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
                              <div className="font-extrabold text-xs uppercase tracking-wider text-gray-500">Ordered Items List ({activeModalOrder.items.length})</div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs divide-y divide-gray-100">
                                  <thead>
                                    <tr className="text-gray-500 font-bold uppercase text-[10px]">
                                      <th className="py-2">Product</th>
                                      <th className="py-2">Price</th>
                                      <th className="py-2 text-center">Qty</th>
                                      <th className="py-2 text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {activeModalOrder.items.map((item, idx) => (
                                      <tr key={idx}>
                                        <td className="py-2.5 flex items-center gap-2">
                                          <img
                                            src={item.productImage}
                                            alt={item.productName}
                                            className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                                          />
                                          <div>
                                            <div className="font-bold text-gray-900">{item.productName}</div>
                                            {item.sku && <div className="text-[10px] font-mono text-gray-500">SKU: {item.sku}</div>}
                                          </div>
                                        </td>
                                        <td className="py-2.5 font-bold text-gray-700">NPR {item.price.toLocaleString()}</td>
                                        <td className="py-2.5 text-center font-bold">{item.quantity}</td>
                                        <td className="py-2.5 text-right font-black text-gray-900">NPR {(item.price * item.quantity).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs">
                              <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span className="font-bold">NPR {activeModalOrder.subtotal.toLocaleString()}</span>
                              </div>
                              {activeModalOrder.discountAmount > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                  <span>Coupon Discount</span>
                                  <span className="font-bold">- NPR {activeModalOrder.discountAmount.toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-gray-600">
                                <span>Delivery Shipping Fee</span>
                                <span className="font-bold">NPR {activeModalOrder.shippingFee.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-gray-600">
                                <span>VAT Tax</span>
                                <span className="font-bold">NPR {activeModalOrder.taxAmount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between font-black text-sm text-gray-900 border-t border-gray-300 pt-2 mt-1">
                                <span>Total Amount Paid / Payable</span>
                                <span className="text-[#0056b3]">NPR {activeModalOrder.totalAmount.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      )}

                      {/* TAB 3: INTERNAL STAFF NOTES */}
                      {modalActiveTab === 'notes' && (
                        <div className="space-y-6">
                          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-start gap-2.5">
                            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="font-extrabold text-xs">Internal Confidential Staff Notes</div>
                              <p className="text-[11px] text-amber-800">
                                These notes are private to store staff (sales, delivery, and customer service) and are never displayed on the customer delivery tracking page.
                              </p>
                            </div>
                          </div>

                          {/* New Staff Note Form */}
                          <form onSubmit={handleAddStaffNote} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                            <div className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                              <Plus className="w-4 h-4 text-[#0056b3]" />
                              <span>Add New Internal Staff Note</span>
                            </div>
                            <textarea
                              value={modalNewStaffNote}
                              onChange={(e) => setModalNewStaffNote(e.target.value)}
                              placeholder="Type private staff instructions or call summary (e.g., 'Customer requested call 30 mins prior to delivery. Address verified with landmark near Patan Hospital.')..."
                              rows={3}
                              className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs focus:outline-none focus:border-[#0056b3]"
                              required
                            />
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="bg-[#0056b3] hover:bg-[#004494] text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Save Internal Note</span>
                              </button>
                            </div>
                          </form>

                          {/* Staff Notes History List */}
                          <div className="space-y-3">
                            <div className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">
                              Internal Staff Note Thread ({activeModalOrder.staffNotes?.length || 0})
                            </div>

                            {(!activeModalOrder.staffNotes || activeModalOrder.staffNotes.length === 0) ? (
                              <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                                No internal notes added for this order yet. Use the form above to add dispatch instructions or phone call notes.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {activeModalOrder.staffNotes.map((note) => (
                                  <div key={note.id} className="bg-white p-4 rounded-2xl border border-gray-200 space-y-1 shadow-xs">
                                    <div className="flex justify-between items-center text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-gray-900">{note.author}</span>
                                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.2 rounded-full uppercase">
                                          {note.role || 'Staff'}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-gray-400 font-mono">{note.timestamp}</span>
                                    </div>
                                    <p className="text-gray-800 text-xs font-medium pt-1 leading-relaxed">
                                      {note.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                      <button
                        onClick={() => setWaybillOrder(activeModalOrder)}
                        className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print Shipping Waybill</span>
                      </button>

                      <button
                        onClick={handleCloseOrderModal}
                        className="bg-gray-900 text-white font-bold text-xs px-5 py-2 rounded-xl hover:bg-black transition-colors"
                      >
                        Close Window
                      </button>
                    </div>

                  </div>
                </div>
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
      )}

      {/* ========================================================================= */}
      {/* MODULE 4: DELIVERY OPERATIONS */}
      {/* ========================================================================= */}
      {activeModule === 'delivery' && (
        <div className="space-y-6">
          <div className="flex gap-2 border-b border-gray-200 pb-3 font-bold text-xs overflow-x-auto">
            <button
              onClick={() => setDeliverySubTab('zones')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                deliverySubTab === 'zones' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              Delivery Zones ({deliveryZones.length})
            </button>
            <button
              onClick={() => setDeliverySubTab('riders')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                deliverySubTab === 'riders' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              Riders &amp; Couriers ({riders.length})
            </button>
          </div>

          {deliverySubTab === 'zones' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-extrabold text-base text-[#1a1a1a]">Nepal Shipping Zones &amp; Tariff Rates</h3>
                <button onClick={() => alert('New Zone added.')} className="bg-[#0056b3] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Delivery Zone</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 uppercase font-extrabold bg-gray-50/50">
                      <th className="py-3 px-3">Province &amp; District</th>
                      <th className="py-3 px-3">Coverage Municipality</th>
                      <th className="py-3 px-3">Standard Fee</th>
                      <th className="py-3 px-3">ETA Window</th>
                      <th className="py-3 px-3">COD Available</th>
                      <th className="py-3 px-3">Free Delivery Threshold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {deliveryZones.map((z) => (
                      <tr key={z.id} className="hover:bg-gray-50">
                        <td className="py-3 px-3 font-bold text-gray-900">{z.province} &bull; {z.district}</td>
                        <td className="py-3 px-3">{z.municipality}</td>
                        <td className="py-3 px-3 font-bold text-[#0056b3]">NPR {z.fee}</td>
                        <td className="py-3 px-3">{z.etaDays}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${z.codAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {z.codAvailable ? 'YES (COD)' : 'Prepaid Only'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">NPR {z.freeShippingThreshold.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {deliverySubTab === 'riders' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-base text-[#1a1a1a]">Riders &amp; Partner Courier Fleet</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {riders.map((r) => (
                  <div key={r.id} className="p-4 rounded-2xl border bg-gray-50 space-y-2">
                    <div className="font-bold text-sm text-gray-900">{r.name}</div>
                    <div className="text-gray-500">{r.phone} &bull; {r.type.toUpperCase()}</div>
                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="font-bold text-[#0056b3]">{r.activeDeliveries} Active Packages</span>
                      <span className="text-emerald-700 font-bold">ACTIVE FLEET</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 5: SERVICES & REPAIRS */}
      {/* ========================================================================= */}
      {activeModule === 'services' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-base text-[#1a1a1a]">Technical Service Tickets ({serviceRequests.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b text-gray-500 uppercase font-extrabold bg-gray-50/50">
                    <th className="py-3 px-3">Ticket ID</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Service Type</th>
                    <th className="py-3 px-3">Assigned Tech</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {serviceRequests.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3 font-mono font-bold text-[#0056b3]">{s.id}</td>
                      <td className="py-3 px-3 font-bold">{s.customerName} ({s.phone})</td>
                      <td className="py-3 px-3 capitalize">{s.serviceType.replace('-', ' ')}</td>
                      <td className="py-3 px-3">{s.assignedTechnician || 'Unassigned'}</td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 uppercase">
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => { updateServiceStatus(s.id, 'completed'); logAuditAction('Services', 'Complete Ticket', `Completed service ticket #${s.id}`); }}
                          className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold"
                        >
                          Mark Resolved
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 6: INVENTORY & STOCK AUDIT */}
      {/* ========================================================================= */}
      {activeModule === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-base text-[#1a1a1a]">Stock Adjustment Audit Log (Append-Only)</h3>
            <p className="text-xs text-gray-500">Every inventory recount, damage removal, or supplier restock is permanently recorded here.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b text-gray-500 uppercase font-extrabold bg-gray-50/50">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Product SKU</th>
                    <th className="py-3 px-3">Quantity Delta</th>
                    <th className="py-3 px-3">Adjustment Reason</th>
                    <th className="py-3 px-3">Acting Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {stockAdjustments.map((sa) => (
                    <tr key={sa.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3 font-mono text-gray-500">{sa.timestamp}</td>
                      <td className="py-3 px-3 font-bold text-gray-900">{sa.productName}</td>
                      <td className={`py-3 px-3 font-black ${sa.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {sa.quantityDelta > 0 ? `+${sa.quantityDelta}` : sa.quantityDelta} Units
                      </td>
                      <td className="py-3 px-3 uppercase text-[10px] font-bold tracking-wider">{sa.reason.replace('_', ' ')}</td>
                      <td className="py-3 px-3 text-gray-700">{sa.adminName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 7: SITE CONTENT & BRANDING */}
      {/* ========================================================================= */}
      {activeModule === 'content' && (
        <form onSubmit={handleSaveSiteSettings} className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-6 shadow-sm">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h2 className="text-lg font-black text-[#1a1a1a]">Store Branding &amp; Content Management</h2>
                <p className="text-xs text-gray-500">Edit storefront identity, header marquee text, physical address, and logo.</p>
              </div>

              <div className="flex items-center gap-3">
                {isSettingsSavedMsg && (
                  <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs">
                    <Check className="w-4 h-4" /> Saved!
                  </span>
                )}
                <button type="submit" className="bg-[#0056b3] text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold mb-1">Store Name</label>
                <input
                  type="text"
                  value={settingsForm.storeName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, storeName: e.target.value })}
                  className="w-full p-2.5 border rounded-xl font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Top Bar Announcement Banner Text</label>
                <input
                  type="text"
                  value={settingsForm.announcementText}
                  onChange={(e) => setSettingsForm({ ...settingsForm, announcementText: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Logo Image File Path / URL</label>
                <input
                  type="text"
                  value={settingsForm.logoUrl}
                  onChange={(e) => setSettingsForm({ ...settingsForm, logoUrl: e.target.value })}
                  className="w-full p-2.5 border rounded-xl font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Physical Store Address</label>
                <input
                  type="text"
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODULE 8: CUSTOMERS */}
      {/* ========================================================================= */}
      {activeModule === 'customers' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h3 className="font-extrabold text-base text-[#1a1a1a]">Registered Customer Profiles &amp; Order Integrity</h3>
          <p className="text-xs text-gray-500">Customer accounts preserve past order history for warranty validation.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 border rounded-2xl bg-gray-50 space-y-2">
              <div className="font-bold text-sm text-gray-900">Subash Bhattarai</div>
              <div className="text-gray-600">Kathmandu, Nepal &bull; Phone: +977-9841223344</div>
              <div className="text-emerald-700 font-bold">2 Orders Placed (Total Spend: NPR 115,000)</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 9: REPORTS & ANALYTICS */}
      {/* ========================================================================= */}
      {activeModule === 'reports' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-extrabold text-base text-[#1a1a1a]">Sales &amp; Inventory Financial Reports</h3>
            <button onClick={handleExportOrdersCsv} className="bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>Export All Financial Logs CSV</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 border rounded-2xl bg-blue-50/50 space-y-1">
              <div className="text-gray-500 font-bold">Gross Orders Volume</div>
              <div className="text-xl font-black text-[#0056b3]">NPR {totalRevenue.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-2xl bg-emerald-50/50 space-y-1">
              <div className="text-gray-500 font-bold">Inventory Valuation</div>
              <div className="text-xl font-black text-emerald-700">
                NPR {products.reduce((acc, p) => acc + (p.sellingPrice * p.stockQuantity), 0).toLocaleString()}
              </div>
            </div>
            <div className="p-4 border rounded-2xl bg-purple-50/50 space-y-1">
              <div className="text-gray-500 font-bold">Completed Service Revenue</div>
              <div className="text-xl font-black text-purple-700">NPR 18,500</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 10: SETTINGS */}
      {/* ========================================================================= */}
      {activeModule === 'settings' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h3 className="font-extrabold text-base text-[#1a1a1a]">Store Configurations &amp; Payment Gateway Keys</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 border rounded-2xl bg-gray-50 space-y-2">
              <div className="font-bold text-sm text-gray-900">Cash on Delivery (COD)</div>
              <div className="text-emerald-700 font-bold">ENABLED (Nepal Cities)</div>
            </div>
            <div className="p-4 border rounded-2xl bg-gray-50 space-y-2">
              <div className="font-bold text-sm text-gray-900">Bank Direct Transfer &amp; Fonepay QR</div>
              <div className="text-emerald-700 font-bold">ENABLED (Account: Nabil Bank)</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 11: STAFF, ROLES & AUDIT TRAIL */}
      {/* ========================================================================= */}
      {activeModule === 'staff' && (
        <div className="space-y-6">
          <div className="flex gap-2 border-b border-gray-200 pb-3 font-bold text-xs overflow-x-auto">
            <button
              onClick={() => setStaffSubTab('users')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                staffSubTab === 'users' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              Admin Users Directory ({adminUsers.length})
            </button>
            <button
              onClick={() => setStaffSubTab('audit')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                staffSubTab === 'audit' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              System Audit Trail ({auditLogs.length})
            </button>
          </div>

          {staffSubTab === 'users' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-base text-[#1a1a1a]">Authorized Staff Accounts</h3>
              <div className="space-y-3 text-xs">
                {adminUsers.map((u) => (
                  <div key={u.id} className="p-4 border rounded-2xl bg-gray-50 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-gray-900">{u.name}</div>
                      <div className="text-gray-500">{u.email} &bull; Role: <span className="font-bold text-[#0056b3]">{u.role}</span></div>
                    </div>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">ACTIVE STAFF</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {staffSubTab === 'audit' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-base text-[#1a1a1a]">System Action Audit Trail (Append-Only)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-gray-500 uppercase font-extrabold bg-gray-50/50">
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3">Staff Member</th>
                      <th className="py-3 px-3">Module</th>
                      <th className="py-3 px-3">Action</th>
                      <th className="py-3 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-3 px-3 font-mono text-gray-500">{log.timestamp}</td>
                        <td className="py-3 px-3 font-bold text-gray-900">{log.adminName} ({log.role})</td>
                        <td className="py-3 px-3 text-[#0056b3] font-bold">{log.module}</td>
                        <td className="py-3 px-3 uppercase text-[10px] font-bold">{log.action}</td>
                        <td className="py-3 px-3 text-gray-700">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: STOCK ADJUSTMENT AUDIT MODAL */}
      {/* ========================================================================= */}
      {auditProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-200">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <div className="text-[10px] font-bold text-[#0056b3] uppercase tracking-wider">Inventory Stock Audit</div>
                <h3 className="font-extrabold text-base text-gray-900">{auditProduct.name}</h3>
              </div>
              <button onClick={() => setAuditProduct(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {auditSuccessMsg ? (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-800 font-bold text-xs text-center flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>{auditSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleStockAdjustmentSubmit} className="space-y-4 text-xs">
                <div className="bg-gray-50 p-3 rounded-xl border text-gray-700 flex justify-between font-bold">
                  <span>Current On-Hand Stock:</span>
                  <span className="text-[#0056b3]">{auditProduct.stockQuantity} Units</span>
                </div>

                <div>
                  <label className="block font-bold mb-1">Adjustment Delta (+ Add Restock / - Remove Damaged)</label>
                  <input
                    type="number"
                    value={stockAdjustment}
                    onChange={(e) => setStockAdjustment(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-[#0056b3] outline-none"
                    required
                  />
                  <div className="text-[10px] text-gray-500 mt-1">Example: Enter <code className="bg-gray-200 px-1 py-0.5 rounded">5</code> to add 5 restocked units, or <code className="bg-gray-200 px-1 py-0.5 rounded">-1</code> for damaged stock.</div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Audit Reason</label>
                  <select
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value as any)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white font-bold"
                  >
                    <option value="supplier_restock">Supplier Restock Shipment</option>
                    <option value="recount">Physical Stock Recount Correction</option>
                    <option value="damaged">Damaged / Broken Item Removal</option>
                    <option value="correction">Order Cancellation Return</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#0056b3] hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md text-xs transition-transform active:scale-95"
                >
                  Confirm &amp; Record Stock Adjustment
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: WAYBILL / DELIVERY SLIP MODAL */}
      {/* ========================================================================= */}
      {waybillOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-gray-200 text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="font-black text-sm text-[#0056b3]">WAYBILL DISPATCH SLIP</div>
              <button onClick={() => setWaybillOrder(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border p-4 rounded-2xl bg-gray-50 space-y-2 font-mono">
              <div className="flex justify-between font-bold text-gray-900">
                <span>ORDER #{waybillOrder.id}</span>
                <span>{waybillOrder.createdAt.slice(0, 10)}</span>
              </div>
              <hr />
              <div><strong>RECIPIENT:</strong> {waybillOrder.customerName}</div>
              <div><strong>PHONE:</strong> {waybillOrder.customerPhone}</div>
              <div><strong>ADDRESS:</strong> {waybillOrder.shippingAddress.addressLine}, {waybillOrder.shippingAddress.district || waybillOrder.shippingAddress.municipality}</div>
              <div><strong>COLLECT COD AMOUNT:</strong> NPR {waybillOrder.totalAmount.toLocaleString()}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { window.print(); }}
                className="bg-[#0056b3] text-white font-bold py-2 px-5 rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Waybill Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD / EDIT PRODUCT MODAL */}
      {/* ========================================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full my-8 space-y-4 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-base text-gray-900">
                {editingProduct ? 'Edit Catalog Product SKU' : 'Add New Hardware Product SKU'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductModal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Product Title</label>
                  <input
                    type="text"
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    required
                    className="w-full p-2.5 border rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Brand Name</label>
                  <select
                    value={prodForm.brand}
                    onChange={(e) => setProdForm({ ...prodForm, brand: e.target.value })}
                    className="w-full p-2.5 border rounded-xl bg-white font-bold"
                  >
                    <option value="Dell">Dell</option>
                    <option value="HP">HP</option>
                    <option value="Lenovo">Lenovo</option>
                    <option value="Epson">Epson</option>
                    <option value="Hikvision">Hikvision</option>
                    <option value="Canon">Canon</option>
                    <option value="Brother">Brother</option>
                  </select>
                </div>
              </div>

              {/* SKU — required and unique in the catalogue, suggested from brand + title */}
              <div>
                <label htmlFor="prod-sku" className="block font-bold mb-1">
                  SKU <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="prod-sku"
                    type="text"
                    value={skuValue}
                    onChange={(e) => {
                      setIsSkuEdited(true);
                      setSkuError(null);
                      setProdForm({ ...prodForm, sku: e.target.value.toUpperCase() });
                    }}
                    required
                    maxLength={SKU_MAX_LENGTH}
                    spellCheck={false}
                    autoCapitalize="characters"
                    aria-invalid={skuError ? true : undefined}
                    aria-describedby={skuError ? 'prod-sku-error' : 'prod-sku-hint'}
                    placeholder="LEN-LEGION-PRO-5"
                    className={`w-full p-2.5 pr-16 border rounded-xl font-mono font-bold tracking-wide ${
                      skuError ? 'border-rose-400 bg-rose-50/50' : ''
                    }`}
                  />
                  {!isSkuEdited && skuValue && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-blue-50 text-[#0056b3] border border-blue-100 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md pointer-events-none">
                      auto
                    </span>
                  )}
                  {isSkuEdited && !editingProduct && suggestedSku && suggestedSku !== skuValue.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSkuEdited(false);
                        setSkuError(null);
                        setProdForm({ ...prodForm, sku: '' });
                      }}
                      title={`Go back to the suggested ${suggestedSku}`}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-gray-500 hover:text-[#0056b3] border border-gray-200 hover:border-blue-200 px-1.5 py-0.5 rounded-md bg-white"
                    >
                      reset
                    </button>
                  )}
                </div>
                {skuError ? (
                  <p id="prod-sku-error" role="alert" className="text-[11px] text-rose-600 font-bold mt-1.5">
                    {skuError}
                  </p>
                ) : (
                  <p id="prod-sku-hint" className="text-[11px] text-gray-500 mt-1.5">
                    {editingProduct
                      ? 'Changing this affects stock records and future order lines — past invoices keep the SKU they were printed with.'
                      : 'Generated from brand + title — edit if you use your own SKU scheme. Must be unique across the catalog.'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1">MRP Price (NPR)</label>
                  <input
                    type="number"
                    value={prodForm.mrp}
                    onChange={(e) => setProdForm({ ...prodForm, mrp: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full p-2.5 border rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Selling Price (NPR)</label>
                  <input
                    type="number"
                    value={prodForm.sellingPrice}
                    onChange={(e) => setProdForm({ ...prodForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full p-2.5 border rounded-xl font-mono font-bold text-[#0056b3]"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Stock Units</label>
                  <input
                    type="number"
                    value={prodForm.stockQuantity}
                    onChange={(e) => setProdForm({ ...prodForm, stockQuantity: parseInt(e.target.value) || 0 })}
                    required
                    className="w-full p-2.5 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Main Image URL</label>
                <input
                  type="text"
                  value={prodForm.image}
                  onChange={(e) => setProdForm({ ...prodForm, image: e.target.value })}
                  required
                  className="w-full p-2.5 border rounded-xl font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Short Specifications Overview</label>
                <textarea
                  value={prodForm.shortDescription}
                  onChange={(e) => setProdForm({ ...prodForm, shortDescription: e.target.value })}
                  rows={3}
                  className="w-full p-2.5 border rounded-xl"
                  placeholder="e.g. Intel Core i5 12th Gen, 16GB DDR4 RAM, 512GB NVMe SSD, 15.6 FHD Display..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-5 py-2.5 border rounded-xl font-bold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0056b3] text-white font-bold rounded-xl shadow-md hover:bg-blue-700"
                >
                  Save Product to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export type ProductCategory = 
  | 'computers-laptops'
  | 'pc-components'
  | 'peripherals-accessories'
  | 'printers-scanners'
  | 'cctv-security'
  | 'networking'
  | 'electronics-appliances';

export interface ProductSpecification {
  key: string;
  value: string;
}

export interface ProductOffer {
  enabled: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  startsAt?: string;
  endsAt?: string;
  isFlashSale?: boolean;
  isStackableWithCoupons?: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  brand: string;
  category: ProductCategory;
  subcategory?: string;
  shortDescription: string;
  longDescription?: string;
  fullDescription?: string;
  mrp: number; // Maximum Retail Price in NPR
  sellingPrice: number; // Actual selling price in NPR
  discountPercent?: number;
  inStock: boolean;
  stockQuantity: number;
  lowStockThreshold?: number;
  rating: number; // 1-5
  reviewCount: number;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isTrending?: boolean;
  isDealOfDay?: boolean;
  offer?: ProductOffer;
  warranty?: string; // e.g., "1 Year Official Brand Warranty"
  warrantyMonths?: number;
  images: string[]; // Image URLs
  specifications?: ProductSpecification[] | Record<string, string>;
  features?: string[];
  tags: string[];
  whatsInTheBox?: string[];
  /**
   * Lifecycle state, straight from `products.status`.
   *
   * The storefront only ever shows `active` rows, but the admin catalogue needs
   * to tell a draft from a paused listing from a retired one — collapsing them
   * meant a product saved as a draft read back as "Active".
   */
  status?: 'draft' | 'active' | 'inactive' | 'discontinued';
  createdAt?: string; // ISO date string (e.g. "2026-03-15T08:00:00.000Z")
  releaseDate?: string; // Release date or added date (e.g. "2026-01-10", "2025-11-20")
  offerToggle?: boolean;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  offerStart?: string;
  offerEnd?: string;
  flashSaleBadge?: boolean;
  stackableWithCoupons?: boolean;
  /**
   * Per-SKU search metadata, edited in the console's Product SEO Matrix.
   *
   * When set these win over the generated `"<name> Price in Dhangadhi"` title —
   * see `lib/seo/resolve.ts`. Absent for most products, which is why the resolver
   * still has a pattern to fall back to.
   */
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  /**
   * The `cart_items` row backing this line. Present once the customer is signed
   * in and the cart lives in the database; absent for a guest cart, which is
   * still held in localStorage until they sign in.
   */
  cartItemId?: number;
}

export interface CategoryItem {
  id: ProductCategory;
  name: string;
  description: string;
  iconName: string;
  image: string;
  productCount: number;
  subcategories: string[];
}

export interface Brand {
  id: string;
  name: string;
  logo: string;
  description: string;
  isPartner: boolean;
  categories: ProductCategory[];
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  email?: string;
  province: string;
  district: string;
  municipality: string;
  ward: string;
  addressLine: string;
  landmark?: string;
  isDefault?: boolean;
}

/**
 * Matches `payment_method` in the database. Fonepay is accepted at the counter
 * but settles as a bank transfer, so it is not a separate method here — an order
 * carrying a value the enum doesn't know would be rejected at insert.
 */
export type PaymentMethod = 'cod' | 'esewa' | 'khalti' | 'bank_transfer';


export type OrderStatus = 
  | 'placed'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface StaffNote {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  role?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  sku?: string;
}

export interface Order {
  id: string; // e.g., ICE-2026-8942
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'verified';
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  taxAmount: number;
  totalAmount: number;
  trackingHistory: {
    status: OrderStatus;
    title: string;
    description: string;
    timestamp: string;
    location?: string;
    updatedBy?: string;
  }[];
  notes?: string;
  staffNotes?: StaffNote[];
  assignedRiderId?: string;
  assignedRiderName?: string;
}

export interface ServiceRequest {
  id: string; // e.g., SRV-9041
  createdAt: string;
  customerName: string;
  phone: string;
  email?: string;
  serviceType: 'computer-repair' | 'laptop-repair' | 'printer-service' | 'cctv-installation' | 'networking' | 'hardware-upgrade';
  deviceInfo: string;
  problemDescription: string;
  preferredDate: string;
  preferredTime: string;
  address: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTechnician?: string;
  estimatedCost?: number;
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number; // e.g., 10 for 10% or 500 for NPR 500 off
  minSpend?: number;
  maxDiscount?: number;
  expiryDate: string;
  isActive: boolean;
  description: string;
}

/* ------------------------------------------------- server-computed checkout */

/**
 * The cart's money as `POST /api/orders/quote` computed it.
 *
 * Nothing here is worked out in the browser. The same module prices the order
 * that is actually written, so a summary built from these figures cannot drift
 * from the invoice — which is what the old client-side `subtotal >= 10000 ? 0 :
 * 250` arithmetic did.
 */
export interface CartQuoteLine {
  productId: number;
  variantId: number | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  listUnitPrice: number;
  lineTotal: number;
  onOffer: boolean;
}

export interface CartQuote {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  vatRatePercent: number;
  /** True when the shown prices already contain VAT, as this store's do. */
  pricesIncludeVat: boolean;
  freeDeliveryApplied: boolean;
  /** Net subtotal at which delivery stops being charged; 0 means never. */
  freeDeliveryThreshold: number;
  couponCode: string | null;
  couponDescription: string | null;
  lines: CartQuoteLine[];
}

/** A row from the customer's address book. */
export interface SavedAddress {
  id: number;
  label: string | null;
  fullName: string;
  phone: string;
  /** A `province_enum` value such as `bagmati`, not a display name. */
  province: string;
  district: string;
  municipality: string;
  wardNo: string;
  tole: string | null;
  streetAddress: string | null;
  houseNumber: string | null;
  landmark: string | null;
  postalCode: string | null;
  deliveryInstructions: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

/** What a new or edited address may set. */
export type AddressInput = Omit<SavedAddress, 'id'>;

/**
 * A shipping option from the `delivery_zones` table, as checkout offers it.
 *
 * Distinct from `DeliveryZone` further down, which is the admin console's
 * per-municipality fee rule and still demo data. The fee here is advisory: the
 * one actually charged is looked up again when the order is priced.
 */
export interface DeliveryZoneOption {
  id: number;
  name: string;
  /** `province_enum` values this zone covers. */
  provinces: string[];
  districts?: string[];
  municipalities?: string[];
  flatFee: number;
  estimatedDays: number;
}

export interface Review {
  id: string;
  productId: string;
  userName: string;
  userCity: string;
  rating: number;
  comment: string;
  images?: Array<{ url: string; caption?: string }>;
  date: string;
  verifiedPurchase: boolean;
  title?: string;
  hardwareSetup?: string;
  componentAspect?: string;
  componentRatings?: {
    thermals?: number;
    buildQuality?: number;
    acoustics?: number;
    performance?: number;
    value?: number;
  };
  pros?: string[];
  cons?: string[];
  helpfulCount?: number;
  adminResponse?: string;
  userUpvoted?: boolean;
}

export interface SiteSettings {
  storeName: string;
  tagline: string;
  logoUrl: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  announcementText: string;
  announcementEnabled: boolean;
  facebookUrl: string;
  instagramUrl: string;
  whatsappNumber: string;
  googleMapEmbedUrl: string;
  googleMapLocationUrl?: string;
  googleMapLatitude?: number;
  googleMapLongitude?: number;
  googlePlaceId: string;
  footerNotice: string;
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  ctaText: string;
  ctaLink: string;
  accentColor: string;
}

export interface FilterState {
  searchQuery: string;
  category: ProductCategory | 'all';
  subcategory: string | 'all';
  brands: string[];
  minPrice: number;
  maxPrice: number;
  inStockOnly: boolean;
  onSaleOnly: boolean;
  minRating: number;
  sortBy: 'featured' | 'newest' | 'oldest' | 'date-desc' | 'date-asc' | 'price-low' | 'price-high' | 'rating' | 'discount';
}

export interface DeliveryZone {
  id: string;
  province: string;
  district: string;
  municipality: string;
  fee: number;
  etaDays: string;
  codAvailable: boolean;
  freeShippingThreshold: number;
}

export interface DeliveryRider {
  id: string;
  name: string;
  phone: string;
  type: 'in_house' | 'partner_courier';
  activeDeliveries: number;
  status: 'active' | 'inactive';
}

export interface ServiceType {
  id: string;
  name: string;
  icon: string;
  description: string;
  estimatedPrice: number;
  processSteps: string[];
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  specialty: 'CCTV & Security' | 'Laptop & PC Hardware' | 'Printers & Copiers' | 'Networking';
  activeWorkload: number;
  status: 'active' | 'inactive';
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  quantityDelta: number;
  reason: 'damaged' | 'recount' | 'supplier_restock' | 'correction';
  timestamp: string;
  adminName: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  suppliedCategories: string[];
  status: 'active' | 'inactive';
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  coverImage: string;
  category: string;
  author: string;
  publishDate: string;
  status: 'published' | 'draft';
  excerpt: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
}

export interface Testimonial {
  id: string;
  customerName: string;
  rating: number;
  quote: string;
  verified: boolean;
  date: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Sales Staff' | 'Inventory Staff' | 'Service Staff' | 'Content Manager' | 'Delivery Driver';
  status: 'active' | 'inactive';
  lastLogin: string;
  phone?: string;
  staffRole?: 'SUPER_ADMIN' | 'STORE_MANAGER' | 'SALES_AGENT' | 'SERVICE_TECHNICIAN' | 'DELIVERY_DRIVER';
  department?: string;
  skills?: string[];
  specialization?: string;
  vehicleNumber?: string;
  drivingLicenseNo?: string;
  shiftStatus?: 'ON_DUTY' | 'ON_TRANSIT' | 'OFF_DUTY';
  assignedCount?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  adminName: string;
  role: string;
  module: string;
  action: string;
  details: string;
}

// Driver Delivery Tracking Types
export interface DriverLocation {
  id: string;
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  isActive: boolean;
}

export interface DeliveryRoute {
  id: string;
  orderId: string;
  driverId: string;
  deliveryPartnerId?: string;
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
  assignedAt: string;
  pickedUpAt?: string;
  inTransitAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  proofOfDelivery?: {
    signature?: string;
    photos?: string[];
    receivedBy?: string;
    notes?: string;
  };
  deliveryNotes?: string;
  estimatedArrival?: string;
  distanceKm?: number;
  routePolyline?: string;
  stopSequence?: number;
}

export interface DriverDelivery extends DeliveryRoute {
  order: Order;
  driver: DeliveryRider;
}

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export interface GeofenceZone {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radiusKm: number;
}

export interface TrackingUpdate {
  orderId: string;
  status: DeliveryRoute['status'];
  location?: GPSPosition;
  notes?: string;
  proofOfDelivery?: DeliveryRoute['proofOfDelivery'];
}

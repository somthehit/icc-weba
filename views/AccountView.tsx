'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { Order, SavedAddress } from '@/types';
import {
  fetchAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  updateProfile,
  sendOtp,
  verifyOtp,
} from '@/lib/api/storefront';
import {
  NEPAL_PROVINCES,
  getDistrictsForProvince,
  getMunicipalitiesForDistrict,
  getWardCount,
  wardOptions,
} from '@/lib/nepal/locations';
import { provinceLabel } from '@/lib/nepal/provinces';
import {
  Package,
  Heart,
  User,
  MapPin,
  LogOut,
  Truck,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  FileText,
  Printer,
  Bell,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  HelpCircle,
  X,
  Phone,
  Home,
  Building2,
  StickyNote,
  Star,
  Loader2,
  ChevronDown,
} from 'lucide-react';

export const AccountView: React.FC = () => {
  const {
    orders,
    wishlist,
    products,
    isUserLoggedIn,
    currentUser,
    setIsAuthModalOpen,
    logoutUser,
    addToCart,
    createServiceRequest,
    setIsServiceModalOpen,
    navigateTo
  } = useStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'wishlist' | 'notifications' | 'profile'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<Order | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('defective');
  const [returnNote, setReturnNote] = useState('');
  const [returnSuccessMsg, setReturnSuccessMsg] = useState('');
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Address State (Nepal Address Model)
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    time: string;
    unread: boolean;
    type?: string;
  }>>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  // Profile Edit State
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({ name: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [otpState, setOtpState] = useState<{
    step: 'idle' | 'sending' | 'verify' | 'verified' | 'error';
    phone: string;
    otp: string;
    error: string;
    countdown: number;
  }>({ step: 'idle', phone: '', otp: '', error: '', countdown: 0 });

  // Address form state
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    province: '',
    district: '',
    municipality: '',
    ward: '',
    tole: '',
    streetAddress: '',
    houseNumber: '',
    landmark: '',
    postalCode: '',
    deliveryInstructions: '',
    isDefault: false,
  });
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [addressFormErrors, setAddressFormErrors] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null);

  // Fetch addresses from the dedicated API endpoint
  const loadAddresses = useCallback(async () => {
    if (!isUserLoggedIn) {
      setAddresses([]);
      setAddressesLoading(false);
      return;
    }
    setAddressesLoading(true);
    setAddressError(null);
    try {
      const result = await fetchAddresses();
      if (result.ok) {
        setAddresses(result.data);
      } else {
        setAddresses([]);
      }
    } catch {
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  }, [isUserLoggedIn]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  // Fetch notifications
  const loadNotifications = useCallback(async () => {
    if (!isUserLoggedIn) {
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }
    setNotificationsLoading(true);
    try {
      const result = await fetchNotifications();
      if (result.ok) {
        setNotifications(result.data.notifications);
      }
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setNotificationsLoading(false);
    }
  }, [isUserLoggedIn]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Fetch full profile data
  const loadProfile = useCallback(async () => {
    if (!isUserLoggedIn || !currentUser?.id) {
      setProfileData(null);
      return;
    }
    setProfileLoading(true);
    try {
      const response = await fetch(`/api/users/${currentUser.id}`);
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
      }
    } catch {
      // Use currentUser as fallback
    } finally {
      setProfileLoading(false);
    }
  }, [isUserLoggedIn, currentUser?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Derive districts/municipalities/wards from selected province/district/municipality
  const formDistricts = addressForm.province
    ? getDistrictsForProvince(addressForm.province)
    : [];
  const formMunicipalities =
    addressForm.province && addressForm.district
      ? getMunicipalitiesForDistrict(addressForm.province, addressForm.district)
      : [];
  const formWardCount =
    addressForm.province && addressForm.district && addressForm.municipality
      ? getWardCount(addressForm.province, addressForm.district, addressForm.municipality)
      : 0;
  const formWardOptions = formWardCount > 0 ? wardOptions(formWardCount) : [];

  const resetAddressForm = () => {
    setAddressForm({
      label: 'Home',
      fullName: '',
      phone: '',
      province: '',
      district: '',
      municipality: '',
      ward: '',
      tole: '',
      streetAddress: '',
      houseNumber: '',
      landmark: '',
      postalCode: '',
      deliveryInstructions: '',
      isDefault: addresses.length === 0,
    });
    setAddressFormErrors({});
    setEditingAddress(null);
  };

  const openAddAddress = () => {
    resetAddressForm();
    setIsAddressModalOpen(true);
  };

  const openEditAddress = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setAddressForm({
      label: addr.label || 'Home',
      fullName: addr.fullName,
      phone: addr.phone,
      province: addr.province,
      district: addr.district,
      municipality: addr.municipality,
      ward: addr.wardNo,
      tole: addr.tole || '',
      streetAddress: addr.streetAddress || '',
      houseNumber: addr.houseNumber || '',
      landmark: addr.landmark || '',
      postalCode: addr.postalCode || '',
      deliveryInstructions: addr.deliveryInstructions || '',
      isDefault: addr.isDefault,
    });
    setAddressFormErrors({});
    setIsAddressModalOpen(true);
  };

  const validateAddressForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!addressForm.fullName.trim()) errors.fullName = 'Name is required';
    if (!addressForm.phone.trim()) errors.phone = 'Phone is required';
    else {
      const cleaned = addressForm.phone.replace(/[\s-]/g, '').replace(/^(\+?977)/, '');
      if (!/^9[678]\d{8}$/.test(cleaned)) errors.phone = 'Enter a valid 10-digit Nepali mobile number';
    }
    if (!addressForm.province) errors.province = 'Province is required';
    if (!addressForm.district.trim()) errors.district = 'District is required';
    if (!addressForm.municipality.trim()) errors.municipality = 'Municipality is required';
    if (!addressForm.ward.trim()) errors.ward = 'Ward number is required';
    setAddressFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddressForm()) return;
    setAddressSubmitting(true);

    try {
      const payload = {
        label: addressForm.label,
        fullName: addressForm.fullName.trim(),
        phone: addressForm.phone.replace(/[\s-]/g, '').replace(/^(\+?977)/, ''),
        province: addressForm.province,
        district: addressForm.district.trim(),
        municipality: addressForm.municipality.trim(),
        wardNo: addressForm.ward.trim(),
        tole: addressForm.tole.trim() || undefined,
        streetAddress: addressForm.streetAddress.trim() || undefined,
        houseNumber: addressForm.houseNumber.trim() || undefined,
        landmark: addressForm.landmark.trim() || undefined,
        postalCode: addressForm.postalCode.trim() || undefined,
        deliveryInstructions: addressForm.deliveryInstructions.trim() || undefined,
        isDefault: addressForm.isDefault,
      };

      if (editingAddress) {
        const result = await updateAddress(editingAddress.id, payload);
        if (!result.ok) {
          setAddressFormErrors({ submit: result.error || 'Failed to update address.' });
          setAddressSubmitting(false);
          return;
        }
        setToast({ message: 'Address updated successfully.', type: 'success' });
      } else {
        const result = await createAddress(payload);
        if (!result.ok) {
          setAddressFormErrors({ submit: result.error || 'Failed to save address.' });
          setAddressSubmitting(false);
          return;
        }
        setToast({ message: 'Address saved successfully.', type: 'success' });
      }

      setIsAddressModalOpen(false);
      resetAddressForm();
      await loadAddresses();
    } catch {
      setAddressFormErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleSetDefault = async (addr: SavedAddress) => {
    if (addr.isDefault) return;
    try {
      const result = await updateAddress(addr.id, { isDefault: true });
      if (result.ok) {
        setToast({ message: 'Default address updated.', type: 'success' });
        await loadAddresses();
      } else {
        setToast({ message: result.error || 'Failed to update default address.', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error.', type: 'error' });
    }
  };

  const handleDeleteAddress = async () => {
    if (deletingAddressId === null) return;
    try {
      const result = await deleteAddress(deletingAddressId);
      if (result.ok) {
        setToast({ message: 'Address deleted.', type: 'success' });
        await loadAddresses();
      } else {
        setToast({ message: result.error || 'Failed to delete address.', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error.', type: 'error' });
    } finally {
      setDeletingAddressId(null);
    }
  };

  /** Format an address for display in Nepal style. */
  const formatAddress = (addr: SavedAddress): string[] => {
    const lines: string[] = [];
    const parts: string[] = [];
    if (addr.tole) parts.push(addr.tole);
    if (addr.streetAddress) parts.push(addr.streetAddress);
    if (parts.length > 0) lines.push(parts.join(', '));
    lines.push(`Ward No. ${addr.wardNo}`);
    lines.push(addr.municipality);
    lines.push(`${addr.district}, ${provinceLabel(addr.province)}`);
    return lines;
  };

  // Handle notification actions
  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    await markNotificationRead(id);
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    await markAllNotificationsRead();
  };

  // Profile edit handlers
  const openProfileEdit = () => {
    setProfileEditForm({
      name: profileData?.name || currentUser?.name || '',
      phone: profileData?.phone || currentUser?.phone || '',
    });
    setIsProfileEditing(true);
    setOtpState({ step: 'idle', phone: '', otp: '', error: '', countdown: 0 });
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const result = await updateProfile({
        name: profileEditForm.name,
        phone: profileEditForm.phone,
      });
      if (result.ok) {
        setToast({ message: 'Profile updated successfully', type: 'success' });
        setIsProfileEditing(false);
        // Refresh profile data
        await loadProfile();
        // Update currentUser in context if name changed
        if (profileEditForm.name) {
          // The context will update on next auth check
        }
      } else {
        setToast({ message: result.error || 'Failed to update profile', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error. Please try again.', type: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSendOtp = async () => {
    const phone = profileEditForm.phone.replace(/[\s-]/g, '').replace(/^(\+?977)/, '');
    if (!/^9[678]\d{8}$/.test(phone)) {
      setOtpState((prev) => ({ ...prev, error: 'Enter a valid 10-digit Nepali mobile number' }));
      return;
    }
    setOtpState((prev) => ({ ...prev, step: 'sending', error: '' }));
    try {
      const result = await sendOtp(phone);
      if (result.ok) {
        setOtpState((prev) => ({
          ...prev,
          step: 'verify',
          phone,
          countdown: 60,
        }));
        // Start countdown
        const interval = setInterval(() => {
          setOtpState((prev) => {
            if (prev.countdown <= 1) {
              clearInterval(interval);
              return { ...prev, countdown: 0 };
            }
            return { ...prev, countdown: prev.countdown - 1 };
          });
        }, 1000);
      } else {
        setOtpState((prev) => ({ ...prev, step: 'idle', error: result.error }));
      }
    } catch {
      setOtpState((prev) => ({ ...prev, step: 'idle', error: 'Network error. Please try again.' }));
    }
  };

  const handleVerifyOtp = async () => {
    if (otpState.otp.length !== 6) {
      setOtpState((prev) => ({ ...prev, error: 'Enter the 6-digit code' }));
      return;
    }
    setOtpState((prev) => ({ ...prev, error: '' }));
    try {
      const result = await verifyOtp(otpState.phone, otpState.otp);
      if (result.ok) {
        setOtpState((prev) => ({ ...prev, step: 'verified', error: '' }));
        setToast({ message: 'Phone number verified successfully', type: 'success' });
      } else {
        setOtpState((prev) => ({ ...prev, error: result.error || 'Invalid code' }));
      }
    } catch {
      setOtpState((prev) => ({ ...prev, error: 'Network error. Please try again.' }));
    }
  };

  const wishlistedProducts = products.filter((p) => wishlist.includes(p.id));

  // Find active in-flight order
  const activeOrder = orders.find(o => o.status !== 'delivered' && o.status !== 'cancelled') || orders[0];

  const handleReorder = (order: Order) => {
    order.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        addToCart(prod, item.quantity);
      }
    });
    navigateTo('cart');
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReturnSuccessMsg(`Return/Exchange request submitted for Order ${showReturnModal?.id}. Support team will contact you within 24 hours.`);
    setTimeout(() => {
      setShowReturnModal(null);
      setReturnSuccessMsg('');
    }, 2500);
  };

  return (
    <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-8 space-y-8 text-xs">
      {/* 1. Header Profile Banner */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 overflow-hidden rounded-2xl bg-[#0056b3] text-white font-black text-xl flex items-center justify-center shadow">
            {profileData?.avatarUrl ? <img src={profileData.avatarUrl} alt={profileData.name} className="h-full w-full rounded-2xl object-cover" /> : isUserLoggedIn && currentUser ? currentUser.name.split(' ').map(n => n[0]).join('') : 'G'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-[#1a1a1a]">
                {isUserLoggedIn && currentUser ? currentUser.name : 'Guest Customer'}
              </h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isUserLoggedIn ? 'bg-blue-100 text-[#0056b3]' : 'bg-gray-100 text-gray-600'
                }`}>
                {isUserLoggedIn ? 'Verified Member' : 'Not Signed In'}
              </span>
            </div>
            <p className="text-gray-500">
              {isUserLoggedIn && currentUser ? `${profileData?.email || currentUser.email} | ${profileData?.phone || currentUser.phone || 'Phone not added'}` : 'Sign in to save wishlist and track orders'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isUserLoggedIn ? (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow flex items-center gap-1.5 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Customer Sign In</span>
            </button>
          ) : (
            <button
              onClick={logoutUser}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-2.5 px-3 rounded-xl flex items-center gap-1.5 transition-colors"
              title="Sign Out of Customer Account"
            >
              <LogOut className="w-4 h-4 text-red-500" />
              <span>Customer Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Active Order Live Tracking Banner (Front & Center) */}
      {activeOrder && (
        <div className="bg-gradient-to-r from-blue-900 via-[#0056b3] to-indigo-900 text-white p-6 rounded-3xl shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-300 animate-pulse" />
              <span className="font-extrabold text-sm">Active Order In-Flight</span>
              <span className="bg-emerald-500 text-white font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold">
                {activeOrder.status.replace('_', ' ')}
              </span>
            </div>
            <div className="font-mono text-xs text-blue-200">
              Ref: <strong className="text-white">{activeOrder.id}</strong> | Placed: {activeOrder.createdAt.split('T')[0]}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="space-y-1">
              <div className="text-xs font-bold text-blue-200">Delivery Address:</div>
              <div className="font-semibold text-white">
                {activeOrder.shippingAddress.addressLine}, Ward {activeOrder.shippingAddress.ward}, {activeOrder.shippingAddress.district}
              </div>
              <div className="text-[11px] text-blue-200">Est. Arrival: Today by 4:00 PM (Valley Dispatch)</div>
            </div>

            <div className="bg-white/10 p-3 rounded-2xl space-y-1 backdrop-blur-sm border border-white/10">
              <div className="text-[10px] uppercase font-bold text-blue-200">Assigned Kailali Rider</div>
              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-300" />
                <span>Sujan Shrestha (+977 9851012345)</span>
              </div>
              <div className="text-[10px] text-blue-200">Vehicle: Ba 92 Pa 4012 (Yamaha FZ)</div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => navigateTo('track-order')}
                className="w-full sm:w-auto bg-white text-[#0056b3] hover:bg-blue-50 font-black text-xs py-2.5 px-5 rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Live Tracker Timeline</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-6 font-bold text-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'orders' ? 'border-[#0056b3] text-[#0056b3]' : 'border-transparent text-gray-500'
            }`}
        >
          <Package className="w-4 h-4" />
          <span>My Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('addresses')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'addresses' ? 'border-[#0056b3] text-[#0056b3]' : 'border-transparent text-gray-500'
            }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Saved Addresses ({addresses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('wishlist')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'wishlist' ? 'border-[#0056b3] text-[#0056b3]' : 'border-transparent text-gray-500'
            }`}
        >
          <Heart className="w-4 h-4" />
          <span>Saved Wishlist ({wishlistedProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap relative ${activeTab === 'notifications' ? 'border-[#0056b3] text-[#0056b3]' : 'border-transparent text-gray-500'
            }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
          {notifications.filter((n) => n.unread).length > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {notifications.filter((n) => n.unread).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'border-[#0056b3] text-[#0056b3]' : 'border-transparent text-gray-500'
            }`}
        >
          <User className="w-4 h-4" />
          <span>Profile Info</span>
        </button>
      </div>

      {/* TAB 1: MY ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center space-y-3">
              <p className="text-gray-500">You have no past order history yet.</p>
              <button
                onClick={() => navigateTo('shop')}
                className="bg-[#1a1a1a] text-white font-bold py-2.5 px-6 rounded-xl"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            orders.map((ord) => (
              <div key={ord.id} className="bg-white rounded-3xl border border-gray-100 p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <span className="font-extrabold text-[#0056b3] text-sm font-mono">{ord.id}</span>
                    <span className="text-[11px] text-gray-400 ml-2">Placed: {ord.createdAt.split('T')[0]}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-green-100 text-green-800 font-extrabold px-2.5 py-0.5 rounded text-[10px] uppercase">
                      {ord.status.replace('_', ' ')}
                    </span>

                    <button
                      onClick={() => setSelectedOrder(ord)}
                      className="bg-gray-100 hover:bg-gray-200 text-[#1a1a1a] font-bold px-3 py-1.5 rounded-lg text-[11px]"
                    >
                      View Details
                    </button>

                    <button
                      onClick={() => handleReorder(ord)}
                      className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reorder</span>
                    </button>

                    <button
                      onClick={() => setShowInvoiceModal(ord)}
                      className="bg-gray-100 hover:bg-gray-200 text-[#1a1a1a] font-bold px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3 text-[#0056b3]" />
                      <span>Tax Invoice</span>
                    </button>
                  </div>
                </div>

                {/* Items preview */}
                <div className="divide-y divide-gray-100">
                  {ord.items.map((it, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={it.productImage}
                          alt={it.productName}
                          className="w-12 h-12 object-contain rounded-lg border border-gray-100 bg-gray-50 p-1"
                        />
                        <div>
                          <div className="font-bold text-[#1a1a1a]">{it.productName}</div>
                          <div className="text-[11px] text-gray-400">Qty: {it.quantity} x NPR {it.price.toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="font-extrabold text-[#1a1a1a]">
                        NPR {(it.price * it.quantity).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-t border-gray-100 pt-3">
                  <div className="text-[11px] text-gray-500">
                    Payment Method: <span className="uppercase font-bold text-[#1a1a1a]">{ord.paymentMethod}</span> | Delivery Fee: {ord.shippingFee === 0 ? 'FREE' : `NPR ${ord.shippingFee}`}
                  </div>
                  <div className="font-extrabold text-sm text-[#0056b3]">
                    Grand Total: NPR {ord.totalAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: SAVED ADDRESSES */}
      {activeTab === 'addresses' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-[#1a1a1a]">Saved Addresses</h3>
              <p className="text-gray-500 text-[11px] mt-0.5">Manage your delivery addresses across Nepal</p>
            </div>
            <button
              onClick={openAddAddress}
              className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 text-xs shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>
          </div>

          {/* Loading */}
          {addressesLoading && (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs">Loading addresses...</span>
            </div>
          )}

          {/* Error */}
          {!addressesLoading && addressError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{addressError}</span>
              <button onClick={loadAddresses} className="ml-auto text-red-800 font-bold hover:underline">Retry</button>
            </div>
          )}

          {/* Empty State */}
          {!addressesLoading && !addressError && addresses.length === 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center space-y-3">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
                <MapPin className="w-7 h-7 text-[#0056b3]" />
              </div>
              <p className="font-bold text-sm text-[#1a1a1a]">No saved addresses yet</p>
              <p className="text-gray-500 text-xs max-w-xs mx-auto">Add a delivery address to speed up checkout and track your orders.</p>
              <button
                onClick={openAddAddress}
                className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Your First Address
              </button>
            </div>
          )}

          {/* Address Cards Grid */}
          {!addressesLoading && !addressError && addresses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`bg-white p-5 rounded-2xl border shadow-sm space-y-3 relative transition-all ${
                    addr.isDefault ? 'border-[#0056b3]/30 ring-1 ring-[#0056b3]/10' : 'border-gray-100'
                  }`}
                >
                  {/* Top Row: Label + Default Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        addr.label === 'Office'
                          ? 'bg-purple-100 text-purple-700'
                          : addr.label === 'Other'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-50 text-[#0056b3]'
                      }`}>
                        {addr.label === 'Office' ? <Building2 className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                        {addr.label || 'Home'}
                      </span>
                    </div>
                    {addr.isDefault && (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                        <Star className="w-3 h-3 fill-current" />
                        Default
                      </span>
                    )}
                  </div>

                  {/* Name + Phone */}
                  <div>
                    <div className="font-bold text-sm text-[#1a1a1a]">{addr.fullName}</div>
                    <div className="text-gray-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-[#0056b3]" />
                      <span className="text-xs">{addr.phone}</span>
                    </div>
                  </div>

                  {/* Formatted Address */}
                  <div className="text-gray-600 text-xs leading-relaxed space-y-0.5">
                    {formatAddress(addr).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    {addr.houseNumber && <p className="text-gray-500">House No. {addr.houseNumber}</p>}
                    {addr.landmark && <p className="text-gray-400 text-[11px]">Landmark: {addr.landmark}</p>}
                    {addr.postalCode && <p className="text-gray-400 text-[11px]">Postal Code: {addr.postalCode}</p>}
                    {addr.deliveryInstructions && (
                      <p className="text-[#0056b3] text-[11px] italic flex items-start gap-1">
                        <StickyNote className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {addr.deliveryInstructions}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => openEditAddress(addr)}
                      className="flex items-center gap-1 text-[11px] font-bold text-gray-600 hover:text-[#0056b3] transition-colors px-2 py-1 rounded-lg hover:bg-gray-50"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingAddressId(addr.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-gray-600 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                    {!addr.isDefault && (
                      <button
                        onClick={() => handleSetDefault(addr)}
                        className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[#0056b3] hover:bg-blue-50 transition-colors px-2 py-1 rounded-lg"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Set as Default
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Address Form Modal */}
          {isAddressModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-[5vh] overflow-y-auto">
              <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <h3 className="font-extrabold text-sm text-[#1a1a1a]">
                    {editingAddress ? 'Edit Address' : 'Add New Address'}
                  </h3>
                  <button
                    onClick={() => { setIsAddressModalOpen(false); resetAddressForm(); }}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {addressFormErrors.submit && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{addressFormErrors.submit}</span>
                  </div>
                )}

                <form onSubmit={handleSaveAddress} className="space-y-3.5">
                  {/* Address Label */}
                  <div>
                    <label className="font-bold text-gray-700 block mb-1 text-xs">Address Label</label>
                    <div className="flex gap-2">
                      {['Home', 'Office', 'Other'].map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setAddressForm({ ...addressForm, label: lbl })}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                            addressForm.label === lbl
                              ? 'bg-[#0056b3] text-white border-[#0056b3]'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Full Name + Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">Full Name *</label>
                      <input
                        type="text"
                        value={addressForm.fullName}
                        onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                        placeholder="e.g. Madhavi Dahit"
                        className={`w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-semibold outline-none transition-all ${
                          addressFormErrors.fullName ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-gray-200 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3]'
                        }`}
                      />
                      {addressFormErrors.fullName && <p className="text-[10px] text-red-600 mt-1">{addressFormErrors.fullName}</p>}
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">Mobile Phone *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-semibold">+977</span>
                        <input
                          type="text"
                          value={addressForm.phone}
                          onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                          placeholder="98XXXXXXXX"
                          className={`w-full bg-gray-50 border rounded-xl p-2.5 pl-12 text-xs font-semibold outline-none transition-all ${
                            addressFormErrors.phone ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-gray-200 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3]'
                          }`}
                        />
                      </div>
                      {addressFormErrors.phone && <p className="text-[10px] text-red-600 mt-1">{addressFormErrors.phone}</p>}
                    </div>
                  </div>

                  {/* Province → District → Municipality → Ward */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">Province *</label>
                      <select
                        value={addressForm.province}
                        onChange={(e) => setAddressForm({
                          ...addressForm,
                          province: e.target.value,
                          district: '',
                          municipality: '',
                          ward: '',
                        })}
                        className={`w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-semibold outline-none appearance-none pr-8 transition-all ${
                          addressFormErrors.province ? 'border-red-400' : 'border-gray-200 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3]'
                        }`}
                      >
                        <option value="">Select Province</option>
                        {NEPAL_PROVINCES.map((p) => (
                          <option key={p.code} value={p.code}>{p.label}</option>
                        ))}
                      </select>
                      {addressFormErrors.province && <p className="text-[10px] text-red-600 mt-1">{addressFormErrors.province}</p>}
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">District *</label>
                      <select
                        value={addressForm.district}
                        onChange={(e) => setAddressForm({
                          ...addressForm,
                          district: e.target.value,
                          municipality: '',
                          ward: '',
                        })}
                        disabled={!addressForm.province}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                      >
                        <option value="">Select District</option>
                        {formDistricts.map((d) => (
                          <option key={d.name} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                      {addressFormErrors.district && <p className="text-[10px] text-red-600 mt-1">{addressFormErrors.district}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">Municipality / Gaunpalika *</label>
                      <select
                        value={addressForm.municipality}
                        onChange={(e) => setAddressForm({
                          ...addressForm,
                          municipality: e.target.value,
                          ward: '',
                        })}
                        disabled={!addressForm.district}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                      >
                        <option value="">Select Municipality</option>
                        {formMunicipalities.map((m) => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                      {addressFormErrors.municipality && <p className="text-[10px] text-red-600 mt-1">{addressFormErrors.municipality}</p>}
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">Ward No. *</label>
                      {formWardOptions.length > 0 ? (
                        <select
                          value={addressForm.ward}
                          onChange={(e) => setAddressForm({ ...addressForm, ward: e.target.value })}
                          disabled={!addressForm.municipality}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                        >
                          <option value="">Select Ward</option>
                          {formWardOptions.map((w) => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={addressForm.ward}
                          onChange={(e) => setAddressForm({ ...addressForm, ward: e.target.value })}
                          placeholder="e.g. 4"
                          disabled={!addressForm.municipality}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                        />
                      )}
                      {addressFormErrors.ward && <p className="text-[10px] text-red-600 mt-1">{addressFormErrors.ward}</p>}
                    </div>
                  </div>

                  {/* Tole, Street, House Number */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">Tole / Area</label>
                      <input
                        type="text"
                        value={addressForm.tole}
                        onChange={(e) => setAddressForm({ ...addressForm, tole: e.target.value })}
                        placeholder="e.g. Hasanpur"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">Street / Road</label>
                      <input
                        type="text"
                        value={addressForm.streetAddress}
                        onChange={(e) => setAddressForm({ ...addressForm, streetAddress: e.target.value })}
                        placeholder="e.g. Main Road"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">House No.</label>
                      <input
                        type="text"
                        value={addressForm.houseNumber}
                        onChange={(e) => setAddressForm({ ...addressForm, houseNumber: e.target.value })}
                        placeholder="e.g. 42"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1 text-xs">Postal Code</label>
                      <input
                        type="text"
                        value={addressForm.postalCode}
                        onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                        placeholder="e.g. 10900"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                      />
                    </div>
                  </div>

                  {/* Landmark */}
                  <div>
                    <label className="font-bold text-gray-700 block mb-1 text-xs">Landmark</label>
                    <input
                      type="text"
                      value={addressForm.landmark}
                      onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                      placeholder="e.g. Near Dhangadhi Mall, opposite Bank of Nepal"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                    />
                  </div>

                  {/* Delivery Instructions */}
                  <div>
                    <label className="font-bold text-gray-700 block mb-1 text-xs">Delivery Instructions</label>
                    <textarea
                      rows={2}
                      value={addressForm.deliveryInstructions}
                      onChange={(e) => setAddressForm({ ...addressForm, deliveryInstructions: e.target.value })}
                      placeholder="e.g. Call before delivery, leave at reception, etc."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none resize-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                    />
                  </div>

                  {/* Set as Default */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addressForm.isDefault}
                      onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-[#0056b3] focus:ring-[#0056b3]"
                    />
                    <span className="text-xs font-semibold text-gray-700">Set as default delivery address</span>
                  </label>

                  {/* Submit */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setIsAddressModalOpen(false); resetAddressForm(); }}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addressSubmitting}
                      className="flex-1 bg-[#0056b3] hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      {addressSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>{editingAddress ? 'Update Address' : 'Save Address'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          {deletingAddressId !== null && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-extrabold text-sm text-[#1a1a1a]">Delete Address?</h3>
                  <p className="text-gray-500 text-xs">This action cannot be undone. The address will be permanently removed from your account.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingAddressId(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAddress}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors"
                  >
                    Delete Address
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WISHLIST */}
      {activeTab === 'wishlist' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100">
            <div>
              <h3 className="font-bold text-sm text-[#1a1a1a]">Saved Wishlist Items ({wishlistedProducts.length})</h3>
              <p className="text-gray-500 text-[11px]">Items saved for later purchase</p>
            </div>
            <button
              onClick={() => navigateTo('wishlist')}
              className="bg-[#0056b3] text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            >
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span>Manage Full Wishlist</span>
            </button>
          </div>

          {wishlistedProducts.length === 0 ? (
            <p className="text-gray-500 py-8 text-center bg-white rounded-3xl border border-gray-100">No items saved in wishlist.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlistedProducts.map((p) => (
                <div key={p.id} className="bg-white rounded-3xl border border-gray-100 p-4 space-y-3 shadow-sm">
                  <img src={p.images[0]} alt={p.name} className="w-full h-36 object-contain rounded-xl bg-gray-50 p-2" />
                  <div className="font-bold text-xs text-[#1a1a1a] line-clamp-1">{p.name}</div>
                  <div className="font-extrabold text-xs text-[#0056b3]">NPR {p.sellingPrice.toLocaleString()}</div>
                  <button
                    onClick={() => addToCart(p)}
                    className="w-full bg-[#1a1a1a] text-white font-bold py-2 rounded-xl hover:bg-black transition-colors"
                  >
                    Move to Cart
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-[#1a1a1a]">Order & Activity Notifications</h3>
            {notifications.some((n) => n.unread) && (
              <button
                onClick={handleMarkAllNotificationsRead}
                className="text-[11px] font-bold text-[#0056b3] hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notificationsLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Bell className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-gray-500 text-xs">No notifications yet</p>
              <p className="text-gray-400 text-[11px]">Order updates and alerts will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`py-3 flex items-start gap-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors ${
                    n.unread ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => n.unread && handleMarkNotificationRead(n.id)}
                >
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${n.unread ? 'bg-[#0056b3]' : 'bg-gray-300'}`} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-[#1a1a1a]">{n.title}</span>
                      <span className="text-[10px] text-gray-400">{n.time}</span>
                    </div>
                    <p className="text-gray-600 text-[11px] mt-0.5">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PROFILE */}
      {activeTab === 'profile' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#1a1a1a]">Customer Account Details</h3>
            {!isProfileEditing && (
              <button
                onClick={openProfileEdit}
                className="text-[11px] font-bold text-[#0056b3] hover:underline flex items-center gap-1"
              >
                <Edit className="w-3 h-3" />
                Edit Profile
              </button>
            )}
          </div>

          {profileLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading your profile...</span>
            </div>
          ) : isProfileEditing ? (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs">Full Name</label>
                <input
                  type="text"
                  value={profileEditForm.name}
                  onChange={(e) => setProfileEditForm({ ...profileEditForm, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="font-bold text-gray-700 block mb-1 text-xs">Mobile Phone</label>
                {otpState.step === 'verify' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">+977</span>
                      <input
                        type="text"
                        value={otpState.otp}
                        onChange={(e) => setOtpState((prev) => ({ ...prev, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        placeholder="Enter 6-digit code"
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                      />
                    </div>
                    {otpState.error && <p className="text-[10px] text-red-600">{otpState.error}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleVerifyOtp}
                        className="flex-1 bg-[#0056b3] text-white font-bold py-2 rounded-xl text-xs hover:bg-blue-700 transition-colors"
                      >
                        Verify Code
                      </button>
                      <button
                        onClick={() => setOtpState({ step: 'idle', phone: '', otp: '', error: '', countdown: 0 })}
                        className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {otpState.countdown > 0 && (
                      <p className="text-[10px] text-gray-400 text-center">
                        Resend code in {otpState.countdown}s
                      </p>
                    )}
                    {otpState.countdown === 0 && otpState.step === 'verify' && (
                      <button
                        onClick={handleSendOtp}
                        className="text-[10px] text-[#0056b3] font-bold hover:underline w-full text-center"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-semibold">+977</span>
                      <input
                        type="text"
                        value={profileEditForm.phone}
                        onChange={(e) => setProfileEditForm({ ...profileEditForm, phone: e.target.value })}
                        placeholder="98XXXXXXXX"
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-2.5 pl-10 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                      />
                    </div>
                    {otpState.error && <p className="text-[10px] text-red-600">{otpState.error}</p>}
                    {otpState.step === 'verified' ? (
                      <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Phone verified
                      </p>
                    ) : (
                      <button
                        onClick={handleSendOtp}
                        disabled={otpState.step === 'sending' || !profileEditForm.phone}
                        className="text-[10px] text-[#0056b3] font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {otpState.step === 'sending' ? 'Sending...' : 'Send Verification Code'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Save/Cancel */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setIsProfileEditing(false); setOtpState({ step: 'idle', phone: '', otp: '', error: '', countdown: 0 }); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="flex-1 bg-[#0056b3] hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-gray-700">
              <div className="space-y-2">
                <div><strong>Full Name:</strong> {profileData?.name || currentUser?.name || 'Not available'}</div>
                <div><strong>Email:</strong> {profileData?.email || currentUser?.email || 'Not available'}</div>
                <div><strong>Mobile Phone:</strong> {profileData?.phone || currentUser?.phone || 'Not added'}</div>
                <div><strong>Loyalty Status:</strong> {isUserLoggedIn ? 'Verified Tech Member' : 'Not Signed In'}</div>
              </div>

              {/* Default Address */}
              {addresses.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-[#0056b3]" />
                    <strong className="text-xs">Default Address</strong>
                    {addresses.find((a) => a.isDefault) && (
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">Default</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed pl-5">
                    {(() => {
                      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
                      return formatAddress(defaultAddr).map((line, i) => (
                        <p key={i}>{line}</p>
                      ));
                    })()}
                  </div>
                  <button
                    onClick={() => setActiveTab('addresses')}
                    className="text-[10px] text-[#0056b3] font-bold hover:underline mt-2 pl-5"
                  >
                    Manage Addresses
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#1a1a1a]">Order Details: {selectedOrder.id}</h3>
                <p className="text-[11px] text-gray-500">Placed on {selectedOrder.createdAt.split('T')[0]}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border border-gray-100">
              <div className="font-bold text-xs text-[#1a1a1a]">Shipping Address:</div>
              <div className="text-gray-600">
                {selectedOrder.shippingAddress.fullName} ({selectedOrder.shippingAddress.phone})<br />
                {selectedOrder.shippingAddress.addressLine}, Ward {selectedOrder.shippingAddress.ward}, {selectedOrder.shippingAddress.municipality}, {selectedOrder.shippingAddress.district}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-xs text-[#1a1a1a]">Ordered Items ({selectedOrder.items.length}):</h4>
              <div className="divide-y divide-gray-100 border rounded-2xl overflow-hidden p-2">
                {selectedOrder.items.map((it, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={it.productImage} alt={it.productName} className="w-10 h-10 object-contain" />
                      <div>
                        <div className="font-bold text-xs">{it.productName}</div>
                        <div className="text-[10px] text-gray-400">1 Year Brand Warranty</div>
                      </div>
                    </div>
                    <div className="text-right font-extrabold text-xs">
                      NPR {(it.price * it.quantity).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between font-extrabold text-sm text-[#0056b3] border-t pt-2">
              <span>Total Payable Amount:</span>
              <span>NPR {selectedOrder.totalAmount.toLocaleString()}</span>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowReturnModal(selectedOrder);
                  setSelectedOrder(null);
                }}
                className="bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold px-4 py-2 rounded-xl text-xs"
              >
                Request Return / Exchange
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-[#1a1a1a] text-white font-bold px-4 py-2 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAX INVOICE PRINT MODAL */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0056b3]" />
                <h3 className="font-extrabold text-base text-[#1a1a1a]">Nepal Official Tax Invoice</h3>
              </div>
              <button onClick={() => setShowInvoiceModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-1 border-b pb-4">
              <h2 className="font-black text-lg text-[#0056b3]">Intel Computer Center</h2>
              <p className="text-gray-500">Ratopool, Dhangadhi, Nepal</p>
              <p className="text-gray-500 font-mono">VAT/PAN No: 302910482 | Tel: 091-525287 / 9848424859</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[11px] bg-gray-50 p-3 rounded-2xl">
              <div>
                <strong>Invoice No:</strong> INV-{showInvoiceModal.id}<br />
                <strong>Order Ref:</strong> {showInvoiceModal.id}<br />
                <strong>Date:</strong> {showInvoiceModal.createdAt.split('T')[0]}
              </div>
              <div>
                <strong>Customer Name:</strong> {showInvoiceModal.shippingAddress.fullName}<br />
                <strong>Phone:</strong> {showInvoiceModal.shippingAddress.phone}<br />
                <strong>Payment Status:</strong> VERIFIED / PAID
              </div>
            </div>

            <div className="divide-y divide-gray-200 border rounded-2xl overflow-hidden">
              <div className="bg-gray-100 p-2 font-bold flex justify-between">
                <span>Description</span>
                <span>Qty x Rate = Total</span>
              </div>
              {showInvoiceModal.items.map((it, idx) => (
                <div key={idx} className="p-2 flex justify-between">
                  <span>{it.productName}</span>
                  <span>{it.quantity} x {it.price.toLocaleString()} = NPR {(it.price * it.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-right font-bold text-xs pt-2">
              <div>Subtotal: NPR {showInvoiceModal.subtotal.toLocaleString()}</div>
              <div>13% VAT: Included in price</div>
              <div className="text-base text-[#0056b3] font-black">Grand Total: NPR {showInvoiceModal.totalAmount.toLocaleString()}</div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-[10px] text-gray-400">Computer Generated Tax Receipt - No Signature Required</span>
              <button
                onClick={() => window.print()}
                className="bg-[#1a1a1a] hover:bg-black text-white font-bold py-2 px-5 rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Tax Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-sm text-[#1a1a1a]">Request Return / Exchange</h3>
              <button onClick={() => setShowReturnModal(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {returnSuccessMsg ? (
              <div className="p-4 bg-green-50 text-green-800 font-bold rounded-2xl text-center">
                {returnSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleReturnSubmit} className="space-y-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Reason for Return</label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-semibold"
                  >
                    <option value="defective">Defective / Hardware Issue under Warranty</option>
                    <option value="wrong_item">Received Wrong Item / Specification</option>
                    <option value="damaged">Damaged during Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Detailed Explanation</label>
                  <textarea
                    rows={3}
                    required
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    placeholder="Describe the issue..."
                    className="w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-600 text-white font-bold py-2.5 rounded-xl hover:bg-amber-700 transition-colors"
                >
                  Submit Return Claim
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-bold text-white transition-all animate-in slide-in-from-bottom-4 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

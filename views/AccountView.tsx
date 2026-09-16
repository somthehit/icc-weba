'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { Order, ShippingAddress } from '@/types';
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
  Phone
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
  const [addresses, setAddresses] = useState<ShippingAddress[]>([
    {
      fullName: 'Valued Customer (Anish Thapa)',
      phone: '+977-9851084291',
      province: 'Bagmati Province',
      district: 'Kailali',
      municipality: 'Kailali Metropolitan City',
      ward: '10',
      addressLine: 'New Baneshwor, Near Civil Bank',
      landmark: 'Opposite Everest Hotel Plaza',
      isDefault: true,
    },
    {
      fullName: 'Office Address',
      phone: '+977-9801234567',
      province: 'Bagmati Province',
      district: 'Lalitpur',
      municipality: 'Lalitpur Metropolitan City',
      ward: '3',
      addressLine: 'Pulchowk Main Road, Ward 3',
      landmark: 'Near Engineering Campus Gate',
      isDefault: false,
    }
  ]);

  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [newAddr, setNewAddr] = useState<ShippingAddress>({
    fullName: 'Anish Thapa',
    phone: '9851084291',
    province: 'Bagmati Province',
    district: 'Kailali',
    municipality: 'Kailali Metropolitan City',
    ward: '1',
    addressLine: 'New Road Plaza',
    landmark: 'Bishal Bazar',
  });

  useEffect(() => {
    if (!isUserLoggedIn || !currentUser?.id) return;
    let cancelled = false;
    fetch(`/api/users/${currentUser.id}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled && data) { setProfileData(data); if (Array.isArray(data.addresses)) setAddresses(data.addresses.map((address: any) => ({ fullName: address.fullName, phone: address.phone, province: address.province, district: address.district, municipality: address.municipality, ward: address.wardNo, addressLine: address.streetAddress || '', landmark: address.landmark || '', isDefault: address.isDefault }))); } })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [isUserLoggedIn, currentUser?.id]);

  // Notifications List
  const [notifications] = useState([
    {
      id: 'n1',
      title: 'Order Out for Delivery!',
      message: 'Order ICE-2026-8942 is out for delivery with Rider Sujan (+977 9851012345).',
      time: '10 mins ago',
      unread: true,
    },
    {
      id: 'n2',
      title: 'Official Warranty Registered',
      message: 'Your 1-Year Brand Warranty for Dell Inspiron 15 is active in Kailali.',
      time: 'Yesterday',
      unread: false,
    },
    {
      id: 'n3',
      title: 'Price Drop Alert',
      message: 'An item in your wishlist (ASUS ROG Strix Monitor) is now NPR 3,000 off!',
      time: '2 days ago',
      unread: false,
    }
  ]);

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

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUserLoggedIn) return;
    const response = await fetch('/api/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: 'Home', fullName: newAddr.fullName, phone: newAddr.phone,
        province: newAddr.province.toLowerCase().replace(/\s+province$/, ''),
        district: newAddr.district, municipality: newAddr.municipality, wardNo: newAddr.ward,
        streetAddress: newAddr.addressLine, landmark: newAddr.landmark, isDefault: addresses.length === 0,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error || 'This address is outside our delivery coverage.');
      return;
    }
    setAddresses([...addresses, { ...newAddr, isDefault: addresses.length === 0 }]);
    setIsAddAddressOpen(false);
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 text-xs">
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
          <span className="w-2 h-2 rounded-full bg-red-500" />
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
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-[#1a1a1a]">Your Delivery Locations in Nepal</h3>
            <button
              onClick={() => setIsAddAddressOpen(true)}
              className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr, idx) => (
              <div key={idx} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2 relative">
                {addr.isDefault && (
                  <span className="absolute top-4 right-4 bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                    Default Address
                  </span>
                )}
                <div className="font-bold text-sm text-[#1a1a1a]">{addr.fullName}</div>
                <div className="text-gray-500 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#0056b3]" />
                  <span>{addr.phone}</span>
                </div>
                <div className="text-gray-600 space-y-0.5">
                  <p>{addr.addressLine}, Ward {addr.ward}</p>
                  <p>{addr.municipality}, {addr.district}, {addr.province}</p>
                  {addr.landmark && <p className="text-gray-400 text-[11px]">Landmark: {addr.landmark}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Modal for adding address */}
          {isAddAddressOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-extrabold text-sm text-[#1a1a1a]">Add Nepal Delivery Address</h3>
                  <button onClick={() => setIsAddAddressOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddAddress} className="space-y-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Receiver Name</label>
                    <input
                      type="text"
                      required
                      value={newAddr.fullName}
                      onChange={(e) => setNewAddr({ ...newAddr, fullName: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Nepali Mobile Phone</label>
                    <input
                      type="text"
                      required
                      value={newAddr.phone}
                      onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Province</label>
                      <select
                        value={newAddr.province}
                        onChange={(e) => setNewAddr({ ...newAddr, province: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-semibold"
                      >
                        <option value="Bagmati Province">Bagmati Province</option>
                        <option value="Gandaki Province">Gandaki Province</option>
                        <option value="Koshi Province">Koshi Province</option>
                        <option value="Lumbini Province">Lumbini Province</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">District</label>
                      <input
                        type="text"
                        required
                        value={newAddr.district}
                        onChange={(e) => setNewAddr({ ...newAddr, district: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Municipality / Gaunpalika</label>
                    <input
                      type="text"
                      required
                      value={newAddr.municipality}
                      onChange={(e) => setNewAddr({ ...newAddr, municipality: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Street / Tole / Area</label>
                    <input
                      type="text"
                      required
                      value={newAddr.addressLine}
                      onChange={(e) => setNewAddr({ ...newAddr, addressLine: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-semibold"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#0056b3] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Save Delivery Address
                  </button>
                </form>
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
          <h3 className="font-extrabold text-sm text-[#1a1a1a]">Order & Activity Notifications</h3>
          <div className="divide-y divide-gray-100">
            {notifications.map((n) => (
              <div key={n.id} className="py-3 flex items-start gap-3">
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
        </div>
      )}

      {/* TAB 5: PROFILE */}
      {activeTab === 'profile' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 space-y-4 max-w-lg">
          <h3 className="font-bold text-sm text-[#1a1a1a]">Customer Account Details</h3>
          <div className="space-y-2 text-gray-700">
            {profileLoading ? <div className="text-gray-400">Loading your profile...</div> : <>
              <div><strong>Full Name:</strong> {profileData?.name || currentUser?.name || 'Not available'}</div>
              <div><strong>Email:</strong> {profileData?.email || currentUser?.email || 'Not available'}</div>
              <div><strong>Mobile Phone:</strong> {profileData?.phone || currentUser?.phone || 'Not added'}</div>
              <div><strong>Primary City:</strong> {addresses[0] ? `${addresses[0].district}, Nepal` : 'No saved address'}</div>
              <div><strong>Loyalty Status:</strong> {isUserLoggedIn ? 'Verified Tech Member' : 'Not Signed In'}</div>
            </>}
          </div>
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
              <p className="text-gray-500">New Road Plaza, Opposite Bishal Bazar, Kailali, Nepal</p>
              <p className="text-gray-500 font-mono">VAT/PAN No: 302910482 | Tel: +977-1-4261890</p>
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
    </div>
  );
};

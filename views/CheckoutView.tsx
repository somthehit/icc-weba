'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { ShippingAddress, PaymentMethod, Order, SavedAddress, DeliveryZoneOption } from '@/types';
import { InvoiceModal } from '@/components/InvoiceModal';
import { PROVINCE_LABELS, provinceLabel, ProvinceCode } from '@/lib/nepal/provinces';
import {
  SERVICED_PROVINCE_CODES,
  SUDURPASHCHIM_CONFIG,
  SUDURPASHCHIM_DISTRICTS,
} from '@/config/regional';
import {
  fetchAddresses,
  createAddress,
  fetchDeliveryZones,
  suggestZone,
} from '@/lib/api/storefront';
import { zoneCoversAddress } from '@/lib/delivery/coverage';
import {
  CheckCircle2,
  Truck,
  CreditCard,
  MapPin,
  Phone,
  User,
  ArrowRight,
  ShieldCheck,
  FileText,
  Copy,
  Printer,
  Home,
  Building2,
  Plus,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';

export const CheckoutView: React.FC = () => {
  const {
    cart,
    getCartSubtotal,
    getCartDiscount,
    getCartTotal,
    placeOrder,
    navigateTo,
    currentUser,
    isUserLoggedIn,
    deliveryZoneId,
    setDeliveryZoneId,
  } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields - initialized from currentUser when available
  const [customerName, setCustomerName] = useState(currentUser?.name ?? '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone ?? '');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email ?? '');

  const [address, setAddress] = useState<ShippingAddress>({
    fullName: currentUser?.name ?? '',
    phone: currentUser?.phone ?? '',
    email: currentUser?.email ?? '',
    province: PROVINCE_LABELS.sudurpashchim,
    district: SUDURPASHCHIM_CONFIG.headquartersDistrict,
    municipality: 'Dhangadhi Sub-Metropolitan City',
    ward: '',
    addressLine: '',
    landmark: '',
  });

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | number | 'new' | null>(null);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [deliveryZonesList, setDeliveryZonesList] = useState<DeliveryZoneOption[]>([]);
  const [saveNewAddressToProfile, setSaveNewAddressToProfile] = useState(true);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Sync profile details when currentUser loads
  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) {
        setCustomerName((prev) => (!prev || prev === 'Anish Thapa' ? currentUser.name : prev));
      }
      if (currentUser.phone) {
        setCustomerPhone((prev) => (!prev || prev === '9851084291' ? (currentUser.phone ?? '') : prev));
      }
      if (currentUser.email) {
        setCustomerEmail((prev) => (!prev || prev === 'anish@example.com' ? currentUser.email : prev));
      }
      setAddress((prev) => ({
        ...prev,
        fullName: prev.fullName || currentUser.name,
        phone: prev.phone || currentUser.phone || '',
        email: prev.email || currentUser.email,
      }));
    }
  }, [currentUser]);

  // Fetch saved addresses and delivery zones on mount or when auth changes
  useEffect(() => {
    if (!isUserLoggedIn) {
      setSelectedAddressId('new');
      return;
    }

    let isMounted = true;
    setIsLoadingAddresses(true);

    Promise.all([fetchAddresses(), fetchDeliveryZones()])
      .then(([addrRes, zoneRes]) => {
        if (!isMounted) return;

        let zones: DeliveryZoneOption[] = [];
        if (zoneRes.ok && zoneRes.data.length > 0) {
          zones = zoneRes.data;
          setDeliveryZonesList(zones);
        }

        if (addrRes.ok && addrRes.data.length > 0) {
          const addrs = addrRes.data;
          setSavedAddresses(addrs);

          // Find default address or first address
          const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
          setSelectedAddressId(defaultAddr.id);

          // Sync into contact and address fields
          if (defaultAddr.fullName) setCustomerName(defaultAddr.fullName);
          if (defaultAddr.phone) setCustomerPhone(defaultAddr.phone);

          const fullStreet = [defaultAddr.houseNumber, defaultAddr.streetAddress, defaultAddr.tole]
            .filter(Boolean)
            .join(', ') || defaultAddr.streetAddress || '';

          const displayProvince = provinceLabel(defaultAddr.province) || PROVINCE_LABELS.sudurpashchim;

          setAddress({
            fullName: defaultAddr.fullName || currentUser?.name || '',
            phone: defaultAddr.phone || currentUser?.phone || '',
            email: currentUser?.email || '',
            province: displayProvince,
            district: defaultAddr.district || SUDURPASHCHIM_CONFIG.headquartersDistrict,
            municipality: defaultAddr.municipality || 'Dhangadhi Sub-Metropolitan City',
            ward: defaultAddr.wardNo || '',
            addressLine: fullStreet,
            landmark: defaultAddr.landmark || '',
          });

          // Match delivery zone if available
          if (zones.length > 0) {
            const coveringZone = zones.find((z) =>
              zoneCoversAddress(
                {
                  provinces: z.provinces.join(','),
                  districts: (z.districts ?? []).join(','),
                  municipalities: (z.municipalities ?? []).join(','),
                },
                {
                  province: defaultAddr.province,
                  district: defaultAddr.district,
                  municipality: defaultAddr.municipality,
                }
              )
            ) || suggestZone(zones, defaultAddr.province);

            if (coveringZone) {
              setDeliveryZoneId(coveringZone.id);
            }
          }
        } else {
          setSelectedAddressId('new');
        }
      })
      .catch((err) => {
        console.error('Error fetching checkout addresses or delivery zones:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAddresses(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isUserLoggedIn, currentUser, setDeliveryZoneId]);

  const handleSelectAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setCustomerName(addr.fullName);
    setCustomerPhone(addr.phone);

    const fullStreet = [addr.houseNumber, addr.streetAddress, addr.tole]
      .filter(Boolean)
      .join(', ') || addr.streetAddress || '';

    const displayProvince = provinceLabel(addr.province) || PROVINCE_LABELS.sudurpashchim;

    setAddress({
      fullName: addr.fullName,
      phone: addr.phone,
      email: customerEmail || currentUser?.email || '',
      province: displayProvince,
      district: addr.district,
      municipality: addr.municipality,
      ward: addr.wardNo,
      addressLine: fullStreet,
      landmark: addr.landmark || '',
    });

    if (deliveryZonesList.length > 0) {
      const coveringZone = deliveryZonesList.find((z) =>
        zoneCoversAddress(
          {
            provinces: z.provinces.join(','),
            districts: (z.districts ?? []).join(','),
            municipalities: (z.municipalities ?? []).join(','),
          },
          {
            province: addr.province,
            district: addr.district,
            municipality: addr.municipality,
          }
        )
      ) || suggestZone(deliveryZonesList, addr.province);

      if (coveringZone) {
        setDeliveryZoneId(coveringZone.id);
      }
    }
  };

  const handleChooseNewAddress = () => {
    setSelectedAddressId('new');
    setAddress((prev) => ({
      ...prev,
      fullName: customerName || currentUser?.name || '',
      phone: customerPhone || currentUser?.phone || '',
      addressLine: '',
      landmark: '',
      ward: '',
    }));
  };

  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  const total = getCartTotal();
  const shippingFee = subtotal >= 10000 ? 0 : 250;

  if (cart.length === 0 && !completedOrder) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">No items in checkout</h2>
        <button
          onClick={() => navigateTo('shop')}
          className="bg-blue-600 text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow"
        >
          Return to Shop Catalog
        </button>
      </div>
    );
  }

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingOrder(true);

    try {
      let shippingAddressIdToUse: string | number | undefined = undefined;

      if (selectedAddressId && selectedAddressId !== 'new') {
        shippingAddressIdToUse = selectedAddressId;
      } else if (isUserLoggedIn && (saveNewAddressToProfile || savedAddresses.length === 0)) {
        // Save new address to customer profile so an address row exists for the order snapshot
        try {
          const provCode =
            (Object.keys(PROVINCE_LABELS) as ProvinceCode[]).find(
              (k) => PROVINCE_LABELS[k] === address.province
            ) || 'sudurpashchim';

          const createRes = await createAddress({
            label: 'Home',
            fullName: address.fullName || customerName,
            phone: (address.phone || customerPhone).replace(/[\s-]/g, '').replace(/^(\+?977)/, ''),
            province: provCode,
            district: address.district,
            municipality: address.municipality,
            wardNo: address.ward || '1',
            streetAddress: address.addressLine,
            landmark: address.landmark || undefined,
            isDefault: savedAddresses.length === 0,
          });

          if (createRes.ok && createRes.data?.address?.id) {
            shippingAddressIdToUse = createRes.data.address.id;
          }
        } catch (saveErr) {
          console.warn('Failed to save address before order:', saveErr);
        }
      }

      const response = await placeOrder({
        shippingAddressId: shippingAddressIdToUse,
        deliveryZoneId: deliveryZoneId ?? undefined,
        paymentMethod,
        customerNote: undefined,
      });

      if (response.ok) {
        setCompletedOrder(response.order);
        setStep(4);
      } else {
        alert(response.error);
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Checkout Stepper Bar */}
      <div className="flex items-center justify-between max-w-2xl mx-auto text-xs font-bold border-b border-slate-200 pb-4">
        <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
          <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-[10px]">1</span>
          <span>Contact Info</span>
        </div>
        <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
          <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-[10px]">2</span>
          <span>Nepal Address</span>
        </div>
        <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-blue-600' : 'text-slate-400'}`}>
          <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-[10px]">3</span>
          <span>Payment</span>
        </div>
        <div className={`flex items-center gap-1.5 ${step === 4 ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-[10px]">4</span>
          <span>Confirmation</span>
        </div>
      </div>

      {step === 4 && completedOrder ? (
        /* STEP 4: ORDER CONFIRMATION & INVOICE */
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6 max-w-2xl mx-auto text-xs">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Order Confirmed!</h1>
            <p className="text-slate-500">
              Thank you for choosing Intel Computer Center. Your order reference number is:
            </p>
            <div className="inline-block bg-blue-50 text-blue-700 font-extrabold text-lg px-4 py-1.5 rounded-xl border border-blue-200 font-mono">
              {completedOrder.id}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex justify-between font-bold text-slate-900 border-b border-slate-200 pb-2">
              <span>Delivery To:</span>
              <span>{completedOrder.shippingAddress.fullName} ({completedOrder.shippingAddress.phone})</span>
            </div>
            <div className="text-slate-600">
              {completedOrder.shippingAddress.addressLine}, Ward {completedOrder.shippingAddress.ward}, {completedOrder.shippingAddress.municipality}, {completedOrder.shippingAddress.district}, {completedOrder.shippingAddress.province}
            </div>
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
              <span>Payment Method:</span>
              <span className="uppercase text-blue-700 font-black">{completedOrder.paymentMethod}</span>
            </div>
            <div className="flex justify-between font-extrabold text-sm text-blue-700">
              <span>Total Payable Amount:</span>
              <span>NPR {completedOrder.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-800">Ordered Items ({completedOrder.items.length}):</h4>
            <div className="divide-y divide-slate-100">
              {completedOrder.items.map((it, idx) => (
                <div key={idx} className="py-2 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">{it.productName}</div>
                    <div className="text-[11px] text-slate-400">Qty: {it.quantity} x NPR {it.price.toLocaleString()}</div>
                  </div>
                  <div className="font-extrabold text-slate-900">
                    NPR {(it.price * it.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => navigateTo('track-order')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow"
            >
              Track Order Live
            </button>
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="bg-[#0056b3] hover:bg-[#004494] text-white font-bold py-3 px-6 rounded-xl shadow flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>View Official Tax Invoice</span>
            </button>
            <button
              onClick={() => window.print()}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-6 rounded-xl border border-slate-300 flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
            </button>
          </div>

          {/* Official Nepal Tax Invoice Modal */}
          {completedOrder && (
            <InvoiceModal
              order={completedOrder}
              isOpen={showInvoiceModal}
              onClose={() => setShowInvoiceModal(false)}
            />
          )}
        </div>
      ) : (
        /* STEPS 1-3 FORM */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-xs">
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Customer Contact */}
            {step === 1 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    <span>Step 1: Customer Contact Information</span>
                  </h2>
                  {isUserLoggedIn && currentUser && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Signed in as {currentUser.name}</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setAddress((prev) => ({ ...prev, fullName: e.target.value }));
                      }}
                      placeholder="e.g. Som Prakash Chaudhary"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nepali Mobile Phone *</label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        setAddress((prev) => ({ ...prev, phone: e.target.value }));
                      }}
                      placeholder="e.g. 9825695432"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value);
                      setAddress((prev) => ({ ...prev, email: e.target.value }));
                    }}
                    placeholder="e.g. user@example.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow flex items-center gap-2"
                >
                  <span>Continue to Shipping Address</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 2: Address */}
            {step === 2 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <span>Step 2: Shipping Address in Nepal</span>
                  </h2>
                  {isLoadingAddresses && (
                    <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading addresses...
                    </span>
                  )}
                </div>

                {/* Saved Addresses Picker (if user has saved addresses in their profile) */}
                {isUserLoggedIn && savedAddresses.length > 0 && (
                  <div className="space-y-3">
                    <label className="block font-bold text-slate-800 text-xs">
                      Select Delivery Address:
                    </label>
                    <div className="grid grid-cols-1 gap-2.5">
                      {savedAddresses.map((addr) => {
                        const isSelected = selectedAddressId === addr.id;
                        const isDefault = addr.isDefault;
                        const formattedLine = [addr.houseNumber, addr.streetAddress, addr.tole]
                          .filter(Boolean)
                          .join(', ') || addr.streetAddress || '';

                        return (
                          <div
                            key={addr.id}
                            onClick={() => handleSelectAddress(addr)}
                            className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 shadow-sm'
                                : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                    isSelected
                                      ? 'border-blue-600 bg-blue-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  {addr.label === 'Office' ? (
                                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                  ) : (
                                    <Home className="w-3.5 h-3.5 text-slate-500" />
                                  )}
                                  <span>{addr.label || 'Home'}</span>
                                </span>
                                {isDefault && (
                                  <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[9px] px-2 py-0.5 rounded tracking-wide">
                                    DEFAULT
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-slate-700">{addr.phone}</span>
                            </div>

                            <div className="mt-1.5 pl-6 space-y-0.5 text-[11px] text-slate-600">
                              <div className="font-semibold text-slate-800">{addr.fullName}</div>
                              <div>
                                {formattedLine ? `${formattedLine}, ` : ''}Ward No. {addr.wardNo}, {addr.municipality}
                              </div>
                              <div className="text-slate-500">
                                {addr.district}, {provinceLabel(addr.province)}
                                {addr.landmark ? ` (Near: ${addr.landmark})` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Option to use a new address */}
                      <div
                        onClick={handleChooseNewAddress}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-2.5 ${
                          selectedAddressId === 'new'
                            ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                            : 'border-dashed border-slate-300 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            selectedAddressId === 'new'
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {selectedAddressId === 'new' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <Plus className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-bold text-blue-700 text-xs">
                          Deliver to a different / new address
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Address Form (Shown if 'new' is selected or user has no saved addresses) */}
                {(selectedAddressId === 'new' || savedAddresses.length === 0) && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    {savedAddresses.length > 0 && (
                      <h3 className="font-bold text-slate-800 text-xs">Enter New Delivery Address:</h3>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Province *</label>
                        <select
                          value={address.province}
                          onChange={(e) => setAddress({ ...address, province: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                        >
                          {SERVICED_PROVINCE_CODES.map((code) => (
                            <option key={code} value={PROVINCE_LABELS[code]}>
                              {PROVINCE_LABELS[code]}
                            </option>
                          ))}
                        </select>
                        {SERVICED_PROVINCE_CODES.length === 1 && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            We currently deliver within {PROVINCE_LABELS.sudurpashchim} only. Nepal-wide
                            delivery is coming soon.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">District *</label>
                        <input
                          type="text"
                          required
                          list="serviced-districts"
                          value={address.district}
                          onChange={(e) => setAddress({ ...address, district: e.target.value })}
                          placeholder={`e.g. ${SUDURPASHCHIM_DISTRICTS.slice(0, 3).join(', ')}`}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                        />
                        <datalist id="serviced-districts">
                          {SUDURPASHCHIM_DISTRICTS.map((district) => (
                            <option key={district} value={district} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Municipality / City *</label>
                        <input
                          type="text"
                          required
                          value={address.municipality}
                          onChange={(e) => setAddress({ ...address, municipality: e.target.value })}
                          placeholder="e.g. Dhangadhi Sub-Metropolitan City"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Ward Number *</label>
                        <input
                          type="text"
                          required
                          value={address.ward}
                          onChange={(e) => setAddress({ ...address, ward: e.target.value })}
                          placeholder="e.g. 5"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Street / Tole / Area Address *</label>
                      <input
                        type="text"
                        required
                        value={address.addressLine}
                        onChange={(e) => setAddress({ ...address, addressLine: e.target.value })}
                        placeholder="e.g. Hasanpur or Main Road"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Landmark (Optional)</label>
                      <input
                        type="text"
                        value={address.landmark}
                        onChange={(e) => setAddress({ ...address, landmark: e.target.value })}
                        placeholder="e.g. Near Nepal Bank"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                      />
                    </div>

                    {isUserLoggedIn && (
                      <label className="flex items-center gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveNewAddressToProfile}
                          onChange={(e) => setSaveNewAddressToProfile(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span className="text-slate-700 font-semibold text-xs">
                          Save this address to my saved addresses for future orders
                        </span>
                      </label>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="bg-slate-100 text-slate-700 font-bold py-3 px-6 rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!address.addressLine.trim() && (selectedAddressId === 'new' || savedAddresses.length === 0)) {
                        alert('Please enter your Street / Tole address.');
                        return;
                      }
                      if (!address.ward.trim() && (selectedAddressId === 'new' || savedAddresses.length === 0)) {
                        alert('Please enter your Ward Number.');
                        return;
                      }
                      setStep(3);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow flex items-center gap-2"
                  >
                    <span>Continue to Payment Selection</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <form onSubmit={handleCompleteOrder} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span>Step 3: Select Payment Method</span>
                  </h2>
                </div>

                {/* Selected Shipping Destination Preview */}
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-blue-900 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Shipping To: {address.fullName || customerName} ({address.phone || customerPhone})</span>
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      {address.addressLine}, Ward {address.ward}, {address.municipality}, {address.district}, {address.province}
                      {address.landmark ? ` (Landmark: ${address.landmark})` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-blue-700 hover:text-blue-900 font-bold text-xs underline flex-shrink-0"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-3">
                  {/* COD */}
                  <label
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20' : 'border-slate-200 bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={paymentMethod === 'cod'} readOnly />
                      <div>
                        <div className="font-bold text-slate-900">Cash on Delivery (COD)</div>
                        <div className="text-[11px] text-slate-500">Pay cash upon inspecting delivery in Kailali / major cities</div>
                      </div>
                    </div>
                    <span className="font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded text-[10px]">
                      POPULAR
                    </span>
                  </label>

                  {/* eSewa */}
                  <label
                    onClick={() => setPaymentMethod('esewa')}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${paymentMethod === 'esewa' ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20' : 'border-slate-200 bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={paymentMethod === 'esewa'} readOnly />
                      <div>
                        <div className="font-bold text-emerald-900">eSewa Mobile Wallet</div>
                        <div className="text-[11px] text-slate-500">Instant digital wallet transfer</div>
                      </div>
                    </div>
                    <span className="font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded text-[10px]">
                      eSewa ID: 9848424859
                    </span>
                  </label>

                  {/* Khalti */}
                  <label
                    onClick={() => setPaymentMethod('khalti')}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${paymentMethod === 'khalti' ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20' : 'border-slate-200 bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={paymentMethod === 'khalti'} readOnly />
                      <div>
                        <div className="font-bold text-purple-900">Khalti Digital Wallet</div>
                        <div className="text-[11px] text-slate-500">Pay via Khalti app / Web banking</div>
                      </div>
                    </div>
                    <span className="font-black text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded text-[10px]">
                      Khalti ID: 9848424859
                    </span>
                  </label>

                  {/* Bank Wire */}
                  <label
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${paymentMethod === 'bank_transfer' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20' : 'border-slate-200 bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={paymentMethod === 'bank_transfer'} readOnly />
                      <div>
                        <div className="font-bold text-slate-900">Direct Bank Wire / Fonepay</div>
                        <div className="text-[11px] text-slate-500">Nabil Bank Account Transfer</div>
                      </div>
                    </div>
                  </label>
                </div>

                {paymentMethod === 'bank_transfer' && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-[11px] space-y-1">
                    <p className="font-bold text-blue-900">Bank Details for Transfer:</p>
                    <p>Bank: Nabil Bank Ltd, New Road Branch</p>
                    <p>Account Name: Intel Computer Center</p>
                    <p>Account Number: 01901017500129</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="bg-slate-100 text-slate-700 font-bold py-3 px-6 rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOrder}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold py-3.5 px-6 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmittingOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Placing Order...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Place Final Order (NPR {total.toLocaleString()})</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Cart Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3 h-fit">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Cart Summary ({cart.length} items)
            </h3>

            <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-slate-100 pr-1">
              {cart.map((item) => (
                <div key={item.product.id} className="pt-2 flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{item.product.name}</div>
                    <div className="text-[11px] text-slate-500">Qty: {item.quantity}</div>
                  </div>
                  <div className="font-extrabold text-blue-700 flex-shrink-0">
                    NPR {(item.product.sellingPrice * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-1.5 font-bold">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>NPR {subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span>- NPR {discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Shipping:</span>
                <span>{shippingFee === 0 ? 'FREE' : `NPR ${shippingFee}`}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-blue-700 border-t border-slate-200 pt-2">
                <span>Total Amount:</span>
                <span>NPR {total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

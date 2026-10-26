'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  NEPAL_PROVINCES,
  getDistrictsForProvince,
  getMunicipalitiesForDistrict,
  getWardCount,
  wardOptions,
} from '@/lib/nepal/locations';
import {
  Phone,
  MapPin,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  LogOut,
} from 'lucide-react';

export default function CompleteProfileModal() {
  const {
    isProfileSetupOpen,
    currentUser,
    completeProfile,
    logoutUser,
  } = useStore();

  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [province, setProvince] = useState('sudurpashchim');
  const [district, setDistrict] = useState('Kailali');
  const [municipality, setMunicipality] = useState('');
  const [ward, setWard] = useState('');
  const [tole, setTole] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [landmark, setLandmark] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Address dropdowns derived from selected province & district
  const districts = useMemo(
    () => (province ? getDistrictsForProvince(province) : []),
    [province]
  );

  const municipalities = useMemo(
    () => (province && district ? getMunicipalitiesForDistrict(province, district) : []),
    [province, district]
  );

  const wardCount = useMemo(
    () => (province && district && municipality ? getWardCount(province, district, municipality) : 0),
    [province, district, municipality]
  );

  const wardOpts = useMemo(
    () => (wardCount > 0 ? wardOptions(wardCount) : []),
    [wardCount]
  );

  if (!isProfileSetupOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate phone
    const cleanPhone = phone.replace(/[\s-]/g, '').replace(/^(\+?977)/, '');
    if (!/^9[678]\d{8}$/.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 10-digit Nepali mobile number (e.g. 98XXXXXXXX or 97XXXXXXXX).');
      return;
    }

    // Validate address
    if (!province) {
      setErrorMessage('Please select your Province.');
      return;
    }
    if (!district) {
      setErrorMessage('Please select your District.');
      return;
    }
    if (!municipality) {
      setErrorMessage('Please select your Municipality / Rural Municipality.');
      return;
    }
    if (!ward.trim()) {
      setErrorMessage('Please specify your Ward number.');
      return;
    }
    if (!tole.trim()) {
      setErrorMessage('Please enter your Tole, Street, or Area name.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await completeProfile({
        phone: cleanPhone,
        address: {
          label: 'Home',
          province,
          district,
          municipality,
          wardNo: ward.trim(),
          tole: tole.trim() || undefined,
          streetAddress: tole.trim() || undefined,
          houseNumber: houseNumber.trim() || undefined,
          landmark: landmark.trim() || undefined,
        },
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to save profile. Please check your inputs.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred while saving your profile.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* User Identity Header */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
          <div className="relative">
            {currentUser?.avatarUrl && !imgError ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#0056b3] shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0056b3] to-blue-400 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
                {currentUser?.name ? currentUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
              </div>
            )}
            <span
              className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"
              title="Google Account Connected"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-[#0056b3] tracking-wide inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Google Verified
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-gray-900 truncate mt-0.5">
              Welcome, {currentUser?.name || 'Customer'}!
            </h2>
            <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
          </div>
        </div>

        {/* Notice Info Banner */}
        <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200/70 rounded-2xl flex gap-3 text-amber-900 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[12px] text-amber-900">One Last Step: Required Contact & Delivery Info</p>
            <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
              To process order delivery, confirm dispatches with our riders, and provide warranty support in Sudurpashchim and across Nepal, please specify your mobile number and default delivery address.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Mobile Phone Number */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#0056b3]" />
              <span>Nepali Mobile Number *</span>
            </label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-200 text-gray-600 font-bold text-xs px-3 py-2.5 rounded-l-xl">
                +977
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX or 97XXXXXXXX"
                className="w-full bg-gray-50 border border-gray-200 rounded-r-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Must be 10 digits starting with 98 or 97. Used for order SMS and courier calls.
            </p>
          </div>

          {/* Delivery Address Section */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
              <MapPin className="w-3.5 h-3.5 text-[#0056b3]" />
              <span>Default Delivery Address in Nepal</span>
            </div>

            {/* Province & District */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Province *
                </label>
                <select
                  required
                  value={province}
                  onChange={(e) => {
                    setProvince(e.target.value);
                    setDistrict('');
                    setMunicipality('');
                    setWard('');
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                >
                  <option value="">Select Province</option>
                  {NEPAL_PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  District *
                </label>
                <select
                  required
                  value={district}
                  disabled={!province}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    setMunicipality('');
                    setWard('');
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                >
                  <option value="">Select District</option>
                  {districts.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Municipality & Ward */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Municipality / Palika *
                </label>
                <select
                  required
                  value={municipality}
                  disabled={!district}
                  onChange={(e) => {
                    setMunicipality(e.target.value);
                    setWard('');
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                >
                  <option value="">Select Municipality</option>
                  {municipalities.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Ward No. *
                </label>
                {wardOpts.length > 0 ? (
                  <select
                    required
                    value={ward}
                    disabled={!municipality}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                  >
                    <option value="">Select Ward</option>
                    {wardOpts.map((w) => (
                      <option key={w} value={w}>
                        Ward {w}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={ward}
                    disabled={!municipality}
                    onChange={(e) => setWard(e.target.value)}
                    placeholder="e.g. 4"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none disabled:opacity-50 focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                  />
                )}
              </div>
            </div>

            {/* Tole / Street Area */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Tole / Street / Area Name *
              </label>
              <input
                type="text"
                required
                value={tole}
                onChange={(e) => setTole(e.target.value)}
                placeholder="e.g. Hasanpur, Main Road, LN Chowk"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
              />
            </div>

            {/* House No / Landmark (Optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  House / Room No. <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="e.g. 12 or Flat 2B"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Nearby Landmark <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near ICC Store"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0056b3] hover:bg-blue-700 text-white font-black py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Profile & Address...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Continue to Store</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Sign Out Escape Option */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={logoutUser}
            className="text-[11px] text-gray-400 hover:text-red-600 transition-colors inline-flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" />
            <span>Not you or want to sign in with a different account? Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

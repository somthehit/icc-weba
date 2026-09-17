'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  X,
  Heart,
  Lock,
  Mail,
  User,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import {
  NEPAL_PROVINCES,
  getDistrictsForProvince,
  getMunicipalitiesForDistrict,
  getWardCount,
  wardOptions,
} from '@/lib/nepal/locations';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail
  } = useStore();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Address state
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [ward, setWard] = useState('');
  const [tole, setTole] = useState('');
  const [houseNumber, setHouseNumber] = useState('');

  const districts = useMemo(() => (province ? getDistrictsForProvince(province) : []), [province]);
  const municipalities = useMemo(
    () => (province && district ? getMunicipalitiesForDistrict(province, district) : []),
    [province, district],
  );
  const wardCount = useMemo(
    () => (province && district && municipality ? getWardCount(province, district, municipality) : 0),
    [province, district, municipality],
  );
  const wardOpts = useMemo(() => (wardCount > 0 ? wardOptions(wardCount) : []), [wardCount]);

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await loginWithGoogle();
      if (!res.success) {
        setErrorMessage(res.error || 'Google authentication was not completed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (activeTab === 'login') {
        const res = await loginWithEmail(email, password);
        if (!res.success && res.error) {
          setErrorMessage(res.error);
        }
      } else {
        if (province && (!district || !municipality || !ward)) {
          setErrorMessage('Please complete the address or leave it blank.');
          setIsLoading(false);
          return;
        }
        const address = province && district && municipality && ward
          ? { province, district, municipality, wardNo: ward, tole: tole || undefined, houseNumber: houseNumber || undefined }
          : undefined;
        const res = await registerWithEmail(name, email, password, phone, address);
        if (!res.success && res.error) {
          setErrorMessage(res.error);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectClass = 'w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white outline-none appearance-none';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 my-8">
        {/* Close Button */}
        <button
          onClick={() => setIsAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          title="Close Modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2 mb-5">
          <div className="w-12 h-12 bg-blue-50 text-[#0056b3] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <Heart className="w-6 h-6 fill-current text-rose-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-black text-[#1a1a1a]">
            {activeTab === 'login' ? 'Sign In to Your Account' : 'Create Customer Account'}
          </h2>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Sync your wishlist, track orders across Sudurpashchim, and access the AI Hardware Consultant.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google Sign-in Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          type="button"
          className="w-full bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 mb-4 hover:border-gray-400"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink mx-3 text-[11px] text-gray-400 font-semibold uppercase">Or with Email</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('login')}
            type="button"
            className={`flex-1 py-2 rounded-lg transition-all ${activeTab === 'login' ? 'bg-white text-[#0056b3] shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setActiveTab('register')}
            type="button"
            className={`flex-1 py-2 rounded-lg transition-all ${activeTab === 'register' ? 'bg-white text-[#0056b3] shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
          >
            Register Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {activeTab === 'register' && (
            <div>
              <label className="block text-gray-700 font-bold mb-1">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Suman Rayamajhi"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 pl-9 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white outline-none"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-gray-700 font-bold mb-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. anish@example.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 pl-9 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white outline-none"
              />
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 pl-9 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white outline-none"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          {activeTab === 'register' && (
            <div>
              <label className="block text-gray-700 font-bold mb-1">Mobile Phone (+977)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+977-9801234567"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white outline-none"
              />
            </div>
          )}

          {/* Address Section (Register only) */}
          {activeTab === 'register' && (
            <div className="pt-1">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-bold text-gray-700">Delivery Address</span>
                <span className="text-[10px] text-gray-400 font-normal">(optional)</span>
              </div>

              <div className="space-y-2">
                {/* Province */}
                <div className="relative">
                  <select
                    value={province}
                    onChange={(e) => { setProvince(e.target.value); setDistrict(''); setMunicipality(''); setWard(''); }}
                    className={selectClass}
                  >
                    <option value="">Province</option>
                    {NEPAL_PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>{p.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>

                {/* District */}
                <div className="relative">
                  <select
                    value={district}
                    onChange={(e) => { setDistrict(e.target.value); setMunicipality(''); setWard(''); }}
                    disabled={!province}
                    className={selectClass}
                  >
                    <option value="">District</option>
                    {districts.map((d) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>

                {/* Municipality */}
                <div className="relative">
                  <select
                    value={municipality}
                    onChange={(e) => { setMunicipality(e.target.value); setWard(''); }}
                    disabled={!district || municipalities.length === 0}
                    className={selectClass}
                  >
                    <option value="">{municipalities.length === 0 && district ? 'Type district name below' : 'Municipality'}</option>
                    {municipalities.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>

                {district && municipalities.length === 0 && (
                  <input
                    type="text"
                    value={municipality}
                    onChange={(e) => { setMunicipality(e.target.value); setWard(''); }}
                    placeholder="Enter municipality or VDC name"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white outline-none"
                  />
                )}

                {/* Ward */}
                <div className="relative">
                  <select
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    disabled={!municipality || wardOpts.length === 0}
                    className={selectClass}
                  >
                    <option value="">{wardOpts.length === 0 && municipality ? 'Enter ward below' : 'Ward Number'}</option>
                    {wardOpts.map((w) => (
                      <option key={w} value={w}>Ward {w}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>

                {municipality && wardOpts.length === 0 && (
                  <input
                    type="text"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    placeholder="Enter ward number"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white outline-none"
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={tole}
                    onChange={(e) => setTole(e.target.value)}
                    placeholder="Tole (optional)"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white outline-none"
                  />
                  <input
                    type="text"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    placeholder="House No. (optional)"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#1a1a1a] hover:bg-black text-white font-bold py-3 rounded-xl shadow transition-colors text-xs flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{activeTab === 'login' ? 'Sign In to Account' : 'Create Free Account'}</span>
          </button>
        </form>

        {/* Switch tabs */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            {activeTab === 'login' ? 'New to Intel Computer?' : 'Already have an account?'}
          </span>
          <button
            onClick={() => {
              setActiveTab(activeTab === 'login' ? 'register' : 'login');
              setErrorMessage(null);
            }}
            type="button"
            className="text-[11px] text-[#0056b3] font-bold hover:underline flex items-center gap-1"
          >
            <span>{activeTab === 'login' ? 'Create a free account' : 'Sign in instead'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';

export const CustomerRegisterView: React.FC = () => {
  const {
    registerWithEmail,
    navigateTo,
  } = useStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please try again.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerWithEmail(name, email, password, phone);
      if (res.success) {
        navigateTo('home');
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#0056b3] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-[#1a1a1a]">Create Your Account</h1>
          <p className="text-sm text-gray-500 mt-1">Join Intel Computer Center today</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          {errorMessage && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 text-sm">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Suman Rayamajhi"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 pl-11 text-sm focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 text-sm">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. suman@example.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 pl-11 text-sm focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 text-sm">Mobile Phone (+977)</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9801234567"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 pl-11 text-sm focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all"
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 text-sm">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 pl-11 pr-11 text-sm focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all"
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-gray-700 font-bold mb-1.5 text-sm">Confirm Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 pl-11 text-sm focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all"
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
              {confirmPassword && password === confirmPassword && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" required className="w-3.5 h-3.5 rounded border-gray-300 text-[#0056b3] focus:ring-[#0056b3] mt-0.5" />
              <span className="text-xs text-gray-500">
                I agree to the <button type="button" className="text-[#0056b3] font-semibold hover:underline">Terms of Service</button> and <button type="button" className="text-[#0056b3] font-semibold hover:underline">Privacy Policy</button>
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0056b3] hover:bg-[#004a99] text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>Create Free Account</span>
            </button>
          </form>
        </div>

        {/* Login Link */}
        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account?{' '}
          <button
            onClick={() => navigateTo('customer-login')}
            className="text-[#0056b3] font-bold hover:underline"
          >
            Sign in instead
          </button>
        </p>

        {/* Back to Store */}
        <p className="text-center mt-3">
          <button
            onClick={() => navigateTo('home')}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
          >
            &larr; Back to store
          </button>
        </p>
      </div>
    </div>
  );
};

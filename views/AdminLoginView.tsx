'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';

export const AdminLoginView: React.FC = () => {
  const {
    loginAdmin,
    navigateTo,
  } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // The role comes from the account, not from a picker on this form — which
      // is why the "Login As" selector is gone. Previously any email/password
      // combination was accepted and the chosen role granted outright.
      const res = await loginAdmin(email, password);
      if (res.success) {
        navigateTo('admin');
      } else {
        setErrorMessage(res.error || 'Sign in failed. Please check your credentials.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1420] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#4C63FF] to-[#0056b3] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Intel Computer & Electronics — Staff Portal</p>
        </div>

        {/* Card */}
        <div className="bg-[#1A2035] rounded-3xl shadow-2xl border border-white/5 p-8">
          {errorMessage && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-gray-300 font-bold mb-1.5 text-sm">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@intel.com.np"
                  className="w-full bg-[#0F1420] border border-white/10 rounded-xl py-3 px-4 pl-11 text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-[#4C63FF]/30 focus:border-[#4C63FF] outline-none transition-all"
                />
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-300 font-bold mb-1.5 text-sm">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-[#0F1420] border border-white/10 rounded-xl py-3 px-4 pl-11 pr-11 text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-[#4C63FF]/30 focus:border-[#4C63FF] outline-none transition-all"
                />
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-600 bg-[#0F1420] text-[#4C63FF] focus:ring-[#4C63FF]" />
                <span className="text-gray-400">Remember me</span>
              </label>
              <button type="button" className="text-[#4C63FF] font-semibold hover:underline">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#4C63FF] hover:bg-[#3B50E0] text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/25 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>Sign In to Dashboard</span>
            </button>
          </form>

          {/* Printing working credentials on the sign-in page defeats the point of
              having them, so the demo block is gone. Staff accounts are created
              from the dashboard. */}
        </div>

        {/* Back to Store */}
        <p className="text-center mt-6">
          <button
            onClick={() => navigateTo('home')}
            className="text-xs text-gray-500 hover:text-gray-300 font-medium transition-colors"
          >
            &larr; Back to Intel Store
          </button>
        </p>
      </div>
    </div>
  );
};

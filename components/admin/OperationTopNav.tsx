'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  Banknote,
  Boxes,
  Calculator,
  LayoutDashboard,
  Shield,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  TrendingUp,
  Store,
  MonitorCheck,
  ChevronRight,
} from 'lucide-react';

interface OperationTopNavProps {
  activeSection: 'pos' | 'accounting' | 'store-manage' | 'admin';
  title?: string;
  subtitle?: string;
}

export const OperationTopNav: React.FC<OperationTopNavProps> = ({
  activeSection,
  title,
  subtitle,
}) => {
  const { navigateTo, currentUser } = useStore();
  const [timeStr, setTimeStr] = useState('');
  const [liveShiftActive, setLiveShiftActive] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNav = (target: 'pos' | 'accounting' | 'store-manage' | 'admin') => {
    if (typeof window !== 'undefined') {
      // If we are on a specific Next.js page route or SPA, handle both seamlessly
      if (target === 'pos') {
        window.location.href = '/pos';
      } else if (target === 'accounting') {
        window.location.href = '/accounting';
      } else if (target === 'store-manage') {
        window.location.href = '/store-manage';
      } else if (target === 'admin') {
        window.location.href = '/?page=admin';
      }
    }
  };

  return (
    <header className="flex-shrink-0 z-40 bg-[#0B0F19] text-white border-b border-white/10 px-4 md:px-6 py-2.5 shadow-md select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Brand & Section Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => handleNav('admin')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 via-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-sm font-mono tracking-wider">
              ICC
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
                <span>ICC Enterprise Suite</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  v2.6
                </span>
              </div>
              <div className="text-[11px] text-gray-400 font-medium">
                {title || 'Integrated Operations Hub'}
              </div>
            </div>
          </div>

          {/* Clock & Status */}
          <div className="flex md:hidden items-center gap-2 font-mono text-[11px] text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{timeStr}</span>
          </div>
        </div>

        {/* Center: Module Link Tabs (POS, Accounting, Storekeeper, Admin) */}
        <nav className="flex items-center gap-1.5 bg-[#141B2D] p-1 rounded-xl border border-white/10 w-full md:w-auto overflow-x-auto scrollbar-none">
          {/* POS Terminal */}
          <button
            onClick={() => handleNav('pos')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeSection === 'pos'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/40 border border-emerald-400/40'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Banknote className="w-3.5 h-3.5 text-emerald-300" />
            <span>Apex POS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </button>

          {/* Accounting Hub */}
          <button
            onClick={() => handleNav('accounting')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeSection === 'accounting'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/40 border border-blue-400/40'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-blue-300" />
            <span>Accounting & Invoices</span>
            <span className="text-[10px] font-mono px-1 rounded bg-blue-500/30 text-blue-200">
              HUB
            </span>
          </button>

          {/* Store Management */}
          <button
            onClick={() => handleNav('store-manage')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeSection === 'store-manage'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-900/40 border border-amber-400/40'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 text-amber-300" />
            <span>Store & Inventory</span>
          </button>

          {/* Admin Console */}
          <button
            onClick={() => handleNav('admin')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeSection === 'admin'
                ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md shadow-purple-900/40 border border-purple-400/40'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-purple-300" />
            <span>Admin Console</span>
          </button>
        </nav>

        {/* Right: Real-time Live Badge & Quick Status */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{timeStr || 'LIVE'}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium">{currentUser?.name || 'Authorized Manager'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

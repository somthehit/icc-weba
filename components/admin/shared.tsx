// components/admin/shared.tsx
//
// Presentational primitives and formatters shared by the admin modules.
//
// These are declared at module scope rather than inside a module component on
// purpose: a component declared in a render body is a new type on every
// keystroke, which remounts the input under it and loses the caret.

import React from 'react';

import type { OrderStatus } from '@/types';

let uniqueIdSeq = 1;
/** Stable keys for locally-created rows (repeater rows, audit log entries). */
export const genAdminId = (prefix: string) => `${prefix}-${uniqueIdSeq++}`;

export const npr = (value: number): string => `NPR ${Math.round(value).toLocaleString('en-IN')}`;

/** Numbers live in forms as strings so a cleared field stays cleared instead of snapping to 0. */
export const toNumber = (value: string, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** URL-safe, matching the `^[a-z0-9]+(?:-[a-z0-9]+)*$` the API enforces. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 220);

/**
 * Which module the console is showing.
 *
 * Named here rather than inferred from the shell's `useState` so the modules that
 * deep-link into each other can type their navigation props.
 */
export type AdminModule =
  | 'dashboard'
  | 'catalog'
  | 'sales'
  | 'delivery'
  | 'services'
  | 'inventory'
  | 'content'
  | 'customers'
  | 'reports'
  | 'settings'
  | 'staff';

/** Sales sub-tab. Shell-owned because the dashboard links straight to `orders`. */
export type SalesSubTab = 'orders' | 'phone-order' | 'returns' | 'offers' | 'coupons';

/** Why stock moved — the reason codes the adjustment ledger accepts. */
export type StockAuditReason = 'damaged' | 'recount' | 'supplier_restock' | 'correction';

/**
 * The next step in the fulfilment chain.
 *
 * Both the orders table (its one-click advance button) and the order-detail modal
 * (its pre-selected target status) need this, so it lives here rather than in
 * either of them.
 */
export const getNextLogicalStatus = (current: OrderStatus): OrderStatus => {
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

/** `products.status` — the four lifecycle states the column actually holds. */
export type PublishState = 'draft' | 'active' | 'inactive' | 'discontinued';

/**
 * How each lifecycle state is shown in the catalogue table.
 *
 * `draft` and `inactive` used to render in the same blue as `active`, so a table
 * of unpublished products read as a live catalogue. Only `active` is green.
 */
export const CATALOG_STATUS_BADGE: Record<PublishState, { label: string; tone: string }> = {
  active: { label: 'Live', tone: 'bg-emerald-100 text-emerald-800' },
  draft: { label: 'Draft', tone: 'bg-amber-100 text-amber-800' },
  inactive: { label: 'Paused', tone: 'bg-gray-100 text-gray-600' },
  discontinued: { label: 'Archived', tone: 'bg-gray-200 text-gray-700' },
};

export const inputClass = (hasError?: boolean): string =>
  `w-full p-2.5 border rounded-xl bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0056b3]/25 ${
    hasError ? 'border-rose-400 bg-rose-50/40' : 'border-gray-200 focus:border-[#0056b3]'
  }`;

/**
 * Label + control + one line of either help text or an error.
 *
 * Defined at module scope rather than inside AdminView: a component declared in
 * a render body is a new type on every keystroke, which remounts the input under
 * it and loses the caret.
 */
export const FormField: React.FC<{
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, required, hint, error, className = '', children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="block font-bold mb-1 text-gray-700">
      {label}
      {required && <span className="text-rose-500"> *</span>}
    </label>
    {children}
    {error ? (
      <p role="alert" className="text-[11px] text-rose-600 font-bold mt-1">
        {error}
      </p>
    ) : hint ? (
      <p className="text-[11px] text-gray-500 mt-1">{hint}</p>
    ) : null}
  </div>
);

export const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label
    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
      checked ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 w-4 h-4 accent-[#0056b3]"
    />
    <span className="min-w-0">
      <span className="block font-bold text-gray-800">{label}</span>
      <span className="block text-[11px] text-gray-500 leading-snug">{description}</span>
    </span>
  </label>
);

/** A remaining-characters counter for the columns with a real varchar limit. */
export const CharCount: React.FC<{ value: string; max: number }> = ({ value, max }) => (
  <span
    className={`font-mono text-[10px] ${
      value.length > max * 0.9 ? 'text-amber-600 font-bold' : 'text-gray-400'
    }`}
  >
    {value.length}/{max}
  </span>
);

export const SparklineChart: React.FC<{
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

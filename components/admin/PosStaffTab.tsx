'use client';

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Unlock,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Laptop,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

export interface PosStaffMember {
  id: string;
  staffCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'cashier' | 'supervisor' | 'manager' | 'admin';
  active: boolean;
  hasPin: boolean;
  mustChangePassword: boolean;
  mustChangePin: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  failedPinAttempts: number;
  pinLockedUntil: string | null;
  isPasswordLocked: boolean;
  isPinLocked: boolean;
  isLocked: boolean;
  createdAt: string;
}

export const PosStaffTab: React.FC = () => {
  const [staffList, setStaffList] = useState<PosStaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<PosStaffMember | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    staffCode: '',
    email: '',
    phone: '',
    role: 'cashier' as PosStaffMember['role'],
    password: '',
    pin: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'cashier' as PosStaffMember['role'],
  });

  const [newPin, setNewPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/pos-staff');
      const data = await res.json();
      if (data.success && data.staff) {
        setStaffList(data.staff);
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to load POS staff' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Error connecting to staff database.' });
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Create Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/admin/pos-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: 'success', text: `Staff member "${createForm.name}" created successfully!` });
        setIsCreateOpen(false);
        setCreateForm({
          name: '',
          staffCode: '',
          email: '',
          phone: '',
          role: 'cashier',
          password: '',
          pin: '',
        });
        fetchStaff();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to create staff member.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Network error creating staff.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Edit Staff Details
  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/admin/pos-staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStaff.id,
          action: 'update',
          ...editForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: 'success', text: `Staff member "${editForm.name}" updated successfully.` });
        setIsEditOpen(false);
        fetchStaff();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to update staff member.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Network error updating staff.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Unlock Account
  const handleUnlock = async (staffMember: PosStaffMember) => {
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/admin/pos-staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staffMember.id,
          action: 'unlock',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: 'success', text: `Account for ${staffMember.name} has been unlocked.` });
        fetchStaff();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to unlock account.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Network error unlocking account.' });
    }
  };

  // 4. Set / Update Quick PIN
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (!/^\d{4,6}$/.test(newPin.trim())) {
      setFeedbackMsg({ type: 'error', text: 'PIN must be between 4 and 6 numeric digits.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/pos-staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStaff.id,
          action: 'set-pin',
          pin: newPin.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: 'success', text: `Fast PIN updated for ${selectedStaff.name}.` });
        setIsPinModalOpen(false);
        setNewPin('');
        fetchStaff();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to update PIN.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Network error updating PIN.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (newPassword.length < 6) {
      setFeedbackMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/pos-staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStaff.id,
          action: 'reset-password',
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: 'success', text: `Password reset successfully for ${selectedStaff.name}.` });
        setIsPasswordModalOpen(false);
        setNewPassword('');
        fetchStaff();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to reset password.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Network error resetting password.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Toggle Active / Deactivate
  const handleToggleActive = async (staffMember: PosStaffMember) => {
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/admin/pos-staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staffMember.id,
          action: 'toggle-active',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: 'success', text: data.message });
        fetchStaff();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to toggle status.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Network error toggling status.' });
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter((s) => {
    const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
    const needle = searchQuery.toLowerCase();
    const matchesSearch =
      !needle ||
      s.name.toLowerCase().includes(needle) ||
      s.staffCode.toLowerCase().includes(needle) ||
      (s.email && s.email.toLowerCase().includes(needle)) ||
      (s.phone && s.phone.includes(needle));
    return matchesRole && matchesSearch;
  });

  // Metrics
  const totalCount = staffList.length;
  const cashiersCount = staffList.filter((s) => s.role === 'cashier').length;
  const supervisorsCount = staffList.filter((s) => s.role === 'supervisor' || s.role === 'manager' || s.role === 'admin').length;
  const lockedCount = staffList.filter((s) => s.isLocked).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total POS Staff</span>
            <UserCheck className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{totalCount}</div>
          <div className="mt-1 text-xs text-slate-500">Retail counter authorized</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Cashiers</span>
            <Laptop className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{cashiersCount}</div>
          <div className="mt-1 text-xs text-slate-500">Checkout & till sales</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Supervisors & Mgrs</span>
            <ShieldCheck className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-600">{supervisorsCount}</div>
          <div className="mt-1 text-xs text-slate-500">Float, EOD & override rights</div>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm ${lockedCount > 0 ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Security Locks</span>
            <Lock className={`h-4 w-4 ${lockedCount > 0 ? 'text-red-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className={`mt-2 text-2xl font-black ${lockedCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{lockedCount}</div>
          <div className="mt-1 text-xs text-slate-500">{lockedCount > 0 ? 'Accounts locked out' : 'All accounts unlocked'}</div>
        </div>
      </div>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-xs font-bold ${
            feedbackMsg.type === 'success'
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border border-red-300 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff code, cashier name, email or phone..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Role Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold">
            {(['ALL', 'cashier', 'supervisor', 'manager', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-lg px-3 py-1.5 capitalize transition ${
                  roleFilter === r
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'ALL' ? 'All Roles' : r}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add POS Staff
          </button>

          <a
            href="/pos/login"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            title="Open POS Terminal Login page in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
            POS Login Page
          </a>
        </div>
      </div>

      {/* Staff Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-4">Staff Member</th>
                <th className="p-4">POS Role</th>
                <th className="p-4">Security / PIN</th>
                <th className="p-4">Lockout Status</th>
                <th className="p-4">Access Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map((member) => {
                const isSupervisor = member.role === 'admin' || member.role === 'manager' || member.role === 'supervisor';

                return (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name & Code */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                            isSupervisor
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {member.staffCode.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">{member.name}</span>
                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {member.staffCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {member.email || 'No email provided'}
                            {member.phone ? ` · +977 ${member.phone}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="p-4">
                      <span
                        className={`inline-block rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                          member.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : member.role === 'manager'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : member.role === 'supervisor'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>

                    {/* Security & PIN */}
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {member.hasPin ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <KeyRound className="h-3 w-3" /> PIN Configured
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                              <Lock className="h-3 w-3" /> Password Only
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedStaff(member);
                            setNewPin('');
                            setIsPinModalOpen(true);
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:underline"
                        >
                          {member.hasPin ? 'Change PIN' : '+ Set PIN'}
                        </button>
                      </div>
                    </td>

                    {/* Lockout status */}
                    <td className="p-4">
                      {member.isPasswordLocked ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
                            <Lock className="h-3 w-3" /> PASSWORD LOCKED ({member.failedAttempts} fails)
                          </span>
                          <button
                            onClick={() => handleUnlock(member)}
                            className="block text-[10px] font-bold text-emerald-700 hover:underline"
                          >
                            🔓 Unlock Account
                          </button>
                        </div>
                      ) : member.isPinLocked ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                            <Lock className="h-3 w-3" /> PIN LOCKED ({member.failedPinAttempts} fails)
                          </span>
                          <button
                            onClick={() => handleUnlock(member)}
                            className="block text-[10px] font-bold text-emerald-700 hover:underline"
                          >
                            🔓 Reset PIN Lock
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Clean Status
                        </span>
                      )}
                    </td>

                    {/* Access Status */}
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                          member.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${member.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {member.active ? 'ACTIVE' : 'DEACTIVATED'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedStaff(member);
                            setEditForm({
                              name: member.name,
                              email: member.email || '',
                              phone: member.phone || '',
                              role: member.role,
                            });
                            setIsEditOpen(true);
                          }}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Edit staff details"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedStaff(member);
                            setNewPassword('');
                            setIsPasswordModalOpen(true);
                          }}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Reset Password"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedStaff(member);
                            setNewPin('');
                            setIsPinModalOpen(true);
                          }}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Set PIN"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-sm text-slate-500">
                    No POS staff members found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE POS STAFF */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateStaff} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-base font-black text-slate-900">Add POS Staff Member</h3>
                <p className="text-xs text-slate-500">Configure retail counter credentials and access role.</p>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-bold text-slate-700">
                  Full Name
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g. Ramesh Sharma"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-slate-700">
                  Staff Code (Terminal ID)
                  <input
                    type="text"
                    required
                    value={createForm.staffCode}
                    onChange={(e) => setCreateForm({ ...createForm, staffCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. CSH03"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs font-bold uppercase outline-none focus:border-slate-900"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-bold text-slate-700">
                  Email Address
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="ramesh@icecomputers.com.np"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-slate-700">
                  Phone Number
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="98XXXXXXXX"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900"
                  />
                </label>
              </div>

              <label className="space-y-1 text-xs font-bold text-slate-700 block">
                POS Operational Role
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900 bg-white"
                >
                  <option value="cashier">Cashier (Standard till operations, sales & receipts)</option>
                  <option value="supervisor">Supervisor (Cash drawer override, opening float, line voids)</option>
                  <option value="manager">Store Manager (Float opening, EOD close, full POS access)</option>
                  <option value="admin">General Manager / Admin (Full system & terminal rights)</option>
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-bold text-slate-700">
                  Initial Password
                  <input
                    type="password"
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Min 6 characters"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-slate-700">
                  Quick PIN (Optional, 4-6 Digits)
                  <input
                    type="text"
                    maxLength={6}
                    value={createForm.pin}
                    onChange={(e) => setCreateForm({ ...createForm, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="e.g. 1234"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs font-bold outline-none focus:border-slate-900"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Staff Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: EDIT STAFF DETAILS */}
      {isEditOpen && selectedStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleEditStaff} className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-base font-black text-slate-900">Edit Staff Profile</h3>
                <p className="font-mono text-xs text-slate-500">{selectedStaff.staffCode}</p>
              </div>
              <button type="button" onClick={() => setIsEditOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <label className="space-y-1 text-xs font-bold text-slate-700 block">
                Full Name
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-slate-700 block">
                Email Address
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-slate-700 block">
                Phone Number
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-slate-700 block">
                Role
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900 bg-white"
                >
                  <option value="cashier">Cashier</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="manager">Store Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: SET QUICK PIN */}
      {isPinModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleSavePin} className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-base font-black text-slate-900">Set Fast-Action PIN</h3>
                <p className="text-xs text-slate-500">For {selectedStaff.name} ({selectedStaff.staffCode})</p>
              </div>
              <button type="button" onClick={() => setIsPinModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Enter 4 to 6 Digit Numeric PIN
              </label>
              <input
                type="password"
                maxLength={6}
                required
                autoFocus
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold rounded-2xl border border-slate-200 bg-slate-50 py-3.5 focus:border-emerald-600 focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 text-center">
                This PIN will be encrypted with Argon2id and server pepper.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || newPin.length < 4}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save PIN'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: RESET PASSWORD */}
      {isPasswordModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleResetPassword} className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-base font-black text-slate-900">Reset Account Password</h3>
                <p className="text-xs text-slate-500">For {selectedStaff.name}</p>
              </div>
              <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                New Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || newPassword.length < 6}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

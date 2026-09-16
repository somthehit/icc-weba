'use client';

import React, { useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  Car,
  Check,
  ClipboardList,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { type AdminUser, type AuditLogEntry } from '@/types';
import { RolesPermissionsTab } from './RolesPermissionsTab';

type StaffRole = NonNullable<AdminUser['staffRole']>;
type Tab = 'all' | 'staff' | 'roles' | 'audit';
type DirectoryUser = AdminUser & { isStaff: boolean };

interface StaffModuleProps {
  adminUsers: AdminUser[];
  auditLogs: AuditLogEntry[];
  onAdminUsersChange: React.Dispatch<React.SetStateAction<AdminUser[]>>;
}

const STAFF_ROLES: StaffRole[] = ['SUPER_ADMIN', 'STORE_MANAGER', 'SALES_AGENT', 'SERVICE_TECHNICIAN', 'DELIVERY_DRIVER'];
const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  STORE_MANAGER: 'Store Manager',
  SALES_AGENT: 'Sales & Support',
  SERVICE_TECHNICIAN: 'Service Technician',
  DELIVERY_DRIVER: 'Delivery Driver',
};
const ROLE_STYLE: Record<StaffRole, string> = {
  SUPER_ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
  STORE_MANAGER: 'bg-slate-100 text-slate-800 border-slate-300',
  SALES_AGENT: 'bg-blue-50 text-blue-700 border-blue-200',
  SERVICE_TECHNICIAN: 'bg-amber-50 text-amber-700 border-amber-200',
  DELIVERY_DRIVER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const ROLE_ICON = {
  SUPER_ADMIN: ShieldCheck,
  STORE_MANAGER: BriefcaseBusiness,
  SALES_AGENT: ClipboardList,
  SERVICE_TECHNICIAN: Wrench,
  DELIVERY_DRIVER: Car,
} satisfies Record<StaffRole, React.ComponentType<{ className?: string }>>;

const EMPTY_FORM = {
  fullName: '', email: '', phone: '', password: '', accountType: 'staff' as 'customer' | 'staff',
  staffRole: 'SERVICE_TECHNICIAN' as StaffRole, department: 'Hardware Repair', skills: '',
  specialization: '', vehicleNumber: '', drivingLicenseNo: '', shiftStatus: 'OFF_DUTY' as NonNullable<AdminUser['shiftStatus']>,
};

const roleToAccountRole = (role: StaffRole) => {
  if (role === 'SALES_AGENT') return 'sales';
  if (role === 'SERVICE_TECHNICIAN') return 'service_technician';
  if (role === 'DELIVERY_DRIVER') return 'delivery_driver';
  return 'admin';
};

export const StaffModule: React.FC<StaffModuleProps> = ({ adminUsers, auditLogs, onAdminUsersChange }) => {
  const [activeTab, setActiveTab] = useState<Tab>('staff');
  const [roleFilter, setRoleFilter] = useState<'ALL' | StaffRole>('ALL');
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<DirectoryUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/users?role=customer&limit=100')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (cancelled) return;
        setCustomers((data.users ?? []).map((user: { id: number; name: string; email: string; phone?: string; isActive: boolean }) => ({
          id: String(user.id), name: user.name, email: user.email, phone: user.phone, role: 'Admin',
          status: user.isActive ? 'active' : 'inactive', lastLogin: 'Customer account', isStaff: false,
        })));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const staff = adminUsers.map((user) => ({ ...user, isStaff: true }));
  const visibleUsers = (activeTab === 'all' ? [...staff, ...customers] : staff).filter((user) => {
    const matchesRole = roleFilter === 'ALL' || user.staffRole === roleFilter;
    const needle = query.toLowerCase();
    return matchesRole && (!needle || `${user.name} ${user.email} ${user.phone ?? ''}`.toLowerCase().includes(needle));
  });

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditing(user);
    setFormData({
      ...EMPTY_FORM, fullName: user.name, email: user.email, phone: user.phone ?? '', password: '', accountType: 'staff',
      staffRole: user.staffRole ?? 'STORE_MANAGER', department: user.department ?? '', skills: user.skills?.join(', ') ?? '',
      specialization: user.specialization ?? '', vehicleNumber: user.vehicleNumber ?? '', drivingLicenseNo: user.drivingLicenseNo ?? '',
      shiftStatus: user.shiftStatus ?? 'OFF_DUTY',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isSaving) setIsModalOpen(false);
  };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    const skills = formData.skills.split(',').map((skill) => skill.trim()).filter(Boolean);
    const staffProfile = formData.accountType === 'staff' ? {
      staffRole: formData.staffRole, department: formData.department || undefined, skills,
      specialization: formData.specialization || undefined, vehicleNumber: formData.vehicleNumber || undefined,
      drivingLicenseNo: formData.drivingLicenseNo || undefined, shiftStatus: formData.shiftStatus,
    } : undefined;

    try {
      if (editing) {
        onAdminUsersChange((current) => current.map((user) => user.id === editing.id ? {
          ...user, name: formData.fullName, email: formData.email, phone: formData.phone,
          role: ROLE_LABELS[formData.staffRole] as AdminUser['role'], ...staffProfile,
        } : user));
      } else {
        const response = await fetch('/api/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.fullName, email: formData.email, phone: formData.phone || undefined,
            password: formData.password || undefined,
            role: formData.accountType === 'customer' ? 'customer' : roleToAccountRole(formData.staffRole),
            staffProfile,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Unable to create account');
        const created: DirectoryUser = {
          id: String(result.user.id), name: result.user.name, email: result.user.email, phone: result.user.phone,
          role: formData.accountType === 'staff' ? ROLE_LABELS[formData.staffRole] as AdminUser['role'] : 'Admin',
          status: 'active', lastLogin: 'Not signed in yet', isStaff: formData.accountType === 'staff', ...staffProfile,
        };
        if (created.isStaff) onAdminUsersChange((current) => [...current, created]);
        else setCustomers((current) => [...current, created]);
      }
      setIsModalOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save account');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; count?: number; icon: typeof Users }[] = [
    { id: 'all', label: 'All Users Directory', count: staff.length + customers.length, icon: Users },
    { id: 'staff', label: 'Staff & Operational Team', count: staff.length, icon: BriefcaseBusiness },
    { id: 'roles', label: 'Roles & Permissions', icon: SlidersHorizontal },
    { id: 'audit', label: 'System Audit Trail', count: auditLogs.length, icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Identity & Operations</p>
            <h2 className="mt-2 text-2xl font-black">Users, Staff & Access</h2>
            <p className="mt-1 text-sm text-slate-500">Every staff profile is connected to a secure user account.</p>
          </div>
          <button onClick={openCreate} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700">
            <Plus className="h-4 w-4" /> Add Staff / User
          </button>
        </div>
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {tabs.map(({ id, label, count, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${activeTab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Icon className="h-4 w-4" /> {label}{count !== undefined && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">{count}</span>}
            </button>
          ))}
        </div>
      </div>

      {(activeTab === 'all' || activeTab === 'staff') && <>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex min-w-64 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-slate-500">
            <Search className="h-4 w-4" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or phone" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
          </label>
          <div className="flex gap-1 overflow-x-auto">
            {(['ALL', ...STAFF_ROLES] as const).map((role) => <button key={role} onClick={() => setRoleFilter(role)} className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold ${roleFilter === role ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{role === 'ALL' ? 'All roles' : ROLE_LABELS[role]}</button>)}
          </div>
        </div>
        <div className="space-y-3">
          {visibleUsers.map((user) => <UserCard key={`${user.isStaff}-${user.id}`} user={user} onEdit={user.isStaff ? () => openEdit(user) : undefined} />)}
          {visibleUsers.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">No users match these filters.</div>}
        </div>
      </>}

      {activeTab === 'roles' && <RolesPermissionsTab />}

      {activeTab === 'audit' && <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><h3 className="font-extrabold text-slate-900">Append-Only Activity</h3><p className="text-xs text-slate-500">Administrative changes across the commerce platform.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-4">Timestamp</th><th className="p-4">Staff member</th><th className="p-4">Module</th><th className="p-4">Action</th><th className="p-4">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{auditLogs.map((log) => <tr key={log.id} className="hover:bg-slate-50"><td className="p-4 font-mono text-slate-500">{log.timestamp}</td><td className="p-4 font-bold text-slate-900">{log.adminName}<div className="font-normal text-slate-400">{log.role}</div></td><td className="p-4 font-bold text-blue-700">{log.module}</td><td className="p-4 font-bold uppercase">{log.action}</td><td className="p-4 text-slate-600">{log.details}</td></tr>)}</tbody></table></div>
      </div>}

      {isModalOpen && <StaffModal formData={formData} setFormData={setFormData} editing={editing} error={formError} isSaving={isSaving} onClose={closeModal} onSubmit={saveUser} />}
    </div>
  );
};

function UserCard({ user, onEdit }: { user: DirectoryUser; onEdit?: () => void }) {
  const role = user.staffRole;
  const Icon = role ? ROLE_ICON[role] : Users;
  return <div className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 md:flex-row md:items-center md:justify-between">
    <div className="flex min-w-0 items-start gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${role ? ROLE_STYLE[role] : 'border border-blue-200 bg-blue-50 text-blue-700'}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-extrabold text-slate-900">{user.name}</h4><span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${role ? ROLE_STYLE[role] : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{role ? ROLE_LABELS[role] : 'Customer'}</span></div>
        <p className="mt-1 truncate text-xs text-slate-500">{user.email}{user.phone ? ` · +977 ${user.phone}` : ''}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {user.skills?.map((skill) => <span key={skill} className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{skill}</span>)}
          {user.specialization && <InfoTag text={`Specialization: ${user.specialization}`} />}
          {user.vehicleNumber && <InfoTag text={`Vehicle: ${user.vehicleNumber}`} />}
          {user.shiftStatus && <InfoTag text={`Duty: ${user.shiftStatus.replaceAll('_', ' ')}`} accent />}
          {user.staffRole === 'SALES_AGENT' && <InfoTag text={`${user.assignedCount ?? 0} inquiries assigned`} accent />}
          {user.staffRole === 'SERVICE_TECHNICIAN' && <InfoTag text={`${user.assignedCount ?? 0} pending tickets`} accent />}
        </div>
      </div>
    </div>
    <div className="flex items-center justify-between gap-3 md:justify-end"><span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{user.status === 'active' ? user.isStaff ? 'ACTIVE STAFF' : 'ACTIVE USER' : 'INACTIVE'}</span>{onEdit && <button onClick={onEdit} aria-label={`Edit ${user.name}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"><Pencil className="h-4 w-4" /></button>}</div>
  </div>;
}

function InfoTag({ text, accent = false }: { text: string; accent?: boolean }) {
  return <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${accent ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{text}</span>;
}

function StaffModal({ formData, setFormData, editing, error, isSaving, onClose, onSubmit }: { formData: typeof EMPTY_FORM; setFormData: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>; editing: AdminUser | null; error: string; isSaving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  const field = (name: keyof typeof EMPTY_FORM, value: string) => setFormData((current) => ({ ...current, [name]: value }));
  const isDriver = formData.staffRole === 'DELIVERY_DRIVER';
  const isTechnician = formData.staffRole === 'SERVICE_TECHNICIAN';
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5"><div><h2 className="text-lg font-black text-slate-900">{editing ? 'Edit staff profile' : 'Create user account'}</h2><p className="text-xs text-slate-500">Authentication and operational details in one form.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
    <div className="space-y-5 p-6">
      {!editing && <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">{(['staff', 'customer'] as const).map((type) => <button type="button" key={type} onClick={() => field('accountType', type)} className={`rounded-lg px-4 py-2.5 text-xs font-bold capitalize ${formData.accountType === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{type} account</button>)}</div>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" value={formData.fullName} onChange={(v) => field('fullName', v)} required /><Field label="Email address" type="email" value={formData.email} onChange={(v) => field('email', v)} required disabled={Boolean(editing)} /><Field label="Phone number" value={formData.phone} onChange={(v) => field('phone', v)} placeholder="9851084291" />{!editing && <Field label="Temporary password" type="password" value={formData.password} onChange={(v) => field('password', v)} required={formData.accountType === 'staff'} />}</div>
      {formData.accountType === 'staff' && <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Operational profile</p><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-bold text-slate-700">Staff role<select value={formData.staffRole} onChange={(e) => field('staffRole', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500">{STAFF_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label><Field label="Department" value={formData.department} onChange={(v) => field('department', v)} /></div>
        {isTechnician && <div className="grid gap-4 sm:grid-cols-2"><Field label="Technical skills" value={formData.skills} onChange={(v) => field('skills', v)} placeholder="BGA Rework, Display Repair" /><Field label="Specialization" value={formData.specialization} onChange={(v) => field('specialization', v)} /></div>}
        {isDriver && <div className="grid gap-4 sm:grid-cols-2"><Field label="Vehicle number" value={formData.vehicleNumber} onChange={(v) => field('vehicleNumber', v)} required /><Field label="Driving license no." value={formData.drivingLicenseNo} onChange={(v) => field('drivingLicenseNo', v)} required /><label className="space-y-1.5 text-xs font-bold text-slate-700">Duty status<select value={formData.shiftStatus} onChange={(e) => field('shiftStatus', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"><option value="ON_DUTY">On duty</option><option value="ON_TRANSIT">On transit</option><option value="OFF_DUTY">Off duty</option></select></label></div>}
      </div>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
    </div>
    <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600">Cancel</button><button disabled={isSaving} className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{isSaving ? 'Saving...' : editing ? 'Save changes' : 'Create account'}</button></div>
  </form></div>;
}

function Field({ label, value, onChange, type = 'text', required = false, disabled = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; disabled?: boolean; placeholder?: string }) {
  return <label className="space-y-1.5 text-xs font-bold text-slate-700">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none placeholder:text-slate-300 focus:border-blue-500 disabled:bg-slate-100" /></label>;
}

'use client';

// components/admin/RolesPermissionsTab.tsx
//
// The Roles & Permissions tab: existing roles as cards, plus a create/edit modal
// built around the permission matrix.
//
// Roles are loaded from `/api/v1/roles` rather than passed in as a prop, because
// the tab is the only thing that mutates them and a parent-held copy would go
// stale the moment a role is created.

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  MODULE_KEYS,
  PERMISSION_ACTIONS,
  ROLE_ICONS,
  SYSTEM_MODULES,
  TOTAL_PERMISSIONS,
  countGranted,
  emptyMatrix,
  normalizeMatrix,
  type ModuleKey,
  type PermissionAction,
  type PermissionMatrix,
} from '@/lib/permissions/modules';

import {
  AlertTriangle,
  Check,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface RoleRecord {
  id: number;
  roleName: string;
  roleSlug: string;
  description: string | null;
  icon: string;
  permissions: PermissionMatrix;
  isSystem: boolean;
  isActive: boolean;
  assignedCount: number;
}

type Notice = { text: string; kind: 'success' | 'error' } | null;

/** Reads a response defensively — an empty or non-JSON body must not throw here. */
async function readJson(response: Response): Promise<any> {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const RolesPermissionsTab: React.FC = () => {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const [isModalOpen, setModalOpen] = useState(false);
  /** The role being edited, or null when creating. */
  const [editing, setEditing] = useState<RoleRecord | null>(null);

  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string>(ROLE_ICONS[0]);
  const [permissions, setPermissions] = useState<PermissionMatrix>(emptyMatrix);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/roles');
      const data = await readJson(response);
      if (!response.ok) {
        setNotice({ text: data.error || `Could not load roles (${response.status}).`, kind: 'error' });
        return;
      }
      setRoles(
        (data.roles ?? []).map((r: RoleRecord) => ({
          ...r,
          permissions: normalizeMatrix(r.permissions),
        })),
      );
    } catch {
      setNotice({ text: 'Could not reach the roles service.', kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setRoleName('');
    setDescription('');
    setIcon(ROLE_ICONS[0]);
    setPermissions(emptyMatrix());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (role: RoleRecord) => {
    setEditing(role);
    setRoleName(role.roleName);
    setDescription(role.description ?? '');
    setIcon(role.icon);
    setPermissions(normalizeMatrix(role.permissions));
    setFormError('');
    setModalOpen(true);
  };

  const toggle = (moduleKey: ModuleKey, action: PermissionAction) => {
    setFormError('');
    setPermissions((prev) => {
      const next = { ...prev, [moduleKey]: { ...prev[moduleKey], [action]: !prev[moduleKey][action] } };
      // Mirrors what the server stores: editing cannot exist without viewing, so
      // ticking write/delete ticks read, and clearing read clears the rest.
      if (action === 'read' && !next[moduleKey].read) {
        next[moduleKey] = { read: false, write: false, delete: false };
      } else if ((action === 'write' || action === 'delete') && next[moduleKey][action]) {
        next[moduleKey].read = true;
      }
      return next;
    });
  };

  /** Ticks or clears an entire module row. */
  const toggleRow = (moduleKey: ModuleKey) => {
    setFormError('');
    setPermissions((prev) => {
      const all = PERMISSION_ACTIONS.every((a) => prev[moduleKey][a]);
      return {
        ...prev,
        [moduleKey]: { read: !all, write: !all, delete: !all },
      };
    });
  };

  const grantedCount = useMemo(() => countGranted(permissions), [permissions]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (grantedCount === 0) {
      setFormError('Grant at least one permission before saving.');
      return;
    }

    setSaving(true);
    try {
      const editingId = editing?.id;
      const response = await fetch(
        editingId ? `/api/v1/roles/${editingId}` : '/api/v1/roles',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleName, description, icon, permissions }),
        },
      );
      const data = await readJson(response);

      if (!response.ok) {
        setFormError(data.error || `Could not save the role (${response.status}).`);
        return;
      }

      setModalOpen(false);
      setNotice({
        text: editingId ? `"${roleName}" updated.` : `"${roleName}" created.`,
        kind: 'success',
      });
      await load();
    } catch {
      setFormError('Could not reach the roles service.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: RoleRecord) => {
    if (!confirm(`Delete the "${role.roleName}" role? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/v1/roles/${role.id}`, { method: 'DELETE' });
      const data = await readJson(response);
      if (!response.ok) {
        setNotice({ text: data.error || `Could not delete the role (${response.status}).`, kind: 'error' });
        return;
      }
      setNotice({ text: `"${role.roleName}" deleted.`, kind: 'success' });
      await load();
    } catch {
      setNotice({ text: 'Could not reach the roles service.', kind: 'error' });
    }
  };

  const systemRoles = roles.filter((r) => r.isSystem);
  const customRoles = roles.filter((r) => !r.isSystem);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-800 text-base">System Access Roles &amp; Permissions</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Define operational roles and assign module-level access controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            title="Reload"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Custom Role &amp; Permissions
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${
            notice.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {notice.kind === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          ) : (
            <Check className="w-4 h-4 shrink-0 mt-px" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/*
        The enforcement gap, stated in the UI rather than only in a code comment —
        an operator ticking boxes here would otherwise reasonably assume they take
        effect.
      */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
        <p>
          <b>These matrices are definitions, not yet enforcement.</b> Access is currently
          decided by the fixed staff role on each account. A custom role records the intended
          permissions and can be assigned, but the API guards do not consult it yet.
        </p>
      </div>

      {loading && roles.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <RoleGrid
            title="Built-in roles"
            subtitle="Compiled into the API guards. Shown for reference; not editable."
            roles={systemRoles}
            onEdit={openEdit}
            onDelete={remove}
          />
          <RoleGrid
            title={`Custom roles (${customRoles.length})`}
            subtitle="Defined by you. Editable and deletable while unassigned."
            roles={customRoles}
            onEdit={openEdit}
            onDelete={remove}
            emptyText="No custom roles yet. Use “Add Custom Role & Permissions” to define one."
          />
        </>
      )}

      {/* ===================== CREATE / EDIT MODAL ===================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editing ? `Edit “${editing.roleName}”` : 'Create New Role & Permission Matrix'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {grantedCount} of {TOTAL_PERMISSIONS} permissions granted
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={save} className="p-6 space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Icon</label>
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xl text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLE_ICONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-8 sm:col-span-10">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Role Title</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={80}
                    placeholder="e.g. Logistics Lead"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Role Description</label>
                <input
                  type="text"
                  maxLength={500}
                  placeholder="e.g. Handles dispatches, deliveries and customer drop-offs"
                  value={description}
                  // The spec's draft had `onChange={(e) => setDescription.value}` here,
                  // which evaluates a property and discards it — the field never updated.
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Matrix */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Module Access Permissions Matrix
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-3">Module</th>
                        <th className="p-3 text-center w-24">View</th>
                        <th className="p-3 text-center w-24">Create / Edit</th>
                        <th className="p-3 text-center w-24">Delete</th>
                        <th className="p-3 text-center w-16">All</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {SYSTEM_MODULES.map((mod) => {
                        const row = permissions[mod.key];
                        const allOn = PERMISSION_ACTIONS.every((a) => row[a]);
                        return (
                          <tr key={mod.key} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <p className="font-bold text-slate-800">{mod.label}</p>
                              <p className="text-[11px] text-slate-400">{mod.desc}</p>
                            </td>
                            {PERMISSION_ACTIONS.map((action) => (
                              <td key={action} className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={row[action]}
                                  onChange={() => toggle(mod.key, action)}
                                  aria-label={`${mod.label} ${action}`}
                                  className={`w-4 h-4 rounded cursor-pointer ${
                                    action === 'delete' ? 'accent-rose-600' : 'accent-blue-600'
                                  }`}
                                />
                              </td>
                            ))}
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleRow(mod.key)}
                                className="text-[10px] font-bold text-blue-600 hover:underline"
                              >
                                {allOn ? 'None' : 'All'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Create/Edit and Delete imply View — every screen that changes a module lists it first.
                </p>
              </div>

              {formError && (
                <p className="flex items-start gap-1.5 text-[11px] font-bold text-rose-600">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editing ? 'Save Changes' : 'Save New Role & Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

interface RoleGridProps {
  title: string;
  subtitle: string;
  roles: RoleRecord[];
  onEdit: (role: RoleRecord) => void;
  onDelete: (role: RoleRecord) => void;
  emptyText?: string;
}

const RoleGrid: React.FC<RoleGridProps> = ({ title, subtitle, roles, onEdit, onDelete, emptyText }) => (
  <div className="space-y-3">
    <div>
      <h4 className="text-xs font-bold text-slate-700">{title}</h4>
      <p className="text-[11px] text-slate-400">{subtitle}</p>
    </div>

    {roles.length === 0 ? (
      emptyText ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
          {emptyText}
        </p>
      ) : null
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => {
          const granted = countGranted(role.permissions);
          return (
            <div
              key={role.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-xl leading-none shrink-0">{role.icon}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{role.roleName}</p>
                    <p className="font-mono text-[10px] text-slate-400">{role.roleSlug}</p>
                  </div>
                </div>
                {role.isSystem ? (
                  <span
                    title="Built-in role"
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600"
                  >
                    <Lock className="w-2.5 h-2.5" />
                    BUILT-IN
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    CUSTOM
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 line-clamp-2 min-h-[2rem]">
                {role.description || 'No description.'}
              </p>

              {/* Per-module summary: which modules are granted at all, and how. */}
              <div className="flex flex-wrap gap-1">
                {MODULE_KEYS.filter((key) => role.permissions[key].read).map((key) => {
                  const p = role.permissions[key];
                  const level = p.delete ? 'full' : p.write ? 'edit' : 'view';
                  const label = SYSTEM_MODULES.find((m) => m.key === key)?.label ?? key;
                  return (
                    <span
                      key={key}
                      title={`${label}: ${level}`}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        level === 'full'
                          ? 'bg-rose-50 text-rose-700'
                          : level === 'edit'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {key}
                    </span>
                  );
                })}
                {granted === 0 && (
                  <span className="text-[10px] italic text-slate-400">No access granted</span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                  <Users className="w-3 h-3" />
                  {role.assignedCount} assigned
                  <span className="text-slate-300">·</span>
                  {granted}/{TOTAL_PERMISSIONS}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={role.isSystem}
                    onClick={() => onEdit(role)}
                    title={role.isSystem ? 'Built-in roles cannot be edited' : 'Edit'}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={role.isSystem || role.assignedCount > 0}
                    onClick={() => onDelete(role)}
                    title={
                      role.isSystem
                        ? 'Built-in roles cannot be deleted'
                        : role.assignedCount > 0
                          ? `Assigned to ${role.assignedCount} staff member(s)`
                          : 'Delete'
                    }
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-slate-200"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

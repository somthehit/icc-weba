'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Unlock,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  TrendingDown,
  TrendingUp,
  Store,
  Edit3,
  UserX,
  LayoutGrid,
  List,
  Fingerprint,
  Phone,
  Mail,
  Building,
  Calendar,
  AlertOctagon,
  Smartphone,
  Radio,
  Power,
  LogOut,
  SlidersHorizontal,
  History,
  CheckSquare,
  Square,
  Globe,
  Monitor,
  Activity,
  Zap,
  Sparkles,
  HelpCircle,
  CheckCheck,
  XCircle,
  ArrowUpRight,
} from 'lucide-react';
import { validatePinStrength } from '@/lib/security/pin-policy';

export interface StaffLimitsData {
  maxLineDiscountPct: number;
  maxInvoiceDiscountAmount: number;
  maxRefundAmount: number;
  maxVoidAmount: number;
  canOverridePrice: boolean;
  canNoSaleOpen: boolean;
  maxCashPayout: number;
  canCreditSale: boolean;
  returnWindowDays: number;
}

export interface ElevationItem {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  staffRole: string;
  grantedById: string;
  grantedByName: string;
  grantedByRole: string;
  permissionKey: string;
  overrideValue: string;
  reason: string;
  status: 'active' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
  isCurrentlyActive: boolean;
  minutesRemaining: number;
}

export interface StaffLimitProfile {
  staffId: string;
  staffCode: string;
  name: string;
  role: string;
  status: string;
  hasCustomLimits: boolean;
  limits: StaffLimitsData;
  roleDefaults: StaffLimitsData;
  updatedAt: string | null;
  activeElevations: ElevationItem[];
}

export interface StaffProfile {
  id: string;
  staffCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  roleLabel: string;
  roleColor: string;
  category: 'pos_staff' | 'back_office';
  status: 'active' | 'suspended' | 'terminated';
  active: boolean;
  branchId: string;
  defaultShift: string;
  emergencyContact: string | null;
  notes: string | null;
  joinDate: string | null;
  pinStatus: 'SET' | 'TEMPORARY' | 'LOCKED' | 'NOT_SET';
  hasPin: boolean;
  pinChangedAt: string | null;
  failedPinAttempts: number;
  pinLockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  lastTerminalCode: string | null;
  assignedTerminals: string[];
  metrics: {
    totalShifts: number;
    totalSales: number;
    totalShort: number;
    totalOver: number;
    totalNetVariance: number;
    avgVariancePerShift: number;
    varianceIncidents: number;
    balancedShifts: number;
    accuracyRate: number;
    anomalyFlag: boolean;
  };
}

export interface TerminalItem {
  id: string;
  code: string;
  name: string;
  branchId: string;
  status: 'approved' | 'pending_approval' | 'revoked';
  isLocked: boolean;
  active: boolean;
  lastSeenAt: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  isOnline: boolean;
  assignedStaff: {
    staffId: string;
    staffCode: string;
    staffName: string;
    staffRole: string;
    allowedDays: string[];
    allowedStartTime: string;
    allowedEndTime: string;
  }[];
  activeSession: {
    staffId: string;
    staffName: string;
    staffCode: string;
    lastActiveAt: string;
  } | null;
}

export interface SessionItem {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  staffRole: string;
  terminalId: string | null;
  terminalCode: string | null;
  terminalName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isRevoked: boolean;
  revokedReason: string | null;
  lastActiveAt: string;
  createdAt: string;
}

export interface AuditItem {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetId: string | null;
  targetType: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

interface CashierRosterViewProps {
  useBsDate?: boolean;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const CashierRosterView: React.FC<CashierRosterViewProps> = ({ useBsDate = false, showToast }) => {
  // Navigation Sub-Modules
  const [activeModule, setActiveModule] = useState<'staff' | 'terminals' | 'sessions' | 'audit' | 'limits'>('staff');

  // Staff State
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 3: Limits & Elevations State
  const [limitsViewMode, setLimitsViewMode] = useState<'staff_limits' | 'matrix'>('staff_limits');
  const [staffLimitsList, setStaffLimitsList] = useState<StaffLimitProfile[]>([]);
  const [activeElevations, setActiveElevations] = useState<ElevationItem[]>([]);
  const [elevationHistory, setElevationHistory] = useState<ElevationItem[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<Record<string, StaffLimitsData>>({});
  const [matrixCapabilities, setMatrixCapabilities] = useState<any[]>([]);
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);
  const [limitsSearch, setLimitsSearch] = useState('');
  const [limitsRoleFilter, setLimitsRoleFilter] = useState('all');

  // Modals for Phase 3
  const [editingStaffLimits, setEditingStaffLimits] = useState<StaffLimitProfile | null>(null);
  const [limitsForm, setLimitsForm] = useState<StaffLimitsData>({
    maxLineDiscountPct: 10,
    maxInvoiceDiscountAmount: 1000,
    maxRefundAmount: 5000,
    maxVoidAmount: 5000,
    canOverridePrice: false,
    canNoSaleOpen: false,
    maxCashPayout: 2000,
    canCreditSale: false,
    returnWindowDays: 7,
  });
  const [isSubmittingLimits, setIsSubmittingLimits] = useState(false);

  const [isGrantElevationOpen, setIsGrantElevationOpen] = useState(false);
  const [elevationTargetStaff, setElevationTargetStaff] = useState<StaffLimitProfile | null>(null);
  const [elevationForm, setElevationForm] = useState({
    staffId: '',
    permissionKey: 'maxRefundAmount',
    overrideValue: '25000',
    reason: '',
    durationMinutes: 120,
  });
  const [isSubmittingElevation, setIsSubmittingElevation] = useState(false);

  // Terminals State
  const [terminalsList, setTerminalsList] = useState<TerminalItem[]>([]);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);

  // Sessions State
  const [sessionsList, setSessionsList] = useState<SessionItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Staff Filters & Search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'pos_staff' | 'back_office'>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals & Drawers
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
  const [pinResetTarget, setPinResetTarget] = useState<StaffProfile | null>(null);
  const [tempPinResult, setTempPinResult] = useState<{ pin: string; expiresAt: string; targetName: string } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Phase 2 Modals
  const [isRegisterTerminalOpen, setIsRegisterTerminalOpen] = useState(false);
  const [configuringTerminal, setConfiguringTerminal] = useState<TerminalItem | null>(null);
  const [selectedStaffForBinding, setSelectedStaffForBinding] = useState<string[]>([]);
  const [allowedDays, setAllowedDays] = useState<string[]>(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  const [allowedStartTime, setAllowedStartTime] = useState('09:00');
  const [allowedEndTime, setAllowedEndTime] = useState('20:30');

  // Add Terminal Form State
  const [newTerminalCode, setNewTerminalCode] = useState('');
  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalBranch, setNewTerminalBranch] = useState('Main - Dhangadhi');
  const [isSubmittingTerminal, setIsSubmittingTerminal] = useState(false);

  // Add Staff Form State
  const [addForm, setAddForm] = useState({
    name: '',
    staffCode: '',
    phone: '',
    email: '',
    role: 'cashier',
    branchId: 'Main - Dhangadhi',
    defaultShift: 'morning',
    emergencyContact: '',
    notes: '',
    initialPin: '',
  });
  const [addPinValidation, setAddPinValidation] = useState<{ valid: boolean; reason?: string }>({ valid: true });
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Staff Form State
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'cashier',
    status: 'active',
    branchId: 'Main - Dhangadhi',
    defaultShift: 'morning',
    emergencyContact: '',
    notes: '',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Secure PIN Reset Form State
  const [resetAuthorizerPin, setResetAuthorizerPin] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // 1. Fetch Staff Directory
  const fetchStaff = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounting/cashiers');
      const data = await res.json();
      if (data.success) {
        setStaffList(data.staff || []);
        setSummary(data.summary || null);
      } else {
        setError(data.error || 'Failed to fetch staff roster');
        showToast('error', data.error || 'Failed to load staff roster');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching staff roster');
      showToast('error', err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Terminals
  const fetchTerminals = async () => {
    setIsLoadingTerminals(true);
    try {
      const res = await fetch('/api/accounting/terminals');
      const data = await res.json();
      if (data.success) {
        setTerminalsList(data.terminals || []);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error loading terminals');
    } finally {
      setIsLoadingTerminals(false);
    }
  };

  // 3. Fetch Active Sessions
  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch('/api/accounting/sessions');
      const data = await res.json();
      if (data.success) {
        setSessionsList(data.sessions || []);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error loading sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // 4. Fetch Audit Logs
  const fetchAudit = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch('/api/accounting/audit');
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs || []);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error loading audit logs');
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // 5. Fetch Staff Limits & Permissions
  const fetchLimits = async () => {
    setIsLoadingLimits(true);
    try {
      const res = await fetch('/api/accounting/limits');
      const data = await res.json();
      if (data.success) {
        setStaffLimitsList(data.staffLimits || []);
        setActiveElevations(data.activeElevations || []);
        setElevationHistory(data.elevationHistory || []);
        setRoleDefaults(data.roleDefaults || {});
        setMatrixCapabilities(data.matrixCapabilities || []);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error loading staff limits');
    } finally {
      setIsLoadingLimits(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchTerminals();
    fetchSessions();
    fetchAudit();
    fetchLimits();
  }, []);

  // Phase 3: Open Limits Drawer
  const handleOpenEditLimits = (target: StaffLimitProfile | StaffProfile) => {
    // If passed StaffProfile, find corresponding StaffLimitProfile
    let profile: StaffLimitProfile | undefined;
    if ('staffId' in target) {
      profile = target as StaffLimitProfile;
    } else {
      profile = staffLimitsList.find((sl) => sl.staffId === target.id);
      if (!profile) {
        // Build fallback from role defaults
        const roleDef = roleDefaults[target.role] || roleDefaults.cashier || {
          maxLineDiscountPct: 10,
          maxInvoiceDiscountAmount: 1000,
          maxRefundAmount: 5000,
          maxVoidAmount: 5000,
          canOverridePrice: false,
          canNoSaleOpen: false,
          maxCashPayout: 2000,
          canCreditSale: false,
          returnWindowDays: 7,
        };
        profile = {
          staffId: target.id,
          staffCode: target.staffCode,
          name: target.name,
          role: target.role,
          status: target.status,
          hasCustomLimits: false,
          limits: roleDef,
          roleDefaults: roleDef,
          updatedAt: null,
          activeElevations: [],
        };
      }
    }

    setEditingStaffLimits(profile);
    setLimitsForm({
      maxLineDiscountPct: profile.limits.maxLineDiscountPct,
      maxInvoiceDiscountAmount: profile.limits.maxInvoiceDiscountAmount,
      maxRefundAmount: profile.limits.maxRefundAmount,
      maxVoidAmount: profile.limits.maxVoidAmount,
      canOverridePrice: profile.limits.canOverridePrice,
      canNoSaleOpen: profile.limits.canNoSaleOpen,
      maxCashPayout: profile.limits.maxCashPayout,
      canCreditSale: profile.limits.canCreditSale,
      returnWindowDays: profile.limits.returnWindowDays,
    });
  };

  // Phase 3: Save Limits Form
  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffLimits) return;
    setIsSubmittingLimits(true);
    try {
      const res = await fetch('/api/accounting/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STAFF_LIMITS',
          staffId: editingStaffLimits.staffId,
          limits: limitsForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setEditingStaffLimits(null);
        fetchLimits();
        fetchAudit();
        fetchStaff();
      } else {
        showToast('error', data.error || 'Failed to update limits');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsSubmittingLimits(false);
    }
  };

  // Phase 3: Reset Limits to Role Defaults
  const handleResetLimits = async (staffId: string) => {
    if (!confirm('Revert this staff member to standard role baseline limits?')) return;
    try {
      const res = await fetch('/api/accounting/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESET_ROLE_DEFAULT',
          staffId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        if (editingStaffLimits && editingStaffLimits.staffId === staffId) {
          setEditingStaffLimits(null);
        }
        fetchLimits();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Failed to reset limits');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Phase 3: Open Grant Elevation Modal
  const handleOpenElevation = (target?: StaffLimitProfile | StaffProfile) => {
    if (target) {
      const id = 'staffId' in target ? target.staffId : target.id;
      setElevationForm((prev) => ({
        ...prev,
        staffId: id,
        permissionKey: 'maxRefundAmount',
        overrideValue: '25000',
        reason: '',
        durationMinutes: 120,
      }));
    }
    setIsGrantElevationOpen(true);
  };

  // Phase 3: Grant Elevation Submit
  const handleGrantElevation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elevationForm.staffId || !elevationForm.reason.trim()) {
      showToast('error', 'Please select a staff member and provide a business reason.');
      return;
    }
    setIsSubmittingElevation(true);
    try {
      const res = await fetch('/api/accounting/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GRANT_ELEVATION',
          staffId: elevationForm.staffId,
          permissionKey: elevationForm.permissionKey,
          overrideValue: elevationForm.overrideValue,
          reason: elevationForm.reason,
          durationMinutes: elevationForm.durationMinutes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setIsGrantElevationOpen(false);
        fetchLimits();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Failed to grant elevation');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsSubmittingElevation(false);
    }
  };

  // Phase 3: Revoke Elevation
  const handleRevokeElevation = async (elevationId: string) => {
    const reason = prompt('Enter reason for early revocation:', 'Floor supervisor returned / normal operation resumed');
    if (!reason) return;
    try {
      const res = await fetch('/api/accounting/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REVOKE_ELEVATION',
          elevationId,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        fetchLimits();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Failed to revoke elevation');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Handle Initial PIN validation live
  const handleInitialPinChange = (val: string) => {
    setAddForm((prev) => ({ ...prev, initialPin: val }));
    if (val.trim()) {
      setAddPinValidation(validatePinStrength(val));
    } else {
      setAddPinValidation({ valid: true });
    }
  };

  // Create Staff Submission
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.staffCode || !addForm.phone) {
      showToast('error', 'Name, Staff Code, and Phone are required.');
      return;
    }
    if (addForm.initialPin && !addPinValidation.valid) {
      showToast('error', addPinValidation.reason || 'Weak PIN rejected.');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await fetch('/api/accounting/cashiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_STAFF',
          ...addForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Staff member created successfully');
        setIsAddStaffOpen(false);
        setAddForm({
          name: '',
          staffCode: '',
          phone: '',
          email: '',
          role: 'cashier',
          branchId: 'Main - Dhangadhi',
          defaultShift: 'morning',
          emergencyContact: '',
          notes: '',
          initialPin: '',
        });
        fetchStaff();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Failed to create staff');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Submission error');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Edit Drawer
  const handleOpenEdit = (s: StaffProfile) => {
    setEditingStaff(s);
    setEditForm({
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      role: s.role,
      status: s.status,
      branchId: s.branchId || 'Main - Dhangadhi',
      defaultShift: s.defaultShift || 'morning',
      emergencyContact: s.emergencyContact || '',
      notes: s.notes || '',
    });
  };

  // Update Staff Submission
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setIsSubmittingEdit(true);
    try {
      const res = await fetch('/api/accounting/cashiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STAFF',
          staffId: editingStaff.id,
          ...editForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Staff profile updated.');
        setEditingStaff(null);
        fetchStaff();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Failed to update profile');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Submission error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Secure PIN Reset Submission (Maker-Checker)
  const handleSecurePinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinResetTarget || !resetAuthorizerPin || !resetReason) {
      showToast('error', 'Supervisor PIN and valid justification are required.');
      return;
    }

    setIsSubmittingReset(true);
    try {
      const res = await fetch('/api/accounting/cashiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SECURE_RESET_PIN',
          staffId: pinResetTarget.id,
          authorizerPin: resetAuthorizerPin,
          reason: resetReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', 'Temporary PIN generated successfully.');
        setTempPinResult({
          pin: data.tempPin,
          expiresAt: data.expiresAt,
          targetName: pinResetTarget.name,
        });
        setPinResetTarget(null);
        setResetAuthorizerPin('');
        setResetReason('');
        fetchStaff();
        fetchAudit();
      } else {
        showToast('error', data.error || 'PIN reset authorization failed');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Unlock Locked Account
  const handleUnlockAccount = async (target: StaffProfile) => {
    const authorizerPin = prompt(`Enter Supervisor / Admin PIN to unlock ${target.name}'s account:`);
    if (!authorizerPin) return;

    try {
      const res = await fetch('/api/accounting/cashiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UNLOCK_PIN',
          staffId: target.id,
          authorizerPin,
          reason: 'Manual supervisor unlock',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `${target.name}'s account unlocked.`);
        fetchStaff();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Unlock authorization failed');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Soft Delete / Suspend toggle
  const handleToggleStatus = async (target: StaffProfile, newStatus: 'active' | 'suspended' | 'terminated') => {
    const confirmMsg =
      newStatus === 'terminated'
        ? `Are you sure you want to TERMINATE ${target.name}? Their PIN and session tokens will be permanently revoked.`
        : `Change status of ${target.name} to ${newStatus.toUpperCase()}?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/accounting/cashiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_STATUS',
          staffId: target.id,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || `Status updated to ${newStatus}`);
        fetchStaff();
        fetchSessions();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Failed to update status');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Phase 2: Approve Terminal Device
  const handleApproveTerminal = async (term: TerminalItem) => {
    if (!confirm(`Authorize POS Terminal ${term.code} (${term.name}) for store operations?`)) return;
    try {
      const res = await fetch('/api/accounting/terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE_DEVICE',
          terminalId: term.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        fetchTerminals();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Failed to approve terminal');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Phase 2: Revoke Terminal Device
  const handleRevokeTerminal = async (term: TerminalItem) => {
    const reason = prompt(`Enter reason for revoking terminal ${term.code}:`, 'Suspicious network activity / Hardware reassignment');
    if (!reason) return;
    try {
      const res = await fetch('/api/accounting/terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REVOKE_DEVICE',
          terminalId: term.id,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        fetchTerminals();
        fetchSessions();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Failed to revoke terminal');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Phase 2: Register New Terminal
  const handleRegisterTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerminalCode || !newTerminalName) {
      showToast('error', 'Code and Name are required.');
      return;
    }
    setIsSubmittingTerminal(true);
    try {
      const res = await fetch('/api/accounting/terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REGISTER_DEVICE',
          code: newTerminalCode,
          name: newTerminalName,
          branchId: newTerminalBranch,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setIsRegisterTerminalOpen(false);
        setNewTerminalCode('');
        setNewTerminalName('');
        fetchTerminals();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Registration failed');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsSubmittingTerminal(false);
    }
  };

  // Phase 2: Force Logout a Cashier Session
  const handleForceLogoutSession = async (sess: SessionItem) => {
    if (!confirm(`Force logout ${sess.staffName} from ${sess.terminalCode}? Any active unsaved transactions will be locked.`)) {
      return;
    }
    try {
      const res = await fetch('/api/accounting/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'FORCE_LOGOUT',
          sessionId: sess.id,
          reason: 'Manual supervisor termination from Access Control Hub',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        fetchSessions();
        fetchAudit();
      } else {
        showToast('error', data.error || 'Failed to logout session');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.staffCode.toLowerCase().includes(search.toLowerCase()) ||
        (s.phone && s.phone.includes(search)) ||
        (s.email && s.email.toLowerCase().includes(search.toLowerCase()));

      const matchCategory = categoryFilter === 'all' || s.category === categoryFilter;
      const matchRole = roleFilter === 'all' || s.role === roleFilter;
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;

      return matchSearch && matchCategory && matchRole && matchStatus;
    });
  }, [staffList, search, categoryFilter, roleFilter, statusFilter]);

  // Phase 3: Filtered staff limits list
  const filteredStaffLimits = useMemo(() => {
    return staffLimitsList.filter((st) => {
      const matchSearch =
        !limitsSearch ||
        st.name.toLowerCase().includes(limitsSearch.toLowerCase()) ||
        st.staffCode.toLowerCase().includes(limitsSearch.toLowerCase());
      const matchRole = limitsRoleFilter === 'all' || st.role === limitsRoleFilter;
      return matchSearch && matchRole;
    });
  }, [staffLimitsList, limitsSearch, limitsRoleFilter]);

  // Phase 3: Visual Matrix Capability Evaluation
  const getMatrixCell = (key: string, role: string) => {
    // POS operations
    if (key === 'create_sale') {
      if (['cashier', 'senior_cashier', 'supervisor', 'store_manager', 'sales_manager', 'admin'].includes(role)) {
        return { allowed: true, text: 'Full Access' };
      }
      return { allowed: false, text: 'No Access' };
    }
    if (key === 'line_discount') {
      const lim = roleDefaults[role]?.maxLineDiscountPct ?? 0;
      return lim > 0 ? { allowed: true, text: `Max ${lim}%` } : { allowed: false, text: 'Blocked' };
    }
    if (key === 'invoice_discount') {
      const lim = roleDefaults[role]?.maxInvoiceDiscountAmount ?? 0;
      return lim > 0 ? { allowed: true, text: `NPR ${lim.toLocaleString('en-IN')}` } : { allowed: false, text: 'Blocked' };
    }
    if (key === 'price_override') {
      const can = roleDefaults[role]?.canOverridePrice;
      return can ? { allowed: true, text: 'Allowed' } : { allowed: false, text: 'Blocked' };
    }
    if (key === 'void_line_cart') {
      if (['cashier', 'senior_cashier', 'supervisor', 'store_manager', 'sales_manager', 'admin'].includes(role)) {
        return { allowed: true, text: 'Allowed' };
      }
      return { allowed: false, text: 'Blocked' };
    }
    if (key === 'void_invoice') {
      const lim = roleDefaults[role]?.maxVoidAmount ?? 0;
      return lim > 0 ? { allowed: true, text: `NPR ${lim.toLocaleString('en-IN')}` } : { allowed: false, text: 'Blocked' };
    }
    if (key === 'cash_refund') {
      const lim = roleDefaults[role]?.maxRefundAmount ?? 0;
      return lim > 0 ? { allowed: true, text: `NPR ${lim.toLocaleString('en-IN')}` } : { allowed: false, text: 'Blocked' };
    }
    if (key === 'no_sale_open') {
      const can = roleDefaults[role]?.canNoSaleOpen;
      return can ? { allowed: true, text: 'Audited Kick' } : { allowed: false, text: 'Blocked' };
    }
    if (key === 'cash_payout') {
      const lim = roleDefaults[role]?.maxCashPayout ?? 0;
      return lim > 0 ? { allowed: true, text: `NPR ${lim.toLocaleString('en-IN')}` } : { allowed: false, text: 'Blocked' };
    }
    if (key === 'credit_sale') {
      const can = roleDefaults[role]?.canCreditSale;
      return can ? { allowed: true, text: 'Allowed' } : { allowed: false, text: 'Blocked' };
    }
    if (key === 'return_window') {
      const days = roleDefaults[role]?.returnWindowDays ?? 0;
      return days > 0 ? { allowed: true, text: `${days} Days` } : { allowed: false, text: 'Blocked' };
    }
    if (key === 'shift_reconciliation') {
      if (['cashier', 'senior_cashier', 'supervisor', 'store_manager', 'admin'].includes(role)) {
        return { allowed: true, text: 'Allowed' };
      }
      return { allowed: false, text: 'Blocked' };
    }

    // Inventory operations
    if (key === 'view_stock') {
      if (['auditor'].includes(role)) return { allowed: true, text: 'Read-only' };
      return { allowed: true, text: 'Full Access' };
    }
    if (key === 'stock_adjust') {
      if (['inventory_manager', 'store_manager', 'admin'].includes(role)) return { allowed: true, text: 'Allowed' };
      return { allowed: false, text: 'Blocked' };
    }
    if (key === 'stock_transfer') {
      if (['inventory_manager', 'store_manager', 'sales_manager', 'admin'].includes(role)) return { allowed: true, text: 'Allowed' };
      return { allowed: false, text: 'Blocked' };
    }
    if (key === 'receive_po') {
      if (['inventory_manager', 'store_manager', 'admin'].includes(role)) return { allowed: true, text: 'Allowed' };
      return { allowed: false, text: 'Blocked' };
    }
    if (key === 'barcode_print') {
      if (['inventory_manager', 'supervisor', 'store_manager', 'admin'].includes(role)) return { allowed: true, text: 'Allowed' };
      return { allowed: false, text: 'Blocked' };
    }

    // Accounting operations
    if (key === 'view_financials') {
      if (['accountant', 'store_manager', 'sales_manager', 'admin', 'auditor'].includes(role)) return { allowed: true, text: 'Allowed' };
      if (['supervisor'].includes(role)) return { allowed: true, text: 'Shift Only' };
      return { allowed: false, text: 'Blocked' };
    }
    if (key === 'approve_variance') {
      if (['supervisor', 'store_manager', 'accountant', 'admin'].includes(role)) return { allowed: true, text: 'Allowed' };
      return { allowed: false, text: 'Blocked' };
    }
    if (key === 'gl_posting') {
      if (['accountant', 'admin'].includes(role)) return { allowed: true, text: 'Allowed' };
      return { allowed: false, text: 'Blocked' };
    }
    if (key === 'bank_recon') {
      if (['accountant', 'admin', 'auditor'].includes(role)) return { allowed: true, text: role === 'auditor' ? 'Read-only' : 'Allowed' };
      return { allowed: false, text: 'Blocked' };
    }
    if (key === 'audit_log') {
      if (['admin', 'auditor', 'store_manager'].includes(role)) return { allowed: true, text: 'Full Trail' };
      return { allowed: false, text: 'Blocked' };
    }
    if (key === 'manage_staff') {
      if (['admin', 'store_manager'].includes(role)) return { allowed: true, text: 'Allowed' };
      if (['supervisor'].includes(role)) return { allowed: true, text: 'Unlock Only' };
      return { allowed: false, text: 'Blocked' };
    }

    return { allowed: false, text: 'Blocked' };
  };

  // Copy temporary PIN
  const handleCopyTempPin = () => {
    if (tempPinResult?.pin) {
      navigator.clipboard.writeText(tempPinResult.pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
      showToast('info', 'Temporary PIN copied to clipboard');
    }
  };

  const getRoleBadgeClass = (color: string) => {
    switch (color) {
      case 'rose':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'purple':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'indigo':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'blue':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'emerald':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'teal':
        return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
      case 'amber':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'orange':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* ================= HEADER SECTION ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Staff, Terminal & Security Access Hub
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                  <Fingerprint className="w-3 h-3" /> Argon2id + Server Pepper
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Staff directory, device binding, maker-checker PIN security, concurrent session guards, and audit trail
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchStaff();
              fetchTerminals();
              fetchSessions();
              fetchAudit();
              fetchLimits();
            }}
            disabled={isLoading || isLoadingTerminals || isLoadingSessions || isLoadingLimits}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors"
            title="Refresh All Modules"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isLoadingLimits ? 'animate-spin text-purple-400' : ''}`} />
            <span>Sync Live</span>
          </button>

          {activeModule === 'staff' && (
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.02]"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Staff Member</span>
            </button>
          )}

          {activeModule === 'terminals' && (
            <button
              onClick={() => setIsRegisterTerminalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.02]"
            >
              <Smartphone className="w-4 h-4" />
              <span>+ Register New Terminal</span>
            </button>
          )}

          {activeModule === 'limits' && (
            <button
              onClick={() => handleOpenElevation()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.02]"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-current" />
              <span>+ Grant Temporary Elevation</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= PHASE 2 & 3 NAVIGATION SUB-MODULE TABS ================= */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveModule('staff')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeModule === 'staff'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory ({staffList.length})</span>
        </button>

        <button
          onClick={() => setActiveModule('terminals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeModule === 'terminals'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Device Registry ({terminalsList.length})</span>
          {terminalsList.some((t) => t.status === 'pending_approval') && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveModule('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeModule === 'sessions'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Power className="w-4 h-4" />
          <span>Active Sessions ({sessionsList.filter((s) => !s.isRevoked).length})</span>
        </button>

        <button
          onClick={() => setActiveModule('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeModule === 'audit'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveModule('limits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeModule === 'limits'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Permissions & Limits</span>
          {activeElevations.length > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-0.5 animate-pulse">
              <Zap className="w-3 h-3 fill-current" /> {activeElevations.length}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono">({staffLimitsList.length})</span>
          )}
        </button>
      </div>

      {/* ================= MODULE 1: STAFF DIRECTORY ================= */}
      {activeModule === 'staff' && (
        <div className="space-y-6">
          {/* Summary Stats Ribbon */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-slate-400">Total Staff Roster</span>
                <div className="text-lg font-bold text-white font-mono">{summary.totalStaff}</div>
                <span className="text-[10px] text-slate-500">Active profiles</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-slate-400">Active POS Cashiers</span>
                <div className="text-lg font-bold text-emerald-400 font-mono">{summary.activeCashiers}</div>
                <span className="text-[10px] text-slate-500">Eligible for terminal login</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-slate-400">Total Shifts Logged</span>
                <div className="text-lg font-bold text-blue-400 font-mono">{summary.totalPosShifts}</div>
                <span className="text-[10px] text-slate-500">Across 3 registers</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-slate-400">POS Sales Volume</span>
                <div className="text-lg font-bold text-purple-400 font-mono">
                  NPR {Number(summary.totalPosSales || 0).toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-500">Gross processed</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-slate-400">Net Cash Variance</span>
                <div
                  className={`text-lg font-bold font-mono ${
                    Number(summary.netPosVariance || 0) < 0
                      ? 'text-rose-400'
                      : Number(summary.netPosVariance || 0) > 0
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  NPR {Number(summary.netPosVariance || 0).toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-500">
                  {summary.anomaliesCount > 0 ? (
                    <b className="text-rose-400">{summary.anomaliesCount} flag(s) needing review</b>
                  ) : (
                    'All registers balanced'
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Search & Filter Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, code (CSH01), phone, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-sans"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-stretch md:self-auto">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    categoryFilter === 'all' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Staff ({staffList.length})
                </button>
                <button
                  onClick={() => setCategoryFilter('pos_staff')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    categoryFilter === 'pos_staff' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  POS Counters ({staffList.filter((s) => s.category === 'pos_staff').length})
                </button>
                <button
                  onClick={() => setCategoryFilter('back_office')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    categoryFilter === 'back_office' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Back-Office ({staffList.filter((s) => s.category === 'back_office').length})
                </button>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Roles</option>
                  <option value="cashier">Counter Cashier</option>
                  <option value="senior_cashier">Senior Cashier</option>
                  <option value="supervisor">Floor Supervisor</option>
                  <option value="store_manager">Store Manager</option>
                  <option value="admin">System Administrator</option>
                  <option value="accountant">Accountant</option>
                  <option value="inventory_manager">Inventory Manager</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'grid' ? 'bg-slate-800 text-purple-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Card Grid View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'table' ? 'bg-slate-800 text-purple-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Table View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cards Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((staffMember) => {
                const isPos = staffMember.category === 'pos_staff';
                const m = staffMember.metrics;

                return (
                  <div
                    key={staffMember.id}
                    className={`bg-slate-900 border rounded-2xl p-5 shadow-xl space-y-4 transition-all hover:border-slate-700 flex flex-col justify-between ${
                      staffMember.status === 'suspended'
                        ? 'border-amber-500/40 bg-amber-950/10 opacity-75'
                        : staffMember.status === 'terminated'
                        ? 'border-rose-500/40 bg-rose-950/10 opacity-60'
                        : m.anomalyFlag
                        ? 'border-rose-500/50 bg-slate-900'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-sm shadow-inner">
                            {staffMember.staffCode}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-1.5">
                              <span>{staffMember.name}</span>
                              {staffMember.category === 'back_office' && (
                                <span className="text-[10px] text-slate-500 font-normal">(Back-Office)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getRoleBadgeClass(staffMember.roleColor)}`}>
                                {staffMember.roleLabel}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold ${
                                  staffMember.status === 'active'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : staffMember.status === 'suspended'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {staffMember.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {m.anomalyFlag && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 text-[10px] font-bold border border-rose-500/50 flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            Needs Review
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span className="font-mono text-slate-300">{staffMember.phone || 'N/A'}</span>
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Store className="w-3 h-3" />
                            <span>{staffMember.branchId}</span>
                          </span>
                        </div>
                      </div>

                      {isPos ? (
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5">
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div>
                              <div className="text-[10px] text-slate-400">Total Shifts:</div>
                              <div className="font-bold text-white text-xs">{m.totalShifts} completed</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">Sales Handled:</div>
                              <div className="font-bold text-purple-300 text-xs">
                                NPR {m.totalSales.toLocaleString('en-IN')}
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-900 pt-2 grid grid-cols-3 gap-1.5 text-center font-mono">
                            <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                              <div className="text-[9px] text-slate-400">Total Short</div>
                              <div className="font-bold text-rose-400 text-xs">
                                {m.totalShort > 0 ? `-NPR ${m.totalShort}` : 'NPR 0'}
                              </div>
                            </div>
                            <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                              <div className="text-[9px] text-slate-400">Total Over</div>
                              <div className="font-bold text-amber-400 text-xs">
                                {m.totalOver > 0 ? `+NPR ${m.totalOver}` : 'NPR 0'}
                              </div>
                            </div>
                            <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                              <div className="text-[9px] text-slate-400">Net Variance</div>
                              <div
                                className={`font-bold text-xs ${
                                  m.totalNetVariance < 0
                                    ? 'text-rose-400'
                                    : m.totalNetVariance > 0
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {m.totalNetVariance > 0 ? `+${m.totalNetVariance}` : m.totalNetVariance}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                            <span>
                              Accuracy Rate: <b className="text-emerald-400">{m.accuracyRate}%</b>
                            </span>
                            <span>
                              Avg / Shift:{' '}
                              <b className={m.avgVariancePerShift < 0 ? 'text-rose-400' : 'text-slate-300'}>
                                NPR {m.avgVariancePerShift}
                              </b>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
                          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-purple-400" />
                            <span>Back-Office Governance Account</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Protected from POS counter login. Retains accounting, auditing, and central inventory oversight.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <div className="flex items-center gap-1.5">
                          {staffMember.pinStatus === 'LOCKED' ? (
                            <span className="flex items-center gap-1 text-rose-400 font-bold">
                              <Lock className="w-3.5 h-3.5" /> LOCKED ({staffMember.failedPinAttempts} fails)
                            </span>
                          ) : staffMember.pinStatus === 'TEMPORARY' ? (
                            <span className="flex items-center gap-1 text-amber-400 font-bold">
                              <Key className="w-3.5 h-3.5" /> Must Change PIN
                            </span>
                          ) : staffMember.pinStatus === 'SET' ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <ShieldCheck className="w-3.5 h-3.5" /> PIN Set (Argon2id)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Key className="w-3.5 h-3.5" /> PIN Not Set
                            </span>
                          )}
                        </div>

                        {staffMember.assignedTerminals.length > 0 && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Bound: {staffMember.assignedTerminals.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(staffMember)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Edit Profile"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenEditLimits(staffMember)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-blue-400 transition-colors"
                          title="Operational Limits"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenElevation(staffMember)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors"
                          title="Grant Temporary Elevation"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>

                        {staffMember.pinStatus === 'LOCKED' ? (
                          <button
                            onClick={() => handleUnlockAccount(staffMember)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <Unlock className="w-3 h-3" /> Unlock
                          </button>
                        ) : (
                          <button
                            onClick={() => setPinResetTarget(staffMember)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Key className="w-3 h-3 text-purple-400" /> Reset PIN
                          </button>
                        )}
                      </div>

                      {staffMember.status === 'active' ? (
                        <button
                          onClick={() => handleToggleStatus(staffMember, 'suspended')}
                          className="text-[11px] text-slate-500 hover:text-amber-400 px-2 py-1 rounded transition-colors"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(staffMember, 'active')}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded font-semibold transition-colors"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <tr>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Staff Name & Contact</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Shifts</th>
                      <th className="py-3 px-4">Sales (NPR)</th>
                      <th className="py-3 px-4">Net Variance</th>
                      <th className="py-3 px-4">Accuracy</th>
                      <th className="py-3 px-4">PIN Security</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-sans">
                    {filteredStaff.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-purple-400">{s.staffCode}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-xs">{s.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{s.phone || 'No phone'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadgeClass(s.roleColor)}`}>
                            {s.roleLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] text-slate-400 capitalize">
                            {s.category === 'pos_staff' ? 'POS Counter' : 'Back-Office'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                              s.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : s.status === 'suspended'
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">{s.metrics.totalShifts}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {s.metrics.totalSales.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span
                            className={
                              s.metrics.totalNetVariance < 0
                                ? 'text-rose-400'
                                : s.metrics.totalNetVariance > 0
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {s.metrics.totalNetVariance > 0 ? `+${s.metrics.totalNetVariance}` : s.metrics.totalNetVariance}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">{s.metrics.accuracyRate}%</td>
                        <td className="py-3 px-4">
                          {s.pinStatus === 'LOCKED' ? (
                            <span className="text-rose-400 font-bold flex items-center gap-1 text-[10px]">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          ) : s.pinStatus === 'TEMPORARY' ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1 text-[10px]">
                              <Key className="w-3 h-3" /> Temp PIN
                            </span>
                          ) : s.pinStatus === 'SET' ? (
                            <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                              <ShieldCheck className="w-3 h-3" /> Argon2id
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Not Set</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditLimits(s)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-blue-400"
                              title="Operational Limits"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenElevation(s)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400"
                              title="Grant Temporary Elevation"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setPinResetTarget(s)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold"
                            >
                              PIN
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODULE 2: DEVICE REGISTRY & TERMINAL BINDING ================= */}
      {activeModule === 'terminals' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between text-xs text-purple-200">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>
                <b>Device-Bound Security Gate:</b> Cashiers can only log into registered, approved POS hardware with active IP & MAC binding. Unknown devices are isolated until approved by an Administrator.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {terminalsList.map((term) => (
              <div
                key={term.id}
                className={`bg-slate-900 border rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between ${
                  term.status === 'pending_approval'
                    ? 'border-amber-500/50 bg-amber-950/15'
                    : term.status === 'revoked'
                    ? 'border-rose-500/40 bg-rose-950/10 opacity-75'
                    : 'border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-purple-400">{term.code}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                            term.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : term.status === 'pending_approval'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {term.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white pt-1">{term.name}</h4>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className={`w-2.5 h-2.5 rounded-full ${term.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      <span className={term.isOnline ? 'text-emerald-400 font-mono text-[10px]' : 'text-slate-500 text-[10px]'}>
                        {term.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                  {/* Network Telemetry Card */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] space-y-1.5 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">IP Binding:</span>
                      <span className="text-slate-200">{term.ipAddress || '192.168.1.1XX'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hardware MAC:</span>
                      <span className="text-slate-200">{term.macAddress || 'D4:5D:64:82:11:XX'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Location:</span>
                      <span className="text-purple-300">{term.branchId}</span>
                    </div>
                  </div>

                  {/* Assigned Staff Summary */}
                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">
                      Authorized Staff ({term.assignedStaff.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {term.assignedStaff.map((as) => (
                        <span key={as.staffId} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                          {as.staffCode} ({as.staffName.split(' ')[0]})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Current Active Session if any */}
                  {term.activeSession && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-emerald-400" />
                        <div>
                          <div className="font-bold text-emerald-300 text-[11px]">Active Session: {term.activeSession.staffName}</div>
                          <div className="text-[9px] text-slate-400 font-mono">Code: {term.activeSession.staffCode}</div>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Terminal Actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  {term.status === 'pending_approval' ? (
                    <button
                      onClick={() => handleApproveTerminal(term)}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve Device for POS
                    </button>
                  ) : term.status === 'approved' ? (
                    <div className="flex items-center justify-between w-full">
                      <button
                        onClick={() => {
                          setConfiguringTerminal(term);
                          setSelectedStaffForBinding(term.assignedStaff.map((a) => a.staffId));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" /> Configure Hours
                      </button>
                      <button
                        onClick={() => handleRevokeTerminal(term)}
                        className="px-3 py-1.5 rounded-xl bg-rose-950 text-rose-300 hover:bg-rose-900 text-xs font-semibold border border-rose-500/40"
                      >
                        Revoke Access
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleApproveTerminal(term)}
                      className="w-full py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:text-white"
                    >
                      Re-Authorize Device
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODULE 3: ACTIVE SESSIONS & CONCURRENCY ================= */}
      {activeModule === 'sessions' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between text-xs text-blue-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>
                <b>Single-Session Concurrency Rule:</b> Cashiers are restricted to 1 active register session. Logging into Counter 2 terminates any lingering session on Counter 1 to prevent register tampering and phantom transactions.
              </span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Cashier Name</th>
                    <th className="py-3 px-4">Terminal</th>
                    <th className="py-3 px-4">Client IP & Device</th>
                    <th className="py-3 px-4">Login Started</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4 text-right">Emergency Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-sans">
                  {sessionsList.map((sess) => (
                    <tr key={sess.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        {!sess.isRevoked ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono flex items-center gap-1.5 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold w-fit">
                            REVOKED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-xs">{sess.staffName}</div>
                        <div className="text-[10px] text-purple-400 font-mono">{sess.staffCode} ({sess.staffRole})</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        {sess.terminalCode || 'POS Counter'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <div>{sess.ipAddress || '192.168.1.101'}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{sess.userAgent || 'Desktop App'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-mono text-[11px]">
                        {new Date(sess.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!sess.isRevoked && (
                          <button
                            onClick={() => handleForceLogoutSession(sess)}
                            className="px-3 py-1.5 rounded-xl bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-500/40 text-xs font-bold transition-colors inline-flex items-center gap-1"
                          >
                            <LogOut className="w-3.5 h-3.5" /> Force Logout
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODULE 4: TAMPER-EVIDENT AUDIT TRAIL ================= */}
      {activeModule === 'audit' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>
                <b>Cryptographic Audit Ledger:</b> Every staff creation, PIN reset, account lockout, force logout, and terminal binding is permanently recorded with actor identity, timestamp, and IP telemetry.
              </span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Authorized Actor</th>
                    <th className="py-3 px-4">Action Recorded</th>
                    <th className="py-3 px-4">Target Resource</th>
                    <th className="py-3 px-4">Audit Details & Parameters</th>
                    <th className="py-3 px-4">Client IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-sans">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-xs">{log.actorName || 'System'}</div>
                        <div className="text-[10px] text-slate-500 capitalize">{log.actorRole || 'automated'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            log.action.includes('RESET')
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : log.action.includes('LOGOUT') || log.action.includes('REVOKE')
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : log.action.includes('APPROVE')
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-purple-300">
                        {log.targetType?.toUpperCase()}: {log.targetId?.slice(0, 10)}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px] max-w-xs truncate">
                        {JSON.stringify(log.details)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[10px]">{log.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODULE 5: PERMISSIONS & LIMITS ================= */}
      {activeModule === 'limits' && (
        <div className="space-y-6">
          {/* Summary Metric Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Total Staff Configured</span>
              <div className="text-lg font-bold text-white font-mono">{staffLimitsList.length} Accounts</div>
              <span className="text-[10px] text-slate-500">Retail access profiles active</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Active Elevations</span>
              <div className="text-lg font-bold text-amber-400 font-mono flex items-center gap-1.5">
                <Zap className="w-4 h-4 fill-current" />
                <span>{activeElevations.length} Active</span>
              </div>
              <span className="text-[10px] text-slate-500">Time-bound supervisor overrides</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Standard Roles</span>
              <div className="text-lg font-bold text-purple-400 font-mono">9 Defined</div>
              <span className="text-[10px] text-slate-500">Cashier to Administrator matrix</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Loss Prevention Status</span>
              <div className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Enforced
              </div>
              <span className="text-[10px] text-slate-500">All threshold overrides audited</span>
            </div>
          </div>

          {/* Active Temporary Elevations Banner */}
          {activeElevations.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/20 to-slate-900 border border-amber-500/40 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Active Time-Bound Supervisor Elevations ({activeElevations.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Temporary overrides granted with automatic revocation upon expiration.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {activeElevations.map((elev) => (
                  <div
                    key={elev.id}
                    className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{elev.staffName}</span>
                          <span className="text-[10px] text-purple-400 font-mono">({elev.staffCode})</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Role: <span className="text-slate-300 font-semibold">{elev.staffRole}</span></div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {elev.minutesRemaining}m left
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Elevated Permission</div>
                      <div className="font-mono font-bold text-emerald-400 text-xs">
                        {elev.permissionKey === 'maxRefundAmount' ? `Max Refund: NPR ${Number(elev.overrideValue).toLocaleString('en-IN')}` :
                         elev.permissionKey === 'maxInvoiceDiscountAmount' ? `Max Inv Discount: NPR ${Number(elev.overrideValue).toLocaleString('en-IN')}` :
                         elev.permissionKey === 'maxLineDiscountPct' ? `Max Line Discount: ${elev.overrideValue}%` :
                         elev.permissionKey === 'maxVoidAmount' ? `Max Void: NPR ${Number(elev.overrideValue).toLocaleString('en-IN')}` :
                         elev.permissionKey === 'canOverridePrice' ? 'Manual Price Override: ENABLED' :
                         elev.permissionKey === 'canNoSaleOpen' ? 'No-Sale Drawer Kick: ENABLED' :
                         elev.permissionKey === 'maxCashPayout' ? `Cash Payout Limit: NPR ${Number(elev.overrideValue).toLocaleString('en-IN')}` :
                         elev.permissionKey === 'canCreditSale' ? 'Credit Sale (Khata): ENABLED' :
                         `${elev.permissionKey} -> ${elev.overrideValue}`}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-0.5">
                      <div className="truncate">
                        <span className="text-slate-500">Reason:</span> &ldquo;{elev.reason}&rdquo;
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <span>By: <b className="text-slate-400">{elev.grantedByName}</b></span>
                        <button
                          onClick={() => handleRevokeElevation(elev.id)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-500/40 transition-colors"
                        >
                          Revoke Early
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View Mode Controls & Filter Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => setLimitsViewMode('staff_limits')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  limitsViewMode === 'staff_limits'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Staff Operational Limits ({staffLimitsList.length})</span>
              </button>

              <button
                onClick={() => setLimitsViewMode('matrix')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  limitsViewMode === 'matrix'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Role Permissions Matrix (9 Roles)</span>
              </button>
            </div>

            {limitsViewMode === 'staff_limits' && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search staff or code..."
                    value={limitsSearch}
                    onChange={(e) => setLimitsSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <select
                  value={limitsRoleFilter}
                  onChange={(e) => setLimitsRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Roles</option>
                  <option value="cashier">Cashier</option>
                  <option value="senior_cashier">Senior Cashier</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="store_manager">Store Manager</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="sales_manager">Sales Manager</option>
                  <option value="accountant">Accountant</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            )}
          </div>

          {/* VIEW 1: STAFF OPERATIONAL LIMITS */}
          {limitsViewMode === 'staff_limits' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Max Line %</th>
                      <th className="py-3 px-3">Max Inv Disc</th>
                      <th className="py-3 px-3">Max Refund</th>
                      <th className="py-3 px-3">Max Void</th>
                      <th className="py-3 px-3">Cash Payout</th>
                      <th className="py-3 px-3">Return Days</th>
                      <th className="py-3 px-3">Key Overrides</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {filteredStaffLimits.map((st) => {
                      const hasElevation = st.activeElevations && st.activeElevations.length > 0;
                      return (
                        <tr key={st.staffId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-sans">
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{st.name}</span>
                              {hasElevation && (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5 fill-current" /> Elevated
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">Code: {st.staffCode}</div>
                          </td>

                          <td className="py-3 px-3 font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                              {st.role.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-bold text-purple-300">{st.limits.maxLineDiscountPct}%</span>
                          </td>

                          <td className="py-3 px-3 text-slate-300">
                            NPR {st.limits.maxInvoiceDiscountAmount.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-bold text-emerald-400">
                              NPR {st.limits.maxRefundAmount.toLocaleString('en-IN')}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-amber-300">
                            NPR {st.limits.maxVoidAmount.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-3 text-slate-400">
                            NPR {st.limits.maxCashPayout.toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-3 text-slate-300">
                            {st.limits.returnWindowDays}d
                          </td>

                          <td className="py-3 px-3 font-sans">
                            <div className="flex items-center gap-1">
                              <span
                                title={st.limits.canOverridePrice ? 'Price Override: Yes' : 'Price Override: No'}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  st.limits.canOverridePrice
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-950 text-slate-600 border border-slate-800'
                                }`}
                              >
                                P-Ovr
                              </span>

                              <span
                                title={st.limits.canNoSaleOpen ? 'No-Sale Open: Yes' : 'No-Sale Open: No'}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  st.limits.canNoSaleOpen
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-slate-950 text-slate-600 border border-slate-800'
                                }`}
                              >
                                NoSale
                              </span>

                              <span
                                title={st.limits.canCreditSale ? 'Credit Sale: Yes' : 'Credit Sale: No'}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  st.limits.canCreditSale
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-slate-950 text-slate-600 border border-slate-800'
                                }`}
                              >
                                Khata
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3 font-sans">
                            {st.hasCustomLimits ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                Customized
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Role Default</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditLimits(st)}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                                title="Tune Limits"
                              >
                                <SlidersHorizontal className="w-3 h-3 text-purple-400" />
                                <span>Tune</span>
                              </button>

                              <button
                                onClick={() => handleOpenElevation(st)}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                                title="Grant Temporary Elevation"
                              >
                                <Zap className="w-3 h-3 text-amber-400" />
                                <span>Elevate</span>
                              </button>

                              {st.hasCustomLimits && (
                                <button
                                  onClick={() => handleResetLimits(st.staffId)}
                                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                                  title="Reset to Role Baseline"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: VISUAL ROLE PERMISSIONS MATRIX */}
          {limitsViewMode === 'matrix' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>Role-Based Access Control (RBAC) & Operational Threshold Matrix</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comprehensive cross-functional breakdown across POS registers, inventory, and central accounting ledgers.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Allowed / Limit
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Blocked
                  </span>
                </div>
              </div>

              {matrixCapabilities.map((cat, idx) => (
                <div key={idx} className="space-y-2 pt-2">
                  <div className="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800/80">
                    <div>
                      <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">{cat.domain}</h4>
                      <p className="text-[10px] text-slate-500">{cat.description}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3 min-w-[220px]">Capability / Security Action</th>
                          {['cashier', 'senior_cashier', 'supervisor', 'store_manager', 'admin', 'inventory_manager', 'sales_manager', 'accountant', 'auditor'].map((role) => (
                            <th key={role} className="py-2.5 px-2 text-center min-w-[90px] border-l border-slate-800/80 capitalize">
                              {role.replace('_', ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {cat.items.map((item: any) => (
                          <tr key={item.key} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2 px-3 font-sans">
                              <div className="font-semibold text-slate-200 text-xs">{item.label}</div>
                              <div className="text-[10px] text-slate-500">{item.desc}</div>
                            </td>
                            {['cashier', 'senior_cashier', 'supervisor', 'store_manager', 'admin', 'inventory_manager', 'sales_manager', 'accountant', 'auditor'].map((role) => {
                              const cell = getMatrixCell(item.key, role);
                              return (
                                <td key={role} className="py-2 px-2 text-center border-l border-slate-800/80">
                                  {cell.allowed ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-block whitespace-nowrap">
                                      {cell.text}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-slate-600 inline-block whitespace-nowrap">
                                      {cell.text}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL 1: ADD STAFF MEMBER DRAWER ================= */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Add New Staff Member</h3>
              </div>
              <button onClick={() => setIsAddStaffOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Bhatta"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Staff Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSH06, SUP03"
                    value={addForm.staffCode}
                    onChange={(e) => setAddForm({ ...addForm, staffCode: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Phone (Nepal 10-digit) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="98XXXXXXXX"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="staff@icecomputers.com.np"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Role (RBAC)</label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="cashier">Counter Cashier (POS)</option>
                    <option value="senior_cashier">Senior Cashier (POS)</option>
                    <option value="supervisor">Floor Supervisor (POS Overrides)</option>
                    <option value="store_manager">Store Manager</option>
                    <option value="accountant">Accountant (Back-Office)</option>
                    <option value="inventory_manager">Inventory Manager</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Default Shift</label>
                  <select
                    value={addForm.defaultShift}
                    onChange={(e) => setAddForm({ ...addForm, defaultShift: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="morning">Morning (09:00 - 15:00)</option>
                    <option value="day">Full Day (10:00 - 18:00)</option>
                    <option value="evening">Evening (14:00 - 20:00)</option>
                  </select>
                </div>
              </div>

              {/* Initial POS PIN */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-300">
                    Initial POS PIN (Optional, 4-6 Digits)
                  </label>
                  <span className="text-[10px] text-purple-400 font-mono">Argon2id Salted</span>
                </div>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Leave empty or enter strong PIN (e.g. 8492)"
                  value={addForm.initialPin}
                  onChange={(e) => handleInitialPinChange(e.target.value)}
                  className={`w-full bg-slate-900 border rounded-xl p-2.5 text-white font-mono text-center tracking-widest focus:outline-none ${
                    addForm.initialPin && !addPinValidation.valid
                      ? 'border-rose-500'
                      : 'border-slate-800 focus:border-purple-500'
                  }`}
                />

                {addForm.initialPin && (
                  <div className="pt-1">
                    {addPinValidation.valid ? (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PIN passes retail security policy
                      </div>
                    ) : (
                      <div className="text-[11px] text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{addPinValidation.reason}</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-500">
                  Weak PINs (1234, 0000, 1111, calendar years, keypad lines) are blocked by system policy.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    placeholder="98XXXXXXXX (Father/Spouse)"
                    value={addForm.emergencyContact}
                    onChange={(e) => setAddForm({ ...addForm, emergencyContact: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Store Branch</label>
                  <input
                    type="text"
                    disabled
                    value={addForm.branchId}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  placeholder="Notes on employment terms, training status, or counter assignment..."
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd || (Boolean(addForm.initialPin) && !addPinValidation.valid)}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white shadow-md disabled:opacity-50"
                >
                  {isSubmittingAdd ? 'Creating...' : 'Save & Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: EDIT STAFF DRAWER ================= */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Edit Profile: {editingStaff.name}</h3>
                <span className="text-xs text-purple-400 font-mono">Code: {editingStaff.staffCode}</span>
              </div>
              <button onClick={() => setEditingStaff(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Role (RBAC)</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="cashier">Counter Cashier</option>
                    <option value="senior_cashier">Senior Cashier</option>
                    <option value="supervisor">Floor Supervisor</option>
                    <option value="store_manager">Store Manager</option>
                    <option value="accountant">Accountant</option>
                    <option value="inventory_manager">Inventory Manager</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Employment Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="suspended">Suspended (Revoke Sessions)</option>
                    <option value="terminated">Terminated (Permanent Offboard)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={editForm.emergencyContact}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setEditingStaff(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white shadow-md disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Update Staff Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: SECURE MAKER-CHECKER PIN RESET ================= */}
      {pinResetTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Maker-Checker PIN Reset</h3>
              </div>
              <button onClick={() => setPinResetTarget(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSecurePinReset} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 space-y-1">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Resetting PIN for: {pinResetTarget.name} ({pinResetTarget.staffCode})
                </div>
                <p className="text-[11px] text-amber-200/80">
                  Self-service PIN reset is disabled for retail security. A supervisor or administrator must authorize this action with their PIN.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Supervisor / Admin PIN Authorization <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter Authorizer PIN (e.g. 7391 or 8492)"
                  value={resetAuthorizerPin}
                  onChange={(e) => setResetAuthorizerPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-center tracking-widest focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Written Justification (Audit Trail) <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Reason: e.g. Cashier forgot PIN during shift handover / Routine rotation"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setPinResetTarget(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReset}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-white shadow-md disabled:opacity-50"
                >
                  {isSubmittingReset ? 'Authorizing...' : 'Authorize & Issue Temp PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: TEMPORARY PIN REVEAL BOX ================= */}
      {tempPinResult && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/50 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <Key className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Temporary One-Time PIN</h3>
              <p className="text-xs text-slate-400">
                Issued for <b className="text-white">{tempPinResult.targetName}</b>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                One-Time Counter PIN
              </span>
              <div className="text-3xl font-black font-mono tracking-widest text-emerald-400 select-all">
                {tempPinResult.pin}
              </div>
              <p className="text-[10px] text-amber-400 font-medium">
                Must be changed upon first login. Expires in 24 hours.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyTempPin}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md"
              >
                {copiedPin ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPin ? 'Copied!' : 'Copy Temporary PIN'}</span>
              </button>
              <button
                onClick={() => setTempPinResult(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 5: REGISTER NEW TERMINAL ================= */}
      {isRegisterTerminalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Register New POS Terminal</h3>
              </div>
              <button onClick={() => setIsRegisterTerminalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterTerminal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Terminal Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. REG-05, TAB-COUNTER"
                  value={newTerminalCode}
                  onChange={(e) => setNewTerminalCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Terminal Name & Hardware Description <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Counter 04 - Express Billing Till"
                  value={newTerminalName}
                  onChange={(e) => setNewTerminalName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Store Branch</label>
                <input
                  type="text"
                  value={newTerminalBranch}
                  onChange={(e) => setNewTerminalBranch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 space-y-1">
                <p className="text-[11px]">
                  New hardware is initially registered in <b>Pending Approval</b> state with login locked. An administrator must approve the hardware MAC before sales transactions are permitted.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsRegisterTerminalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTerminal}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white shadow-md disabled:opacity-50"
                >
                  {isSubmittingTerminal ? 'Registering...' : 'Register Terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 6: CONFIGURE TERMINAL SCHEDULE & BINDING ================= */}
      {configuringTerminal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Configure Terminal: {configuringTerminal.code}</h3>
                <span className="text-slate-400 text-xs">{configuringTerminal.name}</span>
              </div>
              <button onClick={() => setConfiguringTerminal(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block font-semibold text-slate-300">Allowed Operating Days</label>
                <div className="grid grid-cols-4 gap-2">
                  {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => {
                    const isSelected = allowedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setAllowedDays(allowedDays.filter((d) => d !== day));
                          } else {
                            setAllowedDays([...allowedDays, day]);
                          }
                        }}
                        className={`py-1.5 rounded-lg font-mono uppercase font-bold text-[10px] transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-white'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={allowedStartTime}
                    onChange={(e) => setAllowedStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={allowedEndTime}
                    onChange={(e) => setAllowedEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-500">
                Logins initiated outside allowed hours will be automatically blocked at the terminal login gate unless authorized by supervisor override PIN.
              </p>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setConfiguringTerminal(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showToast('success', `Operating schedule for ${configuringTerminal.code} updated (${allowedStartTime} - ${allowedEndTime}).`);
                    setConfiguringTerminal(null);
                    fetchAudit();
                  }}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white shadow-md"
                >
                  Save Schedule Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 7: CUSTOMIZE STAFF LIMITS DRAWER ================= */}
      {editingStaffLimits && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-purple-400" />
                  <span>Customize Operational Limits: {editingStaffLimits.name}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Code: {editingStaffLimits.staffCode} | Role: {editingStaffLimits.role.toUpperCase()}
                </span>
              </div>
              <button onClick={() => setEditingStaffLimits(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLimits} className="space-y-4">
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-purple-200">
                <p className="text-[11px]">
                  Setting custom limits overrides the standard role defaults for this specific cashier. Leave empty or click reset to restore baseline role governance.
                </p>
              </div>

              {/* Slider 1: Max Line Discount % */}
              <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300">Max Line Item Discount (%)</label>
                  <span className="font-mono font-bold text-purple-300 text-sm">
                    {limitsForm.maxLineDiscountPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={limitsForm.maxLineDiscountPct}
                  onChange={(e) => setLimitsForm({ ...limitsForm, maxLineDiscountPct: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0% (No discount)</span>
                  <span>Role Default: {editingStaffLimits.roleDefaults.maxLineDiscountPct}%</span>
                  <span>50%</span>
                </div>
              </div>

              {/* Input 2: Max Invoice Discount (NPR) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <label className="block font-semibold text-slate-300">Max Invoice Discount (NPR)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={limitsForm.maxInvoiceDiscountAmount}
                    onChange={(e) => setLimitsForm({ ...limitsForm, maxInvoiceDiscountAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: NPR {editingStaffLimits.roleDefaults.maxInvoiceDiscountAmount}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <label className="block font-semibold text-slate-300">Max Solo Refund (NPR)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={limitsForm.maxRefundAmount}
                    onChange={(e) => setLimitsForm({ ...limitsForm, maxRefundAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: NPR {editingStaffLimits.roleDefaults.maxRefundAmount}</span>
                </div>
              </div>

              {/* Input 3: Max Void & Payout */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <label className="block font-semibold text-slate-300">Max Solo Void Limit (NPR)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={limitsForm.maxVoidAmount}
                    onChange={(e) => setLimitsForm({ ...limitsForm, maxVoidAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: NPR {editingStaffLimits.roleDefaults.maxVoidAmount}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <label className="block font-semibold text-slate-300">Max Till Cash Payout (NPR)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={limitsForm.maxCashPayout}
                    onChange={(e) => setLimitsForm({ ...limitsForm, maxCashPayout: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: NPR {editingStaffLimits.roleDefaults.maxCashPayout}</span>
                </div>
              </div>

              {/* Return Window */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300">Return Window Acceptance (Days)</label>
                  <span className="font-mono font-bold text-slate-200">{limitsForm.returnWindowDays} Days</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={limitsForm.returnWindowDays}
                  onChange={(e) => setLimitsForm({ ...limitsForm, returnWindowDays: parseInt(e.target.value) || 0 })}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0d (Returns blocked)</span>
                  <span>Default: {editingStaffLimits.roleDefaults.returnWindowDays}d</span>
                  <span>90d</span>
                </div>
              </div>

              {/* Boolean Toggles */}
              <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="font-semibold text-slate-300 pb-1 border-b border-slate-800">Operational Privileges</div>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <span className="text-slate-200 font-semibold">Allow Price Override</span>
                    <p className="text-[10px] text-slate-500">Change catalog prices at checkout</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={limitsForm.canOverridePrice}
                    onChange={(e) => setLimitsForm({ ...limitsForm, canOverridePrice: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <span className="text-slate-200 font-semibold">Allow No-Sale Cash Drawer Kick</span>
                    <p className="text-[10px] text-slate-500">Open drawer without transaction (Audit logged)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={limitsForm.canNoSaleOpen}
                    onChange={(e) => setLimitsForm({ ...limitsForm, canNoSaleOpen: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <span className="text-slate-200 font-semibold">Allow Credit Sale (Khata Ledger)</span>
                    <p className="text-[10px] text-slate-500">Bill against customer receivables</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={limitsForm.canCreditSale}
                    onChange={(e) => setLimitsForm({ ...limitsForm, canCreditSale: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleResetLimits(editingStaffLimits.staffId)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-xs font-semibold"
                >
                  Reset to Role Defaults
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStaffLimits(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingLimits}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white shadow-md disabled:opacity-50"
                  >
                    {isSubmittingLimits ? 'Saving...' : 'Save Limits'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 8: GRANT TEMPORARY ELEVATION MODAL ================= */}
      {isGrantElevationOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Grant Temporary Elevation</h3>
                  <span className="text-slate-400 text-xs">Time-bound manager permission override</span>
                </div>
              </div>
              <button onClick={() => setIsGrantElevationOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGrantElevation} className="space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Select Staff Member <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={elevationForm.staffId}
                  onChange={(e) => setElevationForm({ ...elevationForm, staffId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500 font-sans"
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staffLimitsList.map((st) => (
                    <option key={st.staffId} value={st.staffId}>
                      {st.staffCode} - {st.name} ({st.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Permission to Elevate <span className="text-rose-400">*</span>
                </label>
                <select
                  value={elevationForm.permissionKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    let defVal = '25000';
                    if (key === 'maxLineDiscountPct') defVal = '20';
                    if (key === 'maxInvoiceDiscountAmount') defVal = '10000';
                    if (key === 'canOverridePrice' || key === 'canNoSaleOpen' || key === 'canCreditSale') defVal = 'true';
                    setElevationForm({ ...elevationForm, permissionKey: key, overrideValue: defVal });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500 font-sans"
                >
                  <option value="maxRefundAmount">Increase Max Refund Amount (Solo)</option>
                  <option value="maxInvoiceDiscountAmount">Increase Max Invoice Discount Amount</option>
                  <option value="maxLineDiscountPct">Increase Max Line Discount %</option>
                  <option value="maxVoidAmount">Increase Max Void Limit</option>
                  <option value="canOverridePrice">Grant Manual Price Override Access</option>
                  <option value="canNoSaleOpen">Grant No-Sale Drawer Kick Access</option>
                  <option value="maxCashPayout">Increase Till Cash Payout Limit</option>
                  <option value="canCreditSale">Grant Credit Sale (Khata Ledger) Access</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Elevated Target Value <span className="text-rose-400">*</span>
                </label>
                {['canOverridePrice', 'canNoSaleOpen', 'canCreditSale'].includes(elevationForm.permissionKey) ? (
                  <input
                    type="text"
                    disabled
                    value="ENABLED (true)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-emerald-400 font-mono font-bold"
                  />
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="e.g. 25000 or 15%"
                    value={elevationForm.overrideValue}
                    onChange={(e) => setElevationForm({ ...elevationForm, overrideValue: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Duration of Elevation</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '30m', mins: 30 },
                    { label: '1 Hour', mins: 60 },
                    { label: '2 Hours', mins: 120 },
                    { label: '4 Hours', mins: 240 },
                  ].map((d) => (
                    <button
                      key={d.mins}
                      type="button"
                      onClick={() => setElevationForm({ ...elevationForm, durationMinutes: d.mins })}
                      className={`py-1.5 rounded-lg font-mono text-[11px] font-bold transition-all ${
                        elevationForm.durationMinutes === d.mins
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Business Justification / Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Diwali festival rush evening cover while supervisor handles cash drop"
                  value={elevationForm.reason}
                  onChange={(e) => setElevationForm({ ...elevationForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <p className="text-[10px]">
                  All temporary elevations automatically expire and revoke after the designated duration. The granting supervisor identity and reason are permanently logged in the immutable audit ledger.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGrantElevationOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingElevation}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white shadow-md disabled:opacity-50"
                >
                  {isSubmittingElevation ? 'Granting...' : 'Grant Elevation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

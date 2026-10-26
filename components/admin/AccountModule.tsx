'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import { ImageUploadField, UploadButton } from './ImageUploadField';
import type { AuditLogEntry } from '@/types';
import {
  User,
  Mail,
  Phone,
  Lock,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  Key,
  Camera,
  ShieldCheck,
  BadgeCheck,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Layers,
  Activity,
  Check,
  Copy,
  Terminal,
  Calendar,
  AlertTriangle,
  Boxes,
  ShoppingCart,
  Receipt,
  FileSpreadsheet,
  Globe,
  Trash2,
  HelpCircle,
  Info,
} from 'lucide-react';

export interface UserProfile {
  id: number | string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  createdAt?: string;
  isActive?: boolean;
}

export interface AccountModuleProps {
  auditLogs?: AuditLogEntry[];
}

type TabKey = 'profile' | 'security' | 'permissions' | 'activity';

export const AccountModule: React.FC<AccountModuleProps> = ({ auditLogs = [] }) => {
  const { checkAuth } = useStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // Profile Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('Primary system administrator overseeing daily store sales, POS counters, catalog pricing, and financial books.');

  // Original snapshot to detect dirty state
  const [initialState, setInitialState] = useState({ name: '', phone: '', avatarUrl: '' });
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetch('/api/auth/me');

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setProfile(data.user);
          const initialN = data.user.name || '';
          const initialP = data.user.phone || '';
          const initialA = data.user.avatarUrl || '';
          setName(initialN);
          setPhone(initialP);
          setAvatarUrl(initialA);
          setInitialState({ name: initialN, phone: initialP, avatarUrl: initialA });
        }
      } else {
        setError('Could not retrieve account profile. Please re-authenticate.');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormDirty = useMemo(() => {
    return (
      name !== initialState.name ||
      phone !== initialState.phone ||
      avatarUrl !== initialState.avatarUrl
    );
  }, [name, phone, avatarUrl, initialState]);

  const handleResetForm = () => {
    setName(initialState.name);
    setPhone(initialState.phone);
    setAvatarUrl(initialState.avatarUrl);
    setError('');
  };

  const handleCopyEmail = () => {
    if (!profile?.email) return;
    navigator.clipboard.writeText(profile.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/users/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Account profile updated successfully');
        setInitialState({ name: name.trim(), phone: phone.trim(), avatarUrl: avatarUrl.trim() });
        // Sync global store context so header immediately reflects new name/avatar
        await checkAuth();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch {
      setError('Network error while updating profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordSuccess('Password successfully updated. Your active session remains verified.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 4000);
      } else {
        setPasswordError(data.error || 'Failed to change password. Verify your current password.');
      }
    } catch {
      setPasswordError('Network error while changing password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Password Strength Calculator
  const passwordStrength = useMemo(() => {
    if (!newPassword) {
      return { score: 0, label: 'None', color: 'bg-gray-200', text: 'text-gray-400' };
    }
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-600' };
      case 2:
        return { score: 2, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-600' };
      case 3:
        return { score: 3, label: 'Good', color: 'bg-blue-500', text: 'text-[#0056b3]' };
      case 4:
        return { score: 4, label: 'Strong & Resilient', color: 'bg-emerald-500', text: 'text-emerald-600' };
      default:
        return { score: 0, label: 'None', color: 'bg-gray-200', text: 'text-gray-400' };
    }
  }, [newPassword]);

  // Filtered audit activity for this admin
  const userAuditLogs = useMemo(() => {
    return auditLogs.filter(
      (log) =>
        log.adminName.toLowerCase().includes('admin') ||
        log.role.toLowerCase().includes('admin') ||
        log.adminName.toLowerCase().includes(name.toLowerCase() || 'admin'),
    );
  }, [auditLogs, name]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-[#E6E8EE] p-16 flex flex-col items-center justify-center space-y-3 shadow-2xs">
        <Loader2 className="w-8 h-8 text-[#0056b3] animate-spin" />
        <p className="text-xs font-semibold text-[#6B7280]">Loading administrator profile...</p>
      </div>
    );
  }

  const memberSinceFormatted = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Oct 2026';

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. HERO PROFILE BANNER
          ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#003470] via-[#0056b3] to-[#0a4d94] p-6 sm:p-8 text-white shadow-md">
        {/* Subtle decorative background watermark */}
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-10 w-64 h-64 rounded-full bg-blue-400/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Interactive Avatar with Pulse Indicator */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden ring-4 ring-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg transition-transform group-hover:scale-102">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={profile?.name || 'Administrator'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center font-extrabold text-2xl sm:text-3xl text-white">
                    {profile?.name?.charAt(0) || 'A'}
                  </div>
                )}
              </div>

              {/* Quick Camera Overlay */}
              <UploadButton
                purpose="avatar"
                onUploaded={([url]) => setAvatarUrl(url)}
                title="Change Profile Photo"
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-white text-[#0056b3] hover:bg-blue-50 shadow-md flex items-center justify-center transition-all cursor-pointer border border-blue-100"
              >
                <Camera className="w-4 h-4" />
              </UploadButton>

              {/* Online indicator badge */}
              <span
                title="Account session is active"
                className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full"
              />
            </div>

            {/* Profile Details */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  {name || profile?.name || 'Administrator'}
                  <span title="System Verified Owner">
                    <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  </span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-white/15 text-white border border-white/20 backdrop-blur-sm">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  {profile?.role?.replace('_', ' ') || 'Super Administrator'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-blue-100 font-medium">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                  title="Click to copy email address"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{profile?.email || 'admin@icecomputers.com.np'}</span>
                  {copiedEmail ? (
                    <span className="text-emerald-300 font-bold text-[10px]">Copied!</span>
                  ) : (
                    <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
                  )}
                </button>

                {phone && (
                  <span className="inline-flex items-center gap-1.5 text-blue-100">
                    <Phone className="w-3.5 h-3.5" />
                    <span>+977 {phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Storefront</span>
            </a>

            <button
              type="button"
              onClick={fetchProfile}
              title="Refresh Account Data"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Status Bar */}
        <div className="mt-6 pt-5 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/10">
            <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider">Account ID</div>
            <div className="text-sm font-bold text-white font-mono mt-0.5">#{profile?.id ?? 1}</div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/10">
            <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider">Access Scope</div>
            <div className="text-sm font-bold text-emerald-300 mt-0.5 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Unrestricted</span>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/10">
            <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider">Session Security</div>
            <div className="text-sm font-bold text-blue-100 mt-0.5 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-300" />
              <span>JWT HttpOnly</span>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/10">
            <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider">Member Since</div>
            <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-200" />
              <span>{memberSinceFormatted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. NAVIGATION TABS
          ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-[#E6E8EE] pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-[#0056b3] text-white border-[#0056b3] shadow-xs'
              : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8] hover:text-[#12151C]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile Details</span>
          {isFormDirty && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'security'
              ? 'bg-[#0056b3] text-white border-[#0056b3] shadow-xs'
              : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8] hover:text-[#12151C]'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Security & Password</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'permissions'
              ? 'bg-[#0056b3] text-white border-[#0056b3] shadow-xs'
              : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8] hover:text-[#12151C]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Roles & Authority</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'activity'
              ? 'bg-[#0056b3] text-white border-[#0056b3] shadow-xs'
              : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8] hover:text-[#12151C]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Audit Activity</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 text-[#0056b3] font-bold">
            {userAuditLogs.length}
          </span>
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-500 hover:text-rose-700 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-800 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess('')}
            className="text-emerald-500 hover:text-emerald-700 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 1: PROFILE DETAILS
          ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Avatar & Account Metadata Card */}
          <div className="lg:col-span-4 space-y-6">
            {/* Avatar Management Card */}
            <div className="bg-white rounded-3xl border border-[#E6E8EE] p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#12151C] flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#0056b3]" />
                  <span>Profile Photo</span>
                </h3>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="text-rose-600 hover:text-rose-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Large Image Preview with Dropzone */}
              <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-[#F8F9FC] border border-dashed border-[#D2D6E0] space-y-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-white shadow-md bg-white flex items-center justify-center">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-3xl text-white">
                        {name ? name.charAt(0).toUpperCase() : 'A'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#12151C]">
                    {avatarUrl ? 'Photo Uploaded' : 'Upload custom avatar'}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">
                    Square JPG, PNG, or WEBP (Max 2MB).
                  </p>
                </div>

                <UploadButton
                  purpose="avatar"
                  onUploaded={([url]) => setAvatarUrl(url)}
                  title="Upload New Avatar"
                  className="w-full py-2 px-3 rounded-xl bg-white border border-[#E6E8EE] hover:bg-gray-50 text-xs font-bold text-[#12151C] flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#0056b3]" />
                  <span>Browse File</span>
                </UploadButton>
              </div>

              {/* Direct URL Input fallback */}
              <div className="space-y-1.5 pt-2 border-t border-[#E6E8EE]">
                <label className="text-[11px] font-bold text-[#6B7280]">Or paste image link</label>
                <div className="relative">
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Account Details Card */}
            <div className="bg-white rounded-3xl border border-[#E6E8EE] p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-[#12151C] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#0056b3]" />
                <span>Account Identity</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[#F0F2F6]">
                  <span className="text-[#6B7280]">System Role</span>
                  <span className="font-bold text-[#12151C] capitalize">
                    {profile?.role?.replace('_', ' ') || 'Super Administrator'}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F0F2F6]">
                  <span className="text-[#6B7280]">Account ID</span>
                  <span className="font-mono font-bold text-[#0056b3]">#{profile?.id ?? 1}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F0F2F6]">
                  <span className="text-[#6B7280]">Registered On</span>
                  <span className="font-medium text-[#12151C]">{memberSinceFormatted}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F0F2F6]">
                  <span className="text-[#6B7280]">Localization</span>
                  <span className="font-medium text-[#12151C]">Nepal (GMT +5:45)</span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-[#6B7280]">Store Operating Currency</span>
                  <span className="font-bold text-[#12151C]">NPR (रू)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Personal Information Edit Form */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-[#E6E8EE] p-6 sm:p-8 shadow-2xs">
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E6E8EE]">
                <div>
                  <h3 className="text-base font-bold text-[#12151C]">Personal Details</h3>
                  <p className="text-xs text-[#6B7280]">
                    Manage your identity and staff contact numbers shown across store operations.
                  </p>
                </div>
                {isFormDirty && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Unsaved modifications
                  </span>
                )}
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block text-[#12151C] font-bold mb-1.5 text-xs">
                    Full Legal / Display Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ramesh Thapa"
                      className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 text-xs text-[#12151C] font-semibold focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all"
                    />
                    <User className="w-4 h-4 text-[#9AA1AF] absolute left-3.5 top-3" />
                  </div>
                  <p className="text-[11px] text-[#9AA1AF] mt-1">
                    Displayed on printed sales slips, POS cashier receipts, and audit trail records.
                  </p>
                </div>

                {/* Email Address (Read-only) */}
                <div>
                  <label className="block text-[#12151C] font-bold mb-1.5 text-xs flex items-center justify-between">
                    <span>Email Address</span>
                    <span className="text-[10px] text-gray-400 font-normal">Primary Login</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={profile?.email || ''}
                      readOnly
                      className="w-full bg-[#EBECEF] border border-[#DCDFE6] rounded-xl py-2.5 px-4 pl-10 text-xs text-[#6B7280] font-medium cursor-not-allowed select-all"
                    />
                    <Mail className="w-4 h-4 text-[#9AA1AF] absolute left-3.5 top-3" />
                  </div>
                  <p className="text-[11px] text-[#9AA1AF] mt-1">
                    Managed by system owner. Contact IT administrator to alter root authentication address.
                  </p>
                </div>

                {/* Nepali Phone Number */}
                <div>
                  <label className="block text-[#12151C] font-bold mb-1.5 text-xs flex items-center justify-between">
                    <span>Nepali Mobile Number</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Nepal Telecom / Ncell</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-[#6B7280] select-none pointer-events-none flex items-center gap-1">
                      🇳🇵 +977
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98XXXXXXXX"
                      className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-20 text-xs text-[#12151C] font-semibold focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-[#9AA1AF] mt-1">
                    10-digit mobile number starting with 98, 97, or 96.
                  </p>
                </div>

                {/* Professional Title & Bio */}
                <div className="sm:col-span-2">
                  <label className="block text-[#12151C] font-bold mb-1.5 text-xs">
                    Staff Profile & Executive Notes
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short description of your administrative responsibilities..."
                    className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl p-3 text-xs text-[#12151C] focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-[#E6E8EE] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-[#6B7280] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#0056b3]" />
                  <span>Changes immediately sync to staff credentials and audit headers.</span>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  {isFormDirty && (
                    <button
                      type="button"
                      onClick={handleResetForm}
                      disabled={isSaving}
                      className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Discard
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isSaving || !isFormDirty}
                    className="px-6 py-2.5 bg-[#0056b3] hover:bg-[#004494] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-98"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: SECURITY & PASSWORD
          ========================================================================= */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Password Change Form */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E6E8EE] p-6 sm:p-8 shadow-2xs">
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="flex items-start gap-4 pb-5 border-b border-[#E6E8EE]">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#12151C]">Change Account Password</h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Update your password regularly to protect your administrative console access.
                  </p>
                </div>
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block text-[#12151C] font-bold mb-1.5 text-xs">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your existing password"
                    className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 pr-10 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all font-mono"
                  />
                  <Lock className="w-4 h-4 text-[#9AA1AF] absolute left-3.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3.5 top-2.5 text-[#9AA1AF] hover:text-[#12151C] p-0.5"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password with Strength Meter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[#12151C] font-bold text-xs">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  {newPassword && (
                    <span className={`text-[11px] font-bold ${passwordStrength.text}`}>
                      Strength: {passwordStrength.label}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters with numbers & symbols"
                    className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 pr-10 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all font-mono"
                  />
                  <Key className="w-4 h-4 text-[#9AA1AF] absolute left-3.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-2.5 text-[#9AA1AF] hover:text-[#12151C] p-0.5"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength Meter Bar */}
                {newPassword && (
                  <div className="mt-2 space-y-1.5">
                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      <div className={`rounded-full h-full transition-all ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-gray-200'}`} />
                      <div className={`rounded-full h-full transition-all ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-gray-200'}`} />
                      <div className={`rounded-full h-full transition-all ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-gray-200'}`} />
                      <div className={`rounded-full h-full transition-all ${passwordStrength.score >= 4 ? passwordStrength.color : 'bg-gray-200'}`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[#12151C] font-bold mb-1.5 text-xs">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 pr-10 text-xs focus:ring-2 focus:ring-[#0056b3]/20 focus:bg-white focus:border-[#0056b3] outline-none transition-all font-mono"
                  />
                  <Lock className="w-4 h-4 text-[#9AA1AF] absolute left-3.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-2.5 text-[#9AA1AF] hover:text-[#12151C] p-0.5"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword === confirmPassword && (
                  <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full bg-[#0056b3] hover:bg-[#004494] text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Apply New Password</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Security Checklist & Session Architecture */}
          <div className="lg:col-span-5 space-y-6">
            {/* Password Policy Card */}
            <div className="bg-white rounded-3xl border border-[#E6E8EE] p-6 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold text-[#12151C] uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Password Requirements</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-[#6B7280]">
                  <span className={`w-2 h-2 rounded-full ${newPassword.length >= 8 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span>Minimum 8 characters in length</span>
                </div>
                <div className="flex items-center gap-2 text-[#6B7280]">
                  <span className={`w-2 h-2 rounded-full ${/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span>Mix of uppercase & lowercase characters</span>
                </div>
                <div className="flex items-center gap-2 text-[#6B7280]">
                  <span className={`w-2 h-2 rounded-full ${/[0-9]/.test(newPassword) ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span>At least one numeric digit (0-9)</span>
                </div>
                <div className="flex items-center gap-2 text-[#6B7280]">
                  <span className={`w-2 h-2 rounded-full ${/[^A-Za-z0-9]/.test(newPassword) ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span>At least one symbol (e.g. !@#$%^&*)</span>
                </div>
              </div>
            </div>

            {/* Session Security Overview */}
            <div className="bg-white rounded-3xl border border-[#E6E8EE] p-6 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold text-[#12151C] uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0056b3]" />
                <span>Active Session Protocol</span>
              </h4>

              <div className="space-y-3 text-xs text-[#6B7280] leading-relaxed">
                <div className="p-3 bg-[#F4F5F8] rounded-xl space-y-1">
                  <div className="font-bold text-[#12151C] flex items-center justify-between">
                    <span>Cookie-Secured JWT</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px]">
                    Authentication credentials are protected using HTTP-only, SameSite strict session tokens. JavaScript cannot read the token, safeguarding against XSS credential leaks.
                  </p>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[#F0F2F6]">
                  <span>Encryption Standard</span>
                  <span className="font-mono font-bold text-[#12151C]">TLS 1.3 / bcrypt-hash</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span>Session Idle Policy</span>
                  <span className="font-bold text-[#12151C]">Auto-revalidating</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ROLES & PERMISSIONS
          ========================================================================= */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-[#E6E8EE] p-6 sm:p-8 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E6E8EE]">
              <div>
                <h3 className="text-base font-bold text-[#12151C] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#0056b3]" />
                  <span>Administrative Authority & Role Matrix</span>
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Granular capabilities granted to your account role (<strong className="text-[#12151C] font-semibold">{profile?.role?.replace('_', ' ') || 'Super Admin'}</strong>).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-blue-50 text-[#0056b3] border border-blue-200 font-bold text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tier 1 System Master</span>
                </span>
              </div>
            </div>

            {/* Matrix Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 1. Catalog & Merchandising */}
              <div className="p-5 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EE] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#0056b3] flex items-center justify-center">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    FULL ACCESS
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12151C]">Catalog & Merchandising</h4>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    Create, modify, archive, and permanently delete SKU products, brand registries, category taxonomies, and technical spec sheets.
                  </p>
                </div>
              </div>

              {/* 2. Sales & Order Fulfillment */}
              <div className="p-5 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EE] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    FULL ACCESS
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12151C]">Sales & Fulfillment</h4>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    View customer orders, update tracking statuses, dispatch riders, print official courier waybills, and log audit notes.
                  </p>
                </div>
              </div>

              {/* 3. Apex POS Terminal */}
              <div className="p-5 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EE] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    CASHIER / SHIFT
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12151C]">Apex POS Terminal</h4>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    Barcode scanning counter sales, instant cash/Fonepay QR payments, tax invoice generation, and cashier drawer closures.
                  </p>
                </div>
              </div>

              {/* 4. Warehouse & GRN Management */}
              <div className="p-5 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EE] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    SUPERVISOR
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12151C]">Storekeeper & Inventory</h4>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    Receive purchase goods notes (GRN), assign hardware serial numbers / IMEIs, trigger physical count audits, and log stock variances.
                  </p>
                </div>
              </div>

              {/* 5. Accounting & Ledgers */}
              <div className="p-5 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EE] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    FINANCIAL ERP
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12151C]">Accounting Hub</h4>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    Purchase bills recording, vendor balance payments, operating expense vouchers, profit & loss accounting, and VAT reports.
                  </p>
                </div>
              </div>

              {/* 6. System Governance & Staff RBAC */}
              <div className="p-5 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EE] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    SECURITY ADMIN
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#12151C]">Store Settings & Staff RBAC</h4>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    Provision new administrative operators, manage role permissions, update storefront landing page banners, and inspect audit logs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: RECENT AUDIT ACTIVITY
          ========================================================================= */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-3xl border border-[#E6E8EE] p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E6E8EE]">
            <div>
              <h3 className="text-base font-bold text-[#12151C] flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#0056b3]" />
                <span>Recent Audit Activity</span>
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Actions executed by this account during administrative sessions.
              </p>
            </div>

            <span className="text-xs font-mono font-bold text-[#6B7280]">
              Showing {userAuditLogs.length} events
            </span>
          </div>

          {userAuditLogs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Clock className="w-8 h-8 text-[#9AA1AF] mx-auto" />
              <p className="text-xs font-bold text-[#12151C]">No logged actions recorded yet</p>
              <p className="text-[11px] text-[#6B7280]">
                Administrative events such as product deletions, status changes, and settings updates appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {userAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EE] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-[#0056b3]">
                        {log.module}
                      </span>
                      <strong className="text-[#12151C] font-semibold">{log.action}</strong>
                    </div>
                    <p className="text-[#6B7280] text-[11px] leading-relaxed">{log.details}</p>
                  </div>

                  <div className="shrink-0 text-right text-[11px] text-[#9AA1AF] font-mono">
                    {log.timestamp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useState, useEffect } from 'react';
import { ImageUploadField, UploadButton } from './ImageUploadField';
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
} from 'lucide-react';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  createdAt: string;
}

export const AccountModule: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      // The session is an httpOnly `auth-token` cookie, which a same-origin
      // fetch sends on its own — there is no token in JS to put in a header.
      const response = await fetch('/api/auth/me');

      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setName(data.user.name || '');
        setPhone(data.user.phone || '');
        setAvatarUrl(data.user.avatarUrl || '');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/users/${profile?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          // Empty strings would fail the Zod field validators, so an untouched
          // optional field is omitted rather than sent blank.
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
        }),
      });

      if (response.ok) {
        setSuccess('Profile updated successfully');
        fetchProfile();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);

    try {
      // Password changes go to their own endpoint: `PUT /api/users/[id]` rejects
      // password fields by design, so patching the profile could never set one.
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        setSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#4C63FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#12151C]">My Account</h2>
          <p className="text-xs text-[#6B7280] mt-1">Manage your account settings and security</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4C63FF] to-[#7C5CFF] text-white font-bold text-sm flex items-center justify-center">
            {profile?.name?.charAt(0) || 'A'}
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-[#12151C]">{profile?.name}</div>
            <div className="text-xs text-[#6B7280] capitalize">{profile?.role?.replace('_', ' ')}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E6E8EE] pb-3">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl border transition-colors font-bold text-xs ${
            activeTab === 'profile'
              ? 'bg-[#4C63FF] text-white border-[#4C63FF]'
              : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8]'
          }`}
        >
          <User className="w-3.5 h-3.5 inline mr-1.5" />
          Profile
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl border transition-colors font-bold text-xs ${
            activeTab === 'security'
              ? 'bg-[#4C63FF] text-white border-[#4C63FF]'
              : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8]'
          }`}
        >
          <Shield className="w-3.5 h-3.5 inline mr-1.5" />
          Security
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-3xl border border-[#E6E8EE] p-6 shadow-sm">
          <form onSubmit={handleUpdateProfile} className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- may point at
                  // an arbitrary pasted host, which next/image would reject.
                  <img
                    src={avatarUrl}
                    alt={profile?.name ?? 'Profile picture'}
                    className="w-20 h-20 rounded-full object-cover border border-[#E6E8EE]"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4C63FF] to-[#7C5CFF] text-white font-bold text-2xl flex items-center justify-center">
                    {profile?.name?.charAt(0) || 'A'}
                  </div>
                )}
                {/* Previously a button with no handler at all. */}
                <UploadButton
                  purpose="avatar"
                  onUploaded={([url]) => setAvatarUrl(url)}
                  title="Upload a profile picture"
                  className="absolute bottom-0 right-0 w-7 h-7 bg-[#4C63FF] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#3D52CC] transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                </UploadButton>
              </div>
              <div>
                <div className="text-sm font-bold text-[#12151C]">{profile?.name}</div>
                <div className="text-xs text-[#6B7280]">{profile?.email}</div>
                <div className="text-xs text-[#4C63FF] font-semibold mt-1 capitalize">
                  {profile?.role?.replace('_', ' ')}
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-[#12151C] font-bold mb-1.5 text-xs">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 text-xs focus:ring-2 focus:ring-[#4C63FF]/20 focus:bg-white focus:border-[#4C63FF] outline-none transition-all"
                />
                <User className="w-4 h-4 text-[#9AA1AF] absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Email (readonly) */}
            <div>
              <label className="block text-[#12151C] font-bold mb-1.5 text-xs">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={profile?.email || ''}
                  readOnly
                  className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 text-xs text-[#6B7280] cursor-not-allowed"
                />
                <Mail className="w-4 h-4 text-[#9AA1AF] absolute left-3 top-2.5" />
              </div>
              <p className="text-[10px] text-[#9AA1AF] mt-1">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[#12151C] font-bold mb-1.5 text-xs">Phone Number</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9851084291"
                  className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 text-xs focus:ring-2 focus:ring-[#4C63FF]/20 focus:bg-white focus:border-[#4C63FF] outline-none transition-all"
                />
                <Phone className="w-4 h-4 text-[#9AA1AF] absolute left-3 top-2.5" />
              </div>
              <p className="text-[10px] text-[#9AA1AF] mt-1">
                10-digit Nepali mobile (98/97/96). A +977 prefix is stripped automatically.
              </p>
            </div>

            {/* Profile picture */}
            <ImageUploadField
              label="Profile picture"
              purpose="avatar"
              value={avatarUrl}
              onChange={setAvatarUrl}
              hint="Square image works best. Saved when you press Save Changes."
            />

            {/* Account Info */}
            <div className="bg-[#F4F5F8] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280]">Account ID</span>
                <span className="font-mono font-bold text-[#12151C]">#{profile?.id}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280]">Member Since</span>
                <span className="font-bold text-[#12151C]">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#4C63FF] hover:bg-[#3D52CC] text-white font-bold py-2.5 rounded-xl shadow-lg shadow-[#4C63FF]/25 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-3xl border border-[#E6E8EE] p-6 shadow-sm">
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Key className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#12151C]">Change Password</h3>
                <p className="text-xs text-[#6B7280]">Update your password regularly to keep your account secure</p>
              </div>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-[#12151C] font-bold mb-1.5 text-xs">Current Password</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 pr-10 text-xs focus:ring-2 focus:ring-[#4C63FF]/20 focus:bg-white focus:border-[#4C63FF] outline-none transition-all"
                />
                <Lock className="w-4 h-4 text-[#9AA1AF] absolute left-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-2.5 text-[#9AA1AF] hover:text-[#6B7280]"
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-[#12151C] font-bold mb-1.5 text-xs">New Password</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 text-xs focus:ring-2 focus:ring-[#4C63FF]/20 focus:bg-white focus:border-[#4C63FF] outline-none transition-all"
                />
                <Lock className="w-4 h-4 text-[#9AA1AF] absolute left-3 top-2.5" />
              </div>
              <p className="text-[10px] text-[#9AA1AF] mt-1">Minimum 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[#12151C] font-bold mb-1.5 text-xs">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 text-xs focus:ring-2 focus:ring-[#4C63FF]/20 focus:bg-white focus:border-[#4C63FF] outline-none transition-all"
                />
                <Lock className="w-4 h-4 text-[#9AA1AF] absolute left-3 top-2.5" />
              </div>
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {/* Change Password Button */}
            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full bg-[#4C63FF] hover:bg-[#3D52CC] text-white font-bold py-2.5 rounded-xl shadow-lg shadow-[#4C63FF]/25 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isChangingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Key className="w-4 h-4" />
              )}
              Change Password
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

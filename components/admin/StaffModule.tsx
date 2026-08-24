'use client';

import React, { useState } from 'react';
import { type AdminUser, type AuditLogEntry } from '@/types';

/** Module 11 — the staff directory and the in-memory audit trail. */
export interface StaffModuleProps {
  adminUsers: AdminUser[];
  auditLogs: AuditLogEntry[];
}

export const StaffModule: React.FC<StaffModuleProps> = ({ adminUsers, auditLogs }) => {
  const [staffSubTab, setStaffSubTab] = useState<'users' | 'roles' | 'audit'>('users');

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200 pb-3 font-bold text-xs overflow-x-auto">
        <button
          onClick={() => setStaffSubTab('users')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            staffSubTab === 'users' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          Admin Users Directory ({adminUsers.length})
        </button>
        <button
          onClick={() => setStaffSubTab('audit')}
          className={`px-4 py-2 rounded-xl border transition-colors ${
            staffSubTab === 'audit' ? 'bg-[#0056b3] text-white border-[#0056b3]' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          System Audit Trail ({auditLogs.length})
        </button>
      </div>

      {staffSubTab === 'users' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h3 className="font-extrabold text-base text-[#1a1a1a]">Authorized Staff Accounts</h3>
          <div className="space-y-3 text-xs">
            {adminUsers.map((u) => (
              <div key={u.id} className="p-4 border rounded-2xl bg-gray-50 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-gray-900">{u.name}</div>
                  <div className="text-gray-500">{u.email} &bull; Role: <span className="font-bold text-[#0056b3]">{u.role}</span></div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">ACTIVE STAFF</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {staffSubTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <h3 className="font-extrabold text-base text-[#1a1a1a]">System Action Audit Trail (Append-Only)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-gray-500 uppercase font-extrabold bg-gray-50/50">
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Staff Member</th>
                  <th className="py-3 px-3">Module</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-mono text-gray-500">{log.timestamp}</td>
                    <td className="py-3 px-3 font-bold text-gray-900">{log.adminName} ({log.role})</td>
                    <td className="py-3 px-3 text-[#0056b3] font-bold">{log.module}</td>
                    <td className="py-3 px-3 uppercase text-[10px] font-bold">{log.action}</td>
                    <td className="py-3 px-3 text-gray-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

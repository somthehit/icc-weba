'use client';

import React from 'react';
import { type ServiceRequest } from '@/types';

/** Module 5 — the repair and service request queue. */
export interface ServicesModuleProps {
  serviceRequests: ServiceRequest[];
  updateServiceStatus: (
    id: string,
    status: ServiceRequest['status'],
    technician?: string,
    cost?: number,
  ) => void;
  logAuditAction: (module: string, action: string, details: string) => void;
}

export const ServicesModule: React.FC<ServicesModuleProps> = ({ serviceRequests, updateServiceStatus, logAuditAction }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
        <h3 className="font-extrabold text-base text-[#1a1a1a]">Technical Service Tickets ({serviceRequests.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-gray-500 uppercase font-extrabold bg-gray-50/50">
                <th className="py-3 px-3">Ticket ID</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Service Type</th>
                <th className="py-3 px-3">Assigned Tech</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {serviceRequests.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="py-3 px-3 font-mono font-bold text-[#0056b3]">{s.id}</td>
                  <td className="py-3 px-3 font-bold">{s.customerName} ({s.phone})</td>
                  <td className="py-3 px-3 capitalize">{s.serviceType.replace('-', ' ')}</td>
                  <td className="py-3 px-3">{s.assignedTechnician || 'Unassigned'}</td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 uppercase">
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => { updateServiceStatus(s.id, 'completed'); logAuditAction('Services', 'Complete Ticket', `Completed service ticket #${s.id}`); }}
                      className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold"
                    >
                      Mark Resolved
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

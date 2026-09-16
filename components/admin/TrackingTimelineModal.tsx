'use client';

// components/admin/TrackingTimelineModal.tsx
//
// The audit view behind a tracking code: every status hop, newest first, plus
// the status controls fulfillment staff use to move the package along.

import React, { useState } from 'react';

import {
  SHIPMENT_STATUS_CLASS,
  SHIPMENT_STATUS_LABEL,
  npr,
  type Shipment,
  type ShipmentStatus,
} from './deliveryShared';

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Copy,
  MapPin,
  MessageSquare,
  Printer,
  RotateCcw,
  Truck,
  X,
} from 'lucide-react';

export interface TrackingTimelineModalProps {
  shipment: Shipment;
  onClose: () => void;
  onUpdateStatus: (shipmentId: string, status: ShipmentStatus, reason?: string) => void;
  onPrintLabel: (shipment: Shipment) => void;
  onSendSms: (shipment: Shipment) => void;
}

/** The hops a package can be pushed to from the timeline, in order. */
const NEXT_STATUSES: { status: ShipmentStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'dispatched', label: 'Mark Dispatched', icon: <Truck className="w-3.5 h-3.5" /> },
  { status: 'in_transit', label: 'Out for Delivery', icon: <MapPin className="w-3.5 h-3.5" /> },
  { status: 'delivered', label: 'Mark Delivered', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { status: 'failed', label: 'Mark Failed', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { status: 'returned', label: 'Mark Returned', icon: <RotateCcw className="w-3.5 h-3.5" /> },
];

export const TrackingTimelineModal: React.FC<TrackingTimelineModalProps> = ({
  shipment,
  onClose,
  onUpdateStatus,
  onPrintLabel,
  onSendSms,
}) => {
  const [failureReason, setFailureReason] = useState('');
  const [pendingFailure, setPendingFailure] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyTracking = async () => {
    try {
      await navigator.clipboard.writeText(shipment.trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is unavailable over plain HTTP — the code is on screen anyway.
    }
  };

  const handleStatusClick = (status: ShipmentStatus) => {
    // A failure needs a reason attached, so that one opens an input first.
    if (status === 'failed' || status === 'returned') {
      setPendingFailure(true);
      return;
    }
    onUpdateStatus(shipment.id, status);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#E6E8EE] sticky top-0 bg-white rounded-t-3xl">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#12151C]">Shipment Timeline</h3>
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${SHIPMENT_STATUS_CLASS[shipment.status]}`}
              >
                {SHIPMENT_STATUS_LABEL[shipment.status]}
              </span>
            </div>
            <button
              onClick={copyTracking}
              className="flex items-center gap-1.5 mt-1 font-mono text-[11px] text-[#4C63FF] hover:underline"
              title="Copy tracking code"
            >
              {shipment.trackingCode}
              <Copy className="w-3 h-3" />
              {copied && <span className="text-emerald-600 not-italic">copied</span>}
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F4F5F8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#F4F5F8] rounded-xl p-3">
              <div className="text-[10px] text-[#6B7280] uppercase font-bold tracking-wider">Order</div>
              <div className="font-mono text-xs font-bold text-[#12151C] mt-0.5">{shipment.orderId}</div>
            </div>
            <div className="bg-[#F4F5F8] rounded-xl p-3">
              <div className="text-[10px] text-[#6B7280] uppercase font-bold tracking-wider">Carrier</div>
              <div className="text-xs font-bold text-[#12151C] mt-0.5 truncate">
                {shipment.carrierName || 'Unassigned'}
              </div>
            </div>
            <div className="bg-[#F4F5F8] rounded-xl p-3">
              <div className="text-[10px] text-[#6B7280] uppercase font-bold tracking-wider">COD</div>
              <div
                className={`text-xs font-black mt-0.5 ${shipment.codAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
              >
                {shipment.codAmount > 0 ? npr(shipment.codAmount) : 'PREPAID'}
              </div>
            </div>
            <div className="bg-[#F4F5F8] rounded-xl p-3">
              <div className="text-[10px] text-[#6B7280] uppercase font-bold tracking-wider">Attempts</div>
              <div className="text-xs font-bold text-[#12151C] mt-0.5">{shipment.attemptCount}</div>
            </div>
          </div>

          {/* Destination */}
          <div className="flex items-start gap-3 border border-[#E6E8EE] rounded-2xl p-4">
            <MapPin className="w-4 h-4 text-[#4C63FF] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#12151C]">{shipment.customerName}</div>
              <div className="text-[11px] text-[#6B7280] font-mono">{shipment.customerPhone}</div>
              <div className="text-[11px] text-[#6B7280] mt-1">{shipment.address}</div>
              <div className="text-[11px] font-bold text-[#4C63FF] mt-1">{shipment.zoneLabel}</div>
            </div>
          </div>

          {/* Failure reason capture */}
          {pendingFailure && (
            <div className="border border-red-200 bg-red-50 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-bold text-red-700">Reason for failed delivery</div>
              <input
                type="text"
                autoFocus
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="Customer unreachable, address not found, refused COD…"
                className="w-full bg-white border border-red-200 rounded-xl py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-red-200"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPendingFailure(false);
                    setFailureReason('');
                  }}
                  className="flex-1 py-2 rounded-xl border border-red-200 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!failureReason.trim()}
                  onClick={() => {
                    onUpdateStatus(shipment.id, 'failed', failureReason.trim());
                    setPendingFailure(false);
                    setFailureReason('');
                  }}
                  className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-40"
                >
                  Record Failure
                </button>
              </div>
            </div>
          )}

          {/* Status controls */}
          {!pendingFailure && shipment.status !== 'delivered' && (
            <div>
              <div className="text-xs font-bold text-[#12151C] mb-2">Update Status</div>
              <div className="flex flex-wrap gap-2">
                {NEXT_STATUSES.filter((s) => s.status !== shipment.status).map((s) => (
                  <button
                    key={s.status}
                    onClick={() => handleStatusClick(s.status)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                      s.status === 'failed' || s.status === 'returned'
                        ? 'border-red-200 text-red-700 hover:bg-red-50'
                        : 'border-[#E6E8EE] text-[#12151C] hover:bg-[#F4F5F8]'
                    }`}
                  >
                    {s.icon}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <div className="text-xs font-bold text-[#12151C] mb-3">Audit Trail</div>
            <div className="space-y-0">
              {shipment.trackingLogs.length === 0 && (
                <div className="text-xs text-[#6B7280] py-4 text-center border border-dashed border-[#E6E8EE] rounded-2xl">
                  No tracking events yet — dispatch the shipment to start the trail.
                </div>
              )}
              {shipment.trackingLogs.map((log, i) => {
                const isLatest = i === 0;
                return (
                  <div key={log.id} className="flex gap-3">
                    {/* Rail */}
                    <div className="flex flex-col items-center">
                      {isLatest ? (
                        <CheckCircle2 className="w-4 h-4 text-[#4C63FF] flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#C7CBDA] flex-shrink-0" />
                      )}
                      {i < shipment.trackingLogs.length - 1 && (
                        <div className="w-px flex-1 bg-[#E6E8EE] my-1" />
                      )}
                    </div>
                    {/* Entry */}
                    <div className="pb-5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold ${isLatest ? 'text-[#12151C]' : 'text-[#6B7280]'}`}
                        >
                          {log.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${SHIPMENT_STATUS_CLASS[log.status]}`}
                        >
                          {SHIPMENT_STATUS_LABEL[log.status]}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B7280] mt-0.5">{log.description}</div>
                      <div className="flex items-center gap-2 text-[10px] text-[#9AA1AF] font-mono mt-1">
                        <span>{log.timestamp}</span>
                        {log.location && <span>· {log.location}</span>}
                        {log.updatedBy && <span>· {log.updatedBy}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#E6E8EE]">
            <button
              onClick={() => onPrintLabel(shipment)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#E6E8EE] text-xs font-bold text-[#12151C] hover:bg-[#F4F5F8] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Courier Label
            </button>
            <button
              onClick={() => onSendSms(shipment)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#E6E8EE] text-xs font-bold text-[#12151C] hover:bg-[#F4F5F8] transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Send SMS Update
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#4C63FF] text-white text-xs font-bold hover:bg-[#3D52CC] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

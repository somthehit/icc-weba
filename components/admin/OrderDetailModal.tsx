'use client';

import React, { useState } from 'react';

import type { DeliveryRider, Order, OrderStatus } from '@/types';

import { getNextLogicalStatus } from './shared';
import { InvoiceModal } from '@/components/InvoiceModal';
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Send,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';

export interface OrderDetailModalProps {
  order: Order;
  riders: DeliveryRider[];
  onClose: () => void;
  setWaybillOrder: (order: Order | null) => void;
  updateOrderStatusExtended: (
    orderId: string,
    status: OrderStatus,
    options?: {
      note?: string;
      location?: string;
      updatedBy?: string;
      riderId?: string;
      riderName?: string;
      paymentStatus?: 'pending' | 'paid' | 'verified';
    },
  ) => Promise<void>;
  addStaffNoteToOrder: (orderId: string, author: string, noteText: string, role?: string) => void;
  updateOrder: (updatedOrder: Order) => void;
  logAuditAction: (module: string, action: string, details: string) => void;
}

/**
 * One order, in full: fulfilment timeline, customer and payment detail, and the
 * internal note thread.
 *
 * Mounted per order (`key={order.id}`), which is what lets the draft fields below
 * be plain `useState` seeded from the order rather than an effect that resyncs.
 */
export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  riders,
  onClose,
  setWaybillOrder,
  updateOrderStatusExtended,
  addStaffNoteToOrder,
  updateOrder,
  logAuditAction,
}) => {
  const [modalActiveTab, setModalActiveTab] = useState<'timeline' | 'details' | 'notes'>('timeline');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [modalNewStaffNote, setModalNewStaffNote] = useState('');
  const [modalStatusNote, setModalStatusNote] = useState('');
  const [modalStatusLocation, setModalStatusLocation] = useState(
    order.shippingAddress.district
      ? `${order.shippingAddress.district} Delivery Hub`
      : 'Intel Kailali Showroom Hub',
  );
  const [modalTargetStatus, setModalTargetStatus] = useState<OrderStatus>(
    getNextLogicalStatus(order.status),
  );
  const [modalAssignedRider, setModalAssignedRider] = useState(order.assignedRiderName || '');

  const handleApplyStatusTransition = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    updateOrderStatusExtended(order.id, modalTargetStatus, {
      note: modalStatusNote.trim() || `Status updated to ${modalTargetStatus.replace(/_/g, ' ')}.`,
      location: modalStatusLocation.trim() || 'Intel Kailali Showroom Hub',
      updatedBy: 'Admin (Sales Desk)',
      riderName: modalAssignedRider || order.assignedRiderName,
    });

    logAuditAction(
      'Sales/Orders',
      'Status Transition',
      `Updated Order #${order.id} status to ${modalTargetStatus}`,
    );
    setModalStatusNote('');
  };

  const handleAddStaffNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalNewStaffNote.trim()) return;

    addStaffNoteToOrder(order.id, 'Admin (Sales Desk)', modalNewStaffNote.trim(), 'Sales Officer');
    logAuditAction(
      'Sales/Orders',
      'Internal Note Added',
      `Added internal staff note to Order #${order.id}`,
    );
    setModalNewStaffNote('');
  };

  const handleAssignRiderInModal = (riderName: string) => {
    setModalAssignedRider(riderName);
    updateOrder({ ...order, assignedRiderName: riderName });
    logAuditAction(
      'Sales/Orders',
      'Rider Assignment',
      `Assigned rider ${riderName} to Order #${order.id}`,
    );
  };

  const handleUpdatePaymentStatusInModal = (newPayStatus: 'pending' | 'paid' | 'verified') => {
    updateOrder({ ...order, paymentStatus: newPayStatus });
    logAuditAction(
      'Sales/Orders',
      'Payment Status Update',
      `Updated payment status to ${newPayStatus} for Order #${order.id}`,
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-100">

        {/* Modal Header Bar */}
        <div className="p-5 border-b border-gray-200 bg-gray-50/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl text-[#0056b3] font-mono">
                Order #{order.id}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                order.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                  order.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                    'bg-amber-100 text-amber-800'
                }`}>
                {order.status.replace(/_/g, ' ')}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                'bg-amber-100 text-amber-800'
                }`}>
                Payment: {order.paymentStatus} ({order.paymentMethod.toUpperCase()})
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Placed on {new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="bg-[#0056b3] text-white hover:bg-[#004494] font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
              title="View & Print Official Tax Invoice"
            >
              <FileText className="w-4 h-4" />
              <span>Tax Invoice</span>
            </button>
            <button
              onClick={() => setWaybillOrder(order)}
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Waybill</span>
            </button>
            <button
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 p-2 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-white px-5 text-xs font-bold gap-2">
          <button
            onClick={() => setModalActiveTab('timeline')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${modalActiveTab === 'timeline'
              ? 'border-[#0056b3] text-[#0056b3]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
          >
            <History className="w-4 h-4" />
            <span>Delivery Tracking Timeline</span>
          </button>

          <button
            onClick={() => setModalActiveTab('details')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${modalActiveTab === 'details'
              ? 'border-[#0056b3] text-[#0056b3]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Order Items &amp; Customer Info</span>
          </button>

          <button
            onClick={() => setModalActiveTab('notes')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors relative ${modalActiveTab === 'notes'
              ? 'border-[#0056b3] text-[#0056b3]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Internal Staff Notes</span>
            {order.staffNotes && order.staffNotes.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full ml-1">
                {order.staffNotes.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">

          {/* TAB 1: DELIVERY TRACKING TIMELINE & STATUS TRANSITION */}
          {modalActiveTab === 'timeline' && (
            <div className="space-y-6">

              {/* Status Pipeline Progress Indicator */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <div className="font-extrabold text-sm text-gray-900 flex justify-between items-center">
                  <span>Order Lifecycle Pipeline</span>
                  <span className="text-xs text-[#0056b3]">Current: {order.status.replace(/_/g, ' ').toUpperCase()}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 text-[10px] font-bold text-center">
                  {[
                    { status: 'placed', label: '1. Placed' },
                    { status: 'confirmed', label: '2. Confirmed' },
                    { status: 'processing', label: '3. Processing' },
                    { status: 'packed', label: '4. Packed' },
                    { status: 'shipped', label: '5. Shipped' },
                    { status: 'out_for_delivery', label: '6. Out for Delivery' },
                    { status: 'delivered', label: '7. Delivered' },
                  ].map((step) => {
                    const stepSequence = ['placed', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
                    const currentIdx = stepSequence.indexOf(order.status);
                    const isDone = stepSequence.indexOf(step.status) <= currentIdx && order.status !== 'cancelled';
                    const isCurrent = step.status === order.status;

                    return (
                      <div
                        key={step.status}
                        className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all ${isCurrent
                          ? 'bg-[#0056b3] text-white border-[#0056b3] shadow-md scale-102'
                          : isDone
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : 'bg-white text-gray-400 border-gray-200'
                          }`}
                      >
                        <div className="font-extrabold truncate w-full">{step.label}</div>
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Transition Action Panel */}
              <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-200 space-y-4">
                <div className="font-extrabold text-sm text-[#0056b3] flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  <span>Advance Order Status &amp; Notify Customer</span>
                </div>

                <form onSubmit={handleApplyStatusTransition} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold mb-1 text-gray-700">Target New Status</label>
                    <select
                      value={modalTargetStatus}
                      onChange={(e) => setModalTargetStatus(e.target.value as OrderStatus)}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white font-bold text-xs focus:outline-none focus:border-[#0056b3]"
                    >
                      <option value="placed">Placed</option>
                      <option value="confirmed">Confirmed (Phone Verified)</option>
                      <option value="processing">Processing (Stock Allocated)</option>
                      <option value="packed">Packed &amp; Sealed</option>
                      <option value="shipped">Shipped (In Transit)</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered &amp; Payment Collected</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-gray-700">Location Tag / Transit Hub</label>
                    <input
                      type="text"
                      value={modalStatusLocation}
                      onChange={(e) => setModalStatusLocation(e.target.value)}
                      placeholder="e.g., Kailali Main Warehouse / Patan Route"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-gray-700">Assigned Delivery Rider</label>
                    <select
                      value={modalAssignedRider}
                      onChange={(e) => handleAssignRiderInModal(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold"
                    >
                      <option value="">-- Select Express Rider --</option>
                      {riders.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name} ({r.type.replace(/_/g, ' ')} - {r.phone})
                        </option>
                      ))}
                      <option value="Nepal Express Courier Partner">Nepal Express Courier Partner</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block font-bold mb-1 text-gray-700">Status Change Description / Customer Tracking Note</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={modalStatusNote}
                        onChange={(e) => setModalStatusNote(e.target.value)}
                        placeholder="e.g. Order verified via phone call with customer; handed over to rider Roshan Shrestha."
                        className="flex-1 p-2.5 rounded-xl border border-gray-300 bg-white text-xs"
                      />
                      <button
                        type="submit"
                        className="bg-[#0056b3] hover:bg-[#004494] text-white font-extrabold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Apply Status Update</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Order Delivery Tracking History Timeline (Customer-Facing View) */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0056b3]" />
                    <span>Order Delivery Tracking Timeline (Mirrors Customer Experience)</span>
                  </div>
                  <span className="text-[11px] text-gray-500">{order.trackingHistory.length} status events recorded</span>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-100">
                  {order.trackingHistory.map((event, idx) => {
                    const isLatest = idx === order.trackingHistory.length - 1;
                    return (
                      <div key={idx} className="relative flex items-start gap-4 group">
                        {/* Timeline Node Point */}
                        <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isLatest
                          ? 'bg-[#0056b3] border-white ring-4 ring-blue-100 text-white'
                          : 'bg-emerald-500 border-white text-white'
                          }`}>
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>

                        {/* Event Body */}
                        <div className="bg-gray-50/80 hover:bg-gray-50 p-4 rounded-2xl border border-gray-200 flex-1 space-y-1">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                            <div className="font-extrabold text-sm text-gray-900">{event.title}</div>
                            <div className="text-[11px] text-gray-500 font-mono font-medium">{event.timestamp}</div>
                          </div>

                          <p className="text-gray-700 text-xs font-medium mt-1">{event.description}</p>

                          <div className="flex items-center gap-3 pt-2 text-[10px] text-gray-500 border-t border-gray-200/60 mt-2">
                            <span className="inline-flex items-center gap-1 font-bold text-gray-700">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span>{event.location || 'Intel Kailali Hub'}</span>
                            </span>
                            {event.updatedBy && (
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3 text-gray-400" />
                                <span>{event.updatedBy}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ORDER ITEMS & CUSTOMER DETAILS */}
          {modalActiveTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Left Column: Customer & Address Details */}
              <div className="space-y-4 md:col-span-1">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                  <div className="font-extrabold text-xs uppercase tracking-wider text-gray-500">Customer Contact</div>
                  <div className="space-y-2">
                    <div className="font-extrabold text-sm text-gray-900">{order.customerName}</div>
                    <div className="flex items-center justify-between text-xs text-gray-700 bg-white p-2 rounded-xl border border-gray-200">
                      <span>{order.customerPhone}</span>
                      <a href={`tel:${order.customerPhone}`} className="text-[#0056b3] font-bold flex items-center gap-1 hover:underline">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </a>
                    </div>
                    {order.customerEmail && (
                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span>{order.customerEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                  <div className="font-extrabold text-xs uppercase tracking-wider text-gray-500">Delivery Address</div>
                  <div className="space-y-1 text-gray-800">
                    <div className="font-bold text-gray-900">{order.shippingAddress.fullName}</div>
                    <div>{order.shippingAddress.addressLine}</div>
                    {order.shippingAddress.landmark && (
                      <div className="text-gray-500 italic">Landmark: {order.shippingAddress.landmark}</div>
                    )}
                    <div>
                      {order.shippingAddress.municipality}, Ward {order.shippingAddress.ward}
                    </div>
                    <div className="font-bold text-[#0056b3]">
                      {order.shippingAddress.district}, {order.shippingAddress.province}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                  <div className="font-extrabold text-xs uppercase tracking-wider text-gray-500">Payment Status Control</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Method:</span>
                      <span className="uppercase font-extrabold bg-gray-200 px-2 py-0.5 rounded text-[10px]">{order.paymentMethod}</span>
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-gray-600">Update Payment Status:</label>
                      <select
                        value={order.paymentStatus}
                        onChange={(e) => handleUpdatePaymentStatusInModal(e.target.value as any)}
                        className="w-full p-2 rounded-xl border border-gray-300 bg-white font-bold"
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid (Cash / Wallet)</option>
                        <option value="verified">Verified by Finance</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Order Items Table & Financial Breakdown */}
              <div className="space-y-4 md:col-span-2">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
                  <div className="font-extrabold text-xs uppercase tracking-wider text-gray-500">Ordered Items List ({order.items.length})</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs divide-y divide-gray-100">
                      <thead>
                        <tr className="text-gray-500 font-bold uppercase text-[10px]">
                          <th className="py-2">Product</th>
                          <th className="py-2">Price</th>
                          <th className="py-2 text-center">Qty</th>
                          <th className="py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {order.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 flex items-center gap-2">
                              <img
                                src={item.productImage}
                                alt={item.productName}
                                className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                              />
                              <div>
                                <div className="font-bold text-gray-900">{item.productName}</div>
                                {item.sku && <div className="text-[10px] font-mono text-gray-500">SKU: {item.sku}</div>}
                              </div>
                            </td>
                            <td className="py-2.5 font-bold text-gray-700">NPR {item.price.toLocaleString()}</td>
                            <td className="py-2.5 text-center font-bold">{item.quantity}</td>
                            <td className="py-2.5 text-right font-black text-gray-900">NPR {(item.price * item.quantity).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-bold">NPR {order.subtotal.toLocaleString()}</span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Coupon Discount</span>
                      <span className="font-bold">- NPR {order.discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Shipping Fee</span>
                    <span className="font-bold">NPR {order.shippingFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT Tax</span>
                    <span className="font-bold">NPR {order.taxAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-gray-900 border-t border-gray-300 pt-2 mt-1">
                    <span>Total Amount Paid / Payable</span>
                    <span className="text-[#0056b3]">NPR {order.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: INTERNAL STAFF NOTES */}
          {modalActiveTab === 'notes' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-extrabold text-xs">Internal Confidential Staff Notes</div>
                  <p className="text-[11px] text-amber-800">
                    These notes are private to store staff (sales, delivery, and customer service) and are never displayed on the customer delivery tracking page.
                  </p>
                </div>
              </div>

              {/* New Staff Note Form */}
              <form onSubmit={handleAddStaffNote} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <div className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#0056b3]" />
                  <span>Add New Internal Staff Note</span>
                </div>
                <textarea
                  value={modalNewStaffNote}
                  onChange={(e) => setModalNewStaffNote(e.target.value)}
                  placeholder="Type private staff instructions or call summary (e.g., 'Customer requested call 30 mins prior to delivery. Address verified with landmark near Patan Hospital.')..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs focus:outline-none focus:border-[#0056b3]"
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-[#0056b3] hover:bg-[#004494] text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Save Internal Note</span>
                  </button>
                </div>
              </form>

              {/* Staff Notes History List */}
              <div className="space-y-3">
                <div className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">
                  Internal Staff Note Thread ({order.staffNotes?.length || 0})
                </div>

                {(!order.staffNotes || order.staffNotes.length === 0) ? (
                  <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                    No internal notes added for this order yet. Use the form above to add dispatch instructions or phone call notes.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {order.staffNotes.map((note) => (
                      <div key={note.id} className="bg-white p-4 rounded-2xl border border-gray-200 space-y-1 shadow-xs">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-gray-900">{note.author}</span>
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.2 rounded-full uppercase">
                              {note.role || 'Staff'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">{note.timestamp}</span>
                        </div>
                        <p className="text-gray-800 text-xs font-medium pt-1 leading-relaxed">
                          {note.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="bg-[#0056b3] text-white hover:bg-[#004494] font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Print Tax Invoice</span>
            </button>
            <button
              onClick={() => setWaybillOrder(order)}
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print Shipping Waybill</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="bg-gray-900 text-white font-bold text-xs px-5 py-2 rounded-xl hover:bg-black transition-colors"
          >
            Close Window
          </button>
        </div>

        {/* Official Tax Invoice Modal */}
        <InvoiceModal
          order={order}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
        />

      </div>
    </div>
  );
};

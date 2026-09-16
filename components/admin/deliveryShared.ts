// components/admin/deliveryShared.ts
//
// Types and helpers shared by the delivery module and its two modals.
//
// Declared outside `DeliveryModule.tsx` so `DispatchModal` and
// `TrackingTimelineModal` can import them without an import cycle.

import type { DeliveryRider, DeliveryZone, OrderStatus } from '@/types';

/** Where a shipment is in the courier handoff, independent of `OrderStatus`. */
export type ShipmentStatus =
  | 'pending_dispatch'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'returned';

/** Who is carrying the package — an internal rider or a 3PL account. */
export type CarrierKind = 'in_house' | 'third_party';

export interface ShipmentTrackingLog {
  id: string;
  status: ShipmentStatus;
  title: string;
  description: string;
  timestamp: string;
  location?: string;
  updatedBy?: string;
}

export interface Shipment {
  id: string;
  trackingCode: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  zoneLabel: string;
  address: string;
  carrierId: string;
  carrierName: string;
  carrierKind: CarrierKind;
  /** COD amount still to be collected. `0` for a prepaid order. */
  codAmount: number;
  status: ShipmentStatus;
  createdAt: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  attemptCount: number;
  trackingLogs: ShipmentTrackingLog[];
}

/**
 * A zone row as the console edits it.
 *
 * `DeliveryZone` in `types/index.ts` is what the seeded data and the storefront
 * share; the extra fields here are the ones only the tariff editor writes, kept
 * optional so existing rows keep rendering.
 */
export interface AdminDeliveryZone extends DeliveryZone {
  expressFee?: number;
  isActive?: boolean;
  municipalities?: string[];
}

/** An API-connected courier account (Pathao, NCM, CatchMe…). */
export interface ThirdPartyPartner {
  id: string;
  name: string;
  logoLabel: string;
  apiConnected: boolean;
  enabled: boolean;
  coverage: string;
  activeShipments: number;
  /** What the partner charges per package, before zone surcharges. */
  baseRate: number;
  lastSyncedAt?: string;
}

/** A rider's in-house profile plus the cash they are currently holding. */
export interface RiderProfile extends DeliveryRider {
  vehicleNumber?: string;
  cashInHand?: number;
  deliveriesToday?: number;
}

/** One line of the COD settlement sheet. */
export interface CodReconciliationRow {
  riderId: string;
  riderName: string;
  ordersDelivered: number;
  codCollected: number;
  /** What the admin has physically counted. Blank until they type it. */
  cashReceived: number | null;
  status: 'pending' | 'settled';
  settledAt?: string;
}

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending_dispatch: 'PENDING',
  dispatched: 'DISPATCHED',
  in_transit: 'IN TRANSIT',
  delivered: 'DELIVERED',
  failed: 'FAILED',
  returned: 'RETURNED',
};

export const SHIPMENT_STATUS_CLASS: Record<ShipmentStatus, string> = {
  pending_dispatch: 'bg-amber-100 text-amber-700',
  dispatched: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-blue-100 text-blue-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  returned: 'bg-rose-100 text-rose-700',
};

/** The order statuses that mean the package has left the building. */
export const IN_TRANSIT_ORDER_STATUSES: OrderStatus[] = ['shipped', 'out_for_delivery'];

export const npr = (value: number): string => `NPR ${Math.round(value).toLocaleString('en-IN')}`;

let trackingSeq = 4821;
/** `TRK-2026-4821` — the code printed on the courier label. */
export const genTrackingCode = (): string =>
  `TRK-${new Date().getFullYear()}-${trackingSeq++}`;

let shipmentSeq = 1;
export const genShipmentId = (): string => `SHP-${String(shipmentSeq++).padStart(4, '0')}`;

let logSeq = 1;
export const genLogId = (): string => `slog-${logSeq++}`;

export const nowStamp = (): string =>
  new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

'use client';

// components/admin/DeliveryModule.tsx
//
// Module 4 — delivery operations, split into the four things the fulfilment desk
// actually does: price a zone, dispatch a package, manage who carries it, and
// reconcile the cash that comes back.
//
// Shipments are *derived* from `orders` rather than copied into state, because
// orders arrive asynchronously and a `useState` snapshot taken on first render
// would freeze an empty board. Staff edits live in `shipmentOverrides`, keyed by
// order id, and are merged over the derived row — so a reassignment survives an
// orders refetch instead of being overwritten by it.

import React, { useEffect, useMemo, useState } from 'react';

import type { DeliveryRider, DeliveryZone, Order } from '@/types';

import { DispatchOrderModal } from './DispatchOrderModal';
import { TrackingTimelineModal } from './TrackingTimelineModal';
import { ZoneFareModal } from './ZoneFareModal';
import {
  SHIPMENT_STATUS_CLASS,
  SHIPMENT_STATUS_LABEL,
  genLogId,
  genTrackingCode,
  nowStamp,
  npr,
  type AdminDeliveryZone,
  type CarrierKind,
  type CodReconciliationRow,
  type RiderProfile,
  type Shipment,
  type ShipmentStatus,
  type ShipmentTrackingLog,
  type ThirdPartyPartner,
} from './deliveryShared';
import {
  calculateShippingCost,
  formatCodChargeLabel,
  type TariffRule,
} from '@/lib/delivery/tariff';

import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Bike,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Copy,
  Edit3,
  Landmark,
  Link2,
  MapPin,
  MessageSquare,
  MoreVertical,
  Package,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Truck,
  Wallet,
  X,
  Zap,
} from 'lucide-react';

export interface DeliveryModuleProps {
  deliveryZones: DeliveryZone[];
  riders: DeliveryRider[];
  orders: Order[];
  /** Appends to the console's audit trail. Optional so the module can render standalone. */
  logAuditAction?: (module: string, action: string, details: string) => void;
}

type DeliveryTab = 'zones' | 'dispatch' | 'carriers' | 'cod';

/**
 * Vehicle and cash figures the rider roster shows.
 *
 * `DeliveryRider` in the seeded data has no vehicle or float, and those come
 * from `delivery_partners` columns that do not exist yet — so they are attached
 * here by id and marked clearly as demo values in the UI.
 */
const RIDER_DETAILS: Record<string, { vehicleNumber: string; cashInHand: number; deliveriesToday: number }> = {
  'rider-1': { vehicleNumber: 'BA 12 PA 4821', cashInHand: 48200, deliveriesToday: 6 },
  'rider-2': { vehicleNumber: 'BA 24 PA 1190', cashInHand: 61500, deliveriesToday: 9 },
  'rider-3': { vehicleNumber: 'GA 2 PA 7734', cashInHand: 35500, deliveriesToday: 4 },
};

const INITIAL_PARTNERS: ThirdPartyPartner[] = [
  {
    id: '3pl-pathao',
    name: 'Pathao Courier',
    logoLabel: 'PT',
    apiConnected: true,
    enabled: true,
    coverage: 'Kailali Valley · Dhangadhi · Chitwan',
    activeShipments: 14,
    baseRate: 130,
    lastSyncedAt: '2 min ago',
  },
  {
    id: '3pl-ncm',
    name: 'Nepal Can Move (NCM)',
    logoLabel: 'NCM',
    apiConnected: true,
    enabled: true,
    coverage: 'All 7 provinces · 240+ branches',
    activeShipments: 31,
    baseRate: 110,
    lastSyncedAt: '11 min ago',
  },
  {
    id: '3pl-catchme',
    name: 'CatchMe Logistics',
    logoLabel: 'CM',
    apiConnected: false,
    enabled: false,
    coverage: 'Bagmati · Gandaki',
    activeShipments: 0,
    baseRate: 145,
  },
  {
    id: '3pl-aramex',
    name: 'Aramex Nepal',
    logoLabel: 'AX',
    apiConnected: false,
    enabled: false,
    coverage: 'International outbound',
    activeShipments: 0,
    baseRate: 950,
  },
];

const NEPAL_PROVINCES = [
  'Koshi',
  'Madhesh',
  'Bagmati',
  'Gandaki',
  'Lumbini',
  'Karnali',
  'Sudurpashchim',
];

/** Order statuses that have not yet left the store. */
const PRE_DISPATCH: Order['status'][] = ['placed', 'confirmed', 'processing', 'packed'];

/**
 * Maps an order's lifecycle onto the courier handoff the board cares about.
 *
 * A cancelled order is filtered off the board before this runs — cancelling is
 * not a delivery failure, so `failed` and `returned` are only ever reached by a
 * staff member recording them against a package that actually went out.
 */
const shipmentStatusFromOrder = (status: Order['status']): ShipmentStatus => {
  if (PRE_DISPATCH.includes(status)) return 'pending_dispatch';
  if (status === 'shipped') return 'dispatched';
  if (status === 'out_for_delivery') return 'in_transit';
  if (status === 'delivered') return 'delivered';
  return 'failed';
};

export const DeliveryModule: React.FC<DeliveryModuleProps> = ({
  deliveryZones,
  riders,
  orders,
  logAuditAction,
}) => {
  const [activeTab, setActiveTab] = useState<DeliveryTab>('zones');
  const [databaseRiders, setDatabaseRiders] = useState<DeliveryRider[]>([]);
  const [routeIds, setRouteIds] = useState<Record<string, number>>({});

  // ---- Zones ---------------------------------------------------------------
  /** Zones added in this session. Kept apart from the prop so a refetch cannot drop them. */
  const [addedZones, setAddedZones] = useState<AdminDeliveryZone[]>([]);
  /** Overrides for existing/seeded zones edited in this session. */
  const [zoneOverrides, setZoneOverrides] = useState<Record<string, Partial<AdminDeliveryZone>>>({});
  /**
   * Enable/disable state by zone id.
   *
   * Held as a flag map rather than mutating the row so a disabled zone keeps its
   * historical tariff entries intact — disabling is not deleting.
   */
  const [zoneEnabled, setZoneEnabled] = useState<Record<string, boolean>>({});
  const [isZoneModalOpen, setZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<AdminDeliveryZone | null>(null);

  // Inline editing state for quick row edits
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineForm, setInlineForm] = useState<{
    fee: number;
    additionalPerKgRate: number;
    freeShippingThreshold: number;
    codAvailable: boolean;
    remoteSurcharge: number;
  }>({
    fee: 100,
    additionalPerKgRate: 30,
    freeShippingThreshold: 5000,
    codAvailable: true,
    remoteSurcharge: 0,
  });
  const [zoneActionMenuId, setZoneActionMenuId] = useState<string | null>(null);
  const [isQuickTesterOpen, setIsQuickTesterOpen] = useState(false);

  // Standalone tester inputs:
  const [testerZoneId, setTesterZoneId] = useState<string>('');
  const [testerWeightKg, setTesterWeightKg] = useState('2.5');
  const [testerDimensions, setTesterDimensions] = useState({ l: 30, w: 20, h: 15 });
  const [testerOrderVal, setTesterOrderVal] = useState('2500');
  const [testerIsCod, setTesterIsCod] = useState(true);
  const [testerIsRemote, setTesterIsRemote] = useState(false);

  // ---- Dispatch board -----------------------------------------------------
  const [shipmentOverrides, setShipmentOverrides] = useState<Record<string, Partial<Shipment>>>({});
  const [dispatchTarget, setDispatchTarget] = useState<Shipment | null>(null);
  const [timelineTarget, setTimelineTarget] = useState<Shipment | null>(null);
  const [boardSearch, setBoardSearch] = useState('');
  const [boardFilter, setBoardFilter] = useState<'all' | ShipmentStatus>('all');

  // ---- Carriers -----------------------------------------------------------
  const [partners, setPartners] = useState<ThirdPartyPartner[]>(INITIAL_PARTNERS);

  // ---- COD reconciliation -------------------------------------------------
  const [cashReceived, setCashReceived] = useState<Record<string, string>>({});
  const [settled, setSettled] = useState<Record<string, { amount: number; at: string }>>({});

  const zones: AdminDeliveryZone[] = useMemo(() => {
    const combined = [...deliveryZones, ...addedZones];
    return combined.map((z) => ({
      ...z,
      ...(zoneOverrides[z.id] ?? {}),
    }));
  }, [deliveryZones, addedZones, zoneOverrides]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch('/api/users?role=delivery_driver&limit=100')
        .then((response) => response.ok ? response.json() : Promise.reject())
        .then((data) => setDatabaseRiders((data.users ?? []).map((user: { id: number; name: string; phone?: string; isActive: boolean }) => ({
          id: String(user.id), name: user.name, phone: user.phone ?? '', type: 'in_house' as const,
          activeDeliveries: 0, status: user.isActive ? 'active' as const : 'inactive' as const,
        }))))
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const riderProfiles: RiderProfile[] = useMemo(
    () =>
      (databaseRiders.length > 0 ? databaseRiders : riders).map((r) => ({
        ...r,
        ...(RIDER_DETAILS[r.id] ?? {}),
      })),
    [databaseRiders, riders],
  );

  const inHouseRiders = useMemo(
    () => riderProfiles.filter((r) => r.type === 'in_house'),
    [riderProfiles],
  );

  /** Every order that belongs on the delivery board, as a shipment row. */
  const shipments: Shipment[] = useMemo(() => {
    return orders
      // A cancelled order is not a shipment — unless it was already worked on
      // here, in which case dropping it would lose the trail staff created.
      .filter((o) => o.status !== 'cancelled' || shipmentOverrides[o.id])
      .map<Shipment>((order) => {
        const override = shipmentOverrides[order.id] ?? {};
        const addr = order.shippingAddress;
        const zoneLabel =
          [addr.district, addr.province].filter(Boolean).join(' · ') ||
          addr.municipality ||
          'Unzoned';

        const base: Shipment = {
          id: order.id,
          trackingCode: '',
          orderId: order.id,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          zoneLabel,
          address: [
            addr.addressLine,
            addr.ward ? `Ward ${addr.ward}` : '',
            addr.municipality,
            addr.district,
          ]
            .filter(Boolean)
            .join(', '),
          carrierId: order.assignedRiderId ?? '',
          carrierName: order.assignedRiderName ?? '',
          carrierKind: 'in_house',
          codAmount:
            order.paymentMethod === 'cod' && order.paymentStatus !== 'paid'
              ? order.totalAmount
              : 0,
          status: shipmentStatusFromOrder(order.status),
          createdAt: order.createdAt,
          attemptCount: 1,
          trackingLogs: [],
        };

        return { ...base, ...override };
      });
  }, [orders, shipmentOverrides]);

  const boardMetrics = useMemo(() => {
    const today = new Date().toDateString();
    return {
      pendingDispatch: shipments.filter((s) => s.status === 'pending_dispatch').length,
      outForDelivery: shipments.filter(
        (s) => s.status === 'dispatched' || s.status === 'in_transit',
      ).length,
      deliveredToday: shipments.filter(
        (s) =>
          s.status === 'delivered' &&
          (s.deliveredAt ? new Date(s.deliveredAt).toDateString() === today : true),
      ).length,
      failed: shipments.filter((s) => s.status === 'failed' || s.status === 'returned').length,
    };
  }, [shipments]);

  const visibleShipments = useMemo(() => {
    let list = shipments;

    if (boardFilter !== 'all') {
      list = list.filter((s) => s.status === boardFilter);
    }

    if (boardSearch.trim()) {
      const q = boardSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.orderId.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.trackingCode.toLowerCase().includes(q) ||
          s.customerPhone.includes(q),
      );
    }

    // Pending first — that is the queue staff work through.
    const rank: Record<ShipmentStatus, number> = {
      pending_dispatch: 0,
      dispatched: 1,
      in_transit: 2,
      failed: 3,
      returned: 4,
      delivered: 5,
    };
    return [...list].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [shipments, boardFilter, boardSearch]);

  /** COD sheet, grouped by the in-house rider who collected the cash. */
  const codRows: CodReconciliationRow[] = useMemo(() => {
    const byRider: Record<string, CodReconciliationRow> = {};

    inHouseRiders.forEach((r) => {
      byRider[r.id] = {
        riderId: r.id,
        riderName: r.name,
        ordersDelivered: 0,
        codCollected: 0,
        cashReceived: null,
        status: settled[r.id] ? 'settled' : 'pending',
        settledAt: settled[r.id]?.at,
      };
    });

    shipments
      .filter((s) => s.status === 'delivered' && s.codAmount > 0 && s.carrierKind === 'in_house')
      .forEach((s) => {
        const row = byRider[s.carrierId];
        if (!row) return;
        row.ordersDelivered += 1;
        row.codCollected += s.codAmount;
      });

    // Riders carry a float from earlier runs; fold it in so the sheet is not
    // empty before this session's first delivery lands.
    inHouseRiders.forEach((r) => {
      const row = byRider[r.id];
      if (row && row.codCollected === 0 && r.cashInHand) {
        row.codCollected = r.cashInHand;
        row.ordersDelivered = r.deliveriesToday ?? 0;
      }
    });

    return Object.values(byRider);
  }, [inHouseRiders, shipments, settled]);

  const codTotals = useMemo(() => {
    const uncollected = codRows
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + r.codCollected, 0);
    const settledToday = Object.values(settled).reduce((sum, s) => sum + s.amount, 0);
    return {
      uncollected,
      pendingDeposit: settledToday,
      settledToday,
    };
  }, [codRows, settled]);

  // ---- Mutations ----------------------------------------------------------

  const pushLog = (
    shipment: Shipment,
    status: ShipmentStatus,
    title: string,
    description: string,
  ): ShipmentTrackingLog[] => {
    const entry: ShipmentTrackingLog = {
      id: genLogId(),
      status,
      title,
      description,
      timestamp: nowStamp(),
      location: shipment.zoneLabel,
      updatedBy: 'Admin (System Owner)',
    };
    return [entry, ...shipment.trackingLogs];
  };

  const patchShipment = (id: string, patch: Partial<Shipment>) => {
    setShipmentOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), ...patch },
    }));
  };

  const handleDispatch = async ({
    shipmentId,
    carrierId,
    carrierName,
    carrierKind,
    trackingCode,
    note,
  }: {
    shipmentId: string;
    carrierId: string;
    carrierName: string;
    carrierKind: CarrierKind;
    trackingCode: string;
    note: string;
  }) => {
    const shipment = shipments.find((s) => s.id === shipmentId);
    if (!shipment) return;

    const driverId = Number(carrierId);
    if (carrierKind !== 'in_house' || !Number.isInteger(driverId)) return;
    const orderResponse = await fetch(`/api/orders?orderNumber=${encodeURIComponent(shipment.orderId)}`);
    if (!orderResponse.ok) return;
    const orderRecord = await orderResponse.json();
    const routeResponse = await fetch('/api/driver/deliveries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderRecord.id, driverId }),
    });
    if (!routeResponse.ok) return;
    const routeResult = await routeResponse.json();
    setRouteIds((current) => ({ ...current, [shipmentId]: routeResult.route.id }));

    const code = trackingCode || genTrackingCode();
    patchShipment(shipmentId, {
      carrierId,
      carrierName,
      carrierKind,
      trackingCode: code,
      status: 'dispatched',
      dispatchedAt: new Date().toISOString(),
      trackingLogs: pushLog(
        shipment,
        'dispatched',
        'Dispatched to carrier',
        note
          ? `Handed to ${carrierName}. Note: ${note}`
          : `Handed to ${carrierName}. Tracking ${code}.`,
      ),
    });

    logAuditAction?.(
      'Delivery',
      'Dispatch Shipment',
      `Order ${shipment.orderId} dispatched via ${carrierName} (${code}).`,
    );
    setDispatchTarget(null);
  };

  const handleReassign = (shipment: Shipment, value: string) => {
    if (!value) return;
    const [kind, id] = value.split(':') as [CarrierKind, string];
    const carrierName =
      kind === 'in_house'
        ? riderProfiles.find((r) => r.id === id)?.name ?? 'Unknown rider'
        : partners.find((p) => p.id === id)?.name ?? 'Unknown partner';

    patchShipment(shipment.id, {
      carrierId: id,
      carrierName,
      carrierKind: kind,
      trackingLogs: pushLog(
        shipment,
        shipment.status,
        'Carrier reassigned',
        `Reassigned to ${carrierName}.`,
      ),
    });

    logAuditAction?.(
      'Delivery',
      'Reassign Carrier',
      `Order ${shipment.orderId} reassigned to ${carrierName}.`,
    );
  };

  const handleUpdateStatus = async (shipmentId: string, status: ShipmentStatus, reason?: string) => {
    const shipment = shipments.find((s) => s.id === shipmentId);
    if (!shipment) return;

    const routeId = routeIds[shipmentId];
    const persistedStatus = status === 'dispatched' ? 'picked_up' : status === 'returned' ? 'failed' : status === 'pending_dispatch' ? 'assigned' : status;
    if (routeId) {
      const response = await fetch('/api/driver/deliveries/update-status', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, status: persistedStatus, notes: reason, failureReason: status === 'failed' || status === 'returned' ? reason : undefined }),
      });
      if (!response.ok) return;
    }

    const titles: Record<ShipmentStatus, string> = {
      pending_dispatch: 'Returned to dispatch queue',
      dispatched: 'Dispatched to carrier',
      in_transit: 'Out for delivery',
      delivered: 'Delivered to customer',
      failed: 'Delivery attempt failed',
      returned: 'Returned to store',
    };

    patchShipment(shipmentId, {
      status,
      failureReason: reason,
      deliveredAt: status === 'delivered' ? new Date().toISOString() : shipment.deliveredAt,
      attemptCount:
        status === 'failed' ? shipment.attemptCount + 1 : shipment.attemptCount,
      trackingLogs: pushLog(
        shipment,
        status,
        titles[status],
        reason ??
        (status === 'delivered' && shipment.codAmount > 0
          ? `COD of ${npr(shipment.codAmount)} collected by ${shipment.carrierName}.`
          : `Status moved to ${SHIPMENT_STATUS_LABEL[status]}.`),
      ),
    });

    logAuditAction?.(
      'Delivery',
      'Update Shipment Status',
      `Order ${shipment.orderId} → ${SHIPMENT_STATUS_LABEL[status]}${reason ? ` (${reason})` : ''}.`,
    );

    // Keep the open timeline in sync with what was just written.
    setTimelineTarget((prev) => (prev && prev.id === shipmentId ? { ...prev, status } : prev));
  };

  const handlePrintLabel = (shipment: Shipment) => {
    const win = window.open('', '_blank', 'width=420,height=620');
    if (!win) return;
    win.document.write(`
      <html><head><title>Label ${shipment.trackingCode}</title>
      <style>
        body{font-family:ui-monospace,monospace;padding:18px;color:#111}
        h1{font-size:15px;margin:0 0 4px}
        .code{font-size:20px;font-weight:800;letter-spacing:1px;margin:10px 0}
        .box{border:2px solid #111;border-radius:8px;padding:12px;margin-top:10px}
        .row{display:flex;justify-content:space-between;font-size:12px;margin:3px 0}
        .cod{margin-top:10px;padding:8px;border:2px dashed #111;text-align:center;font-weight:800}
      </style></head><body>
      <h1>ICE Computers &amp; Electronics</h1>
      <div style="font-size:11px">Courier Label · ${shipment.zoneLabel}</div>
      <div class="code">${shipment.trackingCode || 'UNASSIGNED'}</div>
      <div class="box">
        <div class="row"><b>Order</b><span>${shipment.orderId}</span></div>
        <div class="row"><b>To</b><span>${shipment.customerName}</span></div>
        <div class="row"><b>Phone</b><span>${shipment.customerPhone}</span></div>
        <div class="row"><b>Carrier</b><span>${shipment.carrierName || 'Unassigned'}</span></div>
        <div style="font-size:12px;margin-top:8px">${shipment.address}</div>
      </div>
      <div class="cod">${shipment.codAmount > 0 ? `COLLECT COD: ${npr(shipment.codAmount)}` : 'PREPAID — DO NOT COLLECT'}</div>
      </body></html>
    `);
    win.document.close();
    win.print();
    logAuditAction?.('Delivery', 'Print Label', `Printed courier label for ${shipment.orderId}.`);
  };

  const handleSendSms = (shipment: Shipment) => {
    // No SMS gateway is wired yet, so this records intent rather than pretending
    // a message went out.
    alert(
      `SMS queued for ${shipment.customerPhone}:\n\n"Your ICE order ${shipment.orderId} is ${SHIPMENT_STATUS_LABEL[shipment.status]}. Track: ${shipment.trackingCode || 'pending'}"\n\n(No SMS gateway is connected yet — this is recorded in the audit trail only.)`,
    );
    logAuditAction?.(
      'Delivery',
      'Send SMS',
      `Queued status SMS to ${shipment.customerPhone} for ${shipment.orderId}.`,
    );
  };

  const handleTogglePartner = (id: string) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        // A partner with no API credentials cannot be switched on from here.
        if (!p.apiConnected && !p.enabled) {
          alert(`${p.name} has no API credentials configured. Add them in Settings → Integrations first.`);
          return p;
        }
        logAuditAction?.(
          'Delivery',
          p.enabled ? 'Disable 3PL Partner' : 'Enable 3PL Partner',
          `${p.name} ${p.enabled ? 'disabled' : 'enabled'} for dispatch.`,
        );
        return { ...p, enabled: !p.enabled };
      }),
    );
  };

  const handleSettleCash = (row: CodReconciliationRow) => {
    const received = Number(cashReceived[row.riderId] ?? 0);
    const discrepancy = received - row.codCollected;

    const message =
      discrepancy === 0
        ? `Settle ${npr(received)} from ${row.riderName}?`
        : `Settle ${npr(received)} from ${row.riderName}?\n\nDiscrepancy: ${discrepancy > 0 ? '+' : ''}${npr(discrepancy)} (${discrepancy < 0 ? 'shortage' : 'excess'}) will be posted to the ledger.`;

    if (!confirm(message)) return;

    setSettled((prev) => ({
      ...prev,
      [row.riderId]: { amount: received, at: nowStamp() },
    }));

    logAuditAction?.(
      'Delivery',
      'COD Cash Settlement',
      `Settled ${npr(received)} from ${row.riderName} against ${npr(row.codCollected)} collected (${row.ordersDelivered} orders). Discrepancy ${npr(discrepancy)}. Journal: Dr Cash/Bank, Cr Rider Receivable.`,
    );
  };

  const handleOpenAddModal = () => {
    setEditingZone(null);
    setZoneModalOpen(true);
  };

  const handleOpenEditModal = (zone: AdminDeliveryZone) => {
    setEditingZone(zone);
    setZoneModalOpen(true);
    setZoneActionMenuId(null);
  };

  const handleSaveZone = async (zone: AdminDeliveryZone) => {
    const isExisting = zones.some((z) => z.id === zone.id);
    if (isExisting) {
      setZoneOverrides((prev) => ({
        ...prev,
        [zone.id]: { ...(prev[zone.id] ?? {}), ...zone },
      }));

      const zoneId = Number(zone.id);
      if (Number.isInteger(zoneId)) {
        await fetch(`/api/delivery-zones/${zoneId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${zone.province} · ${zone.district}`,
            provinces: zone.province.toLowerCase(),
            districts: zone.district.trim().toLowerCase(),
            municipalities: zone.municipalities?.join(',').toLowerCase(),
            flatFee: zone.fee,
            estimatedDays: Number.parseInt(zone.etaDays, 10) || 1,
            isActive: zone.isActive ?? true,
          }),
        }).catch(() => undefined);
      }

      logAuditAction?.(
        'Delivery',
        'Update Delivery Zone Tariff',
        `Updated zone ${zone.province} · ${zone.district} (Base: ${npr(zone.fee)}, +${npr(zone.additionalPerKgRate ?? 0)}/kg).`,
      );
    } else {
      const response = await fetch('/api/delivery-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${zone.province} · ${zone.district}`,
          provinces: zone.province.toLowerCase(),
          districts: zone.district.trim().toLowerCase(),
          municipalities: zone.municipalities?.join(',').toLowerCase(),
          flatFee: zone.fee,
          estimatedDays: Number.parseInt(zone.etaDays, 10) || 1,
          isActive: true,
        }),
      });

      let savedId = zone.id;
      if (response.ok) {
        const result = await response.json();
        if (result?.zone?.id) savedId = String(result.zone.id);
      }
      const saved = { ...zone, id: savedId };
      setAddedZones((prev) => [...prev, saved]);
      setZoneEnabled((prev) => ({ ...prev, [saved.id]: true }));
      logAuditAction?.(
        'Delivery',
        'Add Delivery Zone',
        `Added zone ${zone.province} · ${zone.district} at ${npr(zone.fee)} standard (+${npr(zone.additionalPerKgRate ?? 0)}/kg).`,
      );
    }

    setZoneModalOpen(false);
    setEditingZone(null);
  };

  const handleStartInlineEdit = (zone: AdminDeliveryZone) => {
    setInlineEditingId(zone.id);
    setInlineForm({
      fee: zone.fee ?? zone.baseRate ?? 100,
      additionalPerKgRate: zone.additionalPerKgRate ?? 30,
      freeShippingThreshold: zone.freeShippingThreshold ?? 5000,
      codAvailable: zone.codAvailable ?? true,
      remoteSurcharge: zone.remoteSurcharge ?? 0,
    });
    setZoneActionMenuId(null);
  };

  const handleSaveInlineEdit = async (zoneId: string) => {
    setZoneOverrides((prev) => ({
      ...prev,
      [zoneId]: {
        ...(prev[zoneId] ?? {}),
        fee: inlineForm.fee,
        baseRate: inlineForm.fee,
        additionalPerKgRate: inlineForm.additionalPerKgRate,
        freeShippingThreshold: inlineForm.freeShippingThreshold,
        codAvailable: inlineForm.codAvailable,
        remoteSurcharge: inlineForm.remoteSurcharge,
      },
    }));

    const numId = Number(zoneId);
    if (Number.isInteger(numId)) {
      await fetch(`/api/delivery-zones/${numId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flatFee: inlineForm.fee,
        }),
      }).catch(() => undefined);
    }

    logAuditAction?.(
      'Delivery',
      'Inline Edit Zone Rates',
      `Inline updated zone rates for ${zoneId}: Base ${npr(inlineForm.fee)}, +${npr(inlineForm.additionalPerKgRate)}/kg.`,
    );
    setInlineEditingId(null);
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingId(null);
  };

  const handleDuplicateZone = (zone: AdminDeliveryZone) => {
    const copy: AdminDeliveryZone = {
      ...zone,
      id: `zone-copy-${Date.now()}`,
      district: `${zone.district} (Area B)`,
      municipality: zone.municipality,
      municipalities: zone.municipalities ? [...zone.municipalities] : [],
    };
    setEditingZone(copy);
    setZoneModalOpen(true);
    setZoneActionMenuId(null);
  };

  const toggleZone = async (zone: AdminDeliveryZone) => {
    const current = zoneEnabled[zone.id] ?? zone.isActive ?? true;
    const zoneId = Number(zone.id);
    if (Number.isInteger(zoneId)) {
      const response = await fetch(`/api/delivery-zones/${zoneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      });
      if (!response.ok) return;
    }
    setZoneEnabled((prev) => ({ ...prev, [zone.id]: !current }));
    logAuditAction?.(
      'Delivery',
      current ? 'Disable Delivery Zone' : 'Enable Delivery Zone',
      `${zone.province} · ${zone.district} ${current ? 'disabled' : 'enabled'}. Historical tariffs retained.`,
    );
  };

  // Quick Standalone Rate Calculator calculation for current selected test zone
  const activeTesterZone = useMemo(() => {
    return zones.find((z) => z.id === testerZoneId) || zones[0];
  }, [zones, testerZoneId]);

  const quickSimResult = useMemo(() => {
    if (!activeTesterZone) return null;
    const rule: TariffRule = {
      baseWeightKg: activeTesterZone.baseWeightKg ?? 1.0,
      baseRate: activeTesterZone.fee ?? activeTesterZone.baseRate ?? 100,
      additionalPerKgRate: activeTesterZone.additionalPerKgRate ?? 30,
      volumetricDivisor: activeTesterZone.volumetricDivisor ?? 5000,
      codPercent: activeTesterZone.codFeePercent ?? 0,
      codFlatFee: activeTesterZone.codFeeFlat ?? 0,
      freeShippingThreshold: activeTesterZone.freeShippingThreshold ?? 5000,
      remoteSurcharge: activeTesterZone.remoteSurcharge ?? 0,
    };
    return calculateShippingCost(
      Number(testerOrderVal) || 0,
      Number(testerWeightKg) || 0,
      testerDimensions,
      activeTesterZone.codAvailable && testerIsCod,
      testerIsRemote || Boolean(activeTesterZone.isRemoteArea),
      rule,
    );
  }, [activeTesterZone, testerOrderVal, testerWeightKg, testerDimensions, testerIsCod, testerIsRemote]);

  const tabs: { id: DeliveryTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'zones', label: 'Shipping Zones', icon: <MapPin className="w-4 h-4" />, badge: zones.length },
    {
      id: 'dispatch',
      label: 'Dispatch & Tracking',
      icon: <Truck className="w-4 h-4" />,
      badge: boardMetrics.pendingDispatch,
    },
    { id: 'carriers', label: 'Riders & 3PL', icon: <Bike className="w-4 h-4" /> },
    { id: 'cod', label: 'COD Reconciliation', icon: <Wallet className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#12151C]">Delivery Operations</h2>
          <p className="text-xs text-[#6B7280] mt-1">
            Zones and tariffs, dispatch board, carrier fleet, and rider cash settlement
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E6E8EE] pb-3 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors font-bold text-xs whitespace-nowrap ${activeTab === tab.id
              ? 'bg-[#4C63FF] text-white border-[#4C63FF]'
              : 'bg-white text-[#6B7280] border-[#E6E8EE] hover:bg-[#F4F5F8]'
              }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-white/20' : 'bg-[#F4F5F8] text-[#6B7280]'
                  }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============== TAB 1 · SHIPPING ZONES ============== */}
      {activeTab === 'zones' && (
        <div className="bg-white rounded-2xl border border-[#E6E8EE] p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6E8EE] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#12151C]">Nepal Shipping Zones &amp; Tariff Rates</h3>
                <span className="text-[10px] bg-[#EEF2FF] text-[#4C63FF] border border-[#C7D2FE] px-2 py-0.5 rounded-full font-bold">
                  Weight &amp; Volumetric V2
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Double-click any row to inline-edit rates or click <span className="font-semibold text-[#4C63FF]">Edit</span> for advanced multi-tier volumetric &amp; surcharge calculation.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setIsQuickTesterOpen(!isQuickTesterOpen)}
                className={`text-xs font-bold py-2 px-3 rounded-xl border flex items-center gap-1.5 transition-colors ${
                  isQuickTesterOpen
                    ? 'bg-[#1E2433] text-white border-[#1E2433]'
                    : 'bg-white text-[#12151C] border-[#E6E8EE] hover:bg-[#F4F5F8]'
                }`}
              >
                <Calculator className="w-3.5 h-3.5 text-[#4C63FF]" />
                {isQuickTesterOpen ? 'Hide Fare Tester' : 'Live Fare Tester'}
              </button>
              <button
                onClick={handleOpenAddModal}
                className="bg-[#4C63FF] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 hover:bg-[#3D52CC] transition-colors shadow-sm shadow-[#4C63FF]/30"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Delivery Zone
              </button>
            </div>
          </div>

          {/* Expandable Quick Live Fare Tester Widget */}
          {isQuickTesterOpen && (
            <div className="bg-gradient-to-br from-[#1A1F2C] to-[#12151C] text-white p-4 rounded-2xl border border-gray-700 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#8C9CFF]" />
                  <span className="text-xs font-bold">Quick Tariff &amp; Weight Simulator</span>
                </div>
                <span className="text-[10px] text-gray-300 font-mono">
                  Volumetric: (L × W × H) / 5000
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                <div>
                  <label className="block text-[10px] text-gray-300 font-semibold mb-1">Target Zone</label>
                  <select
                    value={testerZoneId || activeTesterZone?.id}
                    onChange={(e) => setTesterZoneId(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-1.5 px-2 text-white text-xs outline-none focus:bg-white/20"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id} className="text-[#12151C]">
                        {z.province} · {z.district}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-300 font-semibold mb-1">Order Value (NPR)</label>
                  <input
                    type="number"
                    value={testerOrderVal}
                    onChange={(e) => setTesterOrderVal(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-1.5 px-2 text-white font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-300 font-semibold mb-1">Actual Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testerWeightKg}
                    onChange={(e) => setTesterWeightKg(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-1.5 px-2 text-white font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-300 font-semibold mb-1">L × W × H (cm)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={testerDimensions.l}
                      onChange={(e) =>
                        setTesterDimensions({ ...testerDimensions, l: Number(e.target.value) || 0 })
                      }
                      className="w-full bg-white/10 border border-white/20 rounded-lg py-1 px-1.5 text-center text-white text-xs"
                      title="Length"
                    />
                    <span className="text-gray-400">×</span>
                    <input
                      type="number"
                      value={testerDimensions.w}
                      onChange={(e) =>
                        setTesterDimensions({ ...testerDimensions, w: Number(e.target.value) || 0 })
                      }
                      className="w-full bg-white/10 border border-white/20 rounded-lg py-1 px-1.5 text-center text-white text-xs"
                      title="Width"
                    />
                    <span className="text-gray-400">×</span>
                    <input
                      type="number"
                      value={testerDimensions.h}
                      onChange={(e) =>
                        setTesterDimensions({ ...testerDimensions, h: Number(e.target.value) || 0 })
                      }
                      className="w-full bg-white/10 border border-white/20 rounded-lg py-1 px-1.5 text-center text-white text-xs"
                      title="Height"
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-gray-300">
                    <input
                      type="checkbox"
                      checked={testerIsCod}
                      onChange={(e) => setTesterIsCod(e.target.checked)}
                      className="rounded text-[#4C63FF]"
                    />
                    <span>COD Order</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-gray-300 mt-1">
                    <input
                      type="checkbox"
                      checked={testerIsRemote}
                      onChange={(e) => setTesterIsRemote(e.target.checked)}
                      className="rounded text-[#4C63FF]"
                    />
                    <span>Remote Surcharge</span>
                  </label>
                </div>

                {quickSimResult && (
                  <div className="bg-white/10 rounded-xl p-2.5 flex flex-col justify-center text-right border border-white/10">
                    <span className="text-[10px] text-gray-400">
                      Chargeable: {quickSimResult.chargeableWeightKg}kg {quickSimResult.isVolumetricApplied ? '(Vol)' : '(Act)'}
                    </span>
                    <span className="text-sm font-black text-emerald-400">
                      {quickSimResult.isFreeShipping ? 'FREE SHIPPING' : npr(quickSimResult.totalDeliveryCharge)}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      Freight: {npr(quickSimResult.freightFee)} + COD: {npr(quickSimResult.codFee)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Redesigned Shipping Zones Table */}
          <div className="overflow-x-auto border border-[#E6E8EE] rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E6E8EE] text-[#475467] uppercase font-bold bg-[#F8FAFC] text-[11px] tracking-wide">
                  <th className="py-3 px-3.5">Province &amp; District</th>
                  <th className="py-3 px-3.5">Covered Areas</th>
                  <th className="py-3 px-3.5">Base Fare (Up to 1kg)</th>
                  <th className="py-3 px-3.5">Add. Per Kg</th>
                  <th className="py-3 px-3.5">COD Charge</th>
                  <th className="py-3 px-3.5">Free Shipping</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3F9]">
                {zones.map((z) => {
                  const enabled = zoneEnabled[z.id] ?? z.isActive ?? true;
                  const isInline = inlineEditingId === z.id;
                  const isMenuOpen = zoneActionMenuId === z.id;
                  const baseWeight = z.baseWeightKg ?? 1.0;
                  const addPerKg = z.additionalPerKgRate ?? 30;
                  const codRuleLabel = formatCodChargeLabel(z.codAvailable, z.codFeeFlat, z.codFeePercent);

                  return (
                    <tr
                      key={z.id}
                      onDoubleClick={() => {
                        if (!isInline) handleStartInlineEdit(z);
                      }}
                      className={`transition-colors group ${
                        isInline ? 'bg-[#EEF2FF]/60' : !enabled ? 'opacity-50 hover:bg-[#F8FAFC]' : 'hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {/* Column 1: Province & District */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-[#12151C] flex items-center gap-1.5">
                          <span>
                            {z.province} · {z.district}
                          </span>
                          {z.isRemoteArea && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              Remote
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#6B7280] mt-0.5 flex items-center gap-2">
                          <span>ETA: {z.etaDays}</span>
                          {z.hubBranch && <span className="text-[#9AA1AF]">· {z.hubBranch}</span>}
                        </div>
                      </td>

                      {/* Column 2: Covered Areas */}
                      <td className="py-3 px-3.5 text-[#475467] max-w-[220px]">
                        <div className="truncate font-medium text-[11px]" title={z.municipalities?.join(', ') || z.municipality}>
                          {z.municipalities?.length ? z.municipalities.join(', ') : z.municipality}
                        </div>
                        {z.municipalities && z.municipalities.length > 2 && (
                          <span className="text-[10px] text-[#4C63FF] font-semibold">
                            {z.municipalities.length} coverage hubs
                          </span>
                        )}
                      </td>

                      {/* Column 3: Base Fare (Up to 1kg) */}
                      <td className="py-3 px-3.5">
                        {isInline ? (
                          <div className="w-24">
                            <input
                              type="number"
                              min="0"
                              value={inlineForm.fee}
                              onChange={(e) =>
                                setInlineForm({ ...inlineForm, fee: Number(e.target.value) || 0 })
                              }
                              className="w-full bg-white border border-[#4C63FF] rounded-lg py-1 px-2 text-xs font-bold text-[#4C63FF] outline-none"
                            />
                            <span className="text-[9px] text-[#6B7280] block mt-0.5">Up to {baseWeight}kg</span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-sm text-[#4C63FF]">{npr(z.fee)}</span>
                            <span className="text-[10px] text-[#6B7280] block">
                              Base (upto {baseWeight}kg)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Add. Per Kg */}
                      <td className="py-3 px-3.5">
                        {isInline ? (
                          <div className="w-24">
                            <input
                              type="number"
                              min="0"
                              value={inlineForm.additionalPerKgRate}
                              onChange={(e) =>
                                setInlineForm({
                                  ...inlineForm,
                                  additionalPerKgRate: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full bg-white border border-[#4C63FF] rounded-lg py-1 px-2 text-xs font-bold text-[#12151C] outline-none"
                            />
                            <span className="text-[9px] text-[#6B7280] block mt-0.5">per extra kg</span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold text-[#12151C]">+ {npr(addPerKg)}</span>
                            <span className="text-[10px] text-[#6B7280] block">/ extra kg</span>
                          </div>
                        )}
                      </td>

                      {/* Column 5: COD Charge */}
                      <td className="py-3 px-3.5">
                        {isInline ? (
                          <button
                            type="button"
                            onClick={() =>
                              setInlineForm({
                                ...inlineForm,
                                codAvailable: !inlineForm.codAvailable,
                              })
                            }
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                              inlineForm.codAvailable
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {inlineForm.codAvailable ? 'COD Allowed' : 'Prepaid Only'}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              z.codAvailable
                                ? codRuleLabel === 'Free (0%)'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-100 text-blue-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {codRuleLabel}
                          </span>
                        )}
                      </td>

                      {/* Column 6: Free Shipping */}
                      <td className="py-3 px-3.5 font-mono text-[#12151C]">
                        {isInline ? (
                          <div className="w-24">
                            <input
                              type="number"
                              min="0"
                              value={inlineForm.freeShippingThreshold}
                              onChange={(e) =>
                                setInlineForm({
                                  ...inlineForm,
                                  freeShippingThreshold: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full bg-white border border-[#4C63FF] rounded-lg py-1 px-2 text-xs font-mono font-bold text-[#12151C] outline-none"
                            />
                            <span className="text-[9px] text-[#6B7280] block mt-0.5">threshold NPR</span>
                          </div>
                        ) : (
                          <div>
                            {z.freeShippingThreshold > 0 ? (
                              <span className="font-semibold text-xs text-[#12151C]">
                                Above {npr(z.freeShippingThreshold)}
                              </span>
                            ) : (
                              <span className="text-gray-400">No Free Tier</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Column 7: Status */}
                      <td className="py-3 px-3.5">
                        <button
                          type="button"
                          onClick={() => toggleZone(z)}
                          title={`Click to ${enabled ? 'disable' : 'enable'} zone`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                            enabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              enabled ? 'bg-emerald-500' : 'bg-gray-400'
                            }`}
                          />
                          {enabled ? 'ACTIVE' : 'DISABLED'}
                        </button>
                      </td>

                      {/* Column 8: Actions */}
                      <td className="py-3 px-3.5 text-right">
                        {isInline ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveInlineEdit(z.id)}
                              className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                              title="Save inline changes"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelInlineEdit}
                              className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                              title="Cancel inline editing"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative inline-flex items-center justify-end gap-1">
                            {/* Full Edit Modal Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(z)}
                              className="p-1.5 rounded-lg text-[#4C63FF] hover:bg-[#EEF2FF] transition-colors border border-transparent hover:border-[#C7D2FE] flex items-center gap-1 font-bold text-[11px]"
                              title="Open advanced multi-tier modal"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            {/* 3-Dots Action Dropdown Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setZoneActionMenuId(isMenuOpen ? null : z.id)
                                }
                                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#12151C] hover:bg-gray-100 transition-colors"
                                title="More actions"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {isMenuOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-20"
                                    onClick={() => setZoneActionMenuId(null)}
                                  />
                                  <div className="absolute right-0 top-8 z-30 w-44 bg-white border border-[#E6E8EE] rounded-xl shadow-xl py-1 text-left">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(z)}
                                      className="w-full px-3 py-2 text-xs font-semibold text-[#12151C] hover:bg-[#F4F5F8] flex items-center gap-2"
                                    >
                                      <Sliders className="w-3.5 h-3.5 text-[#4C63FF]" />
                                      Full Tariff Config
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartInlineEdit(z)}
                                      className="w-full px-3 py-2 text-xs font-semibold text-[#12151C] hover:bg-[#F4F5F8] flex items-center gap-2"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                                      Quick Inline Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTesterZoneId(z.id);
                                        setIsQuickTesterOpen(true);
                                        setZoneActionMenuId(null);
                                      }}
                                      className="w-full px-3 py-2 text-xs font-semibold text-[#12151C] hover:bg-[#F4F5F8] flex items-center gap-2"
                                    >
                                      <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                                      Test in Calculator
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateZone(z)}
                                      className="w-full px-3 py-2 text-xs font-semibold text-[#12151C] hover:bg-[#F4F5F8] flex items-center gap-2"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                                      Duplicate Zone
                                    </button>
                                    <div className="border-t border-gray-100 my-1" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        toggleZone(z);
                                        setZoneActionMenuId(null);
                                      }}
                                      className={`w-full px-3 py-2 text-xs font-bold flex items-center gap-2 ${
                                        enabled
                                          ? 'text-rose-600 hover:bg-rose-50'
                                          : 'text-emerald-600 hover:bg-emerald-50'
                                      }`}
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      {enabled ? 'Disable Zone' : 'Enable Zone'}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============== TAB 2 · DISPATCH & TRACKING ============== */}
      {activeTab === 'dispatch' && (
        <div className="space-y-6">
          {/* Metric counters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setBoardFilter('pending_dispatch')}
              className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm text-left hover:border-[#4C63FF] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-[#12151C]">{boardMetrics.pendingDispatch}</div>
              <div className="text-xs text-[#6B7280] mt-1">Pending Dispatch</div>
            </button>

            <button
              onClick={() => setBoardFilter('in_transit')}
              className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm text-left hover:border-[#4C63FF] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-[#12151C]">{boardMetrics.outForDelivery}</div>
              <div className="text-xs text-[#6B7280] mt-1">Out for Delivery</div>
            </button>

            <button
              onClick={() => setBoardFilter('delivered')}
              className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm text-left hover:border-[#4C63FF] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-[#12151C]">{boardMetrics.deliveredToday}</div>
              <div className="text-xs text-[#6B7280] mt-1">Delivered Today</div>
            </button>

            <button
              onClick={() => setBoardFilter('failed')}
              className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm text-left hover:border-[#4C63FF] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-2xl font-black text-[#12151C]">{boardMetrics.failed}</div>
              <div className="text-xs text-[#6B7280] mt-1">Failed / Re-route</div>
            </button>
          </div>

          {/* Board filters */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-4 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search order ID, customer, tracking code, phone…"
                value={boardSearch}
                onChange={(e) => setBoardSearch(e.target.value)}
                className="w-full bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-4 pl-10 text-xs focus:ring-2 focus:ring-[#4C63FF]/20 focus:bg-white focus:border-[#4C63FF] outline-none transition-all"
              />
              <Search className="w-4 h-4 text-[#9AA1AF] absolute left-3 top-2.5" />
            </div>
            <select
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value as typeof boardFilter)}
              className="bg-[#F4F5F8] border border-[#E6E8EE] rounded-xl py-2.5 px-3 text-xs font-semibold text-[#12151C] focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF] outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending_dispatch">Pending Dispatch</option>
              <option value="dispatched">Dispatched</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="returned">Returned</option>
            </select>
          </div>

          {/* Shipment table */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E8EE] text-[#6B7280] uppercase font-bold bg-[#F4F5F8]">
                    <th className="py-3 px-3">Order / Customer</th>
                    <th className="py-3 px-3">Zone / Address</th>
                    <th className="py-3 px-3">Assigned Carrier</th>
                    <th className="py-3 px-3">Tracking</th>
                    <th className="py-3 px-3">COD</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F5F8]">
                  {visibleShipments.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F4F5F8]">
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-[#4C63FF]">{s.orderId}</div>
                        <div className="text-[11px] text-[#12151C] font-bold mt-0.5">
                          {s.customerName}
                        </div>
                        <div className="text-[10px] text-[#6B7280] font-mono">{s.customerPhone}</div>
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="font-bold text-[#12151C]">{s.zoneLabel}</div>
                        <div className="text-[10px] text-[#6B7280] truncate">{s.address}</div>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={s.carrierId ? `${s.carrierKind}:${s.carrierId}` : ''}
                          onChange={(e) => handleReassign(s, e.target.value)}
                          disabled={s.status === 'delivered'}
                          className="bg-[#F4F5F8] border border-[#E6E8EE] rounded-lg py-1.5 px-2 text-[11px] font-semibold text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 disabled:opacity-50 max-w-[150px]"
                        >
                          <option value="">Unassigned</option>
                          <optgroup label="In-House Riders">
                            {riderProfiles
                              .filter((r) => r.type === 'in_house')
                              .map((r) => (
                                <option key={r.id} value={`in_house:${r.id}`}>
                                  {r.name}
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="3PL Partners">
                            {partners
                              .filter((p) => p.enabled)
                              .map((p) => (
                                <option key={p.id} value={`third_party:${p.id}`}>
                                  {p.name}
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        {s.trackingCode ? (
                          <button
                            onClick={() => setTimelineTarget(s)}
                            className="font-mono text-[11px] font-bold text-[#4C63FF] hover:underline"
                          >
                            {s.trackingCode}
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#9AA1AF] italic">not dispatched</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {s.codAmount > 0 ? (
                          <span className="font-bold text-amber-600">{npr(s.codAmount)}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600">PREPAID</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold ${SHIPMENT_STATUS_CLASS[s.status]}`}
                        >
                          {SHIPMENT_STATUS_LABEL[s.status]}
                        </span>
                        {s.failureReason && (
                          <div className="text-[10px] text-red-600 mt-1 max-w-[140px]">
                            {s.failureReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          {s.status === 'pending_dispatch' ? (
                            <button
                              onClick={() => setDispatchTarget(s)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#4C63FF] text-white text-[10px] font-bold hover:bg-[#3D52CC] transition-colors whitespace-nowrap"
                            >
                              Dispatch
                            </button>
                          ) : (
                            <button
                              onClick={() => setTimelineTarget(s)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#E6E8EE] text-[10px] font-bold text-[#12151C] hover:bg-white transition-colors whitespace-nowrap"
                            >
                              Update
                            </button>
                          )}
                          <button
                            onClick={() => handlePrintLabel(s)}
                            title="Print courier label"
                            className="p-1.5 rounded-lg hover:bg-white transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#6B7280]" />
                          </button>
                          <button
                            onClick={() => handleSendSms(s)}
                            title="Send SMS notification"
                            className="p-1.5 rounded-lg hover:bg-white transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#6B7280]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleShipments.length === 0 && (
              <div className="py-12 text-center text-xs text-[#6B7280]">
                No shipments match the current filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============== TAB 3 · RIDERS & 3PL ============== */}
      {activeTab === 'carriers' && (
        <div className="space-y-6">
          {/* In-house riders */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-[#E6E8EE] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#12151C]">In-House Riders</h3>
                <p className="text-[11px] text-[#6B7280] mt-0.5">
                  Vehicle and cash-in-hand figures are demo values — `delivery_partners` has no
                  columns for them yet.
                </p>
              </div>
              <button className="bg-[#4C63FF] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 hover:bg-[#3D52CC] transition-colors">
                <Plus className="w-3.5 h-3.5" />
                Add Rider
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inHouseRiders.map((r) => (
                <div key={r.id} className="border border-[#E6E8EE] rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#4C63FF]/10 flex items-center justify-center">
                        <Bike className="w-5 h-5 text-[#4C63FF]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#12151C]">{r.name}</div>
                        <div className="flex items-center gap-1 text-[10px] text-[#6B7280] font-mono">
                          <Phone className="w-3 h-3" />
                          {r.phone}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-200 text-gray-600'
                        }`}
                    >
                      {r.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-[#12151C] bg-[#F4F5F8] rounded-lg px-2.5 py-1.5">
                    {r.vehicleNumber ?? 'No vehicle on file'}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#F4F5F8] rounded-lg p-2.5">
                      <div className="text-[9px] text-[#6B7280] uppercase font-bold tracking-wider">
                        Active
                      </div>
                      <div className="text-sm font-black text-[#12151C]">{r.activeDeliveries}</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2.5">
                      <div className="text-[9px] text-amber-700 uppercase font-bold tracking-wider">
                        Cash in Hand
                      </div>
                      <div className="text-sm font-black text-amber-700">
                        {npr(r.cashInHand ?? 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3PL partners */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-6 shadow-sm">
            <div className="mb-4 border-b border-[#E6E8EE] pb-3">
              <h3 className="text-sm font-bold text-[#12151C]">3PL API Partners</h3>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Only enabled partners appear in the dispatch carrier list.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partners.map((p) => (
                <div
                  key={p.id}
                  className={`border rounded-2xl p-4 space-y-3 transition-colors ${p.enabled ? 'border-[#4C63FF]/30 bg-[#4C63FF]/[0.03]' : 'border-[#E6E8EE]'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#0F1420] text-white font-black text-[11px] flex items-center justify-center flex-shrink-0">
                        {p.logoLabel}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#12151C] truncate">{p.name}</div>
                        <div className="text-[10px] text-[#6B7280] truncate">{p.coverage}</div>
                      </div>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => handleTogglePartner(p.id)}
                      role="switch"
                      aria-checked={p.enabled}
                      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${p.enabled ? 'bg-[#4C63FF]' : 'bg-[#C7CBDA]'
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${p.enabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${p.apiConnected
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-200 text-gray-600'
                        }`}
                    >
                      <Link2 className="w-2.5 h-2.5" />
                      {p.apiConnected ? 'API CONNECTED' : 'NO CREDENTIALS'}
                    </span>
                    {p.lastSyncedAt && (
                      <span className="text-[10px] text-[#6B7280] font-mono">
                        synced {p.lastSyncedAt}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#F4F5F8] rounded-lg p-2.5">
                      <div className="text-[9px] text-[#6B7280] uppercase font-bold tracking-wider">
                        Active Shipments
                      </div>
                      <div className="text-sm font-black text-[#12151C]">{p.activeShipments}</div>
                    </div>
                    <div className="bg-[#F4F5F8] rounded-lg p-2.5">
                      <div className="text-[9px] text-[#6B7280] uppercase font-bold tracking-wider">
                        Base Rate
                      </div>
                      <div className="text-sm font-black text-[#12151C]">{npr(p.baseRate)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============== TAB 4 · COD RECONCILIATION ============== */}
      {activeTab === 'cod' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                <Coins className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-600">{npr(codTotals.uncollected)}</div>
              <div className="text-xs text-[#6B7280] mt-1">Uncollected Cash (Rider Hands)</div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                <Landmark className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-600">{npr(codTotals.pendingDeposit)}</div>
              <div className="text-xs text-[#6B7280] mt-1">Pending Bank Deposit</div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E6E8EE] p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                <Banknote className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600">{npr(codTotals.settledToday)}</div>
              <div className="text-xs text-[#6B7280] mt-1">Settled Today</div>
            </div>
          </div>

          {/* Reconciliation sheet */}
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-6 shadow-sm">
            <div className="mb-4 border-b border-[#E6E8EE] pb-3">
              <h3 className="text-sm font-bold text-[#12151C]">Rider COD Cash Reconciliation</h3>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Settling posts a journal entry: debit Cash/Bank, credit Rider Receivable. A shortage
                stays on the rider&apos;s ledger.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E8EE] text-[#6B7280] uppercase font-bold bg-[#F4F5F8]">
                    <th className="py-3 px-3">Rider</th>
                    <th className="py-3 px-3">Orders Delivered</th>
                    <th className="py-3 px-3">COD Collected</th>
                    <th className="py-3 px-3">Cash Received by Admin</th>
                    <th className="py-3 px-3">Discrepancy</th>
                    <th className="py-3 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F5F8]">
                  {codRows.map((row) => {
                    const raw = cashReceived[row.riderId] ?? '';
                    const received = raw === '' ? null : Number(raw);
                    const discrepancy = received === null ? null : received - row.codCollected;
                    const isSettled = row.status === 'settled';

                    return (
                      <tr key={row.riderId} className={`hover:bg-[#F4F5F8] ${isSettled ? 'opacity-60' : ''}`}>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#12151C]">{row.riderName}</div>
                          <div className="text-[10px] text-[#6B7280] font-mono">{row.riderId}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#12151C]">{row.ordersDelivered}</td>
                        <td className="py-3 px-3 font-black text-amber-600">
                          {npr(row.codCollected)}
                        </td>
                        <td className="py-3 px-3">
                          {isSettled ? (
                            <span className="font-bold text-[#12151C]">
                              {npr(settled[row.riderId].amount)}
                            </span>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-[10px] font-bold text-[#9AA1AF]">
                                NPR
                              </span>
                              <input
                                type="number"
                                min={0}
                                value={raw}
                                onChange={(e) =>
                                  setCashReceived((prev) => ({
                                    ...prev,
                                    [row.riderId]: e.target.value,
                                  }))
                                }
                                placeholder="0"
                                className="w-32 bg-[#F4F5F8] border border-[#E6E8EE] rounded-lg py-1.5 pl-9 pr-2 text-xs font-bold text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:bg-white focus:border-[#4C63FF]"
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {discrepancy === null && !isSettled ? (
                            <span className="text-[10px] text-[#9AA1AF] italic">enter cash</span>
                          ) : (
                            (() => {
                              const value = isSettled
                                ? settled[row.riderId].amount - row.codCollected
                                : (discrepancy as number);
                              if (value === 0) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                                    <CheckCircle2 className="w-3 h-3" />
                                    BALANCED
                                  </span>
                                );
                              }
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${value < 0
                                    ? 'text-red-700 bg-red-100'
                                    : 'text-blue-700 bg-blue-100'
                                    }`}
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  {value > 0 ? '+' : ''}
                                  {npr(value)} {value < 0 ? 'SHORT' : 'EXCESS'}
                                </span>
                              );
                            })()
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {isSettled ? (
                            <div>
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                SETTLED
                              </span>
                              <div className="text-[9px] text-[#9AA1AF] font-mono mt-1">
                                {settled[row.riderId].at}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSettleCash(row)}
                              disabled={received === null}
                              className="px-3 py-1.5 rounded-lg bg-[#4C63FF] text-white text-[10px] font-bold hover:bg-[#3D52CC] transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              Settle &amp; Post Entry
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {codRows.length === 0 && (
              <div className="py-12 text-center text-xs text-[#6B7280]">
                No in-house riders on the roster.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============== MODALS ============== */}
      {isZoneModalOpen && (
        <ZoneFareModal
          isOpen={isZoneModalOpen}
          onClose={() => {
            setZoneModalOpen(false);
            setEditingZone(null);
          }}
          onSave={handleSaveZone}
          initialZone={editingZone}
          existingCount={zones.length}
        />
      )}

      {dispatchTarget && (
        <DispatchOrderModal
          shipment={dispatchTarget}
          riders={riderProfiles}
          partners={partners}
          onClose={() => setDispatchTarget(null)}
          onDispatch={handleDispatch}
        />
      )}

      {timelineTarget && (
        <TrackingTimelineModal
          // Re-read from the derived list so the timeline reflects the latest patch.
          shipment={shipments.find((s) => s.id === timelineTarget.id) ?? timelineTarget}
          onClose={() => setTimelineTarget(null)}
          onUpdateStatus={handleUpdateStatus}
          onPrintLabel={handlePrintLabel}
          onSendSms={handleSendSms}
        />
      )}
    </div>
  );
};


'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/context/StoreContext';
import { DeliveryRoute, GPSPosition } from '@/types';
import { getCurrentPosition, watchPosition } from '@/lib/gps/browser';
import { calculateDistance, estimateArrivalTime } from '@/lib/gps/utils';
import {
  MapPin,
  Navigation,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  MessageSquare,
  Camera,
  RefreshCw,
  ChevronRight,
  Truck,
  XCircle,
} from 'lucide-react';

interface DeliveryWithOrder extends DeliveryRoute {
  order: {
    orderNumber: string;
    totalAmount: number;
    customerNote?: string;
    shippingAddress?: {
      fullName: string;
      phone: string;
      addressLine: string;
      district: string;
      municipality: string;
      ward: string;
    };
  };
}

export const DriverTrackingView: React.FC = () => {
  const { currentUser, navigateTo } = useStore();
  const [deliveries, setDeliveries] = useState<DeliveryWithOrder[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryWithOrder | null>(null);
  const [currentPosition, setCurrentPosition] = useState<GPSPosition | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const watchRef = useRef<(() => void) | null>(null);

  const driverId = currentUser?.email || '1';

  const fetchDeliveries = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/driver/deliveries?driverId=${driverId}`);
      const data = await response.json();
      if (data.deliveries) {
        setDeliveries(data.deliveries);
      }
    } catch (err) {
      setError('Failed to load deliveries');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const startTracking = useCallback(async () => {
    try {
      const position = await getCurrentPosition();
      setCurrentPosition(position);
      setIsTracking(true);

      watchRef.current = watchPosition(
        async (newPosition) => {
          setCurrentPosition(newPosition);
          await fetch('/api/driver/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverId,
              latitude: newPosition.latitude,
              longitude: newPosition.longitude,
              accuracy: newPosition.accuracy,
              speed: newPosition.speed,
              heading: newPosition.heading,
            }),
          });
        },
        (err) => {
          console.error('GPS watch error:', err);
          setError('GPS tracking error: ' + err.message);
        },
      );
    } catch (err) {
      setError('Failed to start GPS tracking');
      console.error(err);
    }
  }, [driverId]);

  const stopTracking = useCallback(() => {
    if (watchRef.current) {
      watchRef.current();
      watchRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchRef.current) {
        watchRef.current();
      }
    };
  }, []);

  const updateDeliveryStatus = async (
    routeId: number,
    status: DeliveryRoute['status'],
    notes?: string,
  ) => {
    try {
      setStatusUpdateLoading(true);
      const response = await fetch('/api/driver/deliveries/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, status, notes }),
      });

      if (response.ok) {
        await fetchDeliveries();
        setSelectedDelivery(null);
      }
    } catch (err) {
      setError('Failed to update status');
      console.error(err);
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'picked_up':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'in_transit':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned':
        return <Package className="w-4 h-4" />;
      case 'picked_up':
        return <Truck className="w-4 h-4" />;
      case 'in_transit':
        return <Navigation className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case 'assigned':
        return { label: 'Mark as Picked Up', nextStatus: 'picked_up' as const };
      case 'picked_up':
        return { label: 'Start Delivery', nextStatus: 'in_transit' as const };
      case 'in_transit':
        return { label: 'Mark as Delivered', nextStatus: 'delivered' as const };
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm text-slate-600">Loading deliveries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black text-slate-900">Driver Dashboard</h1>
              <p className="text-xs text-slate-500">
                {deliveries.filter((d) => d.status !== 'delivered').length} active deliveries
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={isTracking ? stopTracking : startTracking}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  isTracking
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                <MapPin className="w-4 h-4" />
                {isTracking ? 'GPS Active' : 'Start GPS'}
              </button>
              <button
                onClick={() => navigateTo('home')}
                className="p-2 text-slate-500 hover:text-slate-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {currentPosition && (
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <span>
                Lat: {currentPosition.latitude.toFixed(6)}, Lng:{' '}
                {currentPosition.longitude.toFixed(6)}
              </span>
              {currentPosition.speed && (
                <span>Speed: {(currentPosition.speed * 3.6).toFixed(1)} km/h</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2 hover:text-red-200">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Delivery List */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {deliveries.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">No Deliveries Assigned</h3>
            <p className="text-sm text-slate-500">
              Check back later for new delivery assignments.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${getStatusColor(
                        delivery.status,
                      )}`}
                    >
                      {getStatusIcon(delivery.status)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {delivery.order?.orderNumber || `Order #${delivery.orderId}`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        NPR {delivery.order?.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(
                      delivery.status,
                    )}`}
                  >
                    {delivery.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {delivery.order?.shippingAddress && (
                  <div className="bg-slate-50 rounded-xl p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold text-slate-900">
                          {delivery.order.shippingAddress.fullName}
                        </p>
                        <p className="text-slate-600">
                          {delivery.order.shippingAddress.addressLine}, Ward{' '}
                          {delivery.order.shippingAddress.ward}
                        </p>
                        <p className="text-slate-600">
                          {delivery.order.shippingAddress.municipality},{' '}
                          {delivery.order.shippingAddress.district}
                        </p>
                        <a
                          href={`tel:${delivery.order.shippingAddress.phone}`}
                          className="flex items-center gap-1 text-blue-600 mt-1 hover:underline"
                        >
                          <Phone className="w-3 h-3" />
                          {delivery.order.shippingAddress.phone}
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {delivery.distanceKm && (
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      {delivery.distanceKm} km
                    </span>
                    {delivery.estimatedArrival && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        ETA: {new Date(delivery.estimatedArrival).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {getNextAction(delivery.status) && (
                    <button
                      onClick={() =>
                        updateDeliveryStatus(
                          Number(delivery.id),
                          getNextAction(delivery.status)!.nextStatus,
                        )
                      }
                      disabled={statusUpdateLoading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {statusUpdateLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {getNextAction(delivery.status)!.label}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedDelivery(delivery)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition-colors"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery Detail Modal */}
      {selectedDelivery && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Delivery Details</h2>
              <button
                onClick={() => setSelectedDelivery(null)}
                className="p-2 hover:bg-slate-100 rounded-xl"
              >
                <XCircle className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${getStatusColor(
                    selectedDelivery.status,
                  )}`}
                >
                  {getStatusIcon(selectedDelivery.status)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    {selectedDelivery.order?.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assigned: {new Date(selectedDelivery.assignedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedDelivery.order?.shippingAddress && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">Customer</h4>
                  <p className="text-sm font-bold text-blue-700">
                    {selectedDelivery.order.shippingAddress.fullName}
                  </p>
                  <p className="text-xs text-slate-600">
                    {selectedDelivery.order.shippingAddress.addressLine}
                  </p>
                  <p className="text-xs text-slate-600">
                    {selectedDelivery.order.shippingAddress.municipality},{' '}
                    {selectedDelivery.order.shippingAddress.district}
                  </p>
                  <a
                    href={`tel:${selectedDelivery.order.shippingAddress.phone}`}
                    className="flex items-center gap-2 text-blue-600 text-sm font-bold hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    {selectedDelivery.order.shippingAddress.phone}
                  </a>
                </div>
              )}

              {selectedDelivery.order?.customerNote && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <h4 className="font-bold text-amber-800 text-sm mb-1">Customer Note</h4>
                  <p className="text-xs text-amber-700">{selectedDelivery.order.customerNote}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="font-bold text-slate-900">
                    NPR {selectedDelivery.order?.totalAmount?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">Distance</p>
                  <p className="font-bold text-slate-900">
                    {selectedDelivery.distanceKm || 'N/A'} km
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Timeline</h4>
                <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-blue-600 -ml-[9px]" />
                    <span className="text-slate-500">Assigned</span>
                    <span className="text-slate-400">
                      {new Date(selectedDelivery.assignedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  {selectedDelivery.pickedUpAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-amber-600 -ml-[9px]" />
                      <span className="text-slate-500">Picked Up</span>
                      <span className="text-slate-400">
                        {new Date(selectedDelivery.pickedUpAt).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  {selectedDelivery.inTransitAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-purple-600 -ml-[9px]" />
                      <span className="text-slate-500">In Transit</span>
                      <span className="text-slate-400">
                        {new Date(selectedDelivery.inTransitAt).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  {selectedDelivery.deliveredAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-emerald-600 -ml-[9px]" />
                      <span className="text-slate-500">Delivered</span>
                      <span className="text-slate-400">
                        {new Date(selectedDelivery.deliveredAt).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {getNextAction(selectedDelivery.status) && (
                <button
                  onClick={() =>
                    updateDeliveryStatus(
                      Number(selectedDelivery.id),
                      getNextAction(selectedDelivery.status)!.nextStatus,
                    )
                  }
                  disabled={statusUpdateLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {statusUpdateLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                  {getNextAction(selectedDelivery.status)!.label}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

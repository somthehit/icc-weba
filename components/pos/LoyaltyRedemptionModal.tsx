// components/pos/LoyaltyRedemptionModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  Coins,
  Sparkles,
  Tag,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { formatNepaliNumber } from '@/lib/nepal/money';

export interface LoyaltyProfile {
  customerId: string;
  customerName: string;
  customerPhone: string;
  membershipNumber: string;
  currentLevelId: string;
  levelName: string;
  badgeColor: string;
  icon: string;
  pointsEarningRate: number;
  redemptionConversionRate: number;
  availableCoins: number;
  qualifyingSpend: number;
  nextLevelName: string | null;
  nextLevelThreshold: number | null;
  remainingSpendToNextLevel: number | null;
  progressPercentage: number;
  minRedemptionPoints: number;
  maxRedemptionPercentage: number;
  maxRedemptionPointsPerTx: number;
  minPayableAfterRedemption: number;
}

interface LoyaltyRedemptionModalProps {
  isOpen: boolean;
  profile: LoyaltyProfile | null;
  orderSubtotal: number;
  currentCoinsToRedeem: number;
  currentOfferCode: string;
  eligibleOffers: any[];
  onApply: (data: { coinsToRedeem: number; coinDiscountNpr: number; offerCode: string; offerDiscountNpr: number }) => void;
  onClose: () => void;
}

export default function LoyaltyRedemptionModal({
  isOpen,
  profile,
  orderSubtotal,
  currentCoinsToRedeem,
  currentOfferCode,
  eligibleOffers,
  onApply,
  onClose,
}: LoyaltyRedemptionModalProps) {
  const [coinsInput, setCoinsInput] = useState<number>(currentCoinsToRedeem);
  const [selectedOffer, setSelectedOffer] = useState<string>(currentOfferCode);
  const [quoteError, setQuoteError] = useState<string>('');
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteData, setQuoteData] = useState<{
    coinDiscount: number;
    offerDiscount: number;
    estimatedEarned: number;
    finalPayable: number;
    maxCoinsAllowed: number;
  }>({
    coinDiscount: 0,
    offerDiscount: 0,
    estimatedEarned: 0,
    finalPayable: orderSubtotal,
    maxCoinsAllowed: 0,
  });

  useEffect(() => {
    if (isOpen) {
      setCoinsInput(currentCoinsToRedeem);
      setSelectedOffer(currentOfferCode);
      fetchQuote(currentCoinsToRedeem, currentOfferCode);
    }
  }, [isOpen, profile, orderSubtotal]);

  const fetchQuote = async (coins: number, offerCode: string) => {
    if (!profile) return;
    setIsQuoting(true);
    setQuoteError('');
    try {
      const res = await fetch('/api/pos/loyalty/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: profile.customerId,
          coinsToRedeem: coins,
          orderSubtotal,
          offerCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (!data.redemption.isValid) {
          setQuoteError(data.redemption.errorMessage || 'Invalid redemption amount.');
        } else if (data.offer && data.offer.errorMessage) {
          setQuoteError(data.offer.errorMessage);
        }

        setQuoteData({
          coinDiscount: data.redemption.discountNpr,
          offerDiscount: data.offer?.discountAmount || 0,
          estimatedEarned: data.earning?.totalCredits || 0,
          finalPayable: data.finalPayable,
          maxCoinsAllowed: data.redemption.maxAllowedCoins,
        });
      }
    } catch (err) {
      console.error('Error quoting loyalty:', err);
    } finally {
      setIsQuoting(false);
    }
  };

  if (!isOpen || !profile) return null;

  const handleCoinsChange = (val: number) => {
    const clamped = Math.max(0, val);
    setCoinsInput(clamped);
    fetchQuote(clamped, selectedOffer);
  };

  const handleSelectOffer = (code: string) => {
    const newCode = selectedOffer === code ? '' : code;
    setSelectedOffer(newCode);
    fetchQuote(coinsInput, newCode);
  };

  const handleConfirm = () => {
    onApply({
      coinsToRedeem: coinsInput,
      coinDiscountNpr: quoteData.coinDiscount,
      offerCode: selectedOffer,
      offerDiscountNpr: quoteData.offerDiscount,
    });
    onClose();
  };

  const getBadgeStyle = (color: string) => {
    switch (color) {
      case 'amber':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'slate-silver':
        return 'bg-slate-200 text-slate-800 border-slate-400';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Customer Loyalty &amp; Rewards
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Shopping Coins, Member Benefits &amp; Promotions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 text-xs">
          {/* Member Card */}
          <div className="p-4 rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 text-white shadow-md relative overflow-hidden">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-emerald-400 font-bold tracking-wider">
                    {profile.membershipNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getBadgeStyle(
                      profile.badgeColor
                    )}`}
                  >
                    {profile.icon} {profile.levelName}
                  </span>
                </div>
                <h4 className="text-base font-black text-white mt-1">{profile.customerName}</h4>
                <p className="text-[11px] text-slate-400 font-mono">{profile.customerPhone}</p>
              </div>

              {/* Available Coins Pill */}
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Available Coins</span>
                <span className="text-xl font-black font-mono text-amber-400 flex items-center justify-end gap-1">
                  <Coins className="h-4 w-4" />
                  {profile.availableCoins.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  ≈ NPR {profile.availableCoins.toLocaleString('en-IN')} value
                </span>
              </div>
            </div>

            {/* Next Tier Progress Bar */}
            {profile.nextLevelName && (
              <div className="mt-4 pt-3 border-t border-slate-700/60 relative z-10">
                <div className="flex justify-between text-[10px] text-slate-300 font-bold mb-1">
                  <span>Qualifying Spend: NPR {profile.qualifyingSpend.toLocaleString('en-IN')}</span>
                  <span>
                    Next: {profile.nextLevelName} (NPR {profile.remainingSpendToNextLevel?.toLocaleString('en-IN')} needed)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-emerald-500 to-[#00c569] rounded-full transition-all duration-500"
                    style={{ width: `${profile.progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Shopping Coins Redemption Section */}
          <div className="space-y-3 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-600" />
                <h5 className="font-black text-xs text-amber-950">Redeem Shopping Coins</h5>
              </div>
              <span className="text-[11px] font-bold text-amber-800">
                Max Allowed: {quoteData.maxCoinsAllowed} Coins
              </span>
            </div>

            {profile.availableCoins < profile.minRedemptionPoints ? (
              <div className="p-3 rounded-xl bg-amber-100/60 text-amber-800 text-[11px] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Minimum balance of {profile.minRedemptionPoints} coins required to redeem. (Customer has{' '}
                  {profile.availableCoins} coins).
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      max={quoteData.maxCoinsAllowed}
                      value={coinsInput || ''}
                      onChange={(e) => handleCoinsChange(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-mono font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                    <span className="absolute right-3 top-2.5 text-[11px] font-bold text-slate-400">Coins</span>
                  </div>

                  {/* Clear button */}
                  {coinsInput > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCoinsChange(0)}
                      className="px-2.5 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick select presets */}
                <div className="flex gap-1.5 flex-wrap">
                  {[50, 100, 250, 500].map((preset) => {
                    if (preset > quoteData.maxCoinsAllowed) return null;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleCoinsChange(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition border ${
                          coinsInput === preset
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {preset} Coins
                      </button>
                    );
                  })}
                  {quoteData.maxCoinsAllowed > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCoinsChange(quoteData.maxCoinsAllowed)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-500 text-white hover:bg-amber-600 transition ml-auto"
                    >
                      Max ({quoteData.maxCoinsAllowed})
                    </button>
                  )}
                </div>

                {quoteData.coinDiscount > 0 && (
                  <p className="text-[11px] font-bold text-emerald-700">
                    ✓ Saves NPR {formatNepaliNumber(quoteData.coinDiscount.toFixed(2))} on current order
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Offers & Promotions Section */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-emerald-600" />
              <h5 className="font-black text-xs text-slate-900">Member Offers &amp; Promos</h5>
            </div>

            {eligibleOffers.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">
                No active promotional vouchers currently applicable to this tier/spend.
              </p>
            ) : (
              <div className="space-y-2">
                {eligibleOffers.map((off) => {
                  const isSelected = selectedOffer.toUpperCase() === off.code.toUpperCase();
                  return (
                    <div
                      key={off.id}
                      onClick={() => handleSelectOffer(off.code)}
                      className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {off.code}
                          </span>
                          <span className="font-bold text-xs text-slate-900 truncate">{off.title}</span>
                        </div>
                        {off.description && (
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{off.description}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        {off.calculatedDiscount > 0 ? (
                          <span className="font-mono font-bold text-emerald-600 text-xs">
                            -NPR {off.calculatedDiscount}
                          </span>
                        ) : off.bonusCoins > 0 ? (
                          <span className="font-mono font-bold text-amber-600 text-xs">
                            +{off.bonusCoins} Bonus Coins
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Validation Error banner */}
          {quoteError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{quoteError}</span>
            </div>
          )}

          {/* Summary Breakdown */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Gross Order Subtotal</span>
              <span className="font-mono font-bold text-slate-800">
                NPR {formatNepaliNumber(orderSubtotal.toFixed(2))}
              </span>
            </div>

            {quoteData.coinDiscount > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Coin Redemption Discount</span>
                <span className="font-mono">-NPR {formatNepaliNumber(quoteData.coinDiscount.toFixed(2))}</span>
              </div>
            )}

            {quoteData.offerDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Promotional Offer ({selectedOffer})</span>
                <span className="font-mono">-NPR {formatNepaliNumber(quoteData.offerDiscount.toFixed(2))}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-800 font-black pt-1.5 border-t border-slate-200 text-sm">
              <span>Payable After Loyalty</span>
              <span className="font-mono text-emerald-600">
                NPR {formatNepaliNumber(quoteData.finalPayable.toFixed(2))}
              </span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Est. Coins Earned Today
              </span>
              <span className="font-mono font-bold text-emerald-600">
                +{quoteData.estimatedEarned} Coins
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-2.5 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-100 transition text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#00c569] hover:bg-emerald-500 text-white text-xs font-black shadow-md transition flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Apply to Bill</span>
          </button>
        </div>
      </div>
    </div>
  );
}

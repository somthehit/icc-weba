'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  MapPin,
  Scale,
  CreditCard,
  Calculator,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Truck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { AdminDeliveryZone } from './deliveryShared';
import { calculateShippingCost, type TariffRule } from '@/lib/delivery/tariff';

export interface ZoneFareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (zone: AdminDeliveryZone) => void;
  initialZone?: AdminDeliveryZone | null;
  existingCount: number;
}

const NEPAL_PROVINCES = [
  'Sudurpashchim',
  'Bagmati',
  'Gandaki',
  'Lumbini',
  'Koshi',
  'Madhesh',
  'Karnali',
];

const PROVINCE_DISTRICT_SUGGESTIONS: Record<string, string[]> = {
  Sudurpashchim: [
    'Kailali',
    'Kanchanpur',
    'Dadeldhura',
    'Doti',
    'Baitadi',
    'Achham',
    'Bajhang',
    'Bajura',
    'Darchula',
  ],
  Bagmati: ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Chitwan', 'Kavrepalanchok', 'Makwanpur', 'Dhading', 'Nuwakot'],
  Gandaki: ['Kaski', 'Tanahun', 'Gorkha', 'Syangja', 'Nawalpur', 'Baglung', 'Parbat'],
  Lumbini: ['Rupandehi', 'Banke', 'Dang', 'Kapilvastu', 'Palpa', 'Bardiya', 'Nawalparasi'],
  Koshi: ['Morang', 'Sunsari', 'Jhapa', 'Ilam', 'Udayapur', 'Dhankuta'],
  Madhesh: ['Parsa', 'Dhanusha', 'Mahottari', 'Siraha', 'Saptari', 'Bara', 'Rautahat', 'Sarlahi'],
  Karnali: ['Surkhet', 'Jumla', 'Dailekh', 'Salyan', 'Kalikot', 'Jajarkot', 'Rukum West'],
};

export const ZoneFareModal: React.FC<ZoneFareModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialZone,
  existingCount,
}) => {
  const isEditing = Boolean(initialZone);

  // --- Section A: Basic Zone Information ---
  const [province, setProvince] = useState(initialZone?.province ?? 'Sudurpashchim');
  const [district, setDistrict] = useState(initialZone?.district ?? 'Kailali');
  const [hubBranch, setHubBranch] = useState(initialZone?.hubBranch ?? 'Dhangadhi Central Hub');
  const [municipalitiesList, setMunicipalitiesList] = useState<string[]>(
    initialZone?.municipalities && initialZone.municipalities.length > 0
      ? initialZone.municipalities
      : initialZone?.municipality
      ? initialZone.municipality.split(/[,/]/).map((s) => s.trim()).filter(Boolean)
      : ['Dhangadhi Sub-Metro', 'Attariya', 'Tikapur', 'Lamki', 'Sukkhad']
  );
  const [newTagInput, setNewTagInput] = useState('');
  const [etaDays, setEtaDays] = useState(initialZone?.etaDays ?? 'Same Day - 24 Hrs');
  const [minEtaHours, setMinEtaHours] = useState(String(initialZone?.minEtaHours ?? 12));
  const [maxEtaHours, setMaxEtaHours] = useState(String(initialZone?.maxEtaHours ?? 24));

  // --- Section B: Weight & Volumetric Tier Calculation ---
  const [baseWeightKg, setBaseWeightKg] = useState(String(initialZone?.baseWeightKg ?? 1.0));
  const [baseRate, setBaseRate] = useState(String(initialZone?.fee ?? initialZone?.baseRate ?? 100));
  const [additionalPerKgRate, setAdditionalPerKgRate] = useState(
    String(initialZone?.additionalPerKgRate ?? 30)
  );
  const [volumetricDivisor, setVolumetricDivisor] = useState(
    String(initialZone?.volumetricDivisor ?? 5000)
  );
  const [expressFee, setExpressFee] = useState(
    initialZone?.expressFee !== undefined ? String(initialZone.expressFee) : ''
  );

  // --- Section C: Surcharges & Payment Rules ---
  const [codAvailable, setCodAvailable] = useState(initialZone?.codAvailable ?? true);
  const [codFeeFlat, setCodFeeFlat] = useState(String(initialZone?.codFeeFlat ?? 0));
  const [codFeePercent, setCodFeePercent] = useState(
    String(initialZone?.codFeePercent !== undefined ? initialZone.codFeePercent * 100 : 0)
  );
  const [isRemoteArea, setIsRemoteArea] = useState(initialZone?.isRemoteArea ?? false);
  const [remoteSurcharge, setRemoteSurcharge] = useState(String(initialZone?.remoteSurcharge ?? 50));
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    String(initialZone?.freeShippingThreshold ?? 5000)
  );
  const [isActive, setIsActive] = useState(initialZone?.isActive ?? true);

  // --- Section D: Live Interactive Calculator Simulator ---
  const [simOrderValue, setSimOrderValue] = useState('2500');
  const [simWeightKg, setSimWeightKg] = useState('2.5');
  const [simLengthCm, setSimLengthCm] = useState('30');
  const [simWidthCm, setSimWidthCm] = useState('20');
  const [simHeightCm, setSimHeightCm] = useState('15');
  const [simIsCod, setSimIsCod] = useState(true);
  const [simIsRemote, setSimIsRemote] = useState(isRemoteArea);

  // Sync province changes with default district suggestions
  const handleProvinceChange = (newProv: string) => {
    setProvince(newProv);
    const suggestions = PROVINCE_DISTRICT_SUGGESTIONS[newProv];
    if (suggestions && suggestions.length > 0 && !suggestions.includes(district)) {
      setDistrict(suggestions[0]);
    }
  };

  const addMunicipalityTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !municipalitiesList.includes(trimmed)) {
      setMunicipalitiesList([...municipalitiesList, trimmed]);
      setNewTagInput('');
    }
  };

  const removeMunicipalityTag = (tagToRemove: string) => {
    setMunicipalitiesList(municipalitiesList.filter((t) => t !== tagToRemove));
  };

  // Tariff Rule derived from form values
  const currentTariffRule: TariffRule = useMemo(() => {
    return {
      baseWeightKg: Number(baseWeightKg) || 1.0,
      baseRate: Number(baseRate) || 0,
      additionalPerKgRate: Number(additionalPerKgRate) || 0,
      volumetricDivisor: Number(volumetricDivisor) || 5000,
      codPercent: (Number(codFeePercent) || 0) / 100,
      codFlatFee: codAvailable ? Number(codFeeFlat) || 0 : 0,
      freeShippingThreshold: Number(freeShippingThreshold) || 0,
      remoteSurcharge: isRemoteArea ? Number(remoteSurcharge) || 0 : 0,
    };
  }, [
    baseWeightKg,
    baseRate,
    additionalPerKgRate,
    volumetricDivisor,
    codFeePercent,
    codFeeFlat,
    codAvailable,
    freeShippingThreshold,
    isRemoteArea,
    remoteSurcharge,
  ]);

  // Live simulation calculation
  const simResult = useMemo(() => {
    return calculateShippingCost(
      Number(simOrderValue) || 0,
      Number(simWeightKg) || 0,
      {
        l: Number(simLengthCm) || 0,
        w: Number(simWidthCm) || 0,
        h: Number(simHeightCm) || 0,
      },
      codAvailable && simIsCod,
      simIsRemote,
      currentTariffRule
    );
  }, [
    simOrderValue,
    simWeightKg,
    simLengthCm,
    simWidthCm,
    simHeightCm,
    simIsCod,
    simIsRemote,
    codAvailable,
    currentTariffRule,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMunicipalities =
      municipalitiesList.length > 0 ? municipalitiesList : [district.trim()];

    const zoneData: AdminDeliveryZone = {
      id: initialZone?.id ?? `dz-${Date.now()}`,
      province: province.trim(),
      district: district.trim(),
      municipality: finalMunicipalities.join(' / '),
      municipalities: finalMunicipalities,
      fee: Number(baseRate) || 0,
      baseRate: Number(baseRate) || 0,
      baseWeightKg: Number(baseWeightKg) || 1.0,
      additionalPerKgRate: Number(additionalPerKgRate) || 0,
      volumetricDivisor: Number(volumetricDivisor) || 5000,
      expressFee: expressFee ? Number(expressFee) : undefined,
      minEtaHours: Number(minEtaHours) || 24,
      maxEtaHours: Number(maxEtaHours) || 48,
      etaDays: etaDays.trim() || `${minEtaHours}-${maxEtaHours} Hours`,
      codAvailable,
      codFeeFlat: codAvailable ? Number(codFeeFlat) || 0 : 0,
      codFeePercent: codAvailable ? (Number(codFeePercent) || 0) / 100 : 0,
      freeShippingThreshold: Number(freeShippingThreshold) || 0,
      remoteSurcharge: isRemoteArea ? Number(remoteSurcharge) || 0 : 0,
      hubBranch: hubBranch.trim() || `${district} Central Hub`,
      isRemoteArea,
      isActive,
    };

    onSave(zoneData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl my-8 overflow-hidden border border-[#E6E8EE] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#12151C] to-[#1E2433] text-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4C63FF]/20 border border-[#4C63FF]/40 flex items-center justify-center text-[#8C9CFF]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {initialZone ? `Edit Zone: ${initialZone.province} · ${initialZone.district}` : 'Add New Nepal Shipping Zone'}
                <span className="text-[10px] bg-[#4C63FF] text-white px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                  Tariff Tier V2
                </span>
              </h2>
              <p className="text-xs text-gray-300">
                Configure base rates, incremental per-kg weight tiers, volumetric divisor, and COD/remote surcharges.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Section A: Basic Zone Information */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#12151C] border-b border-[#E2E8F0] pb-2.5">
              <MapPin className="w-4 h-4 text-[#4C63FF]" />
              <h3>Section A: Basic Zone Information & Coverage</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-[#12151C] mb-1.5">Province</label>
                <select
                  value={province}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 font-semibold text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                >
                  {NEPAL_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#12151C] mb-1.5">District</label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Kailali, Kanchanpur"
                  list="district-suggestions"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 font-semibold text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                />
                <datalist id="district-suggestions">
                  {(PROVINCE_DISTRICT_SUGGESTIONS[province] ?? []).map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-bold text-[#12151C] mb-1.5">Hub / Regional Branch</label>
                <input
                  type="text"
                  value={hubBranch}
                  onChange={(e) => setHubBranch(e.target.value)}
                  placeholder="e.g. Dhangadhi Central Hub"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                />
              </div>
            </div>

            {/* Covered Municipalities Chips Input */}
            <div>
              <label className="block font-bold text-[#12151C] mb-1.5">
                Covered Municipalities / Delivery Areas (Tag Chips)
              </label>
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white border border-[#CBD5E1] rounded-xl min-h-[44px]">
                {municipalitiesList.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] px-2.5 py-1 rounded-lg text-xs font-semibold"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeMunicipalityTag(tag)}
                      className="hover:text-rose-600 focus:outline-none"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="flex-1 flex items-center min-w-[150px]">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addMunicipalityTag();
                      }
                    }}
                    placeholder="Type area name & press Enter..."
                    className="w-full bg-transparent px-2 py-1 outline-none text-xs text-[#12151C]"
                  />
                  <button
                    type="button"
                    onClick={addMunicipalityTag}
                    className="px-2 py-1 bg-[#4C63FF] text-white rounded-lg text-[11px] font-bold hover:bg-[#3D52CC]"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-[#64748B] mt-1">
                Type municipal area name and press Enter or comma to add.
              </p>
            </div>

            {/* Delivery ETA Window */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-[#12151C] mb-1.5">ETA Window Label</label>
                <input
                  type="text"
                  required
                  value={etaDays}
                  onChange={(e) => setEtaDays(e.target.value)}
                  placeholder="e.g. Same Day - 24 Hrs, 1-2 Days"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 text-[#12151C] font-semibold outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#12151C] mb-1.5">Min ETA (Hours)</label>
                <input
                  type="number"
                  min={1}
                  value={minEtaHours}
                  onChange={(e) => setMinEtaHours(e.target.value)}
                  placeholder="12"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#12151C] mb-1.5">Max ETA (Hours)</label>
                <input
                  type="number"
                  min={1}
                  value={maxEtaHours}
                  onChange={(e) => setMaxEtaHours(e.target.value)}
                  placeholder="24"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                />
              </div>
            </div>
          </div>

          {/* Section B: Weight & Volumetric Tier Calculation */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-[#12151C]">
                <Scale className="w-4 h-4 text-[#4C63FF]" />
                <h3>Section B: Weight &amp; Volumetric Tier Calculation</h3>
              </div>
              <span className="text-[11px] font-mono text-[#4C63FF] bg-[#EEF2FF] px-2.5 py-0.5 rounded-full font-bold">
                Formula: Max(Actual, L×W×H/5000)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-[#12151C] mb-1">
                  Base Weight Tier (kg)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={baseWeightKg}
                    onChange={(e) => setBaseWeightKg(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 pr-10 font-bold text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                  />
                  <span className="absolute right-3 top-2.5 text-[#64748B] font-semibold">kg</span>
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">Default 1.0 kg tier</p>
              </div>

              <div>
                <label className="block font-bold text-[#12151C] mb-1">
                  Base Fare Rate (NPR)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={baseRate}
                    onChange={(e) => setBaseRate(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 pr-12 font-bold text-[#4C63FF] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                  />
                  <span className="absolute right-3 top-2.5 text-[#64748B] font-semibold">NPR</span>
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">Covers first {baseWeightKg}kg</p>
              </div>

              <div>
                <label className="block font-bold text-[#12151C] mb-1">
                  Additional Rate / kg (NPR)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={additionalPerKgRate}
                    onChange={(e) => setAdditionalPerKgRate(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 pr-14 font-bold text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                  />
                  <span className="absolute right-3 top-2.5 text-[#64748B] font-semibold">/ kg</span>
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">+NPR {additionalPerKgRate} per extra kg</p>
              </div>

              <div>
                <label className="block font-bold text-[#12151C] mb-1">
                  Volumetric Divisor
                </label>
                <input
                  type="number"
                  min="1000"
                  max="10000"
                  value={volumetricDivisor}
                  onChange={(e) => setVolumetricDivisor(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 font-semibold text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
                />
                <p className="text-[10px] text-[#64748B] mt-1">Standard IATA = 5000</p>
              </div>
            </div>

            <div className="pt-1">
              <label className="block font-bold text-[#12151C] mb-1">
                Optional Express Delivery Fee (NPR)
              </label>
              <input
                type="number"
                min="0"
                value={expressFee}
                onChange={(e) => setExpressFee(e.target.value)}
                placeholder="e.g. 250 (leave empty if not offered)"
                className="w-full sm:w-1/2 bg-white border border-[#CBD5E1] rounded-xl py-2.5 px-3 text-[#12151C] outline-none focus:ring-2 focus:ring-[#4C63FF]/20 focus:border-[#4C63FF]"
              />
            </div>
          </div>

          {/* Section C: Surcharges & Payment Rules */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#12151C] border-b border-[#E2E8F0] pb-2.5">
              <CreditCard className="w-4 h-4 text-[#4C63FF]" />
              <h3>Section C: Surcharges &amp; Payment Rules (COD, Remote, Free Threshold)</h3>
            </div>

            {/* COD Settings Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#12151C] flex items-center gap-2">
                    <span>Cash on Delivery (COD)</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        codAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {codAvailable ? 'ENABLED' : 'PREPAID ONLY'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    Allow customers in this zone to pay in cash upon receiving their parcel.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCodAvailable(!codAvailable)}
                  role="switch"
                  aria-checked={codAvailable}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    codAvailable ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      codAvailable ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {codAvailable && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block font-semibold text-[#12151C] mb-1">
                      COD Flat Handling Fee (NPR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={codFeeFlat}
                      onChange={(e) => setCodFeeFlat(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl py-2 px-3 text-[#12151C] outline-none focus:bg-white focus:border-[#4C63FF]"
                    />
                    <p className="text-[10px] text-[#64748B] mt-0.5">Fixed collection surcharge (e.g. NPR 20)</p>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#12151C] mb-1">
                      COD Percentage Fee (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={codFeePercent}
                      onChange={(e) => setCodFeePercent(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl py-2 px-3 text-[#12151C] outline-none focus:bg-white focus:border-[#4C63FF]"
                    />
                    <p className="text-[10px] text-[#64748B] mt-0.5">e.g. 1.5% of order value (0 = free)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Remote / ODA Surcharge Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#12151C] flex items-center gap-2">
                    <span>Remote / Out of Delivery Area (ODA) Surcharge</span>
                    {isRemoteArea && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                        REMOTE TARIFF ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    Adds extra freight fee for mountain or geographically difficult areas (e.g. Bajhang, Bajura, Darchula).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRemoteArea(!isRemoteArea)}
                  role="switch"
                  aria-checked={isRemoteArea}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    isRemoteArea ? 'bg-[#4C63FF]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isRemoteArea ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {isRemoteArea && (
                <div className="pt-2 border-t border-gray-100">
                  <label className="block font-semibold text-[#12151C] mb-1">
                    Remote / ODA Surcharge Amount (NPR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={remoteSurcharge}
                    onChange={(e) => setRemoteSurcharge(e.target.value)}
                    placeholder="50"
                    className="w-full sm:w-1/2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl py-2 px-3 text-[#12151C] font-bold outline-none focus:bg-white focus:border-[#4C63FF]"
                  />
                  <p className="text-[10px] text-[#64748B] mt-0.5">Fixed additional freight for remote delivery</p>
                </div>
              )}
            </div>

            {/* Free Delivery Threshold */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <label className="block font-bold text-[#12151C] mb-1">
                Free Delivery Order Threshold (NPR)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(e.target.value)}
                  placeholder="5000"
                  className="w-full sm:w-1/2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl py-2.5 px-3 pr-12 font-mono font-bold text-[#12151C] outline-none focus:bg-white focus:border-[#4C63FF]"
                />
                <span className="absolute sm:left-[45%] right-3 top-2.5 text-[#64748B] font-semibold">NPR</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-1">
                Orders with subtotal at or above this amount receive free delivery (0 to disable).
              </p>
            </div>
          </div>

          {/* Section D: Interactive Live Rate Calculator Simulator */}
          <div className="bg-gradient-to-br from-[#1E2433] to-[#12151C] text-white rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#8C9CFF]" />
                <div>
                  <h3 className="text-sm font-bold text-white">Interactive Live Fare Simulator</h3>
                  <p className="text-[11px] text-gray-300">
                    Test how this zone calculates freight for any parcel dimensions, weight, &amp; order value
                  </p>
                </div>
              </div>
              <span className="text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                <Zap className="w-3 h-3" /> Live Simulator
              </span>
            </div>

            {/* Test Inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Order Value</label>
                <div className="relative">
                  <input
                    type="number"
                    value={simOrderValue}
                    onChange={(e) => setSimOrderValue(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-1.5 px-2.5 text-white font-bold outline-none focus:bg-white/20"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-gray-400">NPR</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Actual Weight</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={simWeightKg}
                    onChange={(e) => setSimWeightKg(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-1.5 px-2.5 text-white font-bold outline-none focus:bg-white/20"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-gray-400">kg</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Length (cm)</label>
                <input
                  type="number"
                  value={simLengthCm}
                  onChange={(e) => setSimLengthCm(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl py-1.5 px-2.5 text-white outline-none focus:bg-white/20"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Width (cm)</label>
                <input
                  type="number"
                  value={simWidthCm}
                  onChange={(e) => setSimWidthCm(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl py-1.5 px-2.5 text-white outline-none focus:bg-white/20"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={simHeightCm}
                  onChange={(e) => setSimHeightCm(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl py-1.5 px-2.5 text-white outline-none focus:bg-white/20"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={simIsCod}
                  disabled={!codAvailable}
                  onChange={(e) => setSimIsCod(e.target.checked)}
                  className="rounded text-[#4C63FF] focus:ring-0"
                />
                <span className="font-semibold">Test as Cash on Delivery (COD)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={simIsRemote}
                  onChange={(e) => setSimIsRemote(e.target.checked)}
                  className="rounded text-[#4C63FF] focus:ring-0"
                />
                <span className="font-semibold">Test as Remote Address (+NPR {remoteSurcharge})</span>
              </label>
            </div>

            {/* Simulation Results Breakdown Card */}
            <div className="bg-white/5 border border-white/15 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                      Billable Weight
                    </span>
                    <span className="text-base font-black text-amber-300">
                      {simResult.chargeableWeightKg} kg
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-300 pl-3 border-l border-white/10">
                    Actual: <span className="font-semibold">{simResult.actualWeightKg} kg</span> · Volumetric:{' '}
                    <span className="font-semibold">{simResult.volumetricWeightKg} kg</span>{' '}
                    {simResult.isVolumetricApplied && (
                      <span className="text-amber-300 font-bold ml-1">(Volumetric Applied)</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                    Calculated Total Delivery
                  </span>
                  <span className="text-xl font-black text-emerald-400">
                    {simResult.isFreeShipping ? 'FREE (Threshold Met)' : `NPR ${simResult.totalDeliveryCharge.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>

              {/* Step-by-step cost breakdown line */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-white/5 p-2 rounded-lg">
                  <span className="text-gray-400 block text-[10px]">Base Freight</span>
                  <span className="font-bold text-white">NPR {simResult.baseFreight}</span>
                  <span className="text-[9px] text-gray-400 block">Up to {baseWeightKg}kg</span>
                </div>

                <div className="bg-white/5 p-2 rounded-lg">
                  <span className="text-gray-400 block text-[10px]">Extra Weight Charge</span>
                  <span className="font-bold text-white">NPR {simResult.incrementalFreight}</span>
                  <span className="text-[9px] text-gray-400 block">
                    {simResult.breakdown.extraWeightKg} kg × NPR {additionalPerKgRate}
                  </span>
                </div>

                <div className="bg-white/5 p-2 rounded-lg">
                  <span className="text-gray-400 block text-[10px]">Remote / ODA Fee</span>
                  <span className="font-bold text-white">NPR {simResult.remoteSurchargeFee}</span>
                  <span className="text-[9px] text-gray-400 block">
                    {simIsRemote ? 'Remote address' : 'Standard'}
                  </span>
                </div>

                <div className="bg-white/5 p-2 rounded-lg">
                  <span className="text-gray-400 block text-[10px]">COD Handling Fee</span>
                  <span className="font-bold text-white">NPR {simResult.codFee}</span>
                  <span className="text-[9px] text-gray-400 block">
                    {simResult.breakdown.codFlatPortion > 0 ? `NPR ${simResult.breakdown.codFlatPortion} flat` : ''}
                    {simResult.breakdown.codPercentPortion > 0
                      ? ` + ${codFeePercent}% (NPR ${Math.round(simResult.breakdown.codPercentPortion)})`
                      : ''}
                    {simResult.codFee === 0 ? 'Free COD' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Status toggle & footer buttons */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-[#4C63FF] focus:ring-0"
              />
              <span className="font-bold text-[#12151C]">Zone Active for Customer Checkout</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-[#E6E8EE] text-xs font-bold text-[#6B7280] hover:bg-[#F4F5F8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#4C63FF] text-white text-xs font-bold shadow-lg shadow-[#4C63FF]/25 hover:bg-[#3D52CC] transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {isEditing ? 'Save Tariff Changes' : 'Create Shipping Zone'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

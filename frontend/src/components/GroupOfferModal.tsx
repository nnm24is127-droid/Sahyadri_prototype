import React, { useState } from 'react';
import {
  Users,
  X,
  Check,
  Building2,
  MapPin,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Clock,
  Layers,
  Coins,
} from 'lucide-react';
import { GroupOffer, GroupMatchResponse } from '../types';
import { REGIONAL_METADATA } from '../config/api';
import { groupOfferService } from '../services/apiClient';

interface GroupOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOfferCreated: (offer: GroupOffer) => void;
}

export const GroupOfferModal: React.FC<GroupOfferModalProps> = ({
  isOpen,
  onClose,
  onOfferCreated,
}) => {
  const [cropName, setCropName] = useState('Tomato');
  const [targetQuantity, setTargetQuantity] = useState(150);
  const [unit, setUnit] = useState('kg');
  const [maxPrice, setMaxPrice] = useState<number | ''>(32);
  const [targetTaluk, setTargetTaluk] = useState('All Taluks');
  const [hubName, setHubName] = useState(REGIONAL_METADATA.HUBS[0]);
  const [buyerName, setBuyerName] = useState('Ocean Pearl Hotels & Catering');
  const [deliveryAddress, setDeliveryAddress] = useState('Gateway Kitchen, Kankanady, Mangaluru - 575002');
  const [organicOnly, setOrganicOnly] = useState(false);

  // Matcher state
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<GroupMatchResponse | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Run deterministic matching preview
  const handleRunMatcher = async () => {
    setIsMatching(true);
    setMatchError(null);
    setActionError(null);
    try {
      const res = await groupOfferService.matchGroupPool({
        cropName,
        targetQuantity,
        unit,
        maxUnitPrice: maxPrice !== '' ? Number(maxPrice) : undefined,
        taluk: targetTaluk !== 'All Taluks' ? targetTaluk : undefined,
        organicOnly,
      });
      setMatchResult(res);
    } catch (err: any) {
      setMatchError(err.message || 'Failed to calculate matching pool.');
    } finally {
      setIsMatching(false);
    }
  };

  // Quick preset for hackathon demo
  const handleApplyDemoPreset = () => {
    setCropName('Tomato');
    setTargetQuantity(150);
    setUnit('kg');
    setMaxPrice(35);
    setTargetTaluk('All Taluks');
  };

  const handleCreateOffer = async (andAccept: boolean = false) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const offer = await groupOfferService.createGroupOffer({
        buyerName,
        cropName,
        targetQuantity,
        unit,
        offeredUnitPrice: matchResult?.weightedAveragePrice || (maxPrice !== '' ? Number(maxPrice) : 30),
        targetTaluk,
        aggregationHubName: hubName,
        deliveryAddress,
        deliveryTerms: 'Consolidated hub aggregation & temperature-controlled delivery',
        contributions: matchResult?.contributions,
        expiresInMinutes: 60,
      });

      if (andAccept && offer.id) {
        const accepted = await groupOfferService.acceptGroupOffer(offer.id);
        onOfferCreated(accepted);
      } else {
        onOfferCreated(offer);
      }
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit group offer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 via-indigo-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <span>Smart Group Selling & Pooling Matcher</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full tracking-wide">
                  PS 1.2 Core
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Deterministic aggregation combining marginal farmer lots to fulfill commercial demand
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Quick Demo Scenario Button */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Hackathon Demo Target:</strong> Needs 150 kg Tomatoes (Aggregates 40 kg + 60 kg + 50 kg).
              </span>
            </div>
            <button
              type="button"
              onClick={handleApplyDemoPreset}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors"
            >
              Load 150 kg Preset
            </button>
          </div>

          {/* Form Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Crop Required (ಬೆಳೆ)
              </label>
              <input
                type="text"
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                placeholder="e.g. Tomato, Arecanut, Chilli"
                className="w-full text-sm p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-semibold text-slate-800"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Target Quantity & Unit
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={targetQuantity}
                  onChange={(e) => setTargetQuantity(Number(e.target.value))}
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-800"
                  required
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="text-sm p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-slate-50"
                >
                  <option value="kg">kg</option>
                  <option value="quintal">quintal</option>
                  <option value="nut">nuts</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Max Budget Ceiling (₹ / {unit})
              </label>
              <input
                type="number"
                min="1"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                placeholder="No price limit"
                className="w-full text-sm p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-blue-700"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Preferred Cluster / Taluk
              </label>
              <select
                value={targetTaluk}
                onChange={(e) => setTargetTaluk(e.target.value)}
                className="w-full text-sm p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-slate-50"
              >
                <option value="All Taluks">All Taluks (Cross-Cluster Pooling)</option>
                {REGIONAL_METADATA.TALUKS_BY_DISTRICT['Dakshina Kannada']
                  .concat(REGIONAL_METADATA.TALUKS_BY_DISTRICT['Udupi'])
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={organicOnly}
                onChange={(e) => setOrganicOnly(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Organic Certified Lots Only</span>
            </label>

            <button
              type="button"
              onClick={handleRunMatcher}
              disabled={isMatching || !cropName || targetQuantity <= 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isMatching ? 'Finding Compatible Lots...' : 'Run Deterministic Matcher'}</span>
            </button>
          </div>

          {/* Matcher Result Section */}
          {matchError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{matchError}</span>
            </div>
          )}

          {matchResult && (
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in duration-300">
              {/* Match Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                      matchResult.matchStatus === 'full'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : matchResult.matchStatus === 'insufficient_supply'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}
                  >
                    {matchResult.matchStatus === 'full'
                      ? '✓ Exact Full Supply Matched'
                      : matchResult.matchStatus === 'insufficient_supply'
                      ? '⚠ Partial Supply / Shortfall'
                      : '✗ No Compatible Supply'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {matchResult.totalMatchedQuantity} of {matchResult.targetQuantity} {matchResult.unit} aggregated
                  </span>
                </div>

                {matchResult.totalEstimatedAmount > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Weighted Avg Price</span>
                    <span className="text-sm font-extrabold text-blue-700">
                      ₹{matchResult.weightedAveragePrice.toFixed(2)} / {matchResult.unit}
                    </span>
                  </div>
                )}
              </div>

              {/* Deterministic Explanation */}
              <div className="p-3 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed">
                <strong className="text-slate-900 block mb-1">Deterministic Matching Explanation:</strong>
                <p>{matchResult.matchingExplanation}</p>
              </div>

              {/* Farmer Contributions Breakdown */}
              {matchResult.contributions.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Contributing Smallholder Lots ({matchResult.contributions.length})</span>
                    <span className="text-slate-500 font-normal">
                      Est. Total: ₹{matchResult.totalEstimatedAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {matchResult.contributions.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{c.farmerName}</span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {c.farmerLocation}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-extrabold text-slate-900 block">
                            {c.quantity} {c.unit} @ ₹{c.unitPrice.toFixed(2)}
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700">
                            Subtotal: ₹{c.subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={isSubmitting || !matchResult || !matchResult.isAchievable}
              onClick={() => handleCreateOffer(true)}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Processing Order...' : 'Accept Pool & Create Single Parent Order'}</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleCreateOffer(false)}
              className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Users className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving Offer...' : 'Create Proposed Group Offer'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

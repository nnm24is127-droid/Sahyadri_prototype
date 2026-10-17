import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  CheckCircle2,
  MapPin,
  Calendar,
  User,
  Link2,
  Plus,
  BadgeCheck,
  AlertCircle,
  Truck,
  Package,
  Sprout,
  Receipt
} from 'lucide-react';
import { TraceabilityEvent } from '../types';
import { traceabilityService } from '../services/apiClient';

interface TraceabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
  orderId?: string;
}

export const TraceabilityModal: React.FC<TraceabilityModalProps> = ({
  isOpen,
  onClose,
  orderCode,
  orderId,
}) => {
  const [timeline, setTimeline] = useState<TraceabilityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [saving, setSaving] = useState(false);

  // New Event Form State
  const [stageName, setStageName] = useState('harvest');
  const [location, setLocation] = useState('Bantwal APMC Yard');
  const [qualityGrade, setQualityGrade] = useState('Grade A (Export Quality)');
  const [notes, setNotes] = useState('');
  const [isIndependentlyVerified, setIsIndependentlyVerified] = useState(false);
  const [verificationSource, setVerificationSource] = useState('Self-reported by Farmer');

  useEffect(() => {
    if (isOpen) {
      loadTimeline();
    }
  }, [isOpen, orderCode, orderId]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const data = await traceabilityService.getTimeline(orderId || orderCode);
      setTimeline(data);
    } catch (err) {
      console.error('Failed to load traceability events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;
    setSaving(true);
    try {
      await traceabilityService.recordEvent({
        orderId: orderId || orderCode,
        stageName,
        location,
        qualityGrade,
        notes,
        isIndependentlyVerified,
        verificationSource: isIndependentlyVerified ? 'APMC Yard Inspector #DK-09' : verificationSource,
      });
      setIsAddingEvent(false);
      setNotes('');
      await loadTimeline();
    } catch (err) {
      console.error('Failed to record event:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const getStageIcon = (stage: string) => {
    const s = stage.toLowerCase();
    if (s.includes('harvest')) return <Sprout className="w-4 h-4 text-emerald-600" />;
    if (s.includes('pack')) return <Package className="w-4 h-4 text-amber-600" />;
    if (s.includes('handover') || s.includes('dispatch') || s.includes('transit'))
      return <Truck className="w-4 h-4 text-blue-600" />;
    return <Receipt className="w-4 h-4 text-purple-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                ಉತ್ಪನ್ನ ಪತ್ತೆಹಚ್ಚುವಿಕೆ (Produce Traceability Ledger)
              </h3>
              <p className="text-xs text-slate-500">
                Produce journey anchored on ProduceTraceability.sol with independent audits
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
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
            <div>
              <span className="font-semibold block">Order Reference: {orderCode}</span>
              <span className="text-emerald-700 font-mono text-[11px]">Contract: ProduceTraceability.sol (0xCf7E...0Fc9)</span>
            </div>
            <button
              onClick={() => setIsAddingEvent(!isAddingEvent)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Milestone</span>
            </button>
          </div>

          {/* Add Milestone Form */}
          {isAddingEvent && (
            <form onSubmit={handleRecordEvent} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Record Traceability Milestone
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingEvent(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Milestone Stage</label>
                  <select
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-slate-200 focus:border-emerald-500 outline-none"
                  >
                    <option value="harvest">Harvest</option>
                    <option value="packing">Packing & Sorting</option>
                    <option value="handover">Handover to Hub / Logistics</option>
                    <option value="receipt">Receipt at Destination</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Bantwal APMC Yard"
                    className="w-full p-2 bg-white rounded-lg border border-slate-200 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quality Grade</label>
                  <input
                    type="text"
                    value={qualityGrade}
                    onChange={(e) => setQualityGrade(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-slate-200 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Verification Type</label>
                  <div className="flex items-center gap-2 pt-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isIndependentlyVerified}
                        onChange={(e) => setIsIndependentlyVerified(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-slate-700 font-medium">Independently Verified by Third Party</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="text-xs">
                <label className="font-semibold text-slate-700 block mb-1">Observation Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Inspected crate seal; moisture within tolerance"
                  className="w-full p-2 bg-white rounded-lg border border-slate-200 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingEvent(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !location.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Anchoring...' : 'Save & Anchor On-Chain'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Loading verified blockchain milestones...
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {timeline.map((event) => (
                <div key={event.id} className="relative group">
                  {/* Pin Dot */}
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-emerald-500 shadow-sm flex items-center justify-center text-emerald-600">
                    {getStageIcon(event.stageName)}
                  </div>

                  {/* Event Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 hover:border-emerald-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 capitalize">
                          {event.stageName}
                        </h4>
                        {/* Clear Distinction: Independently Verified vs Self-reported */}
                        {event.isIndependentlyVerified ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3 text-emerald-600" />
                            Independently Verified ({event.verificationSource || 'APMC Yard QC'})
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Self-Reported Claim ({event.verificationSource || 'Producer Claim'})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(event.eventTimestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        {event.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Recorded by: <strong>{event.recordedBy}</strong>
                      </span>
                      {event.qualityGrade && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                          {event.qualityGrade}
                        </span>
                      )}
                    </div>

                    {event.metadata && (
                      <div className="bg-white p-2 rounded-lg border border-slate-200/80 text-[11px] text-slate-600 space-y-0.5">
                        {Object.entries(event.metadata).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-slate-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                            <span className="font-semibold text-slate-700">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Hash: {event.eventHash.slice(0, 16)}...</span>
                      {event.onChainTxHash && (
                        <span className="text-emerald-700 flex items-center gap-0.5 font-semibold">
                          <Link2 className="w-3 h-3" />
                          On-Chain Tx: {event.onChainTxHash.slice(0, 14)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

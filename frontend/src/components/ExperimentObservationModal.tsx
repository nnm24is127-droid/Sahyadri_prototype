import React, { useState } from 'react';
import { FlaskConical, X, Sparkles, Plus, Calculator, ArrowRight, AlertTriangle } from 'lucide-react';
import { Experiment } from '../types';
import { labService } from '../services/apiClient';

interface ExperimentObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  experiment: Experiment | null;
  onObservationAdded: (updatedExp: Experiment) => void;
}

export const ExperimentObservationModal: React.FC<ExperimentObservationModalProps> = ({
  isOpen,
  onClose,
  experiment,
  onObservationAdded,
}) => {
  const [metricName, setMetricName] = useState('Harvest Pick Yield (kg)');
  const [controlValue, setControlValue] = useState<number>(100);
  const [expValue, setExpValue] = useState<number>(120);
  const [costControl, setCostControl] = useState<number>(600);
  const [costExp, setCostExp] = useState<number>(350);
  const [notes, setNotes] = useState('Observation after 14 days of trial application.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !experiment) return null;

  // Immediate deterministic preview on client
  const diff = Math.round((expValue - controlValue) * 100) / 100;
  const pct = controlValue !== 0 ? Math.round((diff / controlValue) * 10000) / 100 : 0;
  const costDiff = Math.round((costExp - costControl) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await labService.recordObservation(experiment.id, {
        metricName,
        controlMetricValue: Number(controlValue),
        experimentalMetricValue: Number(expValue),
        inputCostControl: Number(costControl),
        inputCostExperimental: Number(costExp),
        notes,
      });
      onObservationAdded(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record experiment observation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Record Plot Observation (ಪ್ರಾಯೋಗಿಕ ಫಲಿತಾಂಶ)
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">
                {experiment.title}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Metric Measured (ಅಳತೆ ಮಾಡಿದ ಮಾನದಂಡ)
            </label>
            <input
              type="text"
              value={metricName}
              onChange={(e) => setMetricName(e.target.value)}
              placeholder="e.g. Yield weight (kg), Fruit count, Water (litres)"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-purple-500 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Control Plot Value ({experiment.controlMethod.slice(0, 20)}...)
              </label>
              <input
                type="number"
                step="0.01"
                value={controlValue}
                onChange={(e) => setControlValue(parseFloat(e.target.value) || 0)}
                className="w-full text-sm font-bold p-1.5 rounded-lg border border-slate-300 outline-none bg-white"
                required
              />
            </div>
            <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
              <label className="text-[11px] font-bold text-purple-900 block mb-1">
                Experimental Plot Value ({experiment.experimentalMethod.slice(0, 20)}...)
              </label>
              <input
                type="number"
                step="0.01"
                value={expValue}
                onChange={(e) => setExpValue(parseFloat(e.target.value) || 0)}
                className="w-full text-sm font-bold p-1.5 rounded-lg border border-purple-300 outline-none bg-white text-purple-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Control Input Cost (₹)
              </label>
              <input
                type="number"
                step="1"
                value={costControl}
                onChange={(e) => setCostControl(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Experimental Input Cost (₹)
              </label>
              <input
                type="number"
                step="1"
                value={costExp}
                onChange={(e) => setCostExp(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 outline-none"
              />
            </div>
          </div>

          {/* Deterministic calculation preview */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Deterministic Backend Code Calculation Preview:
            </span>
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span>Metric Difference:</span>
              <span className={diff >= 0 ? 'text-forest-700' : 'text-red-700'}>
                {diff >= 0 ? `+${diff}` : diff} ({pct >= 0 ? `+${pct}%` : `${pct}%`})
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Cost Delta:</span>
              <span className={costDiff <= 0 ? 'text-forest-700 font-semibold' : 'text-slate-700'}>
                {costDiff <= 0 ? `₹${costDiff} (Cost Savings)` : `+₹${costDiff} (Higher Expenditure)`}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Field Observations & Weather Conditions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Rainfall after application, pest pressure, vigor"
              className="w-full text-xs p-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none"
              rows={2}
            />
          </div>

          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              FarmLab Rule: Calculations are strictly computed in deterministic backend code. AI provides agronomic synthesis and limitation notes without claiming universal proof.
            </span>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? 'Calculating & Synthesizing...' : 'Submit Observation & Run AI Synthesis'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

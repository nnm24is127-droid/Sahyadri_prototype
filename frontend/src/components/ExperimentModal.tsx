import React, { useState } from 'react';
import { FlaskConical, X, Sparkles, Plus, Check } from 'lucide-react';
import { Experiment } from '../types';
import { labService } from '../services/apiClient';

interface ExperimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExperimentCreated: (exp: Experiment) => void;
}

export const ExperimentModal: React.FC<ExperimentModalProps> = ({
  isOpen,
  onClose,
  onExperimentCreated,
}) => {
  const [title, setTitle] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [cropTested, setCropTested] = useState('Black Pepper (ಕಾಳುಮೆಣಸು)');
  const [controlMethod, setControlMethod] = useState('');
  const [experimentalMethod, setExperimentalMethod] = useState('');
  const [plotSize, setPlotSize] = useState('20 vines trial');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handlePreset = (type: 'jeevamrutha' | 'biochar' | 'trichoderma') => {
    if (type === 'jeevamrutha') {
      setTitle('Jeevamrutha Ferment vs Chemical Urea on Black Pepper Berry Size');
      setHypothesis('Bi-weekly Jeevamrutha soil drench will maintain berry weight while cutting synthetic fertilizer expenses by 60%.');
      setCropTested('Black Pepper (Panniyur-1)');
      setControlMethod('Standard chemical NPK (100:40:140g) biannual dressing.');
      setExperimentalMethod('500ml fresh cow-dung/urine Jeevamrutha drench every 14 days with leaf mulch.');
      setPlotSize('25 vines per block');
    } else if (type === 'biochar') {
      setTitle('Areca Leaf Sheath Biochar for Coastal Laterite Moisture Retention');
      setHypothesis('Amending soil with pyrolyzed areca sheath biochar will reduce irrigation frequency from alternate days to every 4 days.');
      setCropTested('Arecanut Palms (Mangala Variety)');
      setControlMethod('Standard red soil + farmyard manure basin.');
      setExperimentalMethod('Incorporation of 2 kg crushed areca sheath biochar + compost in palm basin.');
      setPlotSize('30 palms trial');
    } else {
      setTitle('Trichoderma viride Bio-Control for Mattu Gulla Root Health');
      setHypothesis('Soil inoculation with Trichoderma viride will lower damping-off disease by 80% without systemic fungicide.');
      setCropTested('Udupi Mattu Gulla');
      setControlMethod('Chemical Carbendazim drenching at transplanting.');
      setExperimentalMethod('Trichoderma enriched neem cake applied at root zone.');
      setPlotSize('100 seedlings');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !hypothesis) return;

    setIsSubmitting(true);
    try {
      const exp = await labService.createExperiment({
        title,
        hypothesis,
        cropTested,
        controlMethod,
        experimentalMethod,
        plotSizeDescription: plotSize,
      });
      onExperimentCreated(exp);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-sm">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                FarmLab — ಕೃಷಿ ಪ್ರಯೋಗ (Agricultural Experiment)
              </h3>
              <p className="text-xs text-slate-500">
                Plan and track small-scale farm trials with scientific control vs trial blocks
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
          {/* Quick Trial Presets */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-xs font-semibold text-slate-600 mb-1.5 block">
              Quick Trial Design Templates:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlePreset('jeevamrutha')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-purple-300 hover:bg-purple-50 transition-colors"
              >
                1. Jeevamrutha Organic Trial
              </button>
              <button
                type="button"
                onClick={() => handlePreset('biochar')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-purple-300 hover:bg-purple-50 transition-colors"
              >
                2. Areca Biochar Soil Test
              </button>
              <button
                type="button"
                onClick={() => handlePreset('trichoderma')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-purple-300 hover:bg-purple-50 transition-colors"
              >
                3. Trichoderma Bio-control
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Experiment Title (ಪ್ರಯೋಗದ ಶೀರ್ಷಿಕೆ)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Jeevamrutha vs Urea on Pepper"
              className="w-full text-sm p-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Hypothesis (ನಿರೀಕ್ಷಿತ ಉದ್ದೇಶ)
            </label>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="What do you expect to observe or save? (e.g., lower disease incidence or higher berry count)"
              className="w-full text-sm p-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Crop Tested
              </label>
              <input
                type="text"
                value={cropTested}
                onChange={(e) => setCropTested(e.target.value)}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Trial Plot Size
              </label>
              <input
                type="text"
                value={plotSize}
                onChange={(e) => setPlotSize(e.target.value)}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Control Method (Standard)
              </label>
              <textarea
                value={controlMethod}
                onChange={(e) => setControlMethod(e.target.value)}
                placeholder="Current normal practice"
                className="w-full text-xs p-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Experimental Method (Test)
              </label>
              <textarea
                value={experimentalMethod}
                onChange={(e) => setExperimentalMethod(e.target.value)}
                placeholder="New method being tested"
                className="w-full text-xs p-2 rounded-xl border border-purple-300 focus:border-purple-500 outline-none bg-purple-50/30"
                rows={2}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !title}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'ಪ್ರಯೋಗ ಸೃಷ್ಟಿಸಲಾಗುತ್ತಿದೆ...' : 'ಪ್ರಯೋಗವನ್ನು ಪ್ರಾರಂಭಿಸಿ (Create Experiment)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

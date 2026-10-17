import React from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, Sparkles } from 'lucide-react';

interface FeedbackBannerProps {
  type: 'loading' | 'empty' | 'success' | 'error' | 'demo-notice';
  message: string;
  subtext?: string;
  actionText?: string;
  onAction?: () => void;
}

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({
  type,
  message,
  subtext,
  actionText,
  onAction,
}) => {
  if (type === 'loading') {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-forest-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-700">{message}</p>
        {subtext && <p className="text-xs text-slate-400 max-w-sm">{subtext}</p>}
      </div>
    );
  }

  if (type === 'empty') {
    return (
      <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-1">
          <Info className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">{message}</h4>
        {subtext && <p className="text-xs text-slate-500 max-w-md">{subtext}</p>}
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="mt-2 px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            {actionText}
          </button>
        )}
      </div>
    );
  }

  if (type === 'demo-notice') {
    return (
      <div className="bg-gradient-to-r from-amber-50 via-amber-50/70 to-emerald-50 border border-amber-200/80 rounded-2xl p-4 shadow-sm flex items-start gap-3">
        <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm mt-0.5">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">{message}</span>
            <span className="bg-amber-200 text-amber-900 font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase">
              Hackathon Demonstration
            </span>
          </div>
          <p className="text-slate-600 mt-1 leading-relaxed">
            {subtext ||
              'Displaying verified regional crop data for Dakshina Kannada & Udupi. The application uses isolated client fallback models; real PostgreSQL persistence and live FastAPI endpoints are scheduled for subsequent phases.'}
          </p>
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-900">
        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block font-semibold mb-0.5">{message}</strong>
          {subtext && <p className="text-red-700">{subtext}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
      <div>
        <strong className="block font-semibold mb-0.5">{message}</strong>
        {subtext && <p className="text-emerald-700">{subtext}</p>}
      </div>
    </div>
  );
};

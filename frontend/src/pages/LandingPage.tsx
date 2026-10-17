import React from 'react';
import { Sprout, Mic, Users, ShieldCheck, Stethoscope, FlaskConical, ArrowRight, TrendingUp, CheckCircle2, ChevronRight } from 'lucide-react';
import { UserRole } from '../types';

interface LandingPageProps {
  onSelectRole: (role: UserRole) => void;
  onOpenAuth: (mode?: 'login' | 'register', role?: UserRole) => void;
  language: 'kn' | 'en';
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectRole,
  onOpenAuth,
  language,
}) => {
  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 bg-gradient-to-b from-forest-50/70 via-white to-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forest-100/80 border border-forest-200 text-forest-800 text-xs font-semibold">
            <Sprout className="w-4 h-4 text-forest-600" />
            <span>Problem Statement PS 1.2 — Coastal Karnataka Agritech Solution</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15] max-w-4xl mx-auto">
            {language === 'kn' ? (
              <>
                ದಕ್ಷಿಣ ಕನ್ನಡ & ಉಡುಪಿಯ ಕೃಷಿಕರಿಗೆ{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-forest-600 to-forest-800">
                  ನೇರ ಮಾರುಕಟ್ಟೆ ಕ್ರಾಂತಿ
                </span>
              </>
            ) : (
              <>
                From Farm to Buyer:{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-forest-600 to-forest-800">
                  Direct Market Access
                </span>{' '}
                for Marginal Farmers
              </>
            )}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {language === 'kn'
              ? 'ಮಧ್ಯವರ್ತಿಗಳ ಹಾವಳಿಯಿಲ್ಲದೆ, ಕನ್ನಡ ವಾಯ್ಸ್ ಲಿಸ್ಟಿಂಗ್, AI ಬೆಲೆ ಮಾರ್ಗದರ್ಶನ, ಸ್ಮಾರ್ಟ್ ಗ್ರೂಪ್ ಸೆಲ್ಲಿಂಗ್ ಮತ್ತು ಬ್ಲಾಕ್‌ಚೈನ್ ವಿಶ್ವಾಸದೊಂದಿಗೆ ಕರಾವಳಿ ಬೆಳೆಗಾರರನ್ನು ಹೊಟೇಲ್ ಮತ್ತು ವ್ಯಾಪಾರಿಗಳಿಗೆ ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸುವ ವೇದಿಕೆ.'
              : 'Connecting smallholders in Bantwal, Mangalore, Puttur, and Udupi directly with bulk buyers, restaurants, and caterers — powered by Kannada voice listing, AI crop forensics, group pooling, and verifiable blockchain escrow.'}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => onSelectRole('farmer')}
              className="w-full sm:w-auto px-6 py-3.5 bg-forest-600 hover:bg-forest-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-forest-600/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
              <Sprout className="w-5 h-5" />
              <span>{language === 'kn' ? 'ಕೃಷಿಕರಾಗಿ ಪ್ರವೇಶಿಸಿ (Farmer Portal)' : 'Farmer Portal (Farm Owner)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSelectRole('buyer')}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
              <Users className="w-5 h-5 text-forest-400" />
              <span>{language === 'kn' ? 'ಖರೀದಿದಾರರಾಗಿ ಪ್ರವೇಶಿಸಿ (Buyer Portal)' : 'Buyer Portal (Restaurant / Retail)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Regional Crops Marquee / Chips */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 font-medium">
            <span className="text-slate-400">Coastal Produce Focus:</span>
            <span className="bg-white px-2.5 py-1 rounded-full border border-slate-200">ಅಡಿಕೆ (Arecanut)</span>
            <span className="bg-white px-2.5 py-1 rounded-full border border-slate-200">ಮಟ್ಟುಗುಳ್ಳ (Udupi Mattu Gulla)</span>
            <span className="bg-white px-2.5 py-1 rounded-full border border-slate-200">ಕಾಳುಮೆಣಸು (Black Pepper)</span>
            <span className="bg-white px-2.5 py-1 rounded-full border border-slate-200">ತೆಂಗು (Coconut)</span>
            <span className="bg-white px-2.5 py-1 rounded-full border border-slate-200">ಶಂಕರಪುರ ಮಲ್ಲಿಗೆ (Jasmine)</span>
          </div>
        </div>
      </section>

      {/* Ground Realities & Challenge Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-forest-600">The Problem (PS 1.2)</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Why Marginal Farmers in Coastal Karnataka Struggle
          </h2>
          <p className="text-sm text-slate-500">
            Small landholders cultivate premium GI crops but remain trapped by commercial and structural bottlenecks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="font-bold text-base text-slate-900">Heavy Intermediary Losses</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Middlemen and commission agents deduct 30% to 50% between the farm gate and retail tables in Mangalore & Manipal. Small farmers have zero price leverage.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="font-bold text-base text-slate-900">Fragmented Small Lot Sizes</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Caterers and supermarkets require bulk lots (e.g. 2,000 kg). A 1-acre farmer with 200 kg cannot participate without local aggregation pooling.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-bold text-base text-slate-900">Crop Health & Tech Barriers</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Monsoon diseases like Koleroga destroy areca crops overnight. Text-heavy English apps fail in the field without native Kannada voice interaction.
            </p>
          </div>
        </div>
      </section>

      {/* Core Modules Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-forest-600">The Solution</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            6 Specialized Agritech Modules Built for Dakshina Kannada & Udupi
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. Kannada Voice Listing */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-forest-300 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center group-hover:bg-forest-600 group-hover:text-white transition-colors">
              <Mic className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-slate-900">Kannada Voice Listing</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Speak naturally in Kannada. The AI parses crop name, quantity, price, and taluk into an editable listing card.
            </p>
          </div>

          {/* 2. FarmForensics */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-red-300 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-slate-900">FarmForensics</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Investigate Koleroga, quick wilt, and leaf spot with AI diagnostic assistance and clear agricultural advisory disclaimers.
            </p>
          </div>

          {/* 3. FarmLab */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-purple-300 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <FlaskConical className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-slate-900">FarmLab</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Plan and record small-scale trials (e.g. Jeevamrutha organic ferment vs NPK) with scientific control vs experimental data points.
            </p>
          </div>

          {/* 4. Smart Group Selling */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-blue-300 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-slate-900">Smart Group Selling</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pooling algorithm clusters surplus lots across Bantwal, Puttur, and Udupi to fulfill bulk institutional purchases.
            </p>
          </div>

          {/* 5. AI Price Assistant */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-amber-300 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-slate-900">AI Price Assistant</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              APMC Mandi benchmarks for Dakshina Kannada & Udupi + AI fair price analysis with transparent data source labeling.
            </p>
          </div>

          {/* 6. Blockchain Agreement & Escrow */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-emerald-300 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-slate-900">Blockchain Agreements & Trace</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cryptographic SHA-256 agreement hash and test token payment escrow in Solidity, with immutable seed-to-delivery traceability.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

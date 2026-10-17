import React, { useState, useEffect } from 'react';
import {
  X,
  Sprout,
  ShoppingCart,
  ShieldCheck,
  UserCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { UserRole, User as UserType } from '../types';
import { authService } from '../services/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserType, role: UserRole) => void;
  initialMode?: 'login' | 'register';
  initialRole?: UserRole;
}

const TALUKS_BY_DISTRICT: Record<string, string[]> = {
  'Dakshina Kannada': ['Bantwal', 'Mangalore', 'Puttur', 'Belthangady', 'Sullia', 'Moodabidri', 'Kadaba'],
  'Udupi': ['Udupi', 'Kundapura', 'Karkala', 'Byndoor', 'Brahmavara', 'Kapu', 'Hebri'],
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
  initialRole = 'farmer',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [role, setRole] = useState<'farmer' | 'buyer'>(initialRole === 'admin' ? 'farmer' : initialRole);
  
  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Register fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [district, setDistrict] = useState<'Dakshina Kannada' | 'Udupi'>('Dakshina Kannada');
  const [taluk, setTaluk] = useState('Bantwal');
  const [village, setVillage] = useState('');
  const [language, setLanguage] = useState<'kn' | 'en'>('kn');

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    if (initialRole !== 'admin') {
      setRole(initialRole);
    }
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [initialMode, initialRole, isOpen]);

  // Update taluk when district changes
  useEffect(() => {
    setTaluk(TALUKS_BY_DISTRICT[district][0]);
  }, [district]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await authService.login(email.trim(), password);
      setSuccessMessage(`Welcome back, ${user.fullName}!`);
      setTimeout(() => {
        onAuthSuccess(user, user.role);
        onClose();
      }, 400);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Login failed. Please verify your credentials or select a demo account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Please enter your contact mobile number.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await authService.register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phoneNumber: phone.trim(),
        role,
        district,
        taluk,
        village: village.trim() || undefined,
        preferredLanguage: language,
      });

      setSuccessMessage(`Account created successfully! Welcome, ${user.fullName}!`);
      setTimeout(() => {
        onAuthSuccess(user, role);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. An account with this email may already exist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Banner */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-forest-50 via-white to-forest-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-forest-600 text-white rounded-2xl shadow-sm">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                {mode === 'login' ? 'Sign in to FarmConnect AI' : 'Create New Account'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'login'
                  ? 'Access your verified farm or procurement portal'
                  : 'Join Dakshina Kannada & Udupi Direct Marketplace'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector: Sign In vs Register */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'login' ? 'bg-white text-forest-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'register' ? 'bg-white text-forest-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            New Registration
          </button>
        </div>

        {/* Error / Success Alerts */}
        <div className="px-6 pt-3 shrink-0">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-800 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-emerald-800 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}
        </div>

        {/* Form Body with scroll */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {mode === 'login' ? (
            /* =================== LOGIN FORM =================== */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Quick 1-Tap Demo Logins */}
              <div className="p-2.5 rounded-xl bg-forest-50/70 border border-forest-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-forest-800">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-forest-600" />
                    <span>Quick Demo Sign-In (1-Tap):</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('ramesh@farmconnect.demo');
                      setPassword('FarmerPass123!');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-forest-200 text-[11px] font-medium text-forest-900 hover:bg-forest-100/60 active:scale-95 shadow-xs transition-all"
                  >
                    👨‍🌾 Farmer (Ramesh)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('procurement@oceanpearlhotels.demo');
                      setPassword('BuyerPass123!');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-forest-200 text-[11px] font-medium text-forest-900 hover:bg-forest-100/60 active:scale-95 shadow-xs transition-all"
                  >
                    🏨 Buyer (Ocean Pearl)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@farmconnect.org');
                      setPassword('AdminPass123!');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-forest-200 text-[11px] font-medium text-forest-900 hover:bg-forest-100/60 active:scale-95 shadow-xs transition-all"
                  >
                    🛡️ Admin (Dr. Rao)
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Registered Email Address</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-600 transition-all"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Account Password</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-forest-600 hover:bg-forest-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md shadow-forest-600/20 flex items-center justify-center gap-2 transition-all mt-2"
              >
                {isSubmitting ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* =================== REGISTRATION FORM =================== */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Role Selection (FARMER or BUYER only - strictly no public Admin!) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Select Account Type:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('farmer')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                      role === 'farmer'
                        ? 'border-forest-600 bg-forest-50/70 text-forest-900 ring-2 ring-forest-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Sprout className="w-4 h-4 text-forest-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-xs">Farm Owner</p>
                      <p className="text-[10px] text-slate-500">Sell crops, AI diagnostics</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('buyer')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                      role === 'buyer'
                        ? 'border-sky-600 bg-sky-50/70 text-sky-900 ring-2 ring-sky-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-xs">Bulk Buyer</p>
                      <p className="text-[10px] text-slate-500">Restaurant, retail, group buy</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Full Name</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Rai"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-600"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-600"
                />
              </div>

              {/* Location: District and Taluk */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>District</span>
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-600 bg-white"
                  >
                    <option value="Dakshina Kannada">Dakshina Kannada</option>
                    <option value="Udupi">Udupi</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Taluk</label>
                  <select
                    value={taluk}
                    onChange={(e) => setTaluk(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-600 bg-white"
                  >
                    {TALUKS_BY_DISTRICT[district].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Password (min. 8)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 chars"
                      required
                      className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20 focus:border-forest-600"
                  />
                </div>
              </div>

              {/* Language Preference */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Preferred Language:</label>
                <div className="flex gap-4 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={language === 'kn'}
                      onChange={() => setLanguage('kn')}
                      className="text-forest-600"
                    />
                    <span>ಕನ್ನಡ (Kannada)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={language === 'en'}
                      onChange={() => setLanguage('en')}
                      className="text-forest-600"
                    />
                    <span>English</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-forest-600 hover:bg-forest-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md shadow-forest-600/20 flex items-center justify-center gap-2 transition-all mt-2"
              >
                {isSubmitting ? <span>Creating Account...</span> : <span>Complete Registration</span>}
              </button>
            </form>
          )}
        </div>

        {/* Footer switch prompt */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-center text-xs text-slate-500 shrink-0">
          {mode === 'login' ? (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                className="text-forest-700 font-bold hover:underline"
              >
                Create one now
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className="text-forest-700 font-bold hover:underline"
              >
                Sign in here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

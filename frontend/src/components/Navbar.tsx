import React, { useState, useEffect } from 'react';
import {
  Sprout,
  ShieldCheck,
  Languages,
  Wallet,
  ShoppingCart,
  UserCheck,
  Menu,
  X,
  ChevronDown,
  LogOut,
  RefreshCw,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { UserRole, User } from '../types';
import { API_CONFIG } from '../config/api';

interface NavbarProps {
  currentUser: User | null;
  currentRole: UserRole;
  language: 'kn' | 'en';
  onLanguageToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenAuth: (initialMode?: 'login' | 'register', targetRole?: UserRole) => void;
  onOpenSwitchAccount: () => void;
  onSignOut: () => void;
  isLandingView: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentRole,
  language,
  onLanguageToggle,
  activeTab,
  onTabChange,
  onOpenAuth,
  onOpenSwitchAccount,
  onSignOut,
  isLandingView,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isBlockchainOnline, setIsBlockchainOnline] = useState<boolean | null>(null);

  // Check blockchain RPC connectivity
  useEffect(() => {
    let isMounted = true;
    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(API_CONFIG.BLOCKCHAIN_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (isMounted) setIsBlockchainOnline(res.ok);
      } catch (_e) {
        if (isMounted) setIsBlockchainOnline(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#profile-menu-container')) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* 1. Left: Brand & Problem Statement */}
            <div
              className="flex items-center gap-2.5 cursor-pointer shrink-0"
              onClick={() => onTabChange('landing')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onTabChange('landing')}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-forest-700 to-forest-500 flex items-center justify-center text-white shadow-md shadow-forest-600/20 shrink-0">
                <Sprout className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 leading-tight">
                    FarmConnect <span className="text-forest-600">AI</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-forest-100 text-forest-800 px-1.5 py-0.5 rounded border border-forest-200 shrink-0">
                    PS 1.2
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden xl:block leading-none mt-0.5">
                  {language === 'kn' ? 'ಕರಾವಳಿ ಕೃಷಿಕರ ನೇರ ಮಾರುಕಟ್ಟೆ ವೇದಿಕೆ' : 'Direct Market Platform • DK & Udupi'}
                </p>
              </div>
            </div>

            {/* 2. Middle: Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
              {isLandingView || !currentUser ? (
                <>
                  <button
                    onClick={() => onTabChange('landing')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === 'landing'
                        ? 'bg-forest-50 text-forest-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಮುಖ್ಯ ಪುಟ (Home)' : 'Platform Home'}
                  </button>
                  <a
                    href="#mission"
                    onClick={(e) => {
                      e.preventDefault();
                      onTabChange('landing');
                      document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಉದ್ದೇಶ (Mission)' : 'Mission'}
                  </a>
                  <a
                    href="#features"
                    onClick={(e) => {
                      e.preventDefault();
                      onTabChange('landing');
                      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ವೈಶಿಷ್ಟ್ಯಗಳು (Features)' : 'Features'}
                  </a>
                  <a
                    href="#problem"
                    onClick={(e) => {
                      e.preventDefault();
                      onTabChange('landing');
                      document.getElementById('problem')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಸವಾಲು (PS 1.2)' : 'The Challenge'}
                  </a>
                </>
              ) : currentRole === 'farmer' ? (
                <>
                  <button
                    onClick={() => onTabChange('overview')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'overview'
                        ? 'bg-forest-100/80 text-forest-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ತೋಟ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' : 'Dashboard'}
                  </button>
                  <button
                    onClick={() => onTabChange('forensics')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'forensics'
                        ? 'bg-forest-100/80 text-forest-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಕ್ರಾಪ್ ತನಿಖೆ (Forensics)' : 'FarmForensics'}
                  </button>
                  <button
                    onClick={() => onTabChange('lab')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'lab'
                        ? 'bg-forest-100/80 text-forest-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಪ್ರಯೋಗಶಾಲೆ (FarmLab)' : 'FarmLab'}
                  </button>
                  <button
                    onClick={() => onTabChange('pricing')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'pricing'
                        ? 'bg-forest-100/80 text-forest-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ (APMC)' : 'Price Assistant'}
                  </button>
                  <button
                    onClick={() => onTabChange('orders')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'orders'
                        ? 'bg-forest-100/80 text-forest-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಆರ್ಡರ್‌ಗಳು & ಬ್ಲಾಕ್‌ಚೈನ್' : 'Orders & Ledger'}
                  </button>
                </>
              ) : currentRole === 'buyer' ? (
                <>
                  <button
                    onClick={() => onTabChange('marketplace')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'marketplace'
                        ? 'bg-forest-100/80 text-forest-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ (Marketplace)' : 'Marketplace'}
                  </button>
                  <button
                    onClick={() => onTabChange('group-selling')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'group-selling'
                        ? 'bg-forest-100/80 text-forest-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಗುಂಪು ಮಾರಾಟ (Group Selling)' : 'Group Selling'}
                  </button>
                  <button
                    onClick={() => onTabChange('orders')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'orders'
                        ? 'bg-forest-100/80 text-forest-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಆರ್ಡರ್‌ಗಳು & ಬ್ಲಾಕ್‌ಚೈನ್' : 'Orders & Ledger'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onTabChange('overview')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'overview'
                        ? 'bg-amber-100/80 text-amber-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಆಡಳಿತ ಅವಲೋಕನ' : 'Admin Overview'}
                  </button>
                  <button
                    onClick={() => onTabChange('listings')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'listings'
                        ? 'bg-amber-100/80 text-amber-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಪರಿಶೀಲನೆ (Moderation)' : 'Moderation'}
                  </button>
                  <button
                    onClick={() => onTabChange('users')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'users'
                        ? 'bg-amber-100/80 text-amber-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಬಳಕೆದಾರರು' : 'Users'}
                  </button>
                  <button
                    onClick={() => onTabChange('audit')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'audit'
                        ? 'bg-amber-100/80 text-amber-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಆಡಿಟ್ ಲಾಗ್‌ಗಳು' : 'Audit Logs'}
                  </button>
                  <button
                    onClick={() => onTabChange('integrity')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === 'integrity'
                        ? 'bg-amber-100/80 text-amber-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'kn' ? 'ಒಪ್ಪಂದ ಪರಿಶೀಲನೆ' : 'Integrity Check'}
                  </button>
                </>
              )}
            </nav>

            {/* 3. Right: Utility Controls & User Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Honest Blockchain Node Indicator */}
              <button
                onClick={() => setIsNetworkModalOpen(true)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
                  isBlockchainOnline === true
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80'
                    : isBlockchainOnline === false
                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/80'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
                title="Click to view Blockchain & Node Status"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isBlockchainOnline === true
                      ? 'bg-emerald-500 animate-pulse'
                      : isBlockchainOnline === false
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
                <span className="hidden sm:inline font-mono">
                  {isBlockchainOnline === true ? 'EVM 31337' : 'EVM Sim'}
                </span>
                <span className="text-[10px] text-slate-500 hidden md:inline">
                  {isBlockchainOnline === true ? '(Hardhat)' : '(Offline)'}
                </span>
              </button>

              {/* Language Switcher Button */}
              <button
                onClick={onLanguageToggle}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                title="Toggle Kannada / English"
                aria-label="Toggle Kannada / English"
              >
                <Languages className="w-3.5 h-3.5 text-forest-600 shrink-0" />
                <span className="font-bold">{language === 'kn' ? 'ಕನ್ನಡ (KN)' : 'English (EN)'}</span>
              </button>

              {/* Profile or Login/Register Action */}
              {currentUser ? (
                <div className="relative" id="profile-menu-container">
                  <button
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-semibold text-slate-800 transition-all shrink-0"
                    aria-expanded={isProfileDropdownOpen}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold ${
                        currentRole === 'farmer'
                          ? 'bg-forest-600'
                          : currentRole === 'buyer'
                          ? 'bg-sky-600'
                          : 'bg-amber-600'
                      }`}
                    >
                      {currentRole === 'farmer' ? 'F' : currentRole === 'buyer' ? 'B' : 'A'}
                    </div>
                    <span className="max-w-[80px] sm:max-w-[120px] truncate hidden sm:inline">
                      {currentUser.fullName.split(' ')[0]}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </button>

                  {/* Profile Dropdown */}
                  {isProfileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              currentRole === 'farmer'
                                ? 'bg-forest-100 text-forest-800'
                                : currentRole === 'buyer'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {currentRole === 'farmer'
                              ? 'Farmer Account'
                              : currentRole === 'buyer'
                              ? 'Buyer Account'
                              : 'System Administrator'}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 text-sm mt-1 truncate">{currentUser.fullName}</p>
                        <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {currentUser.taluk}, {currentUser.district}
                        </p>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            onOpenSwitchAccount();
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-forest-600" />
                          <span>Switch Role / Account</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            onTabChange('landing');
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Info className="w-3.5 h-3.5 text-slate-500" />
                          <span>View Public Landing Page</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            onSignOut();
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onOpenAuth('login')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    {language === 'kn' ? 'ಲಾಗಿನ್' : 'Sign In'}
                  </button>
                  <button
                    onClick={() => onOpenAuth('register')}
                    className="px-3 py-1.5 rounded-lg bg-forest-600 hover:bg-forest-700 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    {language === 'kn' ? 'ನೋಂದಣಿ' : 'Register'}
                  </button>
                </div>
              )}

              {/* Mobile Hamburger Toggle Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden shrink-0"
                aria-label="Toggle mobile navigation menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* 4. Mobile Drawer Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-150 shadow-lg">
            {currentUser && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{currentUser.fullName}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      currentRole === 'farmer'
                        ? 'bg-forest-100 text-forest-800'
                        : currentRole === 'buyer'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {currentRole}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{currentUser.email}</p>
              </div>
            )}

            <div className="space-y-1">
              {isLandingView || !currentUser ? (
                <>
                  <button
                    onClick={() => {
                      onTabChange('landing');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಮುಖ್ಯ ಪುಟ (Home)' : 'Platform Home'}
                  </button>
                  <button
                    onClick={() => {
                      onOpenAuth('login');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-forest-700 hover:bg-forest-50"
                  >
                    {language === 'kn' ? 'ಲಾಗಿನ್ (Sign In)' : 'Sign In'}
                  </button>
                  <button
                    onClick={() => {
                      onOpenAuth('register');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-forest-700 hover:bg-forest-50"
                  >
                    {language === 'kn' ? 'ಹೊಸ ಖಾತೆ ತೆರೆಯಿರಿ (Register)' : 'Create Account'}
                  </button>
                </>
              ) : currentRole === 'farmer' ? (
                <>
                  <button
                    onClick={() => {
                      onTabChange('overview');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ತೋಟ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' : 'Farmer Dashboard'}
                  </button>
                  <button
                    onClick={() => {
                      onTabChange('forensics');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಕ್ರಾಪ್ ತನಿಖೆ (FarmForensics)' : 'FarmForensics Diagnostics'}
                  </button>
                  <button
                    onClick={() => {
                      onTabChange('lab');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಪ್ರಯೋಗಶಾಲೆ (FarmLab)' : 'FarmLab Experiments'}
                  </button>
                  <button
                    onClick={() => {
                      onTabChange('pricing');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ (APMC)' : 'AI Price Assistant'}
                  </button>
                  <button
                    onClick={() => {
                      onTabChange('orders');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಆರ್ಡರ್‌ಗಳು & ಬ್ಲಾಕ್‌ಚೈನ್' : 'Orders & Blockchain'}
                  </button>
                </>
              ) : currentRole === 'buyer' ? (
                <>
                  <button
                    onClick={() => {
                      onTabChange('marketplace');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಮಾರುಕಟ್ಟೆ (Marketplace)' : 'Produce Discovery'}
                  </button>
                  <button
                    onClick={() => {
                      onTabChange('group-selling');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಗುಂಪು ಮಾರಾಟ (Group Selling)' : 'Smart Group Selling'}
                  </button>
                  <button
                    onClick={() => {
                      onTabChange('orders');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಆರ್ಡರ್‌ಗಳು & ಬ್ಲಾಕ್‌ಚೈನ್' : 'Orders & Blockchain'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onTabChange('overview');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಆಡಳಿತ ಅವಲೋಕನ' : 'Admin Overview'}
                  </button>
                  <button
                    onClick={() => {
                      onTabChange('listings');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಪರಿಶೀಲನೆ (Moderation)' : 'Listing Moderation'}
                  </button>
                  <button
                    onClick={() => {
                      onTabChange('users');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಬಳಕೆದಾರರು' : 'User Registry'}
                  </button>
                  <button
                    onClick={() => {
                      onTabChange('audit');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {language === 'kn' ? 'ಆಡಿಟ್ ಲಾಗ್‌ಗಳು' : 'Audit Logs'}
                  </button>
                </>
              )}
            </div>

            {currentUser && (
              <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenSwitchAccount();
                  }}
                  className="w-full text-center py-2 px-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 bg-white"
                >
                  Switch Account
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full text-center py-2 px-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* 5. Honest Blockchain Network Status Modal */}
      {isNetworkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Blockchain & Node Status</h3>
                  <p className="text-xs text-slate-500">Decentralized Trust Layer Verification</p>
                </div>
              </div>
              <button
                onClick={() => setIsNetworkModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">RPC Endpoint:</span>
                  <span className="font-mono text-slate-800 font-semibold">{API_CONFIG.BLOCKCHAIN_RPC_URL}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Network ID:</span>
                  <span className="font-mono text-slate-800 font-semibold">Chain ID 31337 (Local EVM)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Connection Status:</span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${
                      isBlockchainOnline === true ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {isBlockchainOnline === true ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Online & Syncing
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Offline (Using Local Fallback)
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Honest Test Token Disclosure */}
              <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Demonstration Token Notice</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  All conditional escrow deposits use mock ERC-20 <strong>FarmTokens (FARM)</strong> on a local testnet.
                  These tokens have <strong>zero monetary value</strong> and are used exclusively to verify algorithmic
                  multi-farmer escrow release, delivery milestones, and automated refund conditions safely.
                </p>
              </div>

              <div className="space-y-1 text-slate-600 text-[11px]">
                <p className="font-semibold text-slate-800">Anchored Smart Contracts:</p>
                <p>• <strong>OrderRegistry:</strong> SHA-256 Agreement Hash Anchoring</p>
                <p>• <strong>ProduceTraceability:</strong> Tamper-evident supply chain milestones</p>
                <p>• <strong>FarmEscrow:</strong> Buyer deposit, multi-farmer release & refund</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsNetworkModalOpen(false)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Close Status
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

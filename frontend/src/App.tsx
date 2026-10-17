import React, { useState, useEffect } from 'react';
import { UserRole, User } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { FarmerDashboard } from './pages/FarmerDashboard';
import { BuyerDashboard } from './pages/BuyerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { SwitchAccountModal } from './components/SwitchAccountModal';

export const App: React.FC = () => {
  // Authentication & Session State from localStorage
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('farmconnect_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    try {
      const savedUser = localStorage.getItem('farmconnect_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.role) return parsed.role;
      }
    } catch {}
    return 'farmer';
  });

  const [view, setView] = useState<'landing' | 'app'>(() => {
    return localStorage.getItem('farmconnect_token') ? 'app' : 'landing';
  });

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [language, setLanguage] = useState<'kn' | 'en'>(() => {
    const saved = localStorage.getItem('farmconnect_language');
    return (saved === 'en' || saved === 'kn') ? saved : 'kn';
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authTargetRole, setAuthTargetRole] = useState<UserRole>('farmer');
  const [isSwitchAccountOpen, setIsSwitchAccountOpen] = useState(false);

  // Sync language selection to localStorage
  const handleLanguageToggle = () => {
    const nextLang = language === 'kn' ? 'en' : 'kn';
    setLanguage(nextLang);
    localStorage.setItem('farmconnect_language', nextLang);
  };

  // Open auth modal with intended role/mode
  const handleOpenAuth = (mode: 'login' | 'register' = 'login', targetRole: UserRole = 'farmer') => {
    setAuthModalMode(mode);
    setAuthTargetRole(targetRole);
    setIsAuthModalOpen(true);
  };

  // Sign out safely
  const handleSignOut = () => {
    localStorage.removeItem('farmconnect_token');
    localStorage.removeItem('farmconnect_user');
    setCurrentUser(null);
    setView('landing');
  };

  // Open Switch Account
  const handleOpenSwitchAccount = () => {
    setIsSwitchAccountOpen(true);
  };

  // Confirm Switch from modal
  const handleConfirmSwitch = (targetRole?: UserRole) => {
    handleSignOut();
    setIsSwitchAccountOpen(false);
    handleOpenAuth('login', targetRole || 'farmer');
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'landing') {
      setView('landing');
      return;
    }
    // Protected view: require user login to view dashboards
    if (!currentUser && !localStorage.getItem('farmconnect_token')) {
      handleOpenAuth('login', currentRole);
      return;
    }
    setActiveTab(tab);
    setView('app');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Central Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        currentRole={currentRole}
        language={language}
        onLanguageToggle={handleLanguageToggle}
        activeTab={view === 'landing' ? 'landing' : activeTab}
        onTabChange={handleTabChange}
        onOpenAuth={handleOpenAuth}
        onOpenSwitchAccount={handleOpenSwitchAccount}
        onSignOut={handleSignOut}
        isLandingView={view === 'landing'}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {view === 'landing' ? (
          <LandingPage
            onSelectRole={(role) => handleOpenAuth('login', role)}
            onOpenAuth={(mode, role) => handleOpenAuth(mode || 'login', role || 'farmer')}
            language={language}
          />
        ) : !currentUser ? (
          // Protected state fallback if directly navigating to app
          <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Authentication Required</h2>
            <p className="text-sm text-slate-500">
              Please sign in to access {currentRole} tools, listings, and smart contracts.
            </p>
            <button
              onClick={() => handleOpenAuth('login', currentRole)}
              className="px-6 py-2.5 bg-forest-600 hover:bg-forest-700 text-white font-semibold rounded-xl text-sm"
            >
              Sign In to Continue
            </button>
          </div>
        ) : currentRole === 'farmer' ? (
          <FarmerDashboard language={language} activeSection={activeTab} />
        ) : currentRole === 'buyer' ? (
          <BuyerDashboard language={language} activeSection={activeTab} />
        ) : (
          <AdminDashboard language={language} activeSection={activeTab} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            <strong>FarmConnect AI</strong> • Hackathon Problem Statement PS 1.2 • Dakshina Kannada & Udupi
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('landing')}
              className="text-forest-700 hover:underline font-semibold"
            >
              Mission Overview
            </button>
            <span>•</span>
            <button
              onClick={handleOpenSwitchAccount}
              className="text-forest-700 hover:underline font-semibold"
            >
              Switch Account
            </button>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialRole={authTargetRole}
        initialMode={authModalMode}
        onAuthSuccess={(user, role) => {
          setCurrentUser(user);
          setCurrentRole(role);
          setView('app');
          setActiveTab(role === 'farmer' ? 'overview' : role === 'buyer' ? 'marketplace' : 'overview');
        }}
      />

      {/* Switch Account Modal */}
      <SwitchAccountModal
        isOpen={isSwitchAccountOpen}
        onClose={() => setIsSwitchAccountOpen(false)}
        currentUser={currentUser}
        onConfirmSwitch={handleConfirmSwitch}
      />
    </div>
  );
};

export default App;

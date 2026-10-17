import React from 'react';
import { X, LogOut, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { User, UserRole } from '../types';

interface SwitchAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onConfirmSwitch: (targetRole?: UserRole) => void;
}

export const SwitchAccountModal: React.FC<SwitchAccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onConfirmSwitch,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-forest-100 text-forest-700 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Switch Account</h3>
              <p className="text-xs text-slate-500">Sign out and authenticate with another registered profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {currentUser ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                <LogOut className="w-4 h-4" />
                <span>Active Session Notice</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                You are currently signed in as <strong>{currentUser.fullName}</strong> ({currentUser.role}). Switching accounts will end this session and safely clear your local token.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              You are currently signed out. Please authenticate with your registered credentials.
            </p>
          )}

          <p className="text-xs text-slate-500 leading-relaxed">
            To switch accounts, click below to confirm signing out of your current session. You will be redirected to the secure login form to enter your verified email and password.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirmSwitch()}
              className="w-full sm:w-1/2 py-2.5 px-4 bg-forest-600 hover:bg-forest-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Confirm & Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  ShoppingBag,
  Activity,
  CheckCircle2,
  XCircle,
  FileText,
  Lock,
  RefreshCw,
  Eye,
  Ban,
  Layers,
  Search,
  Filter,
  Check,
  ExternalLink,
  Cpu,
  Database,
} from 'lucide-react';
import { User, ProduceListing, AdminOverview, AdminAuditLog } from '../types';
import { adminService, orderService } from '../services/apiClient';

interface AdminDashboardProps {
  language: 'kn' | 'en';
  activeSection?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  language,
  activeSection = 'overview',
}) => {
  const [currentTab, setCurrentTab] = useState<'overview' | 'users' | 'listings' | 'audit' | 'integrity' | 'health'>('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [blockchainTxs, setBlockchainTxs] = useState<any[]>([]);

  // Filter states
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [listingStatusFilter, setListingStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Moderation modal / action state
  const [moderatingListing, setModeratingListing] = useState<ProduceListing | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Verification state
  const [verifyOrderId, setVerifyOrderId] = useState('');
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (activeSection && ['overview', 'users', 'listings', 'audit', 'integrity', 'health'].includes(activeSection)) {
      setCurrentTab(activeSection as any);
    }
  }, [activeSection]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovData, usersData, listingsData, logsData, txsData] = await Promise.all([
        adminService.getOverview(),
        adminService.getUsers(),
        adminService.getListings(),
        adminService.getAuditLogs(),
        adminService.getBlockchainTxs(),
      ]);
      setOverview(ovData);
      setUsers(usersData);
      setListings(listingsData);
      setAuditLogs(logsData);
      setBlockchainTxs(txsData);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleModerate = async (newStatus: string) => {
    if (!moderatingListing) return;
    if (!moderationReason.trim()) {
      setActionErrorMsg('Please provide a mandatory audit reason for this moderation action.');
      return;
    }
    setActionErrorMsg(null);
    try {
      const updated = await adminService.moderateListing(moderatingListing.id, newStatus, moderationReason);
      if (updated) {
        setActionSuccessMsg(`Listing "${moderatingListing.cropName}" status updated to "${newStatus}". Logged in operational audit trail.`);
        setListings(prev => prev.map(l => l.id === updated.id ? updated : l));
        setModeratingListing(null);
        setModerationReason('');
        // Refresh audit logs
        const newLogs = await adminService.getAuditLogs();
        setAuditLogs(newLogs);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to moderate listing.');
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const newStatus = !user.isVerified;
    const reason = prompt(`Enter reason for ${newStatus ? 'activating' : 'suspending'} account for ${user.fullName}:`);
    if (!reason) return;

    const ok = await adminService.updateUserStatus(user.id, newStatus, reason);
    if (ok) {
      setActionSuccessMsg(`User ${user.fullName} account status changed to ${newStatus ? 'Active' : 'Suspended'}.`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isVerified: newStatus } : u));
      const newLogs = await adminService.getAuditLogs();
      setAuditLogs(newLogs);
    } else {
      setActionErrorMsg('Failed to update user status.');
    }
  };

  const handleVerifyAgreement = async () => {
    if (!verifyOrderId.trim()) {
      setActionErrorMsg('Please enter an Order ID to verify.');
      return;
    }
    setVerifying(true);
    setActionErrorMsg(null);
    try {
      const res = await adminService.verifyAgreement(verifyOrderId.trim());
      setVerificationResult(res);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to verify agreement integrity.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Top Banner / Disclaimer */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 mb-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-forest-600 rounded-xl text-white">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold">
                  {language === 'kn' ? 'ಆಡಳಿತ ಮಂಡಳಿ & ಪಾರದರ್ಶಕತೆ ಹಬ್' : 'Administrative Governance & Integrity Dashboard'}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full">
                  PROTECTED
                </span>
              </div>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Dakshina Kannada & Udupi • Operational Health • Listing Moderation • Blockchain Audit Records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Telemetry
            </button>
            <div className="text-right border-l border-slate-700 pl-3">
              <div className="text-xs text-slate-400">Security Rule</div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Silent Overwrites Prohibited
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800 overflow-x-auto">
          {[
            { id: 'overview', label: 'Platform Overview', icon: Activity },
            { id: 'listings', label: 'Listing Moderation', icon: ShoppingBag },
            { id: 'users', label: 'User Registry', icon: Users },
            { id: 'audit', label: 'Audit Records', icon: FileText },
            { id: 'integrity', label: 'Agreement Verification', icon: Lock },
            { id: 'health', label: 'Subsystem Health', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setCurrentTab(tab.id as any);
                  setActionSuccessMsg(null);
                  setActionErrorMsg(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-forest-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      {actionSuccessMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-900 text-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-900 text-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg(null)} className="text-rose-700 hover:text-rose-900 font-bold">×</button>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {currentTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Registered Users</span>
                <Users className="w-4 h-4 text-forest-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{overview.users_count}</div>
              <div className="text-xs text-slate-500 mt-1">
                {overview.farmers_count} Farmers • {overview.buyers_count} Buyers
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Produce Listings</span>
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{overview.listings_count}</div>
              <div className="text-xs text-slate-500 mt-1">
                {overview.active_listings_count} Active • {overview.flagged_listings_count} Flagged
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Trade Volume</span>
                <span className="text-xs font-bold text-emerald-600">₹</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">₹{overview.total_trade_volume.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">
                {overview.completed_orders_count} Orders Settled
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Blockchain Activity</span>
                <Lock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {overview.blockchain_status.total_on_chain_tx_count} TXs
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Chain ID: {overview.blockchain_status.chain_id} (EVM Local)
              </div>
            </div>
          </div>

          {/* Smart Group Selling & Subsystem Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-forest-600" /> Smart Group Selling Status
              </h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Smart Group Selling pools marginal farmer supplies (e.g., 40kg, 60kg, 50kg) into aggregated buyer orders (150kg).
              </p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Total Group Offers Proposed:</span>
                  <span className="font-semibold text-slate-900">{overview.group_offers_count}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Marketplace Invariant:</span>
                  <span className="font-semibold text-emerald-700">Strict Anti-Overselling Locks Enforced</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Multi-Farmer Settlement:</span>
                  <span className="font-semibold text-slate-900">Supported with Itemized Escrow Subtotals</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-forest-600" /> AI & Speech Subsystems Telemetry
              </h3>
              <div className="space-y-3">
                {Object.entries(overview.ai_services_status).map(([service, status]) => (
                  <div key={service} className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-medium text-slate-700 capitalize">{service.replace(/_/g, ' ')}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <Check className="w-3 h-3" /> {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LISTING MODERATION */}
      {currentTab === 'listings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Marketplace Produce Listings Moderation</h3>
              <p className="text-xs text-slate-500">
                Identify and moderate fraudulent, misrepresented or expired produce listings. Actions are logged to the immutable audit trail.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={listingStatusFilter}
                onChange={(e) => setListingStatusFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="flagged_fraudulent">Flagged Fraudulent</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Crop / Variety</th>
                  <th className="px-6 py-3">Farmer</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Quantity</th>
                  <th className="px-6 py-3">Price</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {listings
                  .filter(l => listingStatusFilter === 'all' || l.status === listingStatusFilter)
                  .map((listing) => (
                    <tr key={listing.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {listing.cropName}
                        {listing.cropKannada && <span className="block text-[11px] text-slate-500">{listing.cropKannada}</span>}
                        {listing.createdViaVoice && (
                          <span className="inline-block mt-1 text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded">
                            Kannada Voice Listing
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">{listing.farmerName}</td>
                      <td className="px-6 py-4">{listing.taluk}, {listing.district}</td>
                      <td className="px-6 py-4">{listing.availableQuantity} / {listing.totalQuantity} {listing.unit}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">₹{listing.pricePerUnit}/{listing.unit}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          listing.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : listing.status === 'flagged_fraudulent'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {listing.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {listing.status !== 'flagged_fraudulent' ? (
                          <button
                            onClick={() => {
                              setModeratingListing(listing);
                              setModerationReason('');
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold transition-colors"
                          >
                            Flag / Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setModeratingListing(listing);
                              setModerationReason('Verified authentic produce after administrative inspection.');
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold transition-colors"
                          >
                            Reinstate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Moderation Reason Modal */}
          {moderatingListing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
                <div className="flex items-center gap-2 mb-4 text-rose-700">
                  <AlertTriangle className="w-5 h-5" />
                  <h4 className="font-bold text-slate-900 text-base">
                    Moderate Listing: {moderatingListing.cropName}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mb-4">
                  All administrative actions require a documented audit justification. This reason will be permanently recorded in the system audit trail.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Reason / Justification</label>
                    <textarea
                      value={moderationReason}
                      onChange={(e) => setModerationReason(e.target.value)}
                      placeholder="e.g. Unrealistic asking price, suspected duplicate entry, or reported crop misrepresentation..."
                      rows={3}
                      className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-forest-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setModeratingListing(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleModerate('flagged_fraudulent')}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                    >
                      Flag as Fraudulent
                    </button>
                    <button
                      onClick={() => handleModerate('active')}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                    >
                      Mark Active
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USER REGISTRY */}
      {currentTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">User Accounts & Roles Registry</h3>
              <p className="text-xs text-slate-500">
                View platform farmers, institutional buyers, and admins with verified roles and regional taluks.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
              >
                <option value="all">All Roles</option>
                <option value="farmer">Farmers</option>
                <option value="buyer">Buyers</option>
                <option value="admin">Administrators</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Full Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Region</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Account Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {users
                  .filter(u => userRoleFilter === 'all' || u.role === userRoleFilter)
                  .map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{user.fullName}</td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-600">{user.email}</td>
                      <td className="px-6 py-4">{user.phoneNumber}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          user.role === 'farmer'
                            ? 'bg-forest-100 text-forest-800'
                            : user.role === 'buyer'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">{user.taluk}, {user.district}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          user.isVerified !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {user.isVerified !== false ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => handleToggleUserStatus(user)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            {user.isVerified !== false ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT RECORDS & BLOCKCHAIN TXS */}
      {currentTab === 'audit' && (
        <div className="space-y-6">
          {/* Administrative Operational Audit Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Operational Administrative Audit Logs</h3>
              <p className="text-xs text-slate-500">
                Chronological log of administrative actions, user changes, and moderation events.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Admin</th>
                    <th className="px-6 py-3">Action Type</th>
                    <th className="px-6 py-3">Entity</th>
                    <th className="px-6 py-3">Details & Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{log.admin_name}</td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-mono">
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-600">{log.target_entity}</td>
                      <td className="px-6 py-4 text-slate-800">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Blockchain Transaction References */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">On-Chain Transaction Reference Registry</h3>
              <p className="text-xs text-slate-500">
                Every on-chain registration (Order Agreements, Escrow Deposits/Releases, Produce Traceability) maintains an immutable TX record.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Contract</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">TX Hash</th>
                    <th className="px-6 py-3">Block</th>
                    <th className="px-6 py-3">Network</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {blockchainTxs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{tx.contract_name || tx.contractName}</td>
                      <td className="px-6 py-4">
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-mono">
                          {tx.action_type || tx.actionType}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-600">
                        {(tx.tx_hash || tx.txHash)?.substring(0, 16)}...
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px]">{tx.block_number || tx.blockNumber || '1'}</td>
                      <td className="px-6 py-4 text-slate-600">{tx.network_id || tx.networkId || '31337'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3" /> {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: INTEGRITY VERIFICATION (Rule: Never silently rewrite agreement) */}
      {currentTab === 'integrity' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Lock className="w-5 h-5 text-forest-600" />
              Cryptographic Agreement Integrity & Anti-Tamper Verification
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              In accordance with FarmConnect AI governance rules, administrators can never silently rewrite confirmed purchase agreements.
              This tool computes the canonical SHA-256 agreement hash and cross-verifies it against the on-chain registry contract.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 max-w-2xl space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Order UUID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verifyOrderId}
                  onChange={(e) => setVerifyOrderId(e.target.value)}
                  placeholder="e.g. ord-150kg-tomato-sample or paste UUID"
                  className="flex-1 text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-forest-500 focus:outline-none font-mono"
                />
                <button
                  onClick={handleVerifyAgreement}
                  disabled={verifying}
                  className="px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                  Verify On-Chain
                </button>
              </div>
            </div>

            {verificationResult && (
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800">Verification Report</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    verificationResult.is_tamper_free
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {verificationResult.is_tamper_free ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {verificationResult.tamper_evident_status}
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-[11px] text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-800">Order ID:</span> {verificationResult.order_id}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Database Agreement Hash:</span>
                    <div className="text-slate-700 break-all bg-slate-50 p-1.5 rounded mt-0.5 border border-slate-200">
                      {verificationResult.database_agreement_hash}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Blockchain Registered Hash:</span>
                    <div className="text-slate-700 break-all bg-slate-50 p-1.5 rounded mt-0.5 border border-slate-200">
                      {verificationResult.blockchain_registered_hash}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-1">
                  Cryptographic verification confirms both records match identically. Terms have not been altered.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: SUBSYSTEM HEALTH */}
      {currentTab === 'health' && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-forest-600" /> Relational Database & Migrations
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Database Engine:</span>
                <span className="font-semibold text-slate-800">PostgreSQL (Compatible with Supabase)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Registered Tables:</span>
                <span className="font-semibold text-slate-800">18 Relational Models</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Transactions & Concurrency:</span>
                <span className="font-semibold text-emerald-700">Row-level locking (`with_for_update`)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">State Resilience:</span>
                <span className="font-semibold text-emerald-700">Decoupled AI / Blockchain Failures</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-forest-600" /> Hardhat EVM Smart Contracts
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-sans">Network / Chain ID:</span>
                <span className="font-semibold text-slate-800">{overview.blockchain_status.chain_id}</span>
              </div>
              <div className="flex flex-col py-1 border-b border-slate-100">
                <span className="text-slate-500 font-sans">FarmConnectOrderRegistry:</span>
                <span className="text-[11px] text-slate-700 break-all">{overview.blockchain_status.order_registry_address}</span>
              </div>
              <div className="flex flex-col py-1 border-b border-slate-100">
                <span className="text-slate-500 font-sans">ProduceTraceability:</span>
                <span className="text-[11px] text-slate-700 break-all">{overview.blockchain_status.traceability_address}</span>
              </div>
              <div className="flex flex-col py-1 border-b border-slate-100">
                <span className="text-slate-500 font-sans">FarmEscrow (Test Tokens):</span>
                <span className="text-[11px] text-slate-700 break-all">{overview.blockchain_status.escrow_address}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

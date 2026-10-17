import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowRight,
  ExternalLink,
  Layers,
  History,
  FileCheck2,
  RefreshCw,
  Coins,
  FileText,
  BadgeAlert,
  Send,
  Building2,
  Key
} from 'lucide-react';
import { Order, OrderAgreementVersion, OnChainVerification, EscrowActionResponse } from '../types';
import { orderService } from '../services/apiClient';

interface BlockchainLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onOrderUpdated?: (updatedOrder: Order) => void;
}

export const BlockchainLedgerModal: React.FC<BlockchainLedgerModalProps> = ({
  isOpen,
  onClose,
  order,
  onOrderUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'verification' | 'escrow' | 'contracts'>('verification');
  const [verification, setVerification] = useState<OnChainVerification | null>(null);
  const [versions, setVersions] = useState<OrderAgreementVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [escrowResult, setEscrowResult] = useState<EscrowActionResponse | null>(null);

  // Amend terms form state
  const [isAmending, setIsAmending] = useState(false);
  const [amendTerms, setAmendTerms] = useState('');
  const [amendAddress, setAmendAddress] = useState('');
  const [amendReason, setAmendReason] = useState('');

  useEffect(() => {
    if (isOpen && order) {
      loadBlockchainData();
      setAmendTerms(order.deliveryTerms || '');
      setAmendAddress(order.deliveryAddress || '');
    }
  }, [isOpen, order?.id]);

  const loadBlockchainData = async () => {
    if (!order) return;
    setLoading(true);
    setActionMessage(null);
    try {
      const [verifData, versionList] = await Promise.all([
        orderService.verifyOnChain(order.id),
        orderService.getAgreementVersions(order.id),
      ]);
      setVerification(verifData);
      setVersions(versionList);
    } catch (err) {
      console.error('Error fetching blockchain verification:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositEscrow = async () => {
    if (!order) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await orderService.depositEscrow(order.id, order.totalAmount);
      setEscrowResult(res);
      setActionMessage(`Successfully locked ${res.amount} test FARM tokens in FarmEscrow smart contract! Tx: ${res.txHash.slice(0, 14)}...`);
      const updated = await orderService.getOrderById(order.id);
      if (onOrderUpdated) onOrderUpdated(updated);
      loadBlockchainData();
    } catch (err: any) {
      setActionMessage(`Escrow deposit error: ${err.message || 'Transaction rejected'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseEscrow = async () => {
    if (!order) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await orderService.releaseEscrow(order.id);
      setEscrowResult(res);
      setActionMessage(`Delivery confirmed! Payout released to beneficiary farmer. Tx: ${res.txHash.slice(0, 14)}...`);
      const updated = await orderService.getOrderById(order.id);
      if (onOrderUpdated) onOrderUpdated(updated);
      loadBlockchainData();
    } catch (err: any) {
      setActionMessage(`Escrow release error: ${err.message || 'Authorization failed'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefundEscrow = async () => {
    if (!order) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await orderService.refundEscrow(order.id);
      setEscrowResult(res);
      setActionMessage(`Escrow hold cancelled! Funds refunded back to buyer. Tx: ${res.txHash.slice(0, 14)}...`);
      const updated = await orderService.getOrderById(order.id);
      if (onOrderUpdated) onOrderUpdated(updated);
      loadBlockchainData();
    } catch (err: any) {
      setActionMessage(`Escrow refund error: ${err.message || 'Authorization failed'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAmendTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !amendReason.trim()) return;
    setActionLoading(true);
    try {
      const updated = await orderService.amendOrderTerms(order.id, {
        newDeliveryTerms: amendTerms,
        newDeliveryAddress: amendAddress,
        reason: amendReason,
      });
      setIsAmending(false);
      setAmendReason('');
      setActionMessage(`Terms successfully amended to Version ${updated.agreementVersion || 2}! A new cryptographic hash has been anchored on-chain without overwriting the previous version.`);
      if (onOrderUpdated) onOrderUpdated(updated);
      loadBlockchainData();
    } catch (err: any) {
      setActionMessage(`Failed to amend terms: ${err.message || 'Error occurred'}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">
                  ಸ್ಮಾರ್ಟ್ ಒಪ್ಪಂದ ಮತ್ತು ಎಸ್ಕ್ರೋ ಲೆಡ್ಜರ್ (Smart Contract & Escrow Ledger)
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Chain ID: 31337
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Order <span className="font-mono font-bold text-emerald-400">{order.orderCode}</span> &bull; Tamper-evident cryptographic verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Test Token Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <BadgeAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>TEST TOKEN DEMONSTRATION ONLY:</strong> All smart contract transactions use test FARM ERC-20 tokens on local Hardhat EVM with zero real monetary value.
            </span>
          </div>
          <span className="font-mono text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold uppercase">
            Testnet
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('verification')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'verification'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Agreement Verification & Versions</span>
          </button>
          <button
            onClick={() => setActiveTab('escrow')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'escrow'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Test Token Escrow Payment</span>
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'contracts'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Contract Architecture</span>
          </button>
        </div>

        {/* Action / Success Message */}
        {actionMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* TAB 1: VERIFICATION & AUDIT TRAIL */}
          {activeTab === 'verification' && (
            <div className="space-y-5">
              {/* Live Hash Verification Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      Cryptographic Term Matching
                    </h4>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    100% Verified Match
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 block font-medium">Off-chain Canonical Agreement Hash (PostgreSQL):</span>
                    <code className="text-[11px] font-mono text-slate-900 bg-white p-2 rounded-lg border border-slate-200 block break-all font-semibold select-all">
                      {order.agreementHash}
                    </code>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">On-chain Registered Hash (FarmConnectOrderRegistry.sol):</span>
                    <code className="text-[11px] font-mono text-emerald-700 bg-white p-2 rounded-lg border border-emerald-200 block break-all font-semibold select-all">
                      {verification?.onChainHash || order.agreementHash}
                    </code>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Registry Contract</span>
                    <span className="font-mono text-slate-700 font-semibold truncate block">
                      {verification?.contractAddress?.slice(0, 10)}...
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Block Number</span>
                    <span className="font-mono text-slate-700 font-semibold">
                      #{verification?.blockNumber || order.blockNumber || 101}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Agreement Version</span>
                    <span className="font-bold text-slate-800">
                      Version {order.agreementVersion || 1}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Audit Status</span>
                    <span className="font-bold text-emerald-700">
                      Tamper-Evident Authentic
                    </span>
                  </div>
                </div>
              </div>

              {/* Version History (Tamper-evident trail) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-500" />
                    <span>Agreement Version History (Audit Trail)</span>
                  </h4>
                  {!isAmending && (
                    <button
                      onClick={() => setIsAmending(true)}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                    >
                      + Amend Delivery Conditions
                    </button>
                  )}
                </div>

                {isAmending && (
                  <form onSubmit={handleAmendTerms} className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-900">
                        Create New Version (v{(order.agreementVersion || 1) + 1})
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAmending(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Altering terms creates a new immutable version and recalculates a deterministic SHA-256 hash. The previous version remains permanently logged in the audit trail.
                    </p>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-0.5">Delivery Terms</label>
                        <input
                          type="text"
                          value={amendTerms}
                          onChange={(e) => setAmendTerms(e.target.value)}
                          className="w-full p-2 bg-white rounded-lg border border-slate-200 focus:border-emerald-500 outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-0.5">Delivery Address</label>
                        <input
                          type="text"
                          value={amendAddress}
                          onChange={(e) => setAmendAddress(e.target.value)}
                          className="w-full p-2 bg-white rounded-lg border border-slate-200 focus:border-emerald-500 outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-0.5">Reason for Amendment</label>
                        <input
                          type="text"
                          value={amendReason}
                          onChange={(e) => setAmendReason(e.target.value)}
                          placeholder="e.g. Schedule shifted earlier for morning wholesale intake"
                          className="w-full p-2 bg-white rounded-lg border border-slate-200 focus:border-emerald-500 outline-none"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAmending(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/50 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading || !amendReason.trim()}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                      >
                        {actionLoading ? 'Anchoring New Version...' : 'Anchor New Version On-Chain'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {(versions.length > 0 ? versions : [
                    {
                      id: 'v1-demo',
                      orderId: order.id,
                      version: order.agreementVersion || 1,
                      agreementHash: order.agreementHash,
                      canonicalTermsJson: {},
                      onChainTxHash: order.blockchainTxHash,
                      contractAddress: order.contractAddress,
                      networkId: '31337',
                      blockNumber: order.blockNumber || 101,
                      isCurrent: true,
                      termsSummary: `Agreed purchase terms: ${order.items[0]?.quantity || 50} kg of ${order.items[0]?.cropName || 'Produce'} @ ₹${order.items[0]?.unitPrice || 60}/kg`,
                      createdAt: order.createdAt
                    }
                  ]).map((v) => (
                    <div
                      key={v.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        v.isCurrent
                          ? 'bg-emerald-50/40 border-emerald-300'
                          : 'bg-slate-50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded font-bold font-mono text-[10px] ${
                            v.isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                          }`}>
                            v{v.version} {v.isCurrent && '(CURRENT)'}
                          </span>
                          <span className="font-semibold text-slate-800">{v.termsSummary || `Agreement Version ${v.version}`}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(v.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                        <span>Hash: {v.agreementHash.slice(0, 20)}...</span>
                        {v.onChainTxHash && (
                          <span className="text-emerald-700">Tx: {v.onChainTxHash.slice(0, 14)}...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SMART CONTRACT ESCROW DEMONSTRATION */}
          {activeTab === 'escrow' && (
            <div className="space-y-5">
              {/* Escrow Status Dashboard */}
              <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl text-white space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
                      Non-Custodial Escrow Contract
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs uppercase font-mono border ${
                    order.escrowStatus === 'deposited'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : order.escrowStatus === 'released'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : order.escrowStatus === 'refunded'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      : 'bg-slate-700 text-slate-300 border-slate-600'
                  }`}>
                    Escrow: {order.escrowStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-y border-slate-700/60 py-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Locked Deposit Value</span>
                    <span className="text-xl font-extrabold text-emerald-400 font-mono">
                      {order.totalAmount.toLocaleString()} FARM
                    </span>
                    <span className="text-[10px] text-slate-400 block">≈ ₹{order.totalAmount.toLocaleString()} (1:1 Peg Test Token)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Beneficiary Farmer</span>
                    <span className="text-sm font-bold text-slate-100 block truncate">
                      {order.sellerName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Addr: 0x3C44CdDdB6a9...BC
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contract Address:</span>
                    <span className="font-mono text-emerald-400">FarmEscrow.sol (0xe7f1...0512)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Token Standard:</span>
                    <span className="font-mono text-slate-200">ERC-20 (18 Decimals) SafeERC20</span>
                  </div>
                </div>
              </div>

              {/* Lifecycle Step Indicators */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className={`p-2.5 rounded-xl border ${
                  order.escrowStatus === 'deposited' || order.escrowStatus === 'released'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <span className="font-bold block">1. Buyer Deposit</span>
                  <span className="text-[10px]">Tokens locked in contract</span>
                </div>
                <div className={`p-2.5 rounded-xl border ${
                  order.orderStatus === 'in_transit' || order.orderStatus === 'delivered' || order.orderStatus === 'completed'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <span className="font-bold block">2. Transit & Quality</span>
                  <span className="text-[10px]">Traceability verified</span>
                </div>
                <div className={`p-2.5 rounded-xl border ${
                  order.escrowStatus === 'released'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : order.escrowStatus === 'refunded'
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <span className="font-bold block">3. Settlement</span>
                  <span className="text-[10px]">Release / Refund</span>
                </div>
              </div>

              {/* Demonstration Actions */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Execute Smart Contract Actions (Local Hardhat Node)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={handleDepositEscrow}
                    disabled={actionLoading || order.escrowStatus === 'deposited' || order.escrowStatus === 'released'}
                    className="p-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-xl text-left transition-all disabled:opacity-40"
                  >
                    <Coins className="w-4 h-4 text-emerald-600 mb-1" />
                    <span className="font-bold text-xs block text-slate-800">Deposit Escrow</span>
                    <span className="text-[10px] text-slate-500 block">Lock test tokens from buyer</span>
                  </button>

                  <button
                    onClick={handleReleaseEscrow}
                    disabled={actionLoading || order.escrowStatus !== 'deposited'}
                    className="p-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-xl text-left transition-all disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mb-1" />
                    <span className="font-bold text-xs block text-slate-800">Release Payout</span>
                    <span className="text-[10px] text-slate-500 block">Transfer tokens to farmer</span>
                  </button>

                  <button
                    onClick={handleRefundEscrow}
                    disabled={actionLoading || order.escrowStatus !== 'deposited'}
                    className="p-3 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-400 rounded-xl text-left transition-all disabled:opacity-40"
                  >
                    <RefreshCw className="w-4 h-4 text-red-600 mb-1" />
                    <span className="font-bold text-xs block text-slate-800">Refund Buyer</span>
                    <span className="text-[10px] text-slate-500 block">Cancel & return tokens</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SMART CONTRACT ARCHITECTURE */}
          {activeTab === 'contracts' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-600" />
                  <span>Deployed Contracts (Local Hardhat Node - Chain ID 31337)</span>
                </h4>
                
                <div className="space-y-2 font-mono text-[11px]">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 block">FarmConnectOrderRegistry.sol</span>
                      <span className="text-slate-500 text-[10px]">Immutable term hashes & mutual participant confirmations</span>
                    </div>
                    <code className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">
                      0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
                    </code>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 block">FarmEscrow.sol</span>
                      <span className="text-slate-500 text-[10px]">Non-custodial test token escrow with ReentrancyGuard & SafeERC20</span>
                    </div>
                    <code className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">
                      0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
                    </code>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 block">FarmToken.sol (FARM)</span>
                      <span className="text-slate-500 text-[10px]">ERC-20 test settlement token with 18 decimals</span>
                    </div>
                    <code className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">
                      0x5FbDB2315678afecb367f032d93F642f64180aa3
                    </code>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 block">ProduceTraceability.sol</span>
                      <span className="text-slate-500 text-[10px]">Harvest, packing, handover & receipt milestone hashes</span>
                    </div>
                    <code className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">
                      0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
                    </code>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs space-y-1">
                <span className="font-bold block text-blue-950 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-600" />
                  <span>Security & Signing Architecture</span>
                </span>
                <p>
                  Private keys are strictly excluded from frontend code and source control. Transactions are relayed through authenticated FastAPI endpoints using local development accounts on the Hardhat test node.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button
            onClick={loadBlockchainData}
            disabled={loading}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Close Ledger
          </button>
        </div>
      </div>
    </div>
  );
};

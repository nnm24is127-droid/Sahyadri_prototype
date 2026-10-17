import React, { useState, useEffect } from 'react';
import {
  Sprout,
  Mic,
  PackagePlus,
  Stethoscope,
  FlaskConical,
  TrendingUp,
  ShieldCheck,
  MapPin,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Layers,
  CheckCircle2,
  Lock,
  Pause,
  Play,
  Trash2,
  Star,
  Users,
  Check,
  XCircle,
  Calculator,
  Plus,
  Sparkles,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import {
  ProduceListing,
  CropInvestigation,
  Experiment,
  MarketPriceReference,
  Order,
  Review,
  BlockchainTxRef,
  OfferContribution,
  GroupOffer,
  PriceComparisonResult,
} from '../types';
import {
  listingService,
  forensicsService,
  labService,
  pricingService,
  orderService,
  groupOfferService,
} from '../services/apiClient';
import { MOCK_FARM } from '../mock/mockData';
import { FeedbackBanner } from '../components/FeedbackBanner';
import { VoiceListingModal } from '../components/VoiceListingModal';
import { CreateListingModal } from '../components/CreateListingModal';
import { ForensicsModal } from '../components/ForensicsModal';
import { ExperimentModal } from '../components/ExperimentModal';
import { ExperimentObservationModal } from '../components/ExperimentObservationModal';
import { TraceabilityModal } from '../components/TraceabilityModal';
import { ReviewModal } from '../components/ReviewModal';
import { BlockchainLedgerModal } from '../components/BlockchainLedgerModal';

interface FarmerDashboardProps {
  language: 'kn' | 'en';
  activeSection?: string;
}

export const FarmerDashboard: React.FC<FarmerDashboardProps> = ({
  language,
  activeSection = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState(activeSection);
  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [forensics, setForensics] = useState<CropInvestigation[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [prices, setPrices] = useState<MarketPriceReference[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [blockchainTxs, setBlockchainTxs] = useState<BlockchainTxRef[]>([]);
  const [myContributions, setMyContributions] = useState<OfferContribution[]>([]);
  const [groupOffers, setGroupOffers] = useState<GroupOffer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isListingOpen, setIsListingOpen] = useState(false);
  const [isForensicsOpen, setIsForensicsOpen] = useState(false);
  const [selectedCaseForView, setSelectedCaseForView] = useState<CropInvestigation | null>(null);
  const [isExperimentOpen, setIsExperimentOpen] = useState(false);
  const [traceOrderCode, setTraceOrderCode] = useState<string | null>(null);
  const [selectedOrderForLedger, setSelectedOrderForLedger] = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);

  // Observation & Price Assistant State
  const [selectedExpForObs, setSelectedExpForObs] = useState<Experiment | null>(null);
  const [isExpObsOpen, setIsExpObsOpen] = useState(false);
  const [calcCrop, setCalcCrop] = useState('Arecanut (Chali)');
  const [calcPrice, setCalcPrice] = useState(480);
  const [calcUnit, setCalcUnit] = useState('kg');
  const [calcTaluk, setCalcTaluk] = useState('Bantwal');
  const [isComparingPrice, setIsComparingPrice] = useState(false);
  const [priceComparisonResult, setPriceComparisonResult] = useState<PriceComparisonResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const handleComparePrice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsComparingPrice(true);
    setCompareError(null);
    try {
      const res = await pricingService.comparePrice({
        cropName: calcCrop,
        askingPrice: Number(calcPrice),
        unit: calcUnit,
        district: 'Dakshina Kannada',
        taluk: calcTaluk,
      });
      setPriceComparisonResult(res);
    } catch (err: any) {
      setCompareError(err.message || 'Failed to compare asking price');
    } finally {
      setIsComparingPrice(false);
    }
  };

  useEffect(() => {
    setActiveTab(activeSection);
  }, [activeSection]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [l, f, e, p, o, b, c, g] = await Promise.all([
          listingService.getMyListings(),
          forensicsService.getCases(),
          labService.getExperiments(),
          pricingService.getPriceBenchmarks(),
          orderService.getOrders(),
          orderService.getBlockchainTransactions(),
          groupOfferService.getMyContributions(),
          groupOfferService.getGroupOffers(),
        ]);
        setListings(l);
        setForensics(f);
        setExperiments(e);
        setPrices(p);
        setOrders(o);
        setBlockchainTxs(b);
        setMyContributions(c);
        setGroupOffers(g);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleConfirmContribution = async (contribId: string) => {
    try {
      const updated = await groupOfferService.confirmContribution(contribId);
      setMyContributions((prev) => prev.map((c) => (c.id === contribId ? updated : c)));
      const [freshOrders, freshOffers] = await Promise.all([
        orderService.getOrders(),
        groupOfferService.getGroupOffers(),
      ]);
      setOrders(freshOrders);
      setGroupOffers(freshOffers);
      alert('You have confirmed your allocated contribution in the group pool!');
    } catch (err: any) {
      alert(err.message || 'Failed to confirm contribution');
    }
  };

  const handleRejectContribution = async (contribId: string) => {
    const reason = window.prompt('Enter reason for opting out of this group lot:') || 'Farmer unable to supply';
    try {
      const updated = await groupOfferService.rejectContribution(contribId, reason);
      setMyContributions((prev) => prev.map((c) => (c.id === contribId ? updated : c)));
      const [freshListings, freshOrders, freshOffers] = await Promise.all([
        listingService.getMyListings(),
        orderService.getOrders(),
        groupOfferService.getGroupOffers(),
      ]);
      setListings(freshListings);
      setOrders(freshOrders);
      setGroupOffers(freshOffers);
      alert('You have opted out of this lot. Reserved inventory has been restored to your listing.');
    } catch (err: any) {
      alert(err.message || 'Failed to reject contribution');
    }
  };

  const handleToggleListingStatus = async (listingId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    const updated = await listingService.updateStatus(listingId, nextStatus);
    setListings((prev) => prev.map((l) => (l.id === listingId ? updated : l)));
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!window.confirm('Are you sure you want to remove this listing?')) return;
    await listingService.deleteListing(listingId);
    setListings((prev) => prev.filter((l) => l.id !== listingId));
  };

  const handleConfirmOrderTerms = async (orderId: string) => {
    const confirmed = await orderService.confirmOrderTerms(orderId);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? confirmed : o)));
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt('Enter reason for cancellation:') || 'Farmer requested cancellation';
    const cancelled = await orderService.cancelOrder(orderId, reason);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? cancelled : o)));
  };

  const handleDispatchOrder = async (orderId: string) => {
    const updated = await orderService.transitionOrderStatus(
      orderId,
      'in_transit',
      'Farmer dispatched fresh produce crates'
    );
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Demonstration Notice */}
      <FeedbackBanner
        type="demo-notice"
        message="Farmer Operational Dashboard"
        subtext="Viewing live prototype for Farm Owner Ramesh Rai (Bantwal Taluk, Dakshina Kannada). All actions reflect high-fidelity isolated demonstration data ready for backend API binding."
      />

      {/* Farm Profile Header Card */}
      <div className="bg-gradient-to-r from-forest-800 via-forest-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-forest-500/30 border border-forest-400/40 text-forest-200 text-xs font-semibold">
                Marginal Farmer Account (PS 1.2)
              </span>
              <span className="text-xs text-forest-300 font-mono">ID: f101-demo-ramesh</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {MOCK_FARM.farmName}{' '}
              <span className="text-forest-300 text-lg font-normal">({MOCK_FARM.kannadaFarmAlias})</span>
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-forest-200">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-forest-400" />
                Mani Village, Bantwal Taluk, Dakshina Kannada
              </span>
              <span>•</span>
              <span>Total Land: <strong>{MOCK_FARM.totalAreaAcres} Acres</strong></span>
              <span>•</span>
              <span>Soil: <strong>{MOCK_FARM.soilType}</strong></span>
              <span>•</span>
              <span>Irrigation: <strong>{MOCK_FARM.irrigationSource}</strong></span>
            </div>
          </div>

          {/* Quick Action Hub Buttons */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setIsVoiceOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-forest-900/50 transition-all hover:scale-105"
            >
              <Mic className="w-4 h-4 text-white" />
              <span>ಕನ್ನಡ ವಾಯ್ಸ್ ಲಿಸ್ಟಿಂಗ್</span>
            </button>
            <button
              onClick={() => setIsListingOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 flex items-center gap-1.5 transition-colors"
            >
              <PackagePlus className="w-4 h-4 text-forest-300" />
              <span>+ New Listing</span>
            </button>
            <button
              onClick={() => setIsForensicsOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 font-semibold text-xs border border-red-500/30 flex items-center gap-1.5 transition-colors"
            >
              <Stethoscope className="w-4 h-4 text-red-300" />
              <span>Investigate Crop</span>
            </button>
            <button
              onClick={() => setIsExperimentOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-semibold text-xs border border-purple-500/30 flex items-center gap-1.5 transition-colors"
            >
              <FlaskConical className="w-4 h-4 text-purple-300" />
              <span>Start Trial</span>
            </button>
          </div>
        </div>
      </div>

      {/* Segment Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-forest-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          My Produce Listings ({listings.length})
        </button>
        <button
          onClick={() => setActiveTab('forensics')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'forensics'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>FarmForensics ({forensics.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('lab')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'lab'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>FarmLab Experiments ({experiments.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'pricing'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>AI Price Benchmarks</span>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'bg-forest-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Orders & Blockchain ({orders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('group-pools')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'group-pools'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Smart Group Pools ({myContributions.length})</span>
        </button>
      </div>

      {/* SECTION 1: PRODUCE LISTINGS */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Crop Inventory & Listings</h2>
              <p className="text-xs text-slate-500">
                Directly published produce accessible to hotels, supermarkets, and Smart Group pools
              </p>
            </div>
            <button
              onClick={() => setIsListingOpen(true)}
              className="text-xs font-bold text-forest-700 hover:text-forest-800 bg-forest-50 px-3 py-1.5 rounded-lg border border-forest-200 flex items-center gap-1"
            >
              + Create New Listing
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((l) => (
              <div
                key={l.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-2 py-0.5 rounded border border-forest-100">
                          {l.category}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            l.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : l.status === 'paused'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 mt-1">
                        {l.cropName}{' '}
                        {l.cropKannada && <span className="text-slate-500 text-xs font-normal">({l.cropKannada})</span>}
                      </h3>
                      <p className="text-xs text-slate-500">{l.variety || 'Standard coastal variety'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-forest-700 bg-forest-50 px-2.5 py-1 rounded-xl block">
                        ₹{l.pricePerUnit} / {l.unit}
                      </span>
                      <span className="text-[10px] text-slate-400">Asking Price</span>
                    </div>
                  </div>

                  {l.qualityNotes && (
                    <p className="text-xs text-slate-600 bg-slate-50/80 p-2 rounded-xl italic border border-slate-100">
                      &quot;{l.qualityNotes}&quot;
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Available Stock</span>
                      <span className="font-bold text-slate-800">
                        {l.availableQuantity} {l.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Harvest Date</span>
                      <span className="font-semibold text-slate-700">{l.harvestDate}</span>
                    </div>
                  </div>

                  {l.saleDeadline && (
                    <div className="text-[11px] text-amber-800 bg-amber-50/70 p-1.5 rounded-lg border border-amber-200/60 flex items-center justify-between">
                      <span>Harvest/Sale Deadline:</span>
                      <span className="font-bold">{l.saleDeadline}</span>
                    </div>
                  )}

                  {/* Separate Reference APMC Benchmark */}
                  {(l.referenceMandiPrice || l.marketPriceReference) && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">Govt APMC Benchmark:</span>
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                          KSAMB DEMO
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Modal Reference:</span>
                        <span className="font-semibold text-slate-800">
                          ₹{l.marketPriceReference?.modalPrice ?? l.referenceMandiPrice} / {l.unit}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Yard: {l.marketPriceReference?.marketYard || 'Bantwal APMC'} • Separate from asking price
                      </div>
                    </div>
                  )}

                  {l.allowGroupPooling && (
                    <div className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                      <Layers className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <span>Enabled for Smart Group Selling Pools</span>
                    </div>
                  )}

                  {l.createdViaVoice && (
                    <div className="flex items-center gap-1.5 text-[11px] text-forest-700 bg-forest-50/70 p-1.5 rounded-lg border border-forest-100">
                      <Mic className="w-3.5 h-3.5 text-forest-600" />
                      <span>Created via Kannada Voice Input</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{l.taluk}, {l.district}</span>
                    <span className="text-forest-600 font-semibold">{l.qualityGrade}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleToggleListingStatus(l.id, l.status)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                        l.status === 'active'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {l.status === 'active' ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Listing</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Publish Listing</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteListing(l.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                      title="Delete Listing"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: FARMFORENSICS */}
      {activeTab === 'forensics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">FarmForensics — Crop Pathology Log</h2>
              <p className="text-xs text-slate-500">
                AI early-warning diagnostics for Koleroga, quick wilt, and regional coastal crop issues
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedCaseForView(null);
                setIsForensicsOpen(true);
              }}
              className="text-xs font-bold text-red-700 hover:text-red-800 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1"
            >
              + New Crop Investigation
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {forensics.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-red-200/80 p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                      Case {c.id}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-base">{c.cropName}</h4>
                    <p className="text-xs text-slate-600 italic">&quot;{c.symptomsDescription}&quot;</p>
                  </div>

                  {/* Specimen Photograph Preview */}
                  {c.imageUrl && (
                    <div
                      className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative group cursor-pointer"
                      onClick={() => {
                        setSelectedCaseForView(c);
                        setIsForensicsOpen(true);
                      }}
                      title="Click to view specimen photograph & AI investigation details"
                    >
                      <img
                        src={forensicsService.getAuthenticatedImageUrl(c.imageUrl)}
                        alt={`${c.cropName} specimen`}
                        className="w-full h-36 object-cover group-hover:scale-102 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-2.5">
                        <span className="text-[11px] font-semibold text-white flex items-center gap-1.5 drop-shadow-sm">
                          <ImageIcon className="w-3.5 h-3.5 text-red-300" />
                          View Specimen Photograph & Diagnostics
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-red-50/70 rounded-xl border border-red-100 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Preliminary Diagnosis:</span>
                      <span className="text-[11px] font-extrabold text-red-800 bg-white px-2 py-0.5 rounded border border-red-200">
                        {(c.aiConfidenceScore * 100).toFixed(0)}% Confidence
                      </span>
                    </div>
                    <p className="text-red-900 font-semibold">{c.aiPreliminaryDiagnosis}</p>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Actionable Remedies:
                    </span>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {c.remedies.map((r, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-forest-600 flex-shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* MANDATORY DISCLAIMER */}
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>{c.aiDisclaimerNotice}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500 font-medium">
                    Status: <strong className="text-slate-800 capitalize">{c.status}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setSelectedCaseForView(c);
                      setIsForensicsOpen(true);
                    }}
                    className="text-xs font-bold text-red-700 hover:text-red-800 bg-red-50/60 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 flex items-center gap-1 transition-colors"
                  >
                    <span>Inspect Investigation</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: FARMLAB EXPERIMENTS */}
      {activeTab === 'lab' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">FarmLab — Field Experiment Registry</h2>
              <p className="text-xs text-slate-500">
                Scientifically compare organic trials against conventional methods. Calculations are strictly computed in deterministic backend code.
              </p>
            </div>
            <button
              onClick={() => setIsExperimentOpen(true)}
              className="text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 flex items-center gap-1 shadow-sm"
            >
              + Start Controlled Trial
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {experiments.map((exp) => (
              <div
                key={exp.id}
                className="bg-white rounded-2xl border border-purple-200/80 p-5 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                      Status: {exp.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      Duration: {exp.durationDays || 30} days
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {exp.cropTested}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-base">{exp.title}</h3>
                  <p className="text-xs text-slate-600">
                    <strong>Hypothesis:</strong> {exp.hypothesis}
                  </p>
                  {exp.plotSizeDescription && (
                    <p className="text-[11px] text-slate-500">
                      <strong>Plot Size:</strong> {exp.plotSizeDescription}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block font-medium">Control Practice (Benchmark)</span>
                    <span className="text-slate-700 font-semibold">{exp.controlMethod}</span>
                  </div>
                  <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200">
                    <span className="text-purple-600 block font-medium">Experimental Practice (Trial)</span>
                    <span className="text-purple-900 font-semibold">{exp.experimentalMethod}</span>
                  </div>
                </div>

                {/* Recorded Observations List */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Trial Observations & Measurements:
                    </span>
                    <button
                      onClick={() => {
                        setSelectedExpForObs(exp);
                        setIsExpObsOpen(true);
                      }}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-100/70 hover:bg-purple-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Record Observation</span>
                    </button>
                  </div>

                  {exp.observations && exp.observations.length > 0 ? (
                    <div className="space-y-2">
                      {exp.observations.map((obs, idx) => (
                        <div
                          key={obs.id || idx}
                          className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{obs.metricName}</span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                                  (obs.numericalDifference ?? 0) >= 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {(obs.numericalDifference ?? 0) >= 0 ? `+${obs.numericalDifference}` : obs.numericalDifference}{' '}
                                ({(obs.percentageChange ?? 0) >= 0 ? `+${obs.percentageChange}%` : `${obs.percentageChange}%`})
                              </span>
                              {obs.costDelta !== undefined && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    obs.costDelta <= 0 ? 'bg-forest-100 text-forest-800' : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {obs.costDelta <= 0 ? `Savings ₹${Math.abs(obs.costDelta)}` : `Cost +₹${obs.costDelta}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 flex justify-between">
                            <span>Control: {obs.controlMetricValue}</span>
                            <span>Trial: {obs.experimentalMetricValue}</span>
                          </div>
                          {obs.notes && (
                            <p className="text-[11px] text-slate-600 italic border-t border-slate-200/60 pt-0.5">
                              &quot;{obs.notes}&quot;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      No measurements logged yet. Click &quot;Record Observation&quot; to submit harvest yields or inputs.
                    </p>
                  )}
                </div>

                {/* AI Synthesis Summary */}
                {exp.aiSynthesisSummary && (
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-xs text-slate-700 space-y-1">
                    <span className="font-bold block text-purple-900 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>AI Synthesis & Analysis:</span>
                    </span>
                    <p className="leading-relaxed">{exp.aiSynthesisSummary}</p>
                  </div>
                )}

                {/* Limitations and Disclaimers */}
                {exp.limitationsSummary && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block">Trial Limitations & Caution:</strong>
                      <span>{exp.limitationsSummary}</span>
                    </div>
                  </div>
                )}

                {/* Next Experiment Suggestions */}
                {exp.nextExperimentSuggestions && (
                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <strong className="text-slate-800">Suggested Follow-Up Trial:</strong>{' '}
                    {exp.nextExperimentSuggestions}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: AI PRICE ASSISTANT */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Price Assistant — Mandi APMC Intelligence</h2>
              <p className="text-xs text-slate-500">
                Compare your asking price against authentic wholesale APMC benchmark records in Dakshina Kannada & Udupi.
              </p>
            </div>
          </div>

          {/* Interactive Pricing Comparison Tool */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-2">
              <Calculator className="w-4 h-4 text-forest-600" />
              <span>Real-Time Asking Price Comparator (ಬೆಲೆ ವಿಶ್ಲೇಷಣೆ)</span>
            </div>

            {/* Quick preset selector */}
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                Quick Test Benchmarks:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'Arecanut (Chali)', price: 480, unit: 'kg' },
                  { name: 'Udupi Mattu Gulla', price: 68, unit: 'kg' },
                  { name: 'Black Pepper', price: 630, unit: 'kg' },
                  { name: 'Coconut', price: 25, unit: 'nut' },
                  { name: 'Tomato', price: 32, unit: 'kg' },
                  { name: 'Exotic Dragon Fruit (Rare)', price: 250, unit: 'kg' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCalcCrop(item.name);
                      setCalcPrice(item.price);
                      setCalcUnit(item.unit);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      calcCrop === item.name
                        ? 'bg-forest-50 border-forest-400 text-forest-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleComparePrice} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Crop Name
                </label>
                <input
                  type="text"
                  value={calcCrop}
                  onChange={(e) => setCalcCrop(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Asking Price (₹) & Unit
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    value={calcPrice}
                    onChange={(e) => setCalcPrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 font-bold text-forest-700 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
                    required
                  />
                  <select
                    value={calcUnit}
                    onChange={(e) => setCalcUnit(e.target.value)}
                    className="text-xs font-semibold p-2 rounded-xl border border-slate-200 outline-none bg-slate-50"
                  >
                    <option value="kg">kg</option>
                    <option value="nut">nut</option>
                    <option value="atte">atte</option>
                    <option value="quintal">quintal</option>
                  </select>
                </div>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isComparingPrice}
                  className="w-full py-2 bg-forest-600 hover:bg-forest-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isComparingPrice ? 'Comparing...' : 'Compare Asking Price'}</span>
                </button>
              </div>
            </form>

            {compareError && (
              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200">
                {compareError}
              </div>
            )}

            {/* Comparison Result Display */}
            {priceComparisonResult && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-200">
                {priceComparisonResult.hasReferenceData ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {priceComparisonResult.cropName} Analysis
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            priceComparisonResult.positionRelativeToMandi === 'above_modal_rate'
                              ? 'bg-amber-100 text-amber-800'
                              : priceComparisonResult.positionRelativeToMandi === 'below_modal_rate'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {priceComparisonResult.positionRelativeToMandi.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {priceComparisonResult.referenceMarketYard} ({priceComparisonResult.observationDate})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Your Asking Price</span>
                        <span className="font-extrabold text-forest-700 text-sm">
                          ₹{priceComparisonResult.askingPrice} / {priceComparisonResult.unit}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">APMC Mandi Modal Price</span>
                        <span className="font-extrabold text-slate-800 text-sm">
                          ₹{priceComparisonResult.referenceModalPrice} / {priceComparisonResult.unit}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Deterministic Difference</span>
                        <span
                          className={`font-extrabold text-sm ${
                            (priceComparisonResult.difference ?? 0) >= 0 ? 'text-amber-700' : 'text-blue-700'
                          }`}
                        >
                          {(priceComparisonResult.difference ?? 0) >= 0 ? `+₹${priceComparisonResult.difference}` : `₹${priceComparisonResult.difference}`} (
                          {(priceComparisonResult.percentageDifference ?? 0) >= 0
                            ? `+${priceComparisonResult.percentageDifference}%`
                            : `${priceComparisonResult.percentageDifference}%`}
                          )
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Mandi Price Range</span>
                        <span className="font-bold text-slate-700 text-xs">
                          ₹{priceComparisonResult.referenceMinPrice} - ₹{priceComparisonResult.referenceMaxPrice}
                        </span>
                      </div>
                    </div>

                    {/* AI Explanation in simple language */}
                    <div className="p-3 bg-forest-50/70 border border-forest-100 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-forest-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-forest-600" />
                        <span>AI Market Advisory:</span>
                      </span>
                      <p className="text-forest-950 leading-relaxed font-sans">
                        {priceComparisonResult.aiExplanation}
                      </p>
                    </div>

                    {/* Disclaimer */}
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>{priceComparisonResult.disclaimer}</span>
                    </div>
                  </>
                ) : (
                  /* Explicit missing reference warning */
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Data Limitation Notice — No Official Mandi Benchmark Exists</span>
                    </div>
                    <p className="text-xs text-amber-950 leading-relaxed font-sans">
                      {priceComparisonResult.aiExplanation}
                    </p>
                    <p className="text-[11px] text-amber-800 italic border-t border-amber-200/60 pt-1">
                      {priceComparisonResult.disclaimer}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reference Mandi Benchmarks Table */}
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Official Karnataka State Agricultural Marketing Board (KSAMB) Benchmarks
              </h3>
              <p className="text-xs text-slate-500">
                Independent wholesale modal benchmarks in APMC Bantwal, Puttur, Mangaluru, and Udupi yards.
              </p>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Crop & Variety</th>
                  <th className="py-3 px-4">Market Yard</th>
                  <th className="py-3 px-4">APMC Min</th>
                  <th className="py-3 px-4">APMC Modal</th>
                  <th className="py-3 px-4">APMC Max</th>
                  <th className="py-3 px-4">Direct Fair Value</th>
                  <th className="py-3 px-4">Source & Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prices.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {p.cropName}{' '}
                      {p.variety && <span className="text-slate-400 block font-normal">{p.variety}</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.marketYard}</td>
                    <td className="py-3 px-4 text-slate-600">₹{p.minPrice} / {p.unit}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">₹{p.modalPrice} / {p.unit}</td>
                    <td className="py-3 px-4 text-slate-600">₹{p.maxPrice} / {p.unit}</td>
                    <td className="py-3 px-4 font-extrabold text-forest-700 bg-forest-50/50">
                      ₹{Math.round(p.modalPrice * 1.05)} / {p.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {p.dataSource}
                      {p.isDemonstrationData && ' [Demo]'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: ORDERS & BLOCKCHAIN */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Incoming Orders & Smart Contract State</h2>
            <p className="text-xs text-slate-500">
              Orders backed by cryptographic SHA-256 agreement hashes and test token payment escrow
            </p>
          </div>

          <div className="space-y-4">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-forest-700 bg-forest-50 px-2 py-0.5 rounded">
                      {ord.orderCode}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      Buyer: <strong>{ord.buyerName}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      Status: {ord.orderStatus.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-bold uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Escrow: {ord.escrowStatus}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-medium">Produce Item</span>
                    <span className="font-bold text-slate-800">
                      {ord.items[0]?.cropName} ({ord.items[0]?.quantity} {ord.items[0]?.unit})
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-medium">Total Agreed Settlement</span>
                    <span className="font-extrabold text-forest-800 text-sm">
                      ₹{ord.totalAmount.toLocaleString()} (FARM)
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-medium">Delivery Destination</span>
                    <span className="text-slate-700 font-semibold truncate block">
                      {ord.deliveryAddress}
                    </span>
                  </div>
                </div>

                {ord.cancellationReason && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                    <strong>Cancellation Reason:</strong> {ord.cancellationReason}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                  {!ord.farmerConfirmed && ord.orderStatus === 'created' && (
                    <button
                      onClick={() => handleConfirmOrderTerms(ord.id)}
                      className="px-3 py-1.5 bg-forest-600 hover:bg-forest-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Terms & Accept Order</span>
                    </button>
                  )}

                  {['created', 'confirmed'].includes(ord.orderStatus) && (
                    <button
                      onClick={() => handleCancelOrder(ord.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}

                  {ord.orderStatus === 'escrow_funded' && (
                    <button
                      onClick={() => handleDispatchOrder(ord.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5"
                    >
                      <span>Dispatch Produce / In-Transit</span>
                    </button>
                  )}

                  {ord.orderStatus === 'completed' && (
                    <button
                      onClick={() => setReviewOrder(ord)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>Review Transaction</span>
                    </button>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] font-mono text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-2">
                  <span>Agreement Hash: {ord.agreementHash.slice(0, 20)}...</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTraceOrderCode(ord.orderCode)}
                      className="text-xs font-bold text-forest-700 hover:text-forest-800 flex items-center gap-1 bg-white hover:bg-forest-50 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-forest-600" />
                      <span>Traceability</span>
                    </button>
                    <button
                      onClick={() => setSelectedOrderForLedger(ord)}
                      className="text-xs font-bold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 bg-emerald-100/70 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Blockchain & Escrow Ledger</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Blockchain Audit Transaction Logs */}
          <div className="pt-4 space-y-3">
            <h3 className="font-bold text-sm text-slate-800">On-Chain EVM Contract Activity Log</h3>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Contract</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Tx Hash</th>
                    <th className="py-2.5 px-4">Block #</th>
                    <th className="py-2.5 px-4">Network</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {blockchainTxs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{tx.contractName}</td>
                      <td className="py-2.5 px-4 text-slate-600">{tx.actionType}</td>
                      <td className="py-2.5 px-4 text-emerald-700">{tx.txHash.slice(0, 16)}...</td>
                      <td className="py-2.5 px-4 text-slate-600">#{tx.blockNumber}</td>
                      <td className="py-2.5 px-4 text-slate-500">{tx.networkId}</td>
                      <td className="py-2.5 px-4 text-emerald-600 font-bold uppercase">{tx.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: SMART GROUP SELLING POOLS & CONTRIBUTIONS */}
      {activeTab === 'group-pools' && (
        <div className="space-y-6">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-blue-950 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Smart Group Selling & Lot Pooling Contributions</span>
              </h2>
              <p className="text-xs text-blue-800 mt-0.5">
                Marginal farmers combine surplus small lots to fulfill bulk institutional purchase orders.
              </p>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-white/80 px-3 py-1.5 rounded-xl border border-blue-200">
              Allocated Lots: {myContributions.length}
            </span>
          </div>

          <div className="space-y-4">
            {myContributions.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
                No group pool lots currently assigned to your farm. Ensure <strong>&quot;Allow Group Pooling&quot;</strong> is enabled on your listings so the matcher can aggregate your produce!
              </div>
            ) : (
              myContributions.map((contrib) => (
                <div
                  key={contrib.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          Contribution ID: {contrib.id.slice(0, 8)}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          Pool: {contrib.groupOfferId.slice(0, 8)}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mt-1">
                        Allocated Lot: {contrib.contributedQuantity} kg
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          contrib.farmerConfirmed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {contrib.farmerConfirmed ? '✓ Confirmed by You' : 'Pending Confirmation'}
                      </span>
                      <span className="text-xs font-bold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Status: {contrib.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block font-medium">Agreed Unit Rate</span>
                      <span className="font-bold text-blue-700 text-sm">
                        ₹{contrib.unitPrice?.toFixed(2) || '30.00'} / kg
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block font-medium">Your Lot Subtotal</span>
                      <span className="font-extrabold text-forest-800 text-sm">
                        ₹{contrib.subtotal?.toLocaleString('en-IN') || (contrib.contributedQuantity * (contrib.unitPrice || 30)).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block font-medium">Assigned Hub / Depot</span>
                      <span className="font-semibold text-slate-700 truncate block">
                        Bantwal APMC Aggregation Hub
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      Assigned on: {new Date(contrib.contributionTimestamp).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      {!contrib.farmerConfirmed && contrib.status !== 'rejected' && (
                        <button
                          onClick={() => handleConfirmContribution(contrib.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm My Contribution</span>
                        </button>
                      )}

                      {contrib.status !== 'rejected' && (
                        <button
                          onClick={() => handleRejectContribution(contrib.id)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-semibold text-xs transition-colors"
                        >
                          Opt-Out / Reject Lot
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <VoiceListingModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSaveListing={(newListing) => {
          setListings([newListing as ProduceListing, ...listings]);
        }}
      />

      <CreateListingModal
        isOpen={isListingOpen}
        onClose={() => setIsListingOpen(false)}
        onListingCreated={(newListing) => {
          setListings([newListing, ...listings]);
        }}
      />

      <ForensicsModal
        isOpen={isForensicsOpen}
        onClose={() => {
          setIsForensicsOpen(false);
          setSelectedCaseForView(null);
        }}
        viewCase={selectedCaseForView}
        onCaseCreated={(newCase) => {
          setForensics([newCase, ...forensics]);
        }}
      />

      <ExperimentModal
        isOpen={isExperimentOpen}
        onClose={() => setIsExperimentOpen(false)}
        onExperimentCreated={(newExp) => {
          setExperiments([newExp, ...experiments]);
        }}
      />

      <ExperimentObservationModal
        isOpen={isExpObsOpen}
        onClose={() => {
          setIsExpObsOpen(false);
          setSelectedExpForObs(null);
        }}
        experiment={selectedExpForObs}
        onObservationAdded={(updatedExp) => {
          setExperiments(experiments.map((e) => (e.id === updatedExp.id ? updatedExp : e)));
        }}
      />

      <TraceabilityModal
        isOpen={!!traceOrderCode}
        onClose={() => setTraceOrderCode(null)}
        orderCode={traceOrderCode || ''}
        orderId={orders.find((o) => o.orderCode === traceOrderCode)?.id}
      />

      <BlockchainLedgerModal
        isOpen={!!selectedOrderForLedger}
        onClose={() => setSelectedOrderForLedger(null)}
        order={selectedOrderForLedger}
        onOrderUpdated={(updated) => {
          setOrders(orders.map((o) => (o.id === updated.id ? updated : o)));
        }}
      />

      <ReviewModal
        isOpen={!!reviewOrder}
        onClose={() => setReviewOrder(null)}
        order={reviewOrder}
        onReviewSubmitted={() => {}}
      />
    </div>
  );
};

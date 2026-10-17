import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  ShoppingCart,
  Users,
  ShieldCheck,
  MapPin,
  TrendingUp,
  Package,
  Layers,
  Check,
  Plus,
  ArrowRight,
  Sparkles,
  Star,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ProduceListing, GroupOffer, Order } from '../types';
import { listingService, groupOfferService, orderService } from '../services/apiClient';
import { REGIONAL_METADATA } from '../config/api';
import { FeedbackBanner } from '../components/FeedbackBanner';
import { OrderConfirmationModal } from '../components/OrderConfirmationModal';
import { GroupOfferModal } from '../components/GroupOfferModal';
import { TraceabilityModal } from '../components/TraceabilityModal';
import { ReviewModal } from '../components/ReviewModal';
import { BlockchainLedgerModal } from '../components/BlockchainLedgerModal';

interface BuyerDashboardProps {
  language: 'kn' | 'en';
  activeSection?: string;
}

export const BuyerDashboard: React.FC<BuyerDashboardProps> = ({
  language,
  activeSection = 'marketplace',
}) => {
  const [activeTab, setActiveTab] = useState(activeSection);
  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [groupOffers, setGroupOffers] = useState<GroupOffer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedTaluk, setSelectedTaluk] = useState<string>('all');
  const [minQuantity, setMinQuantity] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [organicOnly, setOrganicOnly] = useState(false);

  // Modals
  const [selectedListingForOrder, setSelectedListingForOrder] = useState<ProduceListing | null>(null);
  const [isGroupOfferModalOpen, setIsGroupOfferModalOpen] = useState(false);
  const [traceOrderCode, setTraceOrderCode] = useState<string | null>(null);
  const [selectedOrderForLedger, setSelectedOrderForLedger] = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);

  useEffect(() => {
    setActiveTab(activeSection);
  }, [activeSection]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [l, g, o] = await Promise.all([
          listingService.getListings(),
          groupOfferService.getGroupOffers(),
          orderService.getOrders(),
        ]);
        setListings(l);
        setGroupOffers(g);
        setOrders(o);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt('Enter reason for cancellation:') || 'Buyer cancelled order';
    const cancelled = await orderService.cancelOrder(orderId, reason);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? cancelled : o)));
  };

  const handleFundEscrow = async (orderId: string) => {
    const updated = await orderService.transitionOrderStatus(
      orderId,
      'escrow_funded',
      'Buyer funded escrow via test tokens'
    );
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
  };

  const handleConfirmDelivery = async (orderId: string) => {
    const updated = await orderService.transitionOrderStatus(
      orderId,
      'delivered',
      'Buyer physically inspected and verified produce delivery'
    );
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
  };

  const handleCompleteOrder = async (orderId: string) => {
    const updated = await orderService.transitionOrderStatus(
      orderId,
      'completed',
      'Buyer released escrow to farmer upon full satisfaction'
    );
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
  };

  const handleAcceptGroupOffer = async (offerId: string) => {
    try {
      const accepted = await groupOfferService.acceptGroupOffer(offerId);
      setGroupOffers((prev) => prev.map((g) => (g.id === offerId ? accepted : g)));
      const freshOrders = await orderService.getOrders();
      setOrders(freshOrders);
      alert('Group offer accepted! A consolidated parent order with itemized farmer contributions has been created.');
    } catch (err: any) {
      alert(err.message || 'Failed to accept group offer');
    }
  };

  const handleRejectGroupOffer = async (offerId: string) => {
    try {
      const rejected = await groupOfferService.rejectGroupOffer(offerId);
      setGroupOffers((prev) => prev.map((g) => (g.id === offerId ? rejected : g)));
      const freshListings = await listingService.getListings();
      setListings(freshListings);
    } catch (err: any) {
      alert(err.message || 'Failed to reject group offer');
    }
  };

  const handleCancelGroupOffer = async (offerId: string) => {
    const reason = window.prompt('Enter reason for pool cancellation:') || 'Buyer cancelled group pool';
    try {
      const cancelled = await groupOfferService.cancelGroupOffer(offerId, reason);
      setGroupOffers((prev) => prev.map((g) => (g.id === offerId ? cancelled : g)));
      const [freshOrders, freshListings] = await Promise.all([
        orderService.getOrders(),
        listingService.getListings(),
      ]);
      setOrders(freshOrders);
      setListings(freshListings);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel group offer');
    }
  };

  const handleOfferCreated = async (newOffer: GroupOffer) => {
    setGroupOffers((prev) => [newOffer, ...prev]);
    const [freshOrders, freshListings] = await Promise.all([
      orderService.getOrders(),
      listingService.getListings(),
    ]);
    setOrders(freshOrders);
    setListings(freshListings);
  };

  // Filter listings
  const filteredListings = listings.filter((item) => {
    const matchesSearch =
      item.cropName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.taluk.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.cropKannada && item.cropKannada.includes(searchQuery));
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesDist = selectedDistrict === 'all' || item.district === selectedDistrict;
    const matchesTaluk = selectedTaluk === 'all' || item.taluk === selectedTaluk;
    const matchesOrganic = !organicOnly || item.organicCertified;
    const matchesMinQty = minQuantity === '' || item.availableQuantity >= Number(minQuantity);
    const matchesMaxPrice = maxPrice === '' || item.pricePerUnit <= Number(maxPrice);

    return matchesSearch && matchesCat && matchesDist && matchesTaluk && matchesOrganic && matchesMinQty && matchesMaxPrice;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Demonstration Banner */}
      <FeedbackBanner
        type="demo-notice"
        message="Commercial Buyer & Procurement Hub"
        subtext="Logged in as Suresh Shetty (Procurement Head, Ocean Pearl Hotels & Catering, Mangalore). Direct purchase orders, Smart Group Selling quantity matching, and test token escrow are operational."
      />

      {/* Buyer Hub Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-forest-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-forest-500/20 text-forest-300 border border-forest-400/30 text-xs font-semibold">
              Verified Institutional Buyer
            </span>
            <span className="text-xs text-slate-400 font-mono">Ocean Pearl Mangalore</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Direct Farm Produce Marketplace
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Source fresh, GI-tagged plantation and horticulture produce directly from verified farmers in Dakshina Kannada & Udupi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGroupOfferModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-forest-900/40 transition-all hover:scale-105"
          >
            <Users className="w-4 h-4 text-white" />
            <span>+ Create Bulk Demand Pool</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'marketplace'
              ? 'bg-forest-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Produce Listings ({filteredListings.length})
        </button>
        <button
          onClick={() => setActiveTab('group-selling')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'group-selling'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Smart Group Selling Pools ({groupOffers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'bg-forest-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>My Orders & Escrow ({orders.length})</span>
        </button>
      </div>

      {/* TAB 1: MARKETPLACE */}
      {activeTab === 'marketplace' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by crop (Arecanut, Mattu Gulla, Pepper) or taluk (Bantwal, Udupi)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs p-2.5 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
              >
                <option value="all">All Categories</option>
                <option value="plantation">Plantation (Arecanut, Coconut)</option>
                <option value="horticulture">Horticulture (Mattu Gulla, Jasmine)</option>
                <option value="spice">Spices (Black Pepper)</option>
                <option value="vegetable">Vegetables</option>
                <option value="fruit">Fruits</option>
                <option value="cereal">Cereals (Red Rice)</option>
              </select>

              <select
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedTaluk('all');
                }}
                className="text-xs p-2.5 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
              >
                <option value="all">All Coastal Districts</option>
                <option value="Dakshina Kannada">Dakshina Kannada</option>
                <option value="Udupi">Udupi</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer self-center whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={organicOnly}
                  onChange={(e) => setOrganicOnly(e.target.checked)}
                  className="rounded text-forest-600 focus:ring-forest-500"
                />
                <span>Organic Only</span>
              </label>
            </div>

            {/* Secondary Advanced Filters: Location, Quantity, Price */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <select
                value={selectedTaluk}
                onChange={(e) => setSelectedTaluk(e.target.value)}
                className="text-xs p-2.5 rounded-xl border border-slate-200 focus:border-forest-500 outline-none bg-slate-50"
              >
                <option value="all">All Taluks (ತಾಲೂಕುಗಳು)</option>
                {selectedDistrict !== 'all'
                  ? REGIONAL_METADATA.TALUKS_BY_DISTRICT[selectedDistrict as 'Dakshina Kannada' | 'Udupi']?.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))
                  : [
                      ...REGIONAL_METADATA.TALUKS_BY_DISTRICT['Dakshina Kannada'],
                      ...REGIONAL_METADATA.TALUKS_BY_DISTRICT['Udupi'],
                    ].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
              </select>

              <input
                type="number"
                placeholder="Required Min Qty (kg/nut)..."
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                className="text-xs p-2.5 rounded-xl border border-slate-200 focus:border-forest-500 outline-none bg-slate-50"
              />

              <input
                type="number"
                placeholder="Max Asking Price ₹/unit..."
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="text-xs p-2.5 rounded-xl border border-slate-200 focus:border-forest-500 outline-none bg-slate-50"
              />
            </div>
          </div>

          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => {
              const isAvailable = listing.availableQuantity > 0 && listing.status === 'active';

              return (
                <div
                  key={listing.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-2 py-0.5 rounded border border-forest-100">
                            {listing.category}
                          </span>
                          {listing.status !== 'active' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                              {listing.status}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-base text-slate-900 mt-1">
                          {listing.cropName}{' '}
                          {listing.cropKannada && (
                            <span className="text-slate-500 text-xs font-normal">({listing.cropKannada})</span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500">{listing.variety}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-extrabold text-forest-700">
                          ₹{listing.pricePerUnit}
                        </span>
                        <span className="text-xs text-slate-400 block">/ {listing.unit}</span>
                      </div>
                    </div>

                    {listing.qualityNotes && (
                      <p className="text-xs text-slate-600 bg-slate-50/80 p-2 rounded-xl italic border border-slate-100">
                        &quot;{listing.qualityNotes}&quot;
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Available</span>
                        <span className="font-bold text-slate-800">
                          {listing.availableQuantity} {listing.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Min Order (MOQ)</span>
                        <span className="font-semibold text-slate-700">
                          {listing.minimumOrderQuantity} {listing.unit}
                        </span>
                      </div>
                    </div>

                    {listing.saleDeadline && (
                      <div className="text-[11px] text-amber-800 bg-amber-50/70 p-1.5 rounded-lg border border-amber-200/60 flex items-center justify-between">
                        <span>Harvest/Sale Deadline:</span>
                        <span className="font-bold">{listing.saleDeadline}</span>
                      </div>
                    )}

                    {/* Separate Reference APMC Benchmark */}
                    {(listing.referenceMandiPrice || listing.marketPriceReference) && (
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
                            ₹{listing.marketPriceReference?.modalPrice ?? listing.referenceMandiPrice} / {listing.unit}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Yard: {listing.marketPriceReference?.marketYard || 'APMC Yard'} • Separate from asking price
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-forest-600" />
                        {listing.taluk}, {listing.district}
                      </span>
                      <span className="font-semibold text-slate-700">{listing.qualityGrade}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Farmer: <strong>{listing.farmerName}</strong></span>
                      {listing.organicCertified && (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          Organic ZBNF
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    disabled={!isAvailable}
                    onClick={() => setSelectedListingForOrder(listing)}
                    className="w-full py-2.5 bg-forest-600 hover:bg-forest-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>{isAvailable ? 'Request Purchase & Escrow' : 'Currently Unavailable'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: SMART GROUP SELLING POOLS */}
      {activeTab === 'group-selling' && (
        <div className="space-y-6">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-blue-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Smart Quantity-Matching Aggregation Pools</span>
              </h3>
              <p className="text-xs text-blue-800 mt-0.5">
                Marginal farmers with 100–500 kg lots pool together to fulfill institutional purchase orders exceeding 2,000 kg.
              </p>
            </div>
            <button
              onClick={() => setIsGroupOfferModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm whitespace-nowrap"
            >
              + Create Bulk Requirement
            </button>
          </div>

          <div className="space-y-5">
            {groupOffers.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
                No active group demand pools found. Click <strong>&quot;+ Create Bulk Requirement&quot;</strong> to start pooling!
              </div>
            ) : (
              groupOffers.map((offer) => {
                const progressPct = Math.min(
                  100,
                  Math.round((offer.currentCommittedQuantity / offer.targetQuantity) * 100)
                );

                return (
                  <div
                    key={offer.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            Pool ID: {offer.id.slice(0, 8)}
                          </span>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              offer.status === 'accepted'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : offer.status === 'proposed'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : offer.status === 'matched'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : offer.status === 'rejected' || offer.status === 'cancelled'
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}
                          >
                            {offer.status.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mt-1">
                          {offer.cropName} — Target: {offer.targetQuantity.toLocaleString()} {offer.unit}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Initiated by: <strong>{offer.buyerName}</strong> • Hub: <strong>{offer.aggregationHubName}</strong>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block font-medium">Weighted Rate</span>
                        <span className="text-xl font-black text-blue-700">
                          ₹{offer.offeredUnitPrice.toFixed(2)} / {offer.unit}
                        </span>
                        {offer.totalAmount && (
                          <span className="text-[11px] font-bold text-slate-600 block">
                            Total: ₹{offer.totalAmount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Matching Explanation */}
                    {offer.matchingExplanation && (
                      <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl text-xs text-blue-950 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-blue-800 text-[11px] uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          <span>Matching Breakdown & Logistics Explanation:</span>
                        </span>
                        <p className="text-slate-700 leading-relaxed">{offer.matchingExplanation}</p>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700">
                          Pooled Quantity: <strong>{offer.currentCommittedQuantity.toLocaleString()} {offer.unit}</strong>
                        </span>
                        <span className="text-blue-700 font-bold">{progressPct}% Filled</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${progressPct}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-forest-500 rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>

                    {/* Contributing Farmers Breakdown */}
                    {offer.contributions.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                          Contributing Smallholder Lots ({offer.contributions.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {offer.contributions.map((c) => (
                            <div
                              key={c.id}
                              className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl text-xs flex flex-col justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900">{c.farmerName}</span>
                                  <span
                                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                      c.farmerConfirmed
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {c.farmerConfirmed ? '✓ Confirmed' : 'Pending'}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500 block">{c.farmerLocation || 'Dakshina Kannada'}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                                <span className="font-bold text-slate-800">
                                  {c.contributedQuantity} {offer.unit}
                                </span>
                                {c.unitPrice ? (
                                  <span className="text-blue-700 font-semibold">
                                    @ ₹{c.unitPrice.toFixed(2)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {offer.orderId && (
                          <button
                            onClick={() => setActiveTab('orders')}
                            className="px-3 py-1.5 bg-forest-50 text-forest-700 hover:bg-forest-100 border border-forest-200 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                          >
                            <span>View Linked Parent Order &rarr;</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {offer.status === 'proposed' && (
                          <>
                            <button
                              onClick={() => handleAcceptGroupOffer(offer.id)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Accept & Create Order</span>
                            </button>
                            <button
                              onClick={() => handleRejectGroupOffer(offer.id)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-colors"
                            >
                              <span>Reject Offer</span>
                            </button>
                          </>
                        )}

                        {['open', 'proposed', 'matched'].includes(offer.status) && (
                          <button
                            onClick={() => handleCancelGroupOffer(offer.id)}
                            className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-semibold text-xs transition-colors"
                          >
                            <span>Cancel Pool</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MY ORDERS & ESCROW */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Procurement Orders & Settlement State</h2>
            <p className="text-xs text-slate-500">
              Track delivery progress and inspect cryptographic SHA-256 agreement hashes
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
                      Seller: <strong>{ord.sellerName}</strong>
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
                    <span className="text-slate-400 block font-medium">Item Ordered</span>
                    <span className="font-bold text-slate-800">
                      {ord.items[0]?.cropName} ({ord.items[0]?.quantity} {ord.items[0]?.unit})
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block font-medium">Total Escrow Deposit</span>
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
                  {['created', 'confirmed'].includes(ord.orderStatus) && (
                    <button
                      onClick={() => handleCancelOrder(ord.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}

                  {ord.orderStatus === 'confirmed' && (
                    <button
                      onClick={() => handleFundEscrow(ord.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5"
                    >
                      <span>Lock TestToken Escrow</span>
                    </button>
                  )}

                  {ord.orderStatus === 'in_transit' && (
                    <button
                      onClick={() => handleConfirmDelivery(ord.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Physical Delivery</span>
                    </button>
                  )}

                  {ord.orderStatus === 'delivered' && (
                    <button
                      onClick={() => handleCompleteOrder(ord.id)}
                      className="px-3 py-1.5 bg-forest-600 hover:bg-forest-700 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete Order & Release Escrow</span>
                    </button>
                  )}

                  {ord.orderStatus === 'completed' && (
                    <button
                      onClick={() => setReviewOrder(ord)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>Leave Review & Rating</span>
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
        </div>
      )}

      {/* Modals */}
      <OrderConfirmationModal
        isOpen={!!selectedListingForOrder}
        onClose={() => setSelectedListingForOrder(null)}
        listing={selectedListingForOrder}
        onOrderConfirmed={(newOrder) => {
          setOrders([newOrder, ...orders]);
        }}
      />

      <GroupOfferModal
        isOpen={isGroupOfferModalOpen}
        onClose={() => setIsGroupOfferModalOpen(false)}
        onOfferCreated={handleOfferCreated}
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

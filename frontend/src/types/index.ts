// ============================================================================
// FarmConnect AI — TypeScript Domain Models
// ============================================================================

export type UserRole = 'farmer' | 'buyer' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  preferredLanguage: 'kn' | 'en';
  district: string;
  taluk: string;
  village?: string;
  walletAddress?: string;
  isVerified?: boolean;
}

export interface Farm {
  id: string;
  farmerId: string;
  farmName: string;
  kannadaFarmAlias?: string;
  totalAreaAcres: number;
  soilType: string;
  irrigationSource: string;
  latitude?: number;
  longitude?: number;
}

export type CropCategory = 'plantation' | 'spice' | 'horticulture' | 'vegetable' | 'fruit' | 'cereal';
export type QualityGrade = 'Grade A (Premium)' | 'Grade B (Standard)' | 'Grade C (Commercial)';
export type ListingStatus = 'draft' | 'active' | 'paused' | 'partially_allocated' | 'sold_out' | 'archived' | 'flagged_fraudulent' | 'flagged';

export interface ProduceListing {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone?: string;
  farmId?: string;
  cropName: string;
  cropKannada?: string;
  variety?: string;
  category: CropCategory;
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
  minimumOrderQuantity: number;
  pricePerUnit: number;
  qualityGrade: QualityGrade;
  qualityNotes?: string;
  organicCertified: boolean;
  harvestDate: string;
  saleDeadline?: string;
  shelfLifeDays: number;
  status: ListingStatus;
  district: string;
  taluk: string;
  allowGroupPooling: boolean;
  aiSuggestedPrice?: number;
  referenceMandiPrice?: number;
  marketPriceReference?: MarketPriceReference;
  createdViaVoice: boolean;
  voiceTranscriptKannada?: string;
  createdAt: string;
  isMock?: boolean;
}

export interface PossibleCause {
  cause: string;
  likelihood: string;
  details?: string;
}

export interface CropInvestigation {
  id: string;
  farmId: string;
  farmerId: string;
  cropName: string;
  symptomsDescription: string;
  voiceNoteTranscriptKannada?: string;
  affectedPercentage: number;
  imageUrl?: string;
  irrigationDetails?: string;
  aiPreliminaryDiagnosis: string;
  aiConfidenceScore: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  remedies: string[];
  possibleCauses?: PossibleCause[];
  recommendedNextChecks?: string[];
  observations?: InvestigationObservation[];
  aiDisclaimerNotice: string;
  status: 'open' | 'monitoring' | 'resolved';
  createdAt: string;
  isMock?: boolean;
}

export interface InvestigationObservation {
  id: string;
  investigationId: string;
  observationDate: string;
  actionTaken: string;
  treatmentType: string;
  spreadStatus: string;
  notes?: string;
  imageUrl?: string;
  createdAt?: string;
}

export interface Experiment {
  id: string;
  farmerId: string;
  farmId: string;
  title: string;
  hypothesis: string;
  cropTested: string;
  controlMethod: string;
  experimentalMethod: string;
  plotSizeDescription?: string;
  durationDays?: number;
  startDate?: string;
  endDate?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  aiSynthesisSummary?: string;
  limitationsSummary?: string;
  nextExperimentSuggestions?: string;
  observations?: ExperimentObservation[];
  createdAt: string;
  isMock?: boolean;
}

export interface ExperimentObservation {
  id: string;
  experimentId: string;
  observationDate: string;
  metricName: string;
  controlMetricValue: number;
  experimentalMetricValue: number;
  numericalDifference?: number;
  percentageChange?: number;
  costDelta?: number;
  inputCostControl?: number;
  inputCostExperimental?: number;
  notes?: string;
}

export interface PriceComparisonResult {
  cropName: string;
  askingPrice: number;
  unit: string;
  district: string;
  taluk: string;
  hasReferenceData: boolean;
  referenceModalPrice?: number;
  referenceMinPrice?: number;
  referenceMaxPrice?: number;
  referenceMarketYard?: string;
  referenceSource?: string;
  observationDate?: string;
  difference?: number;
  percentageDifference?: number;
  positionRelativeToMandi: string;
  aiExplanation: string;
  disclaimer: string;
}

export interface VoiceListingDraft {
  cropName: string;
  cropKannada?: string;
  category: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  district: string;
  taluk: string;
  qualityGrade: string;
  confidenceScore: number;
  englishSummary: string;
  rawTranscript: string;
  requiresFarmerReview: boolean;
}

export interface MarketPriceReference {
  id: string;
  cropName: string;
  variety?: string;
  district: string;
  marketYard: string;
  asOfDate: string;
  minPrice: number;
  modalPrice: number;
  maxPrice: number;
  unit: string;
  dataSource: string;
  isDemonstrationData: boolean;
}

export type GroupOfferStatus =
  | 'open'
  | 'proposed'
  | 'matched'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'locked'
  | 'fulfilled'
  | 'cancelled'
  | 'partial_fulfillment_required';

export interface GroupOffer {
  id: string;
  buyerId?: string;
  buyerName?: string;
  cropName: string;
  variety?: string;
  targetQuantity: number;
  currentCommittedQuantity: number;
  unit: string;
  offeredUnitPrice: number;
  totalAmount?: number;
  targetTaluk: string;
  aggregationHubName: string;
  status: GroupOfferStatus;
  matchingExplanation?: string;
  deliveryAddress?: string;
  deliveryTerms?: string;
  orderId?: string;
  expiresAt: string;
  contributions: OfferContribution[];
  createdAt: string;
  isMock?: boolean;
}

export interface OfferContribution {
  id: string;
  groupOfferId: string;
  farmerId: string;
  farmerName: string;
  farmerLocation?: string;
  listingId?: string;
  contributedQuantity: number;
  unitPrice?: number;
  subtotal?: number;
  farmerConfirmed?: boolean;
  farmerConfirmedAt?: string;
  status: 'reserved' | 'committed' | 'confirmed' | 'rejected' | 'released' | 'aggregated' | 'cancelled';
  contributionTimestamp: string;
}

export interface GroupMatchRequest {
  cropName: string;
  targetQuantity: number;
  unit?: string;
  maxUnitPrice?: number;
  district?: string;
  taluk?: string;
  organicOnly?: boolean;
  qualityGrade?: string;
}

export interface ProposedContribution {
  farmerId: string;
  farmerName: string;
  farmerLocation: string;
  listingId: string;
  cropName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  qualityGrade?: string;
  organicCertified?: boolean;
}

export interface GroupMatchResponse {
  matchStatus: 'full' | 'insufficient_supply' | 'no_supply';
  cropName: string;
  targetQuantity: number;
  totalMatchedQuantity: number;
  shortfallQuantity: number;
  unit: string;
  weightedAveragePrice: number;
  totalEstimatedAmount: number;
  isAchievable: boolean;
  matchingExplanation: string;
  contributions: ProposedContribution[];
}

export type OrderStatus =
  | 'created'
  | 'confirmed'
  | 'escrow_funded'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'cancelled';

export interface OrderItem {
  id: string;
  orderId: string;
  listingId?: string;
  contributingFarmerId: string;
  farmerName: string;
  cropName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface OrderAgreementVersion {
  id: string;
  orderId: string;
  version: number;
  agreementHash: string;
  canonicalTermsJson: Record<string, any>;
  onChainTxHash?: string;
  contractAddress?: string;
  networkId: string;
  blockNumber?: number;
  isCurrent: boolean;
  termsSummary?: string;
  createdAt: string;
}

export interface OnChainVerification {
  orderId: string;
  orderCode: string;
  isRegisteredOnChain: boolean;
  agreementVersion: number;
  offChainHash: string;
  onChainHash?: string;
  hashMatch: boolean;
  contractAddress: string;
  networkIdentifier: string;
  buyerConfirmed: boolean;
  farmerConfirmed: boolean;
  blockNumber?: number;
  onChainStatus?: string;
  verificationMessage: string;
  lastCheckedAt: string;
}

export interface EscrowActionResponse {
  orderId: string;
  action: string;
  amount: number;
  escrowContract: string;
  tokenContract: string;
  txHash: string;
  blockNumber?: number;
  status: string;
  isDemonstration: boolean;
  disclaimer: string;
}

export interface Order {
  id: string;
  orderCode: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  isGroupOrder: boolean;
  groupOfferId?: string;
  items: OrderItem[];
  totalAmount: number;
  orderStatus: OrderStatus;
  deliveryTerms: string;
  deliveryAddress: string;
  agreementHash: string;
  blockchainTxHash?: string;
  smartContractOrderId?: number;
  escrowStatus: 'unfunded' | 'deposited' | 'released' | 'refunded';
  contractAddress?: string;
  networkIdentifier?: string;
  blockNumber?: number;
  agreementVersion?: number;
  agreementVersions?: OrderAgreementVersion[];
  farmerConfirmed?: boolean;
  buyerConfirmed?: boolean;
  cancellationReason?: string;
  cancelledBy?: string;
  events?: any[];
  createdAt: string;
  updatedAt: string;
  isMock?: boolean;
}

export interface Review {
  id: string;
  orderId: string;
  reviewerId: string;
  reviewerName?: string;
  revieweeId: string;
  revieweeName?: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface TraceabilityEvent {
  id: string;
  orderId: string;
  listingId?: string;
  stageName: string;
  location: string;
  recordedBy: string;
  qualityGrade?: QualityGrade | string;
  isIndependentlyVerified?: boolean;
  verificationSource?: string;
  eventTimestamp: string;
  eventHash: string;
  onChainTxHash?: string;
  metadata?: Record<string, any>;
  isMock?: boolean;
}

export interface BlockchainTxRef {
  id: string;
  orderId?: string;
  contractName: string;
  contractAddress: string;
  actionType: string;
  txHash: string;
  blockNumber: number;
  networkId: string;
  status: 'confirmed' | 'pending';
  timestamp: string;
  isMock?: boolean;
}

export interface AdminOverview {
  users_count: number;
  farmers_count: number;
  buyers_count: number;
  listings_count: number;
  active_listings_count: number;
  flagged_listings_count: number;
  orders_count: number;
  completed_orders_count: number;
  total_trade_volume: number;
  group_offers_count: number;
  blockchain_status: {
    status: string;
    chain_id: number;
    is_mock: boolean;
    order_registry_address: string;
    traceability_address: string;
    escrow_address: string;
    token_address: string;
    total_on_chain_tx_count: number;
  };
  ai_services_status: {
    farm_forensics: string;
    farm_lab: string;
    price_assistant: string;
    kannada_speech_recognizer: string;
  };
}

export interface AdminAuditLog {
  id: string;
  admin_id?: string;
  admin_name: string;
  action_type: string;
  target_entity: string;
  target_id: string;
  details: string;
  metadata_json?: Record<string, any>;
  created_at: string;
}

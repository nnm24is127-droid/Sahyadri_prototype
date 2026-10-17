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
export type ListingStatus = 'draft' | 'active' | 'partially_allocated' | 'sold_out' | 'archived';

export interface ProduceListing {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
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
  organicCertified: boolean;
  harvestDate: string;
  shelfLifeDays: number;
  status: ListingStatus;
  district: string;
  taluk: string;
  allowGroupPooling: boolean;
  aiSuggestedPrice?: number;
  referenceMandiPrice?: number;
  createdViaVoice: boolean;
  voiceTranscriptKannada?: string;
  createdAt: string;
  isMock?: boolean;
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
  aiPreliminaryDiagnosis: string;
  aiConfidenceScore: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  remedies: string[];
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
  createdAt: string;
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
  startDate: string;
  endDate?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  aiSynthesisSummary?: string;
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
  notes?: string;
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

export type GroupOfferStatus = 'open' | 'matched' | 'locked' | 'fulfilled' | 'cancelled';

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
  targetTaluk: string;
  aggregationHubName: string;
  status: GroupOfferStatus;
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
  listingId?: string;
  contributedQuantity: number;
  status: 'committed' | 'aggregated' | 'cancelled';
  contributionTimestamp: string;
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
  createdAt: string;
  updatedAt: string;
  isMock?: boolean;
}

export interface TraceabilityEvent {
  id: string;
  orderId: string;
  listingId?: string;
  stageName: 'Harvested' | 'Quality Inspected' | 'Hub Aggregated' | 'Dispatched' | 'Delivered';
  location: string;
  recordedBy: string;
  qualityGrade?: QualityGrade;
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

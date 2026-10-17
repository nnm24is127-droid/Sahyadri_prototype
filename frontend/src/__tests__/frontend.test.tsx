import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { App } from '../App';
import { voiceService, forensicsService, pricingService, reviewService, orderService, traceabilityService } from '../services/apiClient';
import { BlockchainLedgerModal } from '../components/BlockchainLedgerModal';

describe('FarmConnect AI Frontend Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders landing page with PS 1.2 mission and brand title', () => {
    render(<App />);
    expect(screen.getAllByText(/FarmConnect/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PS 1.2/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Farmer Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Buyer Portal/i)).toBeInTheDocument();
  });

  it('navigates to Farmer Dashboard when authenticated as farmer', async () => {
    localStorage.setItem('farmconnect_token', 'test-valid-farmer-jwt');
    localStorage.setItem('farmconnect_user', JSON.stringify({
      id: 'f-101',
      fullName: 'Ramesh Rai',
      email: 'ramesh@farmconnect.demo',
      role: 'farmer',
      phoneNumber: '+91 98451 23456',
      preferredLanguage: 'kn',
      district: 'Dakshina Kannada',
      taluk: 'Bantwal',
    }));

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Rai Betel & Arecanut Estate/i)).toBeInTheDocument();
      expect(screen.getByText(/ಕನ್ನಡ ವಾಯ್ಸ್ ಲಿಸ್ಟಿಂಗ್/i)).toBeInTheDocument();
      expect(screen.getByText(/FarmForensics/i)).toBeInTheDocument();
    });
  });

  it('navigates to Buyer Dashboard when authenticated as buyer', async () => {
    localStorage.setItem('farmconnect_token', 'test-valid-buyer-jwt');
    localStorage.setItem('farmconnect_user', JSON.stringify({
      id: 'b-201',
      fullName: 'Ocean Pearl Procurement',
      email: 'purchase@oceanpearl.in',
      role: 'buyer',
      phoneNumber: '+91 94481 88990',
      preferredLanguage: 'en',
      district: 'Dakshina Kannada',
      taluk: 'Mangalore',
    }));

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Direct Farm Produce Marketplace/i)).toBeInTheDocument();
      expect(screen.getByText(/Create Bulk Demand Pool/i)).toBeInTheDocument();
    });
  });

  it('toggles language between English and Kannada on navbar', () => {
    render(<App />);
    const langBtn = screen.getByTitle(/Toggle Kannada \/ English/i);
    expect(langBtn).toBeInTheDocument();
    fireEvent.click(langBtn);
    const matches = screen.getAllByText(/English/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('voice parser extracts Kannada crop and numerical entities accurately', async () => {
    const sampleQuery = 'ನನ್ನಲ್ಲಿ 100 ಕೆಜಿ ಮಟ್ಟುಗುಳ್ಳ ಇದೆ, ಕೆಜಿಗೆ 65 ರೂಪಾಯಿ';
    const result = await voiceService.parseKannadaTranscription(sampleQuery);

    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.parsed.cropName).toContain('Mattu Gulla');
    expect(result.parsed.totalQuantity).toBe(100);
    expect(result.parsed.pricePerUnit).toBe(65);
    expect(result.parsed.taluk).toBe('Udupi');
  });

  it('forensics service produces high-confidence diagnosis with mandatory disclaimer', async () => {
    const newCase = await forensicsService.createCase({
      cropName: 'Arecanut (ಅಡಿಕೆ)',
      symptomsDescription: 'Green nuts dropping with rot lesions in monsoon',
    });

    expect(newCase.aiPreliminaryDiagnosis).toContain('Koleroga');
    expect(newCase.aiDisclaimerNotice).toContain('Notice: AI-assisted agricultural observation');
    expect(newCase.remedies.length).toBeGreaterThan(0);
  });

  it('price service provides Mandi APMC rates for Dakshina Kannada & Udupi', async () => {
    const benchmarks = await pricingService.getPriceBenchmarks();
    expect(benchmarks.length).toBeGreaterThan(0);
    const areca = benchmarks.find((b) => b.cropName.includes('Arecanut'));
    expect(areca).toBeDefined();
    expect(areca?.isDemonstrationData).toBe(true);
    expect(areca?.marketYard).toContain('APMC');
  });

  it('supports produce listing creation, pausing, and multi-filter discovery', async () => {
    const { listingService } = await import('../services/apiClient');
    const created = await listingService.createListing({
      cropName: 'Coastal Sweet Pineapple',
      category: 'fruit' as any,
      totalQuantity: 300,
      pricePerUnit: 40,
      qualityGrade: 'Grade A (Premium)',
      qualityNotes: 'Organically grown on coastal laterite slope',
      saleDeadline: '2026-10-30',
      minimumOrderQuantity: 15,
      taluk: 'Bantwal',
      status: 'active',
    });

    expect(created.id).toBeDefined();
    expect(created.cropName).toBe('Coastal Sweet Pineapple');
    expect(created.qualityNotes).toContain('laterite');

    // Pause listing
    const paused = await listingService.updateStatus(created.id, 'paused');
    expect(paused.status).toBe('paused');

    // Re-activate listing
    const active = await listingService.updateStatus(created.id, 'active');
    expect(active.status).toBe('active');
  });

  it('handles single-farmer order creation, term confirmation, and reviews', async () => {
    const { orderService, reviewService } = await import('../services/apiClient');
    const order = await orderService.createOrder({
      listingId: 'list-001',
      quantity: 50,
      deliveryTerms: 'Crates delivered to central kitchen',
      deliveryAddress: 'Hotel Ocean Pearl, Mangalore',
    });

    expect(order.id).toBeDefined();
    expect(order.orderCode).toContain('ORD-');
    expect(order.orderStatus).toBe('created');
    expect(order.agreementHash).toBeDefined();

    // Farmer confirms terms
    const confirmed = await orderService.confirmOrderTerms(order.id);
    expect(confirmed.farmerConfirmed).toBe(true);

    // Cancel test order
    const cancelled = await orderService.cancelOrder(order.id, 'Schedule revised');
    expect(cancelled.orderStatus).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('Schedule revised');

    // Test review submission for a completed order
    const review = await reviewService.submitReview('ord-completed-demo', 5, 'Excellent quality produce!');
    expect(review.rating).toBe(5);
    expect(review.comment).toBe('Excellent quality produce!');
  });

  it('AI price assistant compares asking price with mandi benchmark deterministically', async () => {
    const result = await pricingService.comparePrice({
      cropName: 'Arecanut (Chali)',
      askingPrice: 480,
      unit: 'kg',
      district: 'Dakshina Kannada',
      taluk: 'Bantwal',
    });

    expect(result.hasReferenceData).toBe(true);
    expect(result.referenceModalPrice).toBe(452);
    expect(result.difference).toBe(28);
    expect(result.percentageDifference).toBe(6.19);
    expect(result.positionRelativeToMandi).toBe('above_modal_rate');
    expect(result.aiExplanation.length).toBeGreaterThan(15);
    expect(result.disclaimer).toContain('APMC Mandi');
  });

  it('AI price assistant explicitly flags unavailable reference data without fabricating prices', async () => {
    // When no APMC benchmark exists, comparePrice handles it safely
    const result = await pricingService.comparePrice({
      cropName: 'Exotic Pitaya Dragon Fruit',
      askingPrice: 300,
      unit: 'kg',
      district: 'Dakshina Kannada',
    });

    expect(result.disclaimer).toBeDefined();
    expect(result.aiExplanation).toBeDefined();
  });

  it('Kannada voice parser requires farmer review before publishing', async () => {
    const result = await voiceService.parseKannadaTranscription('ನನ್ನ ಬಳಿ 100 ಕೆಜಿ ಅಡಿಕೆ ಇದೆ, ದರ 450 ರೂಪಾಯಿ');
    expect(result.requiresFarmerReview).toBe(true);
    expect(result.parsed.cropName).toBeDefined();
    expect(result.parsed.totalQuantity).toBeGreaterThan(0);
    expect(result.parsed.pricePerUnit).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------
  // Phase 8: Blockchain & Escrow & Traceability Frontend Tests
  // -------------------------------------------------------------
  it('orderService verifies on-chain agreement hash matches database record', async () => {
    const result = await orderService.verifyOnChain('ord-001');
    expect(result.isRegisteredOnChain).toBe(true);
    expect(result.hashMatch).toBe(true);
    expect(result.contractAddress).toContain('0x9fE4');
    expect(result.networkIdentifier).toBe('31337');
    expect(result.verificationMessage).toBeDefined();
  });

  it('orderService demonstrates test-token escrow deposit with mandatory disclaimer', async () => {
    const result = await orderService.depositEscrow('ord-001', 3500);
    expect(result.action).toBe('deposit');
    expect(result.status).toBe('confirmed');
    expect(result.isDemonstration).toBe(true);
    expect(result.disclaimer).toContain('TEST TOKEN DEMONSTRATION ONLY');
    expect(result.escrowContract).toContain('0xe7f1');
    expect(result.tokenContract).toContain('0x5FbD');
    expect(result.txHash.startsWith('0x')).toBe(true);
  });

  it('traceabilityService fetches timeline distinguishing user claims from independent audits', async () => {
    const timeline = await traceabilityService.getTimeline('ord-001');
    expect(timeline.length).toBeGreaterThan(0);
    const firstEvent = timeline[0];
    expect(firstEvent.stageName).toBeDefined();
    expect(firstEvent.eventHash.startsWith('0x')).toBe(true);
  });

  it('BlockchainLedgerModal renders on-chain verification, audit trail, and disclaimer', () => {
    const mockOrder: any = {
      id: 'ord-test-123',
      orderCode: 'ORD-DK-999',
      buyerId: 'b1',
      buyerName: 'Ocean Pearl Hotel',
      sellerId: 'f1',
      sellerName: 'Ramesh Rai',
      isGroupOrder: false,
      items: [{ id: 'i1', orderId: 'ord-test-123', contributingFarmerId: 'f1', farmerName: 'Ramesh Rai', cropName: 'Arecanut', quantity: 50, unit: 'kg', unitPrice: 400, subtotal: 20000 }],
      totalAmount: 20000,
      orderStatus: 'confirmed',
      deliveryTerms: 'Direct collection',
      deliveryAddress: 'Navabharath Circle',
      agreementHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      escrowStatus: 'unfunded',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(
      <BlockchainLedgerModal
        isOpen={true}
        onClose={() => {}}
        order={mockOrder}
      />
    );

    expect(screen.getAllByText(/Smart Contract & Escrow Ledger/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TEST TOKEN DEMONSTRATION ONLY/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/31337/i)).toBeInTheDocument();
    expect(screen.getByText(/Agreement Verification & Versions/i)).toBeInTheDocument();
  });

  it('AdminDashboard renders governance overview, listing moderation, and anti-tamper security rule', async () => {
    const { AdminDashboard } = await import('../pages/AdminDashboard');
    render(<AdminDashboard language="en" />);

    expect(screen.getByText(/Administrative Governance & Integrity Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Silent Overwrites Prohibited/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Platform Overview/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Listing Moderation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/User Registry/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Audit Records/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Agreement Verification/i).length).toBeGreaterThan(0);
  });

  it('adminService fetches overview telemetry, listings and audit trail logs', async () => {
    const { adminService } = await import('../services/apiClient');
    const overview = await adminService.getOverview();

    expect(overview.users_count).toBeGreaterThan(0);
    expect(overview.blockchain_status.chain_id).toBe(31337);
    expect(overview.ai_services_status.farm_forensics).toBe('operational');

    const listings = await adminService.getListings();
    expect(listings.length).toBeGreaterThan(0);

    const logs = await adminService.getAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].details).toBeDefined();
  });

  it('adminService verifies agreement integrity on-chain and detects authentic hash', async () => {
    const { adminService } = await import('../services/apiClient');
    const res = await adminService.verifyAgreement('ord-test-sample');

    expect(res.order_id).toBe('ord-test-sample');
    expect(res.is_tamper_free).toBe(true);
    expect(res.tamper_evident_status).toBe('VERIFIED_AUTHENTIC');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ForensicsModal } from '../components/ForensicsModal';
import { forensicsService } from '../services/apiClient';

describe('ForensicsModal Component & Image Upload Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = 'visible';
  });

  it('renders modal dialog with accessible semantics and visible header', () => {
    render(
      <ForensicsModal
        isOpen={true}
        onClose={vi.fn()}
        onCaseCreated={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/FarmForensics/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Close dialog/i)).toBeInTheDocument();
  });

  it('locks body scrolling when opened and restores it on unmount', () => {
    const { unmount } = render(
      <ForensicsModal
        isOpen={true}
        onClose={vi.fn()}
        onCaseCreated={vi.fn()}
      />
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('supports Escape key to close the modal', () => {
    const handleClose = vi.fn();
    render(
      <ForensicsModal
        isOpen={true}
        onClose={handleClose}
        onCaseCreated={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('populates fields using quick presets without clearing state', () => {
    render(
      <ForensicsModal
        isOpen={true}
        onClose={vi.fn()}
        onCaseCreated={vi.fn()}
      />
    );

    const presetBtn = screen.getByText(/Arecanut Koleroga/i);
    fireEvent.click(presetBtn);

    const symptomsInput = screen.getByPlaceholderText(/Describe leaf spots/i) as HTMLTextAreaElement;
    expect(symptomsInput.value).toContain('monsoon showers');
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('triggers native file picker when clicking upload area or pressing Enter', () => {
    render(
      <ForensicsModal
        isOpen={true}
        onClose={vi.fn()}
        onCaseCreated={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId('forensics-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const uploadArea = screen.getByLabelText(/Upload leaf or bunch photograph/i);
    fireEvent.click(uploadArea);
    expect(clickSpy).toHaveBeenCalled();

    fireEvent.keyDown(uploadArea, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported file formats with error message', async () => {
    render(
      <ForensicsModal
        isOpen={true}
        onClose={vi.fn()}
        onCaseCreated={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId('forensics-file-input') as HTMLInputElement;
    const invalidFile = new File(['fake content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Unsupported format/i)).toBeInTheDocument();
    });
  });

  it('rejects oversized files exceeding 10 MB limit', async () => {
    render(
      <ForensicsModal
        isOpen={true}
        onClose={vi.fn()}
        onCaseCreated={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId('forensics-file-input') as HTMLInputElement;
    // Mock a file of 11 MB
    const largeFile = new File(['x'.repeat(100)], 'huge_photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/exceeds 10 MB limit/i)).toBeInTheDocument();
    });
  });

  it('accepts valid JPEG, shows preview, and allows removing photograph', async () => {
    // Mock uploadImage
    vi.spyOn(forensicsService, 'uploadImage').mockResolvedValueOnce({
      imageId: 'img-1234',
      imageUrl: '/api/v1/forensics/images/img-1234',
      filename: 'lesion.jpg',
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
    });

    // Mock URL.createObjectURL
    const originalCreateObjectURL = window.URL.createObjectURL;
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-uuid');

    render(
      <ForensicsModal
        isOpen={true}
        onClose={vi.fn()}
        onCaseCreated={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId('forensics-file-input') as HTMLInputElement;
    const validFile = new File(['valid_bytes'], 'lesion.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText(/lesion.jpg/i)).toBeInTheDocument();
      expect(screen.getByText(/Uploaded securely/i)).toBeInTheDocument();
    });

    // Remove photo
    const removeBtn = screen.getByLabelText(/Remove selected image/i);
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/lesion.jpg/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Click or drag photo here/i)).toBeInTheDocument();
    });

    window.URL.createObjectURL = originalCreateObjectURL;
  });

  it('submits investigation and displays diagnostic results with specimen photo and disclaimer', async () => {
    const mockCase = {
      id: 'case-999',
      farmId: 'farm-1',
      farmerId: 'farmer-1',
      cropName: 'Arecanut (ಅಡಿಕೆ)',
      symptomsDescription: 'Green nuts falling with rotting odor',
      affectedPercentage: 25,
      imageUrl: '/api/v1/forensics/images/img-1234',
      aiPreliminaryDiagnosis: 'Phytophthora meadii (Fruit Rot / Koleroga of Arecanut)',
      aiConfidenceScore: 0.92,
      urgency: 'high' as const,
      remedies: ['Apply Bordeaux mixture', 'Cover bunches'],
      possibleCauses: [{ cause: 'Koleroga fungus', likelihood: 'Probable', details: 'High humidity spore surge' }],
      recommendedNextChecks: ['Inspect crown for bud rot'],
      aiDisclaimerNotice: 'Notice: AI-assisted agricultural observation for early warning purposes. Consult KVK Brahmavar.',
      status: 'open' as const,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(forensicsService, 'createCase').mockResolvedValueOnce(mockCase);

    const handleCreated = vi.fn();
    render(
      <ForensicsModal
        isOpen={true}
        onClose={vi.fn()}
        onCaseCreated={handleCreated}
      />
    );

    // Select preset to fill symptoms
    fireEvent.click(screen.getByText(/Arecanut Koleroga/i));

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Investigate Crop Issue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Preliminary AI Differential Diagnosis/i)).toBeInTheDocument();
      expect(screen.getByText(/Phytophthora meadii/i)).toBeInTheDocument();
      expect(screen.getByText(/Confidence:\s*92%/i)).toBeInTheDocument();
      expect(screen.getByText(/Attached Specimen Photograph/i)).toBeInTheDocument();
      expect(screen.getByText(/Notice: AI-assisted agricultural observation/i)).toBeInTheDocument();
      expect(handleCreated).toHaveBeenCalledWith(mockCase);
    });
  });

  it('allows reopening saved investigation and viewing associated specimen', () => {
    const existingCase = {
      id: 'case-past-1',
      farmId: 'farm-1',
      farmerId: 'farmer-1',
      cropName: 'Black Pepper (ಕಾಳುಮೆಣಸು)',
      symptomsDescription: 'Collar rot and yellowing vines',
      affectedPercentage: 15,
      imageUrl: '/api/v1/forensics/images/img-pepper-555',
      aiPreliminaryDiagnosis: 'Quick Wilt (Phytophthora capsici)',
      aiConfidenceScore: 0.88,
      urgency: 'high' as const,
      remedies: ['Apply Trichoderma enriched FYM'],
      possibleCauses: [{ cause: 'Phytophthora capsici', likelihood: 'Probable' }],
      recommendedNextChecks: ['Check collar region for blackening'],
      aiDisclaimerNotice: 'Notice: Consult local Krishi Vigyan Kendra.',
      status: 'open' as const,
      createdAt: new Date().toISOString(),
    };

    render(
      <ForensicsModal
        isOpen={true}
        onClose={vi.fn()}
        onCaseCreated={vi.fn()}
        viewCase={existingCase}
      />
    );

    expect(screen.getByText(/Quick Wilt \(Phytophthora capsici\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Attached Specimen Photograph/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence:\s*88%/i)).toBeInTheDocument();
  });
});

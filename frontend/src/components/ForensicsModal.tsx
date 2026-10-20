import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Stethoscope,
  X,
  AlertTriangle,
  Sparkles,
  Check,
  Upload,
  Image as ImageIcon,
  Trash2,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { CropInvestigation } from '../types';
import { forensicsService } from '../services/apiClient';

export interface SpecimenImage {
  id: string;
  file: File;
  previewUrl: string;
  imageId: string | null;
  imageUrl: string | null;
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

interface ForensicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (newCase: CropInvestigation) => void;
  viewCase?: CropInvestigation | null;
}

export const ForensicsModal: React.FC<ForensicsModalProps> = ({
  isOpen,
  onClose,
  onCaseCreated,
  viewCase = null,
}) => {
  // Form State
  const [cropName, setCropName] = useState('Arecanut (ಅಡಿಕೆ)');
  const [symptoms, setSymptoms] = useState('');
  const [affectedPct, setAffectedPct] = useState(20);

  // Multiple Image Upload State
  const [specimens, setSpecimens] = useState<SpecimenImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Form Submission & Result State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [symptomError, setSymptomError] = useState<string | null>(null);
  const [result, setResult] = useState<CropInvestigation | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Sync viewCase if provided
  useEffect(() => {
    if (viewCase) {
      setResult(viewCase);
    } else {
      setResult(null);
    }
  }, [viewCase, isOpen]);

  // 2. Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // 3. Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Clean up object URLs on unmount or file change
  useEffect(() => {
    return () => {
      specimens.forEach((s) => {
        if (s.previewUrl && s.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(s.previewUrl);
        }
      });
    };
  }, [specimens]);

  if (!isOpen) return null;

  // Handle Quick Presets (preserves uploaded image & unrelated fields)
  const handleQuickPreset = (preset: 'koleroga' | 'pepper_wilt' | 'mattu_pest') => {
    setSymptomError(null);
    setSubmitError(null);

    if (preset === 'koleroga') {
      setCropName('Arecanut (ಅಡಿಕೆ)');
      setSymptoms(
        'Green nuts showing water-soaked lesions and dropping in large numbers during heavy monsoon showers. Rotting smell near palm canopy.'
      );
      setAffectedPct(25);
    } else if (preset === 'pepper_wilt') {
      setCropName('Black Pepper (ಕಾಳುಮೆಣಸು)');
      setSymptoms(
        'Leaves turning dull pale yellow and drooping suddenly after continuous rain. Dark necrotic lesions at the base collar of the vine.'
      );
      setAffectedPct(15);
    } else {
      setCropName('Udupi Mattu Gulla (ಮಟ್ಟುಗುಳ್ಳ)');
      setSymptoms(
        'Shoot and fruit borer damage; holes visible on young brinjal fruits with larval frass. Wilting of terminal shoots.'
      );
      setAffectedPct(10);
    }
  };

  // Multi-File Processing and Parallel Upload
  const processFiles = async (files: File[]) => {
    setUploadError(null);
    setSubmitError(null);

    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const validMimes = ['image/jpeg', 'image/png'];
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

    const toAdd: SpecimenImage[] = [];

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));
      if (!validMimes.includes(file.type) && !hasValidExt) {
        setUploadError(`Skipped "${file.name}": Only JPEG and PNG images are accepted (.jpg, .jpeg, .png).`);
        continue;
      }

      if (file.size > MAX_SIZE) {
        setUploadError(`Skipped "${file.name}": Exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
        continue;
      }

      if (file.size === 0) {
        setUploadError(`Skipped "${file.name}": File is empty.`);
        continue;
      }

      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const previewUrl = URL.createObjectURL(file);
      toAdd.push({
        id,
        file,
        previewUrl,
        imageId: null,
        imageUrl: null,
        status: 'uploading',
      });
    }

    if (toAdd.length === 0) return;

    setSpecimens((prev) => [...prev, ...toAdd]);

    // Upload each specimen
    for (const spec of toAdd) {
      try {
        const uploadRes = await forensicsService.uploadImage(spec.file);
        setSpecimens((prev) =>
          prev.map((item) =>
            item.id === spec.id
              ? {
                  ...item,
                  imageId: uploadRes.imageId,
                  imageUrl: uploadRes.imageUrl,
                  status: 'success',
                }
              : item
          )
        );
      } catch (err: any) {
        setSpecimens((prev) =>
          prev.map((item) =>
            item.id === spec.id
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: err?.message || 'Upload failed',
                }
              : item
          )
        );
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    await processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      await processFiles(files);
    }
  };

  const handleRemoveSpecimen = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSpecimens((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((s) => s.id !== id);
    });
  };

  const handleClearAllSpecimens = () => {
    specimens.forEach((s) => {
      if (s.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(s.previewUrl);
      }
    });
    setSpecimens([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadAreaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSymptomError(null);

    if (!symptoms.trim()) {
      setSymptomError('Observed symptoms description is required to investigate plant pathology.');
      return;
    }

    const isUploading = specimens.some((s) => s.status === 'uploading');
    if (isUploading) {
      setSubmitError('Please wait for specimen photograph uploads to complete before submitting.');
      return;
    }

    const firstSuccess = specimens.find((s) => s.status === 'success');
    const imageId = firstSuccess?.imageId || undefined;
    const imageUrl = firstSuccess?.imageUrl || undefined;

    setIsSubmitting(true);
    try {
      const newCase = await forensicsService.createCase({
        cropName,
        symptomsDescription: symptoms.trim(),
        affectedPercentage: affectedPct,
        imageUrl,
        imageId,
      });

      setResult(newCase);
      onCaseCreated(newCase);
    } catch (err: any) {
      console.error('Failed to submit crop investigation:', err);
      setSubmitError(err.message || 'Investigation request failed. Please check network connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    handleClearAllSpecimens();
    setSymptoms('');
    setCropName('Arecanut (ಅಡಿಕೆ)');
    setAffectedPct(20);
    setResult(null);
    setSubmitError(null);
    setSymptomError(null);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="forensics-modal-title"
    >
      <div
        className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed & Always Visible */}
        <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-md shadow-red-600/20 shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="forensics-modal-title"
                className="font-bold text-slate-900 text-base sm:text-lg leading-tight"
              >
                FarmForensics — ಬೆಳೆ ರೋಗ ತನಿಖೆ (Crop Investigation)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                AI-assisted diagnostic guidance for coastal Karnataka plant pathology
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Container */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 focus:outline-none">
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Quick Scenario Presets */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  Quick Diagnostic Scenario Presets (ಪೂರ್ವಸಿದ್ಧ ಮಾದರಿಗಳು):
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('koleroga')}
                    className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 font-medium transition-colors shadow-2xs"
                  >
                    1. Arecanut Koleroga (ಕೊಳೆರೋಗ)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('pepper_wilt')}
                    className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 font-medium transition-colors shadow-2xs"
                  >
                    2. Pepper Quick Wilt (ಕಾಳುಮೆಣಸು ಸೊರಗು ರೋಗ)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('mattu_pest')}
                    className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 font-medium transition-colors shadow-2xs"
                  >
                    3. Mattu Gulla Fruit Borer
                  </button>
                </div>
              </div>

              {/* Crop Name */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                  Crop Under Investigation (ಬೆಳೆ) <span className="text-red-500">*</span>
                </label>
                <select
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none bg-white font-medium"
                >
                  <option value="Arecanut (ಅಡಿಕೆ)">Arecanut (ಅಡಿಕೆ - Chali / Bette)</option>
                  <option value="Black Pepper (ಕಾಳುಮೆಣಸು)">Black Pepper (ಕಾಳುಮೆಣಸು)</option>
                  <option value="Udupi Mattu Gulla (ಮಟ್ಟುಗುಳ್ಳ)">Udupi Mattu Gulla (GI Brinjal)</option>
                  <option value="Coconut (ತೆಂಗು)">Coconut (ತೆಂಗಿನ ಮರ)</option>
                  <option value="Shankarpura Mallige (ಮಲ್ಲಿಗೆ)">Shankarpura Mallige (Jasmine)</option>
                  <option value="Cashew (ಗೇರು)">Cashew (ಗೇರು ಬೀಜ)</option>
                </select>
              </div>

              {/* Symptoms Description */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Observed Symptoms & Progression (ರೋಗ ಲಕ್ಷಣಗಳು) <span className="text-red-500">*</span>
                  </label>
                  {symptomError && (
                    <span className="text-[11px] font-medium text-red-600">{symptomError}</span>
                  )}
                </div>
                <textarea
                  value={symptoms}
                  onChange={(e) => {
                    setSymptoms(e.target.value);
                    if (symptomError) setSymptomError(null);
                  }}
                  placeholder="Describe leaf spots, fruit drop, rotting smell, wilting, discolouration, insect frass, or recent rainfall context..."
                  className={`w-full text-sm p-3 rounded-xl border ${
                    symptomError ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  } focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none resize-y min-h-[90px]`}
                  rows={3}
                  required
                />
              </div>

              {/* Affected Percentage Slider */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Estimated Affected Acreage / Palms (% ನಷ್ಟ ಪ್ರಮಾಣ)
                  </label>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800">
                    {affectedPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={affectedPct}
                  onChange={(e) => setAffectedPct(Number(e.target.value))}
                  className="w-full accent-red-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>5% (Isolated)</span>
                  <span>40% (Moderate)</span>
                  <span>80% (Severe)</span>
                </div>
              </div>

              {/* Working Photo Upload Area */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                  Upload Leaf / Bunch Photographs (Optional)
                </label>

                {/* Hidden native file input supporting multiple files */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  className="hidden"
                  data-testid="forensics-file-input"
                />

                {specimens.length === 0 ? (
                  /* Initial Drag-and-Drop Zone */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={handleUploadAreaKeyDown}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    tabIndex={0}
                    role="button"
                    aria-label="Upload leaf or bunch photograph"
                    className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 group ${
                      isDragging
                        ? 'border-red-500 bg-red-100/60 scale-[1.01] shadow-inner ring-2 ring-red-400'
                        : 'border-slate-300 hover:border-red-400 hover:bg-red-50/20 bg-slate-50/60'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 transition-transform ${
                      isDragging ? 'bg-red-200 text-red-700 scale-110' : 'bg-red-100 text-red-600 group-hover:scale-105'
                    }`}>
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800">
                      {isDragging ? 'Drop photo(s) here now!' : 'Click or drag photo(s) here to upload specimen'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      JPEG or PNG format, up to 10 MB each. You can select or drag multiple images.
                    </p>
                  </div>
                ) : (
                  /* Multi-Specimen Gallery & Previews */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-red-600" />
                        <span>Attached Specimens ({specimens.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleClearAllSpecimens}
                        className="text-[11px] text-red-600 hover:text-red-700 font-medium hover:underline"
                      >
                        Remove All
                      </button>
                    </div>

                    {/* Previews Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {specimens.map((spec) => (
                        <div
                          key={spec.id}
                          className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 flex flex-col gap-1.5 group overflow-hidden"
                        >
                          {/* Image preview thumbnail */}
                          <div className="w-full h-24 rounded-lg overflow-hidden bg-white border border-slate-200 relative">
                            <img
                              src={spec.previewUrl}
                              alt={spec.file.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={(e) => handleRemoveSpecimen(spec.id, e)}
                              className="absolute top-1 right-1 p-1 rounded-md bg-black/60 hover:bg-red-600 text-white transition-colors shadow-xs"
                              title="Remove photograph"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Info & Status */}
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-bold text-slate-800 truncate" title={spec.file.name}>
                              {spec.file.name}
                            </p>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">
                                {(spec.file.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                              {spec.status === 'uploading' && (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  Uploading
                                </span>
                              )}
                              {spec.status === 'success' && (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  Ready
                                </span>
                              )}
                              {spec.status === 'error' && (
                                <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Failed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add More Photos Dropzone Button */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        role="button"
                        tabIndex={0}
                        aria-label="Add more photos"
                        className={`border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer min-h-[110px] transition-all ${
                          isDragging
                            ? 'border-red-500 bg-red-100/60 ring-2 ring-red-400'
                            : 'border-slate-300 hover:border-red-400 hover:bg-red-50/20 bg-slate-50/50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-1">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">Add More</span>
                        <span className="text-[9px] text-slate-400">Click or drop</span>
                      </div>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || specimens.some((s) => s.status === 'uploading') || !symptoms.trim()}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ... (Investigating Pathology & Image)</span>
                  </>
                ) : specimens.some((s) => s.status === 'uploading') ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ... (Uploading Specimens...)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>ರೋಗ ತನಿಖೆ ನಡೆಸಿ (Investigate Crop Issue)</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Diagnostic Output Result */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Primary Diagnosis Box */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                    Preliminary AI Differential Diagnosis
                  </span>
                  <span className="text-xs font-extrabold bg-red-200 text-red-900 px-2.5 py-0.5 rounded-full">
                    Confidence: {(result.aiConfidenceScore * 100).toFixed(0)}%
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  {result.aiPreliminaryDiagnosis}
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Urgency Level:</span>
                  <span className="text-xs font-bold uppercase text-red-700 bg-white px-2 py-0.5 rounded border border-red-200">
                    {result.urgency}
                  </span>
                </div>
              </div>

              {/* Attached Specimen Photograph Display */}
              {result.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                      Attached Specimen Photograph (ಲಗತ್ತಿಸಲಾದ ಛಾಯಾಚಿತ್ರ)
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                      Linked to Investigation
                    </span>
                  </div>
                  <div className="p-3 flex justify-center bg-slate-900/5">
                    <img
                      src={forensicsService.getAuthenticatedImageUrl(result.imageUrl)}
                      alt="Crop specimen under investigation"
                      className="max-h-60 rounded-lg object-contain shadow-sm border border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* Possible Causes Breakdown */}
              {result.possibleCauses && result.possibleCauses.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Possible Causes & Likelihood (ಸಂಭಾವ್ಯ ಕಾರಣಗಳು):
                  </h5>
                  <div className="space-y-1.5">
                    {result.possibleCauses.map((item, idx) => (
                      <div
                        key={idx}
                        className="text-xs p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{item.cause}</span>
                          {item.details && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{item.details}</p>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.likelihood === 'Probable'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.likelihood}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Field Checks */}
              {result.recommendedNextChecks && result.recommendedNextChecks.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Recommended Field Checks (ಮುಂದಿನ ಕ್ಷೇತ್ರ ಪರಿಶೀಲನೆ):
                  </h5>
                  <ul className="space-y-1.5">
                    {result.recommendedNextChecks.map((check, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-700 bg-blue-50/60 border border-blue-100 p-2.5 rounded-lg flex items-start gap-2"
                      >
                        <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{check}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actionable Remedies */}
              {result.remedies && result.remedies.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Recommended Immediate Protocol (ತಕ್ಷಣದ ಕ್ರಮಗಳು):
                  </h5>
                  <ul className="space-y-2">
                    {result.remedies.map((remedy, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-start gap-2"
                      >
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{remedy}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* MANDATORY DISCLAIMER */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="font-semibold block mb-0.5">Mandatory Agricultural Advisory Notice:</strong>
                  {result.aiDisclaimerNotice}
                </p>
              </div>

              {/* Bottom Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  New Investigation (ಹೊಸ ತನಿಖೆ)
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-forest-600 hover:bg-forest-700 rounded-xl transition-colors shadow-md shadow-forest-600/20"
                >
                  Done (ಪೂರ್ಣಗೊಳಿಸಿ)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render via React Portal to document.body to ensure it appears on top of headers, navbars, and container layouts
  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(modalContent, document.body);
  }

  return modalContent;
};

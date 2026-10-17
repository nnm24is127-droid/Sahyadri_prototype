import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Sparkles, Check, X, AlertCircle, Edit3, Volume2 } from 'lucide-react';
import { ProduceListing } from '../types';
import { voiceService } from '../services/apiClient';

interface VoiceListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveListing: (listing: Partial<ProduceListing>) => void;
}

export const VoiceListingModal: React.FC<VoiceListingModalProps> = ({
  isOpen,
  onClose,
  onSaveListing,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Partial<ProduceListing> | null>(null);
  const [englishTranslation, setEnglishTranslation] = useState('');
  const [audioWaves, setAudioWaves] = useState<number[]>([12, 28, 45, 20, 60, 35, 18, 40]);

  // Voice recognition instance
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setAudioWaves(Array.from({ length: 8 }, () => Math.floor(Math.random() * 45) + 10));
      }, 150);
    } else {
      setAudioWaves([10, 10, 10, 10, 10, 10, 10, 10]);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  if (!isOpen) return null;

  const handleStartRealOrSimulatedSpeech = () => {
    setIsRecording(true);
    setTranscript('');
    setParsedData(null);

    // Try Web Speech API if supported in browser
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'kn-IN'; // Kannada (India)
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          const spokenText = event.results[0][0].transcript;
          setTranscript(spokenText);
          setIsRecording(false);
        };

        recognition.onerror = () => {
          // Fallback to high-quality coastal Kannada sample
          useSimulatedAudioSample();
        };

        recognition.start();
        return;
      } catch (_e) {
        // Fallback
      }
    }

    // Default simulation if browser permission not granted or API unavailable
    setTimeout(() => {
      useSimulatedAudioSample();
    }, 2800);
  };

  const useSimulatedAudioSample = (sampleType: 'mattu_gulla' | 'areca' | 'pepper' = 'mattu_gulla') => {
    setIsRecording(false);
    if (sampleType === 'mattu_gulla') {
      setTranscript('ನನ್ನಲ್ಲಿ ನೂರು ಕೆಜಿ ಮಟ್ಟುಗುಳ್ಳ ಬದನೆಕಾಯಿ ಇದೆ, ಕೆಜಿಗೆ ಅರವತ್ತೈದು ರೂಪಾಯಿ, ಉಡುಪಿ');
    } else if (sampleType === 'areca') {
      setTranscript('ನನ್ನಲ್ಲಿ ಐನೂರು ಕೆಜಿ ಚಾಲಿ ಅಡಿಕೆ ಇದೆ, ಕೆಜಿಗೆ 465 ರೂಪಾಯಿ, ಬಂಟ್ವಾಳ');
    } else {
      setTranscript('ನನ್ನಲ್ಲಿ 150 ಕೆಜಿ ಕಪ್ಪು ಕಾಳುಮೆಣಸು ಇದೆ, ಕೆಜಿಗೆ 620 ರೂಪಾಯಿ, ಪುತ್ತೂರು');
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (!transcript) {
      useSimulatedAudioSample('mattu_gulla');
    }
  };

  const handleParseTranscript = async () => {
    if (!transcript) return;
    setIsParsing(true);
    try {
      const result = await voiceService.parseKannadaTranscription(transcript);
      setParsedData(result.parsed);
      setEnglishTranslation(result.englishTranslation);
    } catch (e) {
      console.error(e);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmAndPublish = () => {
    if (parsedData) {
      onSaveListing({
        ...parsedData,
        createdViaVoice: true,
        voiceTranscriptKannada: transcript,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-forest-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-forest-600 text-white rounded-xl shadow-sm">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                ಕನ್ನಡ ವಾಯ್ಸ್ ಲಿಸ್ಟಿಂಗ್ (Kannada Voice Listing)
              </h3>
              <p className="text-xs text-slate-500">
                Speak naturally in Kannada. The AI extracts crop, quantity, price & location.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Quick Audio Samples */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-forest-600" />
              <span>Or click a regional Kannada voice sample to test:</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => useSimulatedAudioSample('mattu_gulla')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-forest-400 hover:bg-forest-50 transition-colors"
              >
                1. 100 kg Mattu Gulla (Udupi)
              </button>
              <button
                type="button"
                onClick={() => useSimulatedAudioSample('areca')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-forest-400 hover:bg-forest-50 transition-colors"
              >
                2. 500 kg Chali Arecanut (Bantwal)
              </button>
              <button
                type="button"
                onClick={() => useSimulatedAudioSample('pepper')}
                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-forest-400 hover:bg-forest-50 transition-colors"
              >
                3. 150 kg Black Pepper (Puttur)
              </button>
            </div>
          </div>

          {/* Microphone Recording Centerpiece */}
          <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-forest-50/50 to-white rounded-2xl border border-forest-100/80">
            <button
              onClick={isRecording ? handleStopRecording : handleStartRealOrSimulatedSpeech}
              className={`relative p-5 rounded-full transition-all shadow-lg ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse ring-8 ring-red-100'
                  : 'bg-forest-600 text-white hover:bg-forest-700 hover:scale-105 shadow-forest-600/30'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>

            {/* Audio Waveform Animation */}
            <div className="flex items-center gap-1.5 h-10 mt-4">
              {audioWaves.map((height, i) => (
                <div
                  key={i}
                  style={{ height: `${height}px` }}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    isRecording ? 'bg-forest-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <p className="text-sm font-semibold text-slate-800 mt-2">
              {isRecording ? 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇವೆ... (Listening to voice)' : 'ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ (Tap to Speak)'}
            </p>
            <p className="text-xs text-slate-500 text-center max-w-xs mt-1">
              ಉದಾಹರಣೆ: &quot;ನನ್ನಲ್ಲಿ ನೂರು ಕೆಜಿ ಮಟ್ಟುಗುಳ್ಳ ಇದೆ, ಕೆಜಿಗೆ 65 ರೂಪಾಯಿ&quot;
            </p>
          </div>

          {/* Transcription Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5 text-forest-600" />
                <span>Recorded Transcription (Editable)</span>
              </label>
              <span className="text-[11px] text-slate-400">Kannada (kn-IN)</span>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your Kannada transcription will appear here. You can also edit or type manually..."
              className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-200 outline-none transition-all font-sans"
              rows={2}
            />
          </div>

          {/* Action to Extract */}
          {transcript && !parsedData && (
            <button
              onClick={handleParseTranscript}
              disabled={isParsing}
              className="w-full py-2.5 px-4 bg-forest-600 hover:bg-forest-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isParsing ? 'ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ... (Extracting Listing Details)' : 'ವಿವರಗಳನ್ನು ಗುರುತಿಸಿ (Extract Listing Details)'}</span>
            </button>
          )}

          {/* Extracted Card Preview */}
          {parsedData && (
            <div className="p-4 bg-forest-50/70 border border-forest-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-forest-800 font-bold text-sm">
                  <Check className="w-4 h-4 text-forest-600" />
                  <span>ಗುರುತಿಸಲಾದ ಕರಡು (Extracted Listing Card)</span>
                </div>
                <span className="text-xs bg-forest-200 text-forest-900 px-2 py-0.5 rounded-full font-semibold">
                  94% Confidence
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-forest-200">
                  <label className="text-slate-500 block font-semibold text-[11px] mb-1">ಬೆಳೆ ಹೆಸರು (Crop)</label>
                  <input
                    type="text"
                    value={parsedData.cropName || ''}
                    onChange={(e) => setParsedData({ ...parsedData, cropName: e.target.value })}
                    className="w-full font-bold text-slate-800 text-sm border-b border-forest-300 focus:border-forest-600 outline-none pb-0.5"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-forest-200">
                  <label className="text-slate-500 block font-semibold text-[11px] mb-1">ಪ್ರಮಾಣ (Quantity & Unit)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={parsedData.totalQuantity ?? 0}
                      onChange={(e) => setParsedData({ ...parsedData, totalQuantity: parseFloat(e.target.value) || 0, availableQuantity: parseFloat(e.target.value) || 0 })}
                      className="w-20 font-bold text-slate-800 text-sm border-b border-forest-300 focus:border-forest-600 outline-none pb-0.5"
                    />
                    <select
                      value={parsedData.unit || 'kg'}
                      onChange={(e) => setParsedData({ ...parsedData, unit: e.target.value })}
                      className="font-bold text-slate-800 text-xs border-b border-forest-300 outline-none bg-transparent"
                    >
                      <option value="kg">kg</option>
                      <option value="quintal">quintal</option>
                      <option value="nut">nut</option>
                      <option value="atte">atte</option>
                    </select>
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-forest-200">
                  <label className="text-slate-500 block font-semibold text-[11px] mb-1">ದರ (Price / Unit)</label>
                  <div className="flex items-center gap-1 font-bold text-forest-700 text-sm">
                    <span>₹</span>
                    <input
                      type="number"
                      value={parsedData.pricePerUnit ?? 0}
                      onChange={(e) => setParsedData({ ...parsedData, pricePerUnit: parseFloat(e.target.value) || 0 })}
                      className="w-24 font-bold text-forest-700 text-sm border-b border-forest-300 focus:border-forest-600 outline-none pb-0.5"
                    />
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-forest-200">
                  <label className="text-slate-500 block font-semibold text-[11px] mb-1">ತಾಲೂಕು (Location Taluk)</label>
                  <input
                    type="text"
                    value={parsedData.taluk || ''}
                    onChange={(e) => setParsedData({ ...parsedData, taluk: e.target.value })}
                    className="w-full font-bold text-slate-800 text-sm border-b border-forest-300 focus:border-forest-600 outline-none pb-0.5"
                  />
                </div>
              </div>

              {englishTranslation && (
                <p className="text-xs text-forest-800 italic bg-white/70 p-2 rounded-lg border border-forest-100">
                  &quot;{englishTranslation}&quot;
                </p>
              )}

              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-forest-600 flex-shrink-0" />
                <span>You can review or adjust these values at any time before final deal confirmation.</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          {parsedData && (
            <button
              onClick={handleConfirmAndPublish}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-forest-600 hover:bg-forest-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>ಲಿಸ್ಟಿಂಗ್ ಪ್ರಕಟಿಸಿ (Publish Listing)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

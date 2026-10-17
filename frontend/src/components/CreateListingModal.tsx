import React, { useState } from 'react';
import { PackagePlus, X, Tag, ShieldCheck, TrendingUp, Check } from 'lucide-react';
import { ProduceListing, CropCategory, QualityGrade } from '../types';
import { REGIONAL_METADATA } from '../config/api';
import { listingService } from '../services/apiClient';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListingCreated: (listing: ProduceListing) => void;
}

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  isOpen,
  onClose,
  onListingCreated,
}) => {
  const [cropName, setCropName] = useState('Arecanut (Chali)');
  const [category, setCategory] = useState<CropCategory>('plantation');
  const [totalQuantity, setTotalQuantity] = useState(500);
  const [unit, setUnit] = useState('kg');
  const [pricePerUnit, setPricePerUnit] = useState(465);
  const [qualityGrade, setQualityGrade] = useState<QualityGrade>('Grade A (Premium)');
  const [district, setDistrict] = useState<'Dakshina Kannada' | 'Udupi'>('Dakshina Kannada');
  const [taluk, setTaluk] = useState('Bantwal');
  const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(10);
  const [qualityNotes, setQualityNotes] = useState('Freshly harvested, graded and clean.');
  const [saleDeadline, setSaleDeadline] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [organic, setOrganic] = useState(false);
  const [allowPooling, setAllowPooling] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectPreset = (crop: { name: string; category: string; defaultUnit: string }) => {
    setCropName(crop.name);
    setCategory(crop.category as CropCategory);
    setUnit(crop.defaultUnit);

    if (crop.name === 'Arecanut') {
      setPricePerUnit(465);
      setTotalQuantity(500);
    } else if (crop.name === 'Udupi Mattu Gulla') {
      setPricePerUnit(68);
      setTotalQuantity(200);
      setDistrict('Udupi');
      setTaluk('Udupi');
    } else if (crop.name === 'Black Pepper') {
      setPricePerUnit(620);
      setTotalQuantity(150);
    } else if (crop.name === 'Coconut') {
      setPricePerUnit(24);
      setTotalQuantity(1500);
    } else if (crop.name === 'Shankarpura Mallige') {
      setPricePerUnit(780);
      setTotalQuantity(40);
      setDistrict('Udupi');
      setTaluk('Udupi');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newListing = await listingService.createListing({
        cropName,
        category,
        totalQuantity,
        availableQuantity: totalQuantity,
        unit,
        pricePerUnit,
        qualityGrade,
        district,
        taluk,
        minimumOrderQuantity,
        qualityNotes,
        saleDeadline,
        organicCertified: organic,
        allowGroupPooling: allowPooling,
        harvestDate: new Date().toISOString().split('T')[0],
      });
      onListingCreated(newListing);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-forest-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-forest-600 text-white rounded-xl shadow-sm">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                ಹೊಸ ಬೆಳೆ ಲಿಸ್ಟಿಂಗ್ (Create Produce Listing)
              </h3>
              <p className="text-xs text-slate-500">
                Directly list produce for restaurants, retailers, and Smart Group Selling
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Quick Crop Selector Pills */}
          <div>
            <span className="text-xs font-semibold text-slate-600 mb-2 block">
              Quick Coastal Karnataka Crop Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {REGIONAL_METADATA.POPULAR_CROPS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => handleSelectPreset(c)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    cropName.includes(c.name)
                      ? 'bg-forest-600 text-white border-forest-600 font-semibold shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {c.kannada} ({c.name})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Crop Name (ಬೆಳೆ ಹೆಸರು)
              </label>
              <input
                type="text"
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CropCategory)}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
              >
                <option value="plantation">Plantation (ತೋಟದ ಬೆಳೆ)</option>
                <option value="spice">Spice (ಮಸಾಲೆ ಬೆಳೆ)</option>
                <option value="horticulture">Horticulture (ತೋಟಗಾರಿಕೆ)</option>
                <option value="vegetable">Vegetable (ತರಕಾರಿ)</option>
                <option value="fruit">Fruit (ಹಣ್ಣು)</option>
                <option value="cereal">Cereal / Rice (ಧಾನ್ಯ)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Quantity (ಪ್ರಮಾಣ)
              </label>
              <input
                type="number"
                min="1"
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(Number(e.target.value))}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
              >
                <option value="kg">kg (ಕಿಲೋಗ್ರಾಂ)</option>
                <option value="quintal">quintal (ಕ್ವಿಂಟಾಲ್)</option>
                <option value="nut">nut (ಕಾಯಿ)</option>
                <option value="atte">atte (ಅಟ್ಟೆ)</option>
                <option value="bunch">bunch (ಗೊನೆ)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Price (ದರ ₹)
              </label>
              <input
                type="number"
                min="1"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(Number(e.target.value))}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none font-bold text-forest-700"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                District (ಜಿಲ್ಲೆ)
              </label>
              <select
                value={district}
                onChange={(e) => {
                  const d = e.target.value as 'Dakshina Kannada' | 'Udupi';
                  setDistrict(d);
                  setTaluk(REGIONAL_METADATA.TALUKS_BY_DISTRICT[d][0]);
                }}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
              >
                <option value="Dakshina Kannada">Dakshina Kannada (ದಕ್ಷಿಣ ಕನ್ನಡ)</option>
                <option value="Udupi">Udupi (ಉಡುಪಿ)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Taluk (ತಾಲೂಕು)
              </label>
              <select
                value={taluk}
                onChange={(e) => setTaluk(e.target.value)}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
              >
                {REGIONAL_METADATA.TALUKS_BY_DISTRICT[district].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Min Order Quantity (ಕನಿಷ್ಠ ಪ್ರಮಾಣ)
              </label>
              <input
                type="number"
                min="1"
                value={minimumOrderQuantity}
                onChange={(e) => setMinimumOrderQuantity(Number(e.target.value))}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Harvest/Sale Deadline (ಗಡುವು)
              </label>
              <input
                type="date"
                value={saleDeadline}
                onChange={(e) => setSaleDeadline(e.target.value)}
                className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Quality Notes (ಗುಣಮಟ್ಟದ ವಿವರ)
            </label>
            <input
              type="text"
              value={qualityNotes}
              onChange={(e) => setQualityNotes(e.target.value)}
              placeholder="e.g. Tree-ripened, sorted, no artificial wax or carbide"
              className="w-full text-sm p-2 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
            />
          </div>

          {/* APMC Price Guidance Box */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span>
                <strong>APMC Benchmark Rate:</strong> Modal ~₹{pricePerUnit - 10} / {unit}
              </span>
            </div>
            <span className="font-semibold text-forest-700 bg-white px-2 py-0.5 rounded border border-amber-200">
              Direct premium: +5-8%
            </span>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={allowPooling}
                onChange={(e) => setAllowPooling(e.target.checked)}
                className="rounded text-forest-600 focus:ring-forest-500"
              />
              <span>
                <strong>Smart Group Selling:</strong> Allow pooling with other small farmers to fulfill bulk orders
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={organic}
                onChange={(e) => setOrganic(e.target.checked)}
                className="rounded text-forest-600 focus:ring-forest-500"
              />
              <span>Certified Organic / Zero-Budget Natural Farming (ZBNF)</span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-forest-600 hover:bg-forest-700 text-white font-bold rounded-xl shadow-md shadow-forest-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'ಪ್ರಕಟಿಸಲಾಗುತ್ತಿದೆ...' : 'ಲಿಸ್ಟಿಂಗ್ ಪ್ರಕಟಿಸಿ (Publish Produce Listing)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

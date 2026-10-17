import React, { useState } from 'react';
import { ShoppingBag, X, ShieldCheck, Check, Wallet, ArrowRight, Lock } from 'lucide-react';
import { ProduceListing, Order } from '../types';
import { orderService } from '../services/apiClient';

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: ProduceListing | null;
  onOrderConfirmed: (order: Order) => void;
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  isOpen,
  onClose,
  listing,
  onOrderConfirmed,
}) => {
  const [quantity, setQuantity] = useState(100);
  const [deliveryAddress, setDeliveryAddress] = useState(
    'Ocean Pearl Procurement Stores, Navabharath Circle, Mangalore - 575003'
  );
  const [deliveryTerms, setDeliveryTerms] = useState(
    'Direct truck dispatch from taluk aggregation hub; physical inspection on warehouse unloading.'
  );
  const [isEscrowDepositing, setIsEscrowDepositing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  if (!isOpen || !listing) return null;

  const totalAmount = quantity * listing.pricePerUnit;
  const isQuantityValid = quantity >= listing.minimumOrderQuantity && quantity <= listing.availableQuantity;

  const handleConfirmOrder = async () => {
    if (!isQuantityValid) return;
    setIsEscrowDepositing(true);
    try {
      const newOrder = await orderService.createOrder({
        listingId: listing.id,
        quantity,
        deliveryAddress,
        deliveryTerms,
      });

      // Advance to escrow_funded if simulating blockchain escrow deposit
      try {
        const fundedOrder = await orderService.transitionOrderStatus(
          newOrder.id,
          'escrow_funded',
          'Initial test token escrow deposited'
        );
        setConfirmedOrder(fundedOrder);
        onOrderConfirmed(fundedOrder);
      } catch (_e) {
        setConfirmedOrder(newOrder);
        onOrderConfirmed(newOrder);
      }

      setIsComplete(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEscrowDepositing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-forest-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-forest-600 text-white rounded-xl shadow-sm">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                ಆರ್ಡರ್ ದೃಢೀಕರಣ (Order Confirmation & Escrow)
              </h3>
              <p className="text-xs text-slate-500">
                Cryptographic agreement hash & smart contract payment demonstration
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
        <div className="p-6 space-y-4 overflow-y-auto">
          {!isComplete ? (
            <>
              {/* Summary Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{listing.cropName}</span>
                  <span className="text-xs bg-forest-100 text-forest-800 font-semibold px-2 py-0.5 rounded-full">
                    {listing.qualityGrade}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Seller: <strong className="text-slate-700">{listing.farmerName}</strong> ({listing.taluk}, {listing.district})
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <span>Unit Price:</span>
                  <span className="font-bold text-slate-800">
                    ₹{listing.pricePerUnit} / {listing.unit}
                  </span>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Required Purchase Quantity (Max Available: {listing.availableQuantity} {listing.unit})
                </label>
                <input
                  type="number"
                  min={listing.minimumOrderQuantity}
                  max={listing.availableQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={`w-full text-base font-bold p-2.5 rounded-xl border outline-none text-slate-800 ${
                    !isQuantityValid ? 'border-red-400 bg-red-50/50' : 'border-slate-200 focus:border-forest-500'
                  }`}
                />
                {!isQuantityValid && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    Quantity must be between {listing.minimumOrderQuantity} and {listing.availableQuantity} {listing.unit}.
                  </p>
                )}
              </div>

              {/* Total Calculation */}
              <div className="p-4 bg-forest-50/80 border border-forest-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-forest-800 block font-medium">Total Payable Amount</span>
                  <span className="text-xs text-forest-600">Calculated direct price (no middlemen commission)</span>
                </div>
                <span className="text-2xl font-black text-forest-800">₹{totalAmount.toLocaleString()}</span>
              </div>

              {/* Delivery Terms */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Delivery Address & Transit Route
                </label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
                  rows={2}
                />
              </div>

              {/* Smart Contract Escrow Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>Test Token Escrow Demonstration</span>
                </div>
                <p>
                  Upon confirmation, <strong>{totalAmount.toLocaleString()} FARM TestTokens</strong> are locked inside the EVM `FarmEscrow.sol` contract. Funds will only be released to the farmer once you physically confirm delivery.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isEscrowDepositing || !isQuantityValid}
                  onClick={handleConfirmOrder}
                  className="w-full py-3 bg-forest-600 hover:bg-forest-700 text-white font-bold rounded-xl shadow-md shadow-forest-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Wallet className="w-4 h-4" />
                  <span>{isEscrowDepositing ? 'Deposit in Escrow & Signing...' : 'Confirm Order & Lock Escrow (TestToken)'}</span>
                </button>
              </div>
            </>
          ) : (
            /* Success Screen */
            <div className="text-center py-4 space-y-4 animate-in fade-in duration-200">
              <div className="w-16 h-16 bg-forest-100 text-forest-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">Order Agreement Successfully Created!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Order Code: <strong className="text-forest-700">{confirmedOrder?.orderCode}</strong>
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Cryptographic Agreement Hash (SHA-256):</span>
                  <code className="text-[11px] font-mono text-slate-800 break-all bg-white p-1 rounded border border-slate-200 block">
                    {confirmedOrder?.agreementHash}
                  </code>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Blockchain Escrow Transaction Hash:</span>
                  <code className="text-[11px] font-mono text-amber-700 break-all bg-white p-1 rounded border border-slate-200 block">
                    {confirmedOrder?.blockchainTxHash}
                  </code>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-forest-600 hover:bg-forest-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

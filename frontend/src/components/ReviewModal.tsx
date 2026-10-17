import React, { useState } from 'react';
import { Star, X, Check, MessageSquare, AlertCircle } from 'lucide-react';
import { Order, Review } from '../types';
import { reviewService } from '../services/apiClient';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onReviewSubmitted: (review: Review) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  order,
  onReviewSubmitted,
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const isCompleted = order.orderStatus === 'completed';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCompleted) {
      setError('Reviews can only be submitted for completed transactions.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const review = await reviewService.submitReview(order.id, rating, comment);
      onReviewSubmitted(review);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review. Ensure the order is completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
              <Star className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Transaction Review & Rating
              </h3>
              <p className="text-xs text-slate-500">
                Order: <span className="font-mono">{order.orderCode}</span>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isCompleted && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Review Restricted:</strong> Reviews are legally and contractually restricted to eligible completed transactions. Current status: <strong>{order.orderStatus}</strong>.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Star Rating (1 - 5)
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 text-slate-300 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= rating
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
              <span className="text-sm font-bold text-slate-700 ml-2">
                {rating} out of 5 stars
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Feedback & Comments (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share details on produce freshness, packaging, weight accuracy, and timely delivery..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-forest-500 outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isCompleted}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              {isSubmitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Verified Review</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

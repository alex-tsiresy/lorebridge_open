'use client';

import { useState } from 'react';
import { useSubscription } from '@/lib/useSubscription';
import { Crown, X, CreditCard, Clock } from 'lucide-react';
import { logger } from '@/lib/logger';

interface TrialBannerProps {
  className?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const TrialBanner = ({ 
  className = '',
  dismissible = true,
  onDismiss 
}: TrialBannerProps) => {
  const {
    subscriptionStatus,
    loading,
    isOnTrial,
    getTrialDaysRemaining,
    createCheckoutSession,
  } = useSubscription();

  const [isDismissed, setIsDismissed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Don't show banner if not on trial, loading, or dismissed
  if (!isOnTrial || loading || isDismissed) {
    return null;
  }

  const daysRemaining = getTrialDaysRemaining();
  const trialEndDate = subscriptionStatus?.trial_end_date 
    ? new Date(subscriptionStatus.trial_end_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    : '';

  const handleUpgrade = async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      const { url } = await createCheckoutSession(false); // No trial for upgrade
      
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      logger.error('Upgrade error:', err);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Different styling based on days remaining
  const getBannerStyle = () => {
    if (daysRemaining <= 1) {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        accent: 'text-red-600'
      };
    } else if (daysRemaining <= 3) {
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800',
        accent: 'text-orange-600'
      };
    } else {
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        accent: 'text-yellow-600'
      };
    }
  };

  const bannerStyle = getBannerStyle();

  return (
    <div className={`relative p-4 rounded-lg border ${bannerStyle.bg} ${bannerStyle.border} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className={`h-5 w-5 ${bannerStyle.accent}`} />
          <div>
            <h3 className={`font-medium ${bannerStyle.text}`}>
              {daysRemaining === 0 
                ? 'Your trial ends today!' 
                : daysRemaining === 1 
                  ? 'Your trial ends tomorrow!' 
                  : `${daysRemaining} days left in your Pro trial`
              }
            </h3>
            <p className={`text-sm ${bannerStyle.text} mt-1`}>
              <Clock className="inline h-3 w-3 mr-1" />
              Trial ends {trialEndDate}. Upgrade now to keep your Pro features.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Upgrade button */}
          <button
            onClick={handleUpgrade}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Upgrade Now
              </>
            )}
          </button>
          
          {/* Dismiss button */}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className={`p-1 rounded-md hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${bannerStyle.text}`}
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 
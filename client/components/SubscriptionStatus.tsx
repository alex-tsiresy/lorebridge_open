'use client';

import { useState } from 'react';
import { useSubscription } from '@/lib/useSubscription';
import { Crown, CreditCard, Calendar, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface SubscriptionStatusProps {
  className?: string;
  showBillingButton?: boolean;
}

export const SubscriptionStatus = ({ 
  className = '',
  showBillingButton = true 
}: SubscriptionStatusProps) => {
  const {
    subscriptionStatus,
    loading,
    error,
    isOnTrial,
    isProUser,
    isFreeUser,
    getTrialDaysRemaining,
    createPortalSession,
  } = useSubscription();

  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const handleManageBilling = async () => {
    if (isLoadingPortal) return;

    try {
      setIsLoadingPortal(true);
      const { url } = await createPortalSession();
      
      if (url) {
        window.open(url, '_blank');
      } else {
        throw new Error('No portal URL received');
      }
    } catch (err) {
      logger.error('Portal error:', err);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-lg bg-gray-50 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-gray-600">Loading subscription status...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-600">Error loading subscription</span>
      </div>
    );
  }

  // Format period end date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get status display info
  const getStatusInfo = () => {
    if (isOnTrial) {
      const daysRemaining = getTrialDaysRemaining();
      return {
        icon: Crown,
        text: `Pro Trial (${daysRemaining} days left)`,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200'
      };
    }
    
    if (subscriptionStatus?.subscription_status === 'active') {
      return {
        icon: Crown,
        text: 'Pro Plan',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      };
    }
    
    if (subscriptionStatus?.subscription_status === 'past_due') {
      return {
        icon: AlertTriangle,
        text: 'Payment Issue',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
      };
    }
    
    return {
      icon: CreditCard,
      text: 'Free Plan',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={`p-4 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
          <div>
            <h3 className={`font-medium ${statusInfo.color}`}>
              {statusInfo.text}
            </h3>
            
            {/* Show additional info based on status */}
            {isOnTrial && subscriptionStatus?.trial_end_date && (
              <p className="text-sm text-gray-600 mt-1">
                Trial ends {formatDate(subscriptionStatus.trial_end_date)}
              </p>
            )}
            
            {subscriptionStatus?.subscription_status === 'active' && 
             subscriptionStatus?.subscription_current_period_end && (
              <p className="text-sm text-gray-600 mt-1">
                <Calendar className="inline h-3 w-3 mr-1" />
                Next billing: {formatDate(subscriptionStatus.subscription_current_period_end)}
              </p>
            )}
            
            {subscriptionStatus?.subscription_status === 'past_due' && (
              <p className="text-sm text-red-600 mt-1">
                Please update your payment method
              </p>
            )}
            
            {subscriptionStatus?.subscription_cancel_at_period_end && (
              <p className="text-sm text-orange-600 mt-1">
                Subscription will cancel at period end
              </p>
            )}
          </div>
        </div>
        
        {/* Billing management button */}
        {showBillingButton && isProUser && (
          <button
            onClick={handleManageBilling}
            disabled={isLoadingPortal}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingPortal ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                Manage Billing
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}; 
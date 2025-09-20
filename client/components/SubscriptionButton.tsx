'use client';

import { useState } from 'react';
import { useSubscription } from '@/lib/useSubscription';
import { getStripe } from '@/lib/stripe';
import { Loader2, Crown, CreditCard } from 'lucide-react';
import { logger } from '@/lib/logger';

interface SubscriptionButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
}

export const SubscriptionButton = ({ 
  className = '', 
  variant = 'default',
  size = 'default' 
}: SubscriptionButtonProps) => {
  const {
    subscriptionStatus,
    loading,
    error,
    canStartTrial,
    isProUser,
    createCheckoutSession,
  } = useSubscription();

  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      // Create checkout session
      const { url } = await createCheckoutSession(canStartTrial);

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      logger.error('Subscription error:', err);
      alert('Failed to start subscription process. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Don't show button if user is already pro
  if (isProUser) {
    return null;
  }

  // Get button classes based on variant and size
  const getButtonClasses = () => {
    let baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    // Size classes
    const sizeClasses = {
      sm: 'h-9 px-3 text-sm',
      default: 'h-10 py-2 px-4',
      lg: 'h-11 px-8 text-lg'
    };

    // Variant classes
    const variantClasses = {
      default: 'custom-button text-white hover:opacity-90 custom-ring-accent',
      outline: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300'
    };

    return `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;
  };

  // Show loading state
  if (loading) {
    return (
      <button 
        disabled 
        className={getButtonClasses()}
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </button>
    );
  }

  // Show error state
  if (error) {
    return (
      <button 
        disabled 
        className={getButtonClasses()}
      >
        <CreditCard className="mr-2 h-4 w-4" />
        Error loading subscription
      </button>
    );
  }

  // Determine button text and icon
  const buttonText = canStartTrial ? 'Start 7-Day Free Trial' : 'Upgrade to Pro';
  const ButtonIcon = canStartTrial ? Crown : CreditCard;

  return (
    <button
      onClick={handleSubscribe}
      disabled={isProcessing}
      className={getButtonClasses()}
    >
      {isProcessing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <ButtonIcon className="mr-2 h-4 w-4" />
          {buttonText}
        </>
      )}
    </button>
  );
}; 
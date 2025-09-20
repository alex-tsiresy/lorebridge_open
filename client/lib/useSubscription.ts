import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getApiBase } from './apiBase';

export interface SubscriptionStatus {
  subscription_status: string;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
  trial_end_date: string | null;
  has_used_trial: boolean;
}

export interface TrialEligibility {
  eligible: boolean;
  reason?: string;
}

export const useSubscription = () => {
  const { getToken } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [trialEligibility, setTrialEligibility] = useState<TrialEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getApiBase({ allowLocalhost: true });

  // Fetch subscription status
  const fetchSubscriptionStatus = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${apiUrl || ''}/api/v1/subscriptions/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription status: ${response.statusText}`);
      }

      const data = await response.json();
      setSubscriptionStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch trial eligibility
  const fetchTrialEligibility = async () => {
    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${apiUrl || ''}/api/v1/subscriptions/trial-eligibility`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch trial eligibility: ${response.statusText}`);
      }

      const data = await response.json();
      setTrialEligibility(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Create checkout session
  const createCheckoutSession = async (withTrial: boolean = true) => {
    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${apiUrl || ''}/api/v1/subscriptions/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success_url: `${window.location.origin}/subscription/success`,
          cancel_url: `${window.location.origin}/subscription/cancel`,
          with_trial: withTrial,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create checkout session: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  // Create customer portal session
  const createPortalSession = async () => {
    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${apiUrl || ''}/api/v1/subscriptions/portal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: window.location.origin,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create portal session: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchSubscriptionStatus();
    fetchTrialEligibility();
  }, []);

  // Helper functions
  const isOnTrial = subscriptionStatus?.subscription_status === 'trialing';
  const isProUser = subscriptionStatus?.subscription_status === 'active' || isOnTrial;
  const isFreeUser = subscriptionStatus?.subscription_status === 'free';
  const canStartTrial = trialEligibility?.eligible || false;

  // Calculate days remaining in trial
  const getTrialDaysRemaining = (): number => {
    if (!subscriptionStatus?.trial_end_date) return 0;
    
    const trialEndDate = new Date(subscriptionStatus.trial_end_date);
    const now = new Date();
    const diffTime = trialEndDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  return {
    subscriptionStatus,
    trialEligibility,
    loading,
    error,
    isOnTrial,
    isProUser,
    isFreeUser,
    canStartTrial,
    getTrialDaysRemaining,
    fetchSubscriptionStatus,
    fetchTrialEligibility,
    createCheckoutSession,
    createPortalSession,
  };
}; 
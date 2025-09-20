'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Crown, Home, Loader2 } from 'lucide-react';
import { useSubscription } from '@/lib/useSubscription';
import { logger } from '@/lib/logger';

export default function SubscriptionSuccess() {
  const router = useRouter();
  const { fetchSubscriptionStatus, subscriptionStatus, isOnTrial, isProUser } = useSubscription();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Refresh subscription status when user returns from Stripe
    const refreshStatus = async () => {
      try {
        await fetchSubscriptionStatus();
      } catch (error) {
        logger.error('Failed to refresh subscription status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Add a small delay to ensure webhook has processed
    const timer = setTimeout(refreshStatus, 2000);
    return () => clearTimeout(timer);
  }, [fetchSubscriptionStatus]);

  const handleGoHome = () => {
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing your subscription...</h2>
          <p className="text-gray-600">Please wait while we set up your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isOnTrial ? 'Trial Started!' : 'Welcome to Pro!'}
          </h1>
          
          {isOnTrial ? (
            <div>
              <p className="text-gray-600 mb-4">
                Your 7-day free trial has started successfully! You now have access to all Pro features.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <Crown className="h-5 w-5 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm text-yellow-800">
                  <strong>Pro Trial Active</strong><br />
                  Enjoy unlimited access to all features for 7 days.
                </p>
              </div>
            </div>
          ) : isProUser ? (
            <div>
              <p className="text-gray-600 mb-4">
                Thank you for upgrading to Pro! You now have unlimited access to all features.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <Crown className="h-5 w-5 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-green-800">
                  <strong>Pro Plan Active</strong><br />
                  All premium features are now unlocked.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">
                Your subscription is being processed. You should receive access shortly.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleGoHome}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Home className="h-4 w-4" />
          Go to Dashboard
        </button>

        <p className="text-xs text-gray-500 mt-4">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  );
} 
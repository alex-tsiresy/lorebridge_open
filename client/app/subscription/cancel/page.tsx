'use client';

import { useRouter } from 'next/navigation';
import { XCircle, Home, CreditCard } from 'lucide-react';
import { SubscriptionButton } from '@/components/SubscriptionButton';

export default function SubscriptionCancel() {
  const router = useRouter();

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <XCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Subscription Cancelled
          </h1>
          <p className="text-gray-600 mb-6">
            No worries! You can upgrade to Pro anytime to unlock all premium features.
          </p>
        </div>

        <div className="space-y-4">
          {/* Try again button */}
          <SubscriptionButton className="w-full" />
          
          {/* Go back to dashboard */}
          <button
            onClick={handleGoHome}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            <Home className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Why upgrade to Pro?</h3>
          <ul className="text-sm text-blue-800 space-y-1 text-left">
            <li>• Unlimited AI-powered lore generation</li>
            <li>• Advanced worldbuilding tools</li>
            <li>• Priority support</li>
            <li>• Export your creations</li>
          </ul>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Questions? Contact our support team for help.
        </p>
      </div>
    </div>
  );
} 
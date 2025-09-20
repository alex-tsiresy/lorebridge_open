import { loadStripe } from '@stripe/stripe-js';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
let stripePromise: Promise<any> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      throw new Error(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set in environment variables'
      );
    }
    
    stripePromise = loadStripe(publishableKey);
  }
  
  return stripePromise;
}; 
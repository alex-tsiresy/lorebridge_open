import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export function useOnboardingStatus() {
  const { user, isLoaded } = useUser();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) {
      setOnboardingComplete(null);
      return;
    }

    const completed = user.unsafeMetadata?.onboardingComplete === true;
    setOnboardingComplete(completed);
  }, [user, isLoaded]);

  return {
    onboardingComplete,
    isLoading: !isLoaded || onboardingComplete === null,
  };
}
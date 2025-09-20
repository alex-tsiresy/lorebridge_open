"use client";

import { useRouter } from "next/navigation";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useEffect } from "react";

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  const router = useRouter();
  const { onboardingComplete, isLoading } = useOnboardingStatus();

  useEffect(() => {
    if (!isLoading && onboardingComplete === false) {
      router.replace("/onboarding");
    }
  }, [onboardingComplete, isLoading, router]);

  // Show loading while checking onboarding status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if onboarding is not complete (will redirect)
  if (onboardingComplete === false) {
    return null;
  }

  return <>{children}</>;
}
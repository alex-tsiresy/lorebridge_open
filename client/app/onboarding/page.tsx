"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";

export default function OnboardingPage() {
  const headerGradientStyle = {
    backgroundColor: '#dbeafe',
    borderRadius: '0px',
    boxShadow: '8px 8px 25px rgba(0, 0, 0, 0.5), 4px 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    backgroundImage: `
      linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%),
      linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.02) 75%)
    `,
    backgroundSize: '16px 16px, 12px 12px',
    backgroundBlendMode: 'overlay',
  } as const;

  const { user } = useUser();
  const router = useRouter();
  const { onboardingComplete, isLoading } = useOnboardingStatus();

  const [useCase, setUseCase] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if onboarding is already complete
  useEffect(() => {
    if (!isLoading && onboardingComplete) {
      router.replace("/");
    }
  }, [onboardingComplete, isLoading, router]);

  const useCaseOptions = [
    "Research and note-taking",
    "Academic work",
    "Content creation",
    "Business documentation",
    "Personal knowledge management",
    "Other"
  ];

  const referralOptions = [
    "Google search",
    "Social media (Twitter, LinkedIn, etc.)",
    "Friend or colleague",
    "Blog post or article",
    "YouTube or podcast",
    "ProductHunt",
    "Other"
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    
    setSubmitting(true);
    try {
      // Save onboarding data to Clerk user metadata using the correct API
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          onboardingComplete: true,
          useCase,
          referralSource,
          onboardingCompletedAt: new Date().toISOString(),
        }
      });

      // Redirect to main app
      router.replace("/");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      // Still redirect on error - don't block user
      router.replace("/");
    } finally {
      setSubmitting(false);
    }
  }

  // Show loading while checking onboarding status
  if (isLoading) {
    return (
      <div className="min-h-screen h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if onboarding is complete (will redirect)
  if (onboardingComplete) {
    return null;
  }

  return (
    <div 
      className="min-h-screen h-screen bg-blue-50 relative overflow-hidden flex items-center justify-center px-2 sm:px-4 md:px-6" 
      style={{ 
        paddingTop: 'clamp(0.5rem, 2vh, 6rem)',
        paddingBottom: 'clamp(0.5rem, 2vh, 6rem)'
      }}
    >
      <style jsx>{`
        @media (max-height: 500px) {
          .hidden-on-short-height {
            display: none !important;
          }
        }
      `}</style>
      
      {/* Global grid background */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(196, 68, 222,0.18) 2.4px, transparent 2.5px),
            linear-gradient(to right, rgba(30,64,175,0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(30,64,175,0.08) 1px, transparent 1px),
            radial-gradient(ellipse at 20% 10%, rgba(99,102,241,0.08), transparent 50%),
            radial-gradient(ellipse at 80% 60%, rgba(59,130,246,0.06), transparent 50%)
          `,
          backgroundSize: '100px 100px, 100px 100px, 100px 100px, auto, auto',
          backgroundPosition: '0 0, 0 0, 0 0, 0 0, 0 0',
          backgroundRepeat: 'repeat',
          backgroundBlendMode: 'normal, normal, normal, soft-light, soft-light',
        }}
      />
      
      <div 
        className="relative flex z-10 w-full max-w-xs sm:max-w-sm md:max-w-lg max-h-[80vh] p-1.5 sm:p-2 md:p-3 rounded-xl" 
        style={{
          ...headerGradientStyle,
          minHeight: 'clamp(400px, 60vh, 600px)'
        }}
      >
        <div 
          className="flex-1 flex flex-col" 
          style={{ 
            padding: 'clamp(0.5rem, 2vh, 2rem) clamp(0.75rem, 3vw, 2rem)' 
          }}
        >
          {/* Fixed Header */}
          <div className="flex flex-col items-center mb-4 sm:mb-6 flex-shrink-0">
            <div className="flex items-center space-x-2 justify-center mb-2">
              <Image 
                src="/logo_small.png" 
                alt="LoreBridge Logo" 
                height={32} 
                width={32}
                className="w-6 h-6 sm:w-8 sm:h-8 select-none"
                draggable={false}
              />
              <span className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 select-none">lorebridge</span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-800 text-center">
              Welcome to LoreBridge!
            </h1>
          </div>

          {/* Scrollable Form */}
          <div className="flex-1 overflow-y-auto pr-6">
            <form onSubmit={handleSubmit} className="flex flex-col space-y-3 sm:space-y-4">
            
            {/* Question 1: Use Case */}
            <div className="space-y-3">
              <label className="block text-sm sm:text-base font-medium text-slate-700">
                What are you using LoreBridge for?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {useCaseOptions.map((option) => (
                  <label key={option} className="flex items-center space-x-4 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="relative">
                      <input
                        type="radio"
                        name="useCase"
                        value={option}
                        checked={useCase === option}
                        onChange={(e) => setUseCase(e.target.value)}
                        className="sr-only"
                        required
                      />
                      <div className={`w-6 h-6 border-2 rounded-sm flex items-center justify-center transition-colors ${
                        useCase === option 
                          ? 'border-blue-600 bg-blue-600' 
                          : 'border-gray-300 bg-white'
                      }`}>
                        {useCase === option && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-sm sm:text-base text-gray-700 flex-1">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Question 2: Referral Source */}
            <div className="space-y-3">
              <label className="block text-sm sm:text-base font-medium text-slate-700">
                Where did you hear about us?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {referralOptions.map((option) => (
                  <label key={option} className="flex items-center space-x-4 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="relative">
                      <input
                        type="radio"
                        name="referralSource"
                        value={option}
                        checked={referralSource === option}
                        onChange={(e) => setReferralSource(e.target.value)}
                        className="sr-only"
                        required
                      />
                      <div className={`w-6 h-6 border-2 rounded-sm flex items-center justify-center transition-colors ${
                        referralSource === option 
                          ? 'border-blue-600 bg-blue-600' 
                          : 'border-gray-300 bg-white'
                      }`}>
                        {referralSource === option && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-sm sm:text-base text-gray-700 flex-1">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 mt-auto">
              <button
                type="submit"
                disabled={submitting || !useCase || !referralSource}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-none transition text-sm sm:text-base"
                style={{ 
                  padding: `clamp(0.75rem, 1.5vh, 1rem) !important`,
                  minHeight: '48px'
                }}
              >
                {submitting ? "Getting started..." : "Complete setup"}
              </button>
              
              {/* Skip option */}
              <button
                type="button"
                onClick={() => router.replace("/")}
                className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 transition"
                disabled={submitting}
              >
                Skip for now
              </button>
            </div>
          </form>
          </div>
        </div>

        {/* Side connectors (matching auth pages) */}
        <div className="absolute inset-0 pointer-events-none z-40 hidden md:block" aria-hidden>
          <div
            className="absolute animated-dotted-connector"
            style={{
              top: '50%',
              right: 'calc(100% + 64px)',
              transform: 'translateY(-50%)',
              width: 'clamp(200px, 35vw, 1000px)',
              height: '6px',
              animationDirection: 'reverse',
            }}
          />
          <div
            className="absolute animated-dotted-connector"
            style={{
              top: '50%',
              left: 'calc(100% + 64px)',
              transform: 'translateY(-50%)',
              width: 'clamp(200px, 35vw, 1000px)',
              height: '6px',
              animationDirection: 'reverse',
            }}
          />
        </div>
        <div
          className="hidden md:block"
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            transform: 'translate(-260%, -50%)',
            width: '16px',
            height: '16px',
            border: '2px solid #1e40af',
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            borderRadius: '0px',
            zIndex: 50,
          }}
        />
        <div
          className="hidden md:block"
          style={{
            position: 'absolute',
            top: '50%',
            right: 0,
            transform: 'translate(260%, -50%)',
            width: '16px',
            height: '16px',
            border: '2px solid #1e40af',
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            borderRadius: '0px',
            zIndex: 50,
          }}
        />
      </div>
    </div>
  );
}
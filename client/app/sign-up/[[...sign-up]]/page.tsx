"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useClerk, useSignUp } from "@clerk/nextjs";
import { SiApple, SiGithub } from "react-icons/si";
import { FcGoogle } from "react-icons/fc";

export default function SignUpPage() {
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

  const { signUp, isLoaded: signUpLoaded, setActive } = useSignUp();
  const _clerk = useClerk();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"start" | "verify" | "complete">("start");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Fancy multi-cell code input component
  const CodeInput = ({
    length = 6,
    value,
    onChange,
    disabled,
  }: {
    length?: number;
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
  }) => {
    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
      // Autofocus first empty cell when component mounts
      const firstEmptyIndex = Math.min(
        Math.max(value.replace(/\D/g, "").length, 0),
        length - 1
      );
      const el = inputsRef.current[firstEmptyIndex];
      if (el && document.activeElement !== el && !disabled) {
        el.focus();
        el.select?.();
      }
    }, [length, value, disabled]);

    const setCharAt = (str: string, index: number, chr: string) => {
      const padded = (str || "").padEnd(length, " ");
      return (
        padded.substring(0, index) + chr + padded.substring(index + 1)
      )
        .slice(0, length)
        .replace(/\s/g, "");
    };

    const handleChange = (idx: number, chr: string) => {
      const digit = (chr || "").replace(/\D/g, "").slice(0, 1);
      const next = digit ? setCharAt(value, idx, digit) : value;
      onChange(next);
      if (digit && idx < length - 1) {
        const el = inputsRef.current[idx + 1];
        el?.focus();
        el?.select?.();
      }
    };

    const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const hasValueHere = /\d/.test(value[idx] || "");
        const cleared = hasValueHere ? setCharAt(value, idx, "") : value;
        onChange(cleared);
        const prevIdx = hasValueHere ? idx : Math.max(0, idx - 1);
        const el = inputsRef.current[prevIdx];
        el?.focus();
        el?.select?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const el = inputsRef.current[Math.max(0, idx - 1)];
        el?.focus();
        el?.select?.();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const el = inputsRef.current[Math.min(length - 1, idx + 1)];
        el?.focus();
        el?.select?.();
      }
    };

    const handlePaste = (idx: number, e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "");
      if (!pasted) return;
      const existing = value.padEnd(length, "");
      const chars = existing.split("");
      let writeIndex = idx;
      for (const ch of pasted.slice(0, length - idx)) {
        chars[writeIndex] = ch;
        writeIndex += 1;
      }
      const next = chars.join("").slice(0, length).replace(/\s/g, "");
      onChange(next);
      const focusIdx = Math.min(writeIndex, length - 1);
      const el = inputsRef.current[focusIdx];
      el?.focus();
      el?.select?.();
    };

    const digits = (value || "").replace(/\D/g, "").slice(0, length);
    const cells = Array.from({ length }).map((_, i) => digits[i] || "");
    const activeIndex = Math.min(digits.length, length - 1);

    return (
      <div className="w-full">
        <div className="rounded-md  p-2 bg-blue-100/30">
          <div className="grid grid-cols-6 gap-2">
            {cells.map((val, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={1}
                value={val}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={(e) => handlePaste(i, e)}
                onFocus={(e) => e.currentTarget.select()}
                disabled={disabled}
                aria-label={`Digit ${i + 1}`}
                className={
                  "aspect-square w-full text-center text-lg font-semibold rounded-none appearance-none outline-none border border-transparent focus:outline-none focus:ring-0 transition " +
                  (i === activeIndex
                    ? "bg-white text-black shadow-sm ring-2 ring-white"
                    : val
                    ? "bg-white text-black shadow-sm"
                    : "bg-blue-200/50 text-white/70")
                }
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (!signUpLoaded) return;
    setSubmitting(true);
    try {
      await signUp.create({ emailAddress });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPhase("verify");
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || "Unable to start sign up.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUpLoaded) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        router.replace("/onboarding");
        return;
      }
      const mf = (signUp as any)?.missingFields || [];
      setMissingFields(Array.isArray(mf) ? mf : []);
      setPhase("complete");
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || "Invalid code. Please try again.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUpLoaded) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: Record<string, any> = {};
      if (missingFields.includes("first_name")) payload.firstName = firstName;
      if (missingFields.includes("last_name")) payload.lastName = lastName;
      if (missingFields.includes("username")) payload.username = username;
      if (missingFields.includes("password")) payload.password = password;
      const updated = Object.keys(payload).length > 0
        ? await signUp.update(payload as any)
        : (signUp as any);
      const sessionId = updated?.createdSessionId;
      if (updated?.status === "complete" && sessionId) {
        await setActive({ session: sessionId });
        router.replace("/onboarding");
        return;
      }
      const mf = updated?.missingFields || [];
      if (Array.isArray(mf) && mf.length > 0) {
        setMissingFields(mf);
        setErrorMessage("Still missing information. Please complete the required fields.");
        return;
      }
      setErrorMessage("Unable to finish sign up.");
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || "Unable to finish sign up.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    if (!signUpLoaded) return;
    setErrorMessage(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || "Google sign-up failed.";
      setErrorMessage(message);
    }
  }

  async function continueWithFacebook() {
    if (!signUpLoaded) return;
    setErrorMessage(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_facebook",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || "Facebook sign-up failed.";
      setErrorMessage(message);
    }
  }

  async function continueWithGitHub() {
    if (!signUpLoaded) return;
    setErrorMessage(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || "GitHub sign-up failed.";
      setErrorMessage(message);
    }
  }

  async function continueWithApple() {
    if (!signUpLoaded) return;
    setErrorMessage(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_apple",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || "Apple sign-up failed.";
      setErrorMessage(message);
    }
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
          .aspect-square {
            aspect-ratio: 2/1 !important;
          }
        }
      `}</style>
      {/** Global grid background (no top fade) */}
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
        className="relative flex z-10 w-full max-w-xs sm:max-w-sm md:max-w-md max-h-[80vh] p-1.5 sm:p-2 md:p-3 rounded-xl" 
        style={{
          ...headerGradientStyle,
          minHeight: 'clamp(300px, 50vh, 450px)'
        }}
      >
          <div 
            className="flex-1 flex flex-col overflow-y-auto" 
            style={{ 
              padding: 'clamp(0.5rem, 2vh, 2rem) clamp(0.75rem, 3vw, 2rem)' 
            }}
          >
            <div className="flex flex-col items-center mb-2 sm:mb-3 md:mb-4 lg:mb-6 flex-shrink-0">
              <div className="flex items-center space-x-2 justify-center">
                <Image 
                  src="/logo_small.png" 
                  alt="LoreBridge Logo" 
                  height={32} 
                  width={32}
                  className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 select-none"
                  draggable={false}
                />
                <span className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-gray-900 select-none">lorebridge</span>
              </div>
            </div>
            <h1 className="text-base sm:text-lg md:text-xl font-semibold text-slate-800 text-center mb-0.5 sm:mb-1.5 flex-shrink-0">
              Create your account
            </h1>

            <div className="flex-1 flex flex-col justify-center min-h-0">
            {phase === "start" && (
              <div className="flex flex-col">
                {/* Social buttons - directly after title with small fixed gap */}
                <div 
                  className="grid grid-cols-4" 
                  style={{ 
                    gap: 'clamp(0.125rem, 0.5vh, 0.75rem)' 
                  }}
                >
                  <button
                    type="button"
                    onClick={continueWithGoogle}
                    className="flex items-center justify-center bg-blue-50 text-gray-900 border border-blue-200 shadow-sm rounded-none w-full aspect-square hover:bg-white hover:border-gray-300 hover:shadow-md transition-colors transition-shadow"
                    disabled={submitting || !signUpLoaded}
                    aria-label="Continue with Google"
                  >
                    <FcGoogle 
                      className="" 
                      aria-hidden 
                      style={{ 
                        width: 'clamp(1rem, 3vh, 1.75rem)', 
                        height: 'clamp(1rem, 3vh, 1.75rem)' 
                      }} 
                    />
                  </button>
                  <button
                    type="button"
                    onClick={continueWithFacebook}
                    className="flex items-center justify-center bg-blue-50 text-gray-900 border border-blue-200 shadow-sm rounded-none w-full aspect-square hover:bg-white hover:border-gray-300 hover:shadow-md transition-colors transition-shadow"
                    disabled={submitting || !signUpLoaded}
                    aria-label="Continue with Facebook"
                  >
                    <svg 
                      viewBox="0 0 24 24" 
                      aria-hidden 
                      style={{ 
                        width: 'clamp(1rem, 3vh, 1.75rem)', 
                        height: 'clamp(1rem, 3vh, 1.75rem)' 
                      }}
                    >
                      <path fill="#1877F2" d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.093 10.125 24v-8.438H7.078v-3.49h3.047V9.356c0-3.007 1.793-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.492 0-1.953.93-1.953 1.887v2.266h3.328l-.532 3.49h-2.796V24C19.612 23.093 24 18.1 24 12.073z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={continueWithGitHub}
                    className="flex items-center justify-center bg-blue-50 text-gray-900 border border-blue-200 shadow-sm rounded-none w-full aspect-square hover:bg-white hover:border-gray-300 hover:shadow-md transition-colors transition-shadow"
                    disabled={submitting || !signUpLoaded}
                    aria-label="Continue with GitHub"
                  >
                    <SiGithub 
                      className="" 
                      aria-hidden 
                      style={{ 
                        width: 'clamp(1rem, 3vh, 1.75rem)', 
                        height: 'clamp(1rem, 3vh, 1.75rem)' 
                      }} 
                    />
                  </button>
                  <button
                    type="button"
                    onClick={continueWithApple}
                    className="flex items-center justify-center bg-blue-50 text-gray-900 border border-blue-200 shadow-sm rounded-none w-full aspect-square hover:bg-white hover:border-gray-300 hover:shadow-md transition-colors transition-shadow"
                    disabled={submitting || !signUpLoaded}
                    aria-label="Continue with Apple"
                  >
                    <SiApple 
                      className="" 
                      aria-hidden 
                      style={{ 
                        width: 'clamp(1rem, 3vh, 1.75rem)', 
                        height: 'clamp(1rem, 3vh, 1.75rem)' 
                      }} 
                    />
                  </button>
                </div>
                
                {/* Rest of the form with flexible spacing */}
                <div 
                  className="flex-1 flex flex-col justify-center min-h-0" 
                  style={{ 
                    marginTop: 'clamp(0.25rem, 2vh, 1rem)' 
                  }}
                >
                  <form onSubmit={handleEmailSubmit} className="space-y-2 sm:space-y-3 md:space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-black" />
                      <div className="text-center text-black text-xs sm:text-sm">or</div>
                      <div className="flex-1 h-px bg-black" />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm text-slate-700 mb-1">Email address</label>
                      <input
                        type="email"
                        required
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="w-full border border-gray-300 rounded-none bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm md:text-base"
                        placeholder="Enter your email address"
                        style={{ 
                          padding: `clamp(0.75rem, 1.5vh, 1rem) clamp(0.75rem, 1vw, 1rem) !important`,
                          minHeight: '48px'
                        }}
                      />
                    </div>
                    <div className="flex justify-center">
                      <div id="clerk-captcha" data-cl-theme="auto" data-cl-size="normal" data-cl-language="auto" />
                    </div>
                    {errorMessage && (
                      <p className="text-xs text-red-600">{errorMessage}</p>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-none transition text-xs sm:text-sm md:text-base"
                      disabled={submitting || !signUpLoaded}
                      style={{ 
                        padding: `clamp(0.75rem, 1.5vh, 1rem) !important`,
                        minHeight: '48px'
                      }}
                    >
                      {submitting ? "Creating account..." : "Create account"}
                    </button>
                  </form>
                  
                  {/* Sign in link */}
                  <div className="text-center pt-2 sm:pt-3 md:pt-4">
                    <p className="text-xs sm:text-sm text-gray-600">
                      Already have an account?{" "}
                      <Link href="/sign-in" className="text-blue-600 hover:text-blue-800 font-medium">
                        Sign in
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}
            {phase === "verify" && (
              <form onSubmit={handleCodeSubmit} className="space-y-2 sm:space-y-3 md:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm text-slate-700 mb-1">Verification code</label>
                  <CodeInput length={6} value={code} onChange={setCode} disabled={submitting} />
                  <p className="mt-1 text-xs text-slate-600">Enter the 6-digit code we emailed you</p>
                </div>
                {errorMessage && (
                  <p className="text-xs text-red-600">{errorMessage}</p>
                )}
                <div className="flex items-center justify-between gap-2 mt-3 sm:mt-4 md:mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("start");
                      setCode("");
                      setErrorMessage(null);
                    }}
                    className="border border-gray-300 rounded-none bg-white text-gray-900 hover:bg-gray-50 text-xs sm:text-sm"
                    disabled={submitting}
                    style={{ 
                      padding: `clamp(0.75rem, 1.5vh, 1rem) clamp(1rem, 2vw, 2rem) !important`,
                      minHeight: '48px',
                      minWidth: '80px'
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-none transition text-xs sm:text-sm ml-2"
                    disabled={submitting || code.replace(/\D/g, "").length !== 6}
                    style={{ 
                      padding: `clamp(0.75rem, 1.5vh, 1rem) !important`,
                      minHeight: '48px'
                    }}
                  >
                    {submitting ? "Verifying..." : "Verify and continue"}
                  </button>
                </div>
              </form>
            )}
            {phase === "complete" && (
              <form onSubmit={handleCompleteSubmit} className="space-y-2 sm:space-y-3 md:space-y-4">
                {missingFields.includes("first_name") && (
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-700 mb-1">First name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full border border-gray-300 rounded-none bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm md:text-base"
                      placeholder="Your first name"
                      style={{ 
                        padding: `clamp(0.75rem, 1.5vh, 1rem) clamp(0.75rem, 1vw, 1rem) !important`,
                        minHeight: '48px'
                      }}
                    />
                  </div>
                )}
                {missingFields.includes("last_name") && (
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-700 mb-1">Last name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full border border-gray-300 rounded-none bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm md:text-base"
                      placeholder="Your last name"
                      style={{ 
                        padding: `clamp(0.75rem, 1.5vh, 1rem) clamp(0.75rem, 1vw, 1rem) !important`,
                        minHeight: '48px'
                      }}
                    />
                  </div>
                )}
                {missingFields.includes("username") && (
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-700 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full border border-gray-300 rounded-none bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm md:text-base"
                      placeholder="Choose a username"
                      style={{ 
                        padding: `clamp(0.75rem, 1.5vh, 1rem) clamp(0.75rem, 1vw, 1rem) !important`,
                        minHeight: '48px'
                      }}
                    />
                  </div>
                )}
                {missingFields.includes("password") && (
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-none bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm md:text-base"
                      placeholder="Create a password"
                      style={{ 
                        padding: `clamp(0.75rem, 1.5vh, 1rem) clamp(0.75rem, 1vw, 1rem) !important`,
                        minHeight: '48px'
                      }}
                    />
                  </div>
                )}
                {errorMessage && (
                  <p className="text-xs text-red-600">{errorMessage}</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("start");
                      setErrorMessage(null);
                    }}
                    className="border border-gray-300 rounded-none bg-white text-gray-900 hover:bg-gray-50 text-xs sm:text-sm"
                    disabled={submitting}
                    style={{ 
                      padding: `clamp(0.75rem, 1.5vh, 1rem) clamp(1rem, 2vw, 2rem) !important`,
                      minHeight: '48px',
                      minWidth: '80px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-none transition text-xs sm:text-sm ml-2"
                    disabled={submitting}
                    style={{ 
                      padding: `clamp(0.75rem, 1.5vh, 1rem) !important`,
                      minHeight: '48px'
                    }}
                  >
                    {submitting ? "Creating account..." : "Complete sign up"}
                  </button>
                </div>
              </form>
            )}
            </div>
            <div className="pt-2 sm:pt-3 md:pt-4 flex-shrink-0 mt-auto hidden-on-short-height">
              <div className="w-full flex items-center justify-center">
                <div className="inline-flex items-center gap-1 sm:gap-2 text-xs text-gray-500 font-medium tracking-wide">
                  <svg className="w-3 h-3 text-gray-500" viewBox="0 0 24 24" aria-hidden>
                    <path fill="currentColor" d="M12 1.75a4.25 4.25 0 00-4.25 4.25v2.25H6A2.75 2.75 0 003.25 11v7A2.75 2.75 0 006 20.75h12A2.75 2.75 0 0020.75 18v-7A2.75 2.75 0 0018 8.25h-1.75V6A4.25 4.25 0 0012 1.75zm-2.75 6.75V6A2.75 2.75 0 0112 3.25 2.75 2.75 0 0114.75 6v2.5h-5.5z"/>
                  </svg>
                  <span>Secured by</span>
                  <span className="text-gray-700 font-semibold">clerk</span>
                </div>
              </div>
            </div>
          </div>
        {/* Side connectors and handles (matching main page style) */}
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
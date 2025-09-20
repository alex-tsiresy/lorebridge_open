"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { DashboardLayout } from "@/components/DashboardLayout";
import { OnboardingWrapper } from "@/components/OnboardingWrapper";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";

// Animated floor tile grid - centered layout
function AnimatedTileFloor({ buttonPhase }: { buttonPhase: 'waiting' | 'highlight' | 'done' }) {
  const [tiles, setTiles] = useState<Array<{id: number, row: number, col: number, delay: number, color: string, waveDelay: number, rippleDelay: number}>>([]);
  const [animationTime, setAnimationTime] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<'waiting' | 'button' | 'tiles'>('waiting');

  useEffect(() => {
    const generateTileGrid = () => {
      const tileSize = 120;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Calculate tiles needed to cover screen plus extra for seamless coverage
      const cols = Math.ceil(viewportWidth / tileSize) + 2; // Extra tiles beyond screen
      const rows = Math.ceil(viewportHeight / tileSize) + 2; // Extra tiles beyond screen
      
      const colors = ['bg-gray-50']; // Uniform base color
      const centerRow = Math.floor(rows / 2);
      const centerCol = Math.floor(cols / 2);
      
      const newTiles = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Calculate distance from center for ripple effect
          const distanceFromCenter = Math.sqrt(Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2));
          // Calculate diagonal wave delay
          const waveDelay = (row + col) * 0.1;
          
          newTiles.push({
            id: row * cols + col,
            row,
            col,
            delay: Math.random() * 8,
            color: 'bg-gray-50',
            waveDelay: waveDelay,
            rippleDelay: distanceFromCenter * 0.2
          });
        }
      }
      setTiles(newTiles);
    };

    generateTileGrid();
    window.addEventListener('resize', generateTileGrid);
    return () => window.removeEventListener('resize', generateTileGrid);
  }, []);

  // Animation sequence controller - react to button phase changes
  useEffect(() => {
    if (buttonPhase === 'done') {
      setAnimationPhase('tiles');
      setAnimationTime(0); // Reset animation time when starting
    } else if (buttonPhase === 'waiting') {
      setAnimationPhase('waiting');
      setAnimationTime(0); // Reset when going back to waiting
    }
  }, [buttonPhase]);

  // Animation timer for coordinated effects - only runs during tile phase
  useEffect(() => {
    if (animationPhase !== 'tiles') return;
    
    const timer = setInterval(() => {
      setAnimationTime(prev => {
        const newTime = prev + 0.1;
        // Stop animation after one full wave cycle (about 3.5 seconds)
        if (newTime >= 3.5) {
          setAnimationPhase('waiting');
          return 0;
        }
        return newTime;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [animationPhase]);

  const cols = Math.ceil((typeof window !== 'undefined' ? window.innerWidth : 1200) / 120) + 2;
  const rows = Math.ceil((typeof window !== 'undefined' ? window.innerHeight : 800) / 120) + 2;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      <div 
        className="grid gap-0 absolute"
        style={{
          gridTemplateColumns: `repeat(${cols}, 120px)`,
          gridTemplateRows: `repeat(${rows}, 120px)`,
          left: '50%', // Center horizontally
          top: '40%',  // Position at button's vertical location
          transform: `translate(${-cols * 60}px, ${-rows * 48}px)`, // Center the grid around the button position
        }}
      >
        {tiles.map((tile) => {
          // Since grid is now centered around button, use grid center as wave origin
          const centerRow = Math.floor(rows / 2);
          const centerCol = Math.floor(cols / 2);
          const distanceFromCenter = Math.sqrt(Math.pow(tile.row - centerRow, 2) + Math.pow(tile.col - centerCol, 2));
          
          // Only animate tiles during 'tiles' phase
          const wavePhase = animationPhase === 'tiles' ? Math.sin(animationTime * 1.8 - distanceFromCenter * 0.3) : -1;
          const normalizedWave = (wavePhase + 1) / 2; // 0-1 range
          
          // Create bounce effect with different phases and color-changing hue
          let jumpOffset = 0;
          let scaleEffect = 1;
          let shadowIntensity = 0;
          let hueIntensity = 0;
          
          // White light effect for tiles
          const waveColor = { r: 255, g: 255, b: 255 };
          
          if (normalizedWave > 0.7) {
            // Jump up phase
            const jumpPhase = (normalizedWave - 0.7) / 0.3; // 0-1 for jump up
            jumpOffset = -jumpPhase * 8; // Up to 8px jump
            hueIntensity = jumpPhase * 0.4; // Color hue intensity matches jump
          } else if (normalizedWave > 0.5 && normalizedWave <= 0.7) {
            // Bounce back down phase
            const bouncePhase = 1 - (normalizedWave - 0.5) / 0.2; // 1-0 for bounce down
            jumpOffset = bouncePhase * 2; // Slight overshoot down
            hueIntensity = bouncePhase * 0.2; // Fading color hue
          }
          
          return (
            <div
              key={tile.id}
              className={`bg-gray-200 opacity-30 hover:opacity-40 transition-all duration-100`}
              style={{
                border: '1px solid rgba(196, 68, 222, 0.22)',
                backgroundColor: hueIntensity > 0 ? `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${hueIntensity * 0.15})` : 'rgb(229, 231, 235)', // Dimmer white light overlay when jumping
                backgroundImage: hueIntensity > 0 
                  ? `linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%), radial-gradient(circle at center, rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${hueIntensity * 0.2}) 0%, rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${hueIntensity * 0.1}) 50%, transparent 80%)`
                  : 'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%)',
                backgroundSize: '32px 32px, 100% 100%',
                transform: `translateY(${jumpOffset}px)`,
                boxShadow: jumpOffset < 0 
                  ? `0 8px 25px rgba(0,0,0,0.25), 0 15px 40px rgba(0,0,0,0.15)` 
                  : 'none',
                zIndex: jumpOffset < -2 ? 10 : 'auto', // Bring jumping tiles to front
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  // State to track which demo video is currently selected
  const [selectedDemo, setSelectedDemo] = useState<'canvas' | 'custom' | 'speed'>('canvas');
  const [buttonAnimationPhase, setButtonAnimationPhase] = useState<'waiting' | 'highlight' | 'done'>('waiting');
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const demoVideoRef = useRef<HTMLVideoElement>(null);
  const [isDemoVideoVisible, setIsDemoVideoVisible] = useState(false);

  // Intersection Observer for demo video lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsDemoVideoVisible(true);
          if (demoVideoRef.current) {
            demoVideoRef.current.load();
          }
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = demoVideoRef.current;
    if (currentRef) {
      observer.observe(currentRef.parentElement || currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef.parentElement || currentRef);
      }
    };
  }, []);

  // Button animation sequence controller with looping cycle
  useEffect(() => {
    const runAnimationCycle = () => {
      // Reset to waiting state
      setButtonAnimationPhase('waiting');
      
      // Start button highlight after 3 seconds
      const buttonTimeout = setTimeout(() => {
        setButtonAnimationPhase('highlight');
      }, 3000);

      // End button highlight and start tile animation after 1 more second (4 seconds total)
      const tileTimeout = setTimeout(() => {
        setButtonAnimationPhase('done'); // This triggers tile animation
      }, 4000);

      // Wait 7 seconds after tiles finish, then restart cycle (11 seconds total)
      const restartTimeout = setTimeout(() => {
        runAnimationCycle(); // Restart the cycle
      }, 11000);

      return () => {
        clearTimeout(buttonTimeout);
        clearTimeout(tileTimeout);
        clearTimeout(restartTimeout);
      };
    };

    // Start the first cycle
    const cleanup = runAnimationCycle();
    
    return cleanup;
  }, []);

  // Debug log whenever buttonAnimationPhase changes
  useEffect(() => {
    console.log('Button animation phase changed to:', buttonAnimationPhase);
  }, [buttonAnimationPhase]);

  // Demo video mapping with multiple formats for better compression
  const demoVideos: Record<'canvas' | 'custom' | 'speed', {mp4: string, webm?: string, poster: string}> = {
    canvas: {
      mp4: "/lorebridge_demo_compressed.mp4",
      webm: "/lorebridge_demo.webm",
      poster: "/video-poster.jpg"
    },
    custom: {
      mp4: "/lorebridge_demo_compressed.mp4", 
      webm: "/lorebridge_demo.webm",
      poster: "/video-poster.jpg"
    },
    speed: {
      mp4: "/lorebridge_demo_compressed.mp4",
      webm: "/lorebridge_demo.webm", 
      poster: "/video-poster.jpg"
    }
  };

  // Gradient style reused from the header for thin gradient borders
  const headerGradientStyle = {
    backgroundImage: `
      linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%),
      linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.02) 75%),
      linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15), rgba(59,130,246,0.15)),
      linear-gradient(to bottom right, rgba(255,255,255,0.95), rgba(236,254,255,0.95))
    `,
    backgroundSize: '32px 32px, 24px 24px, cover, cover',
  } as const;

  // Replaced subtle dot grid with emoji overlay

  return (
    <>
      <SignedOut>
          <div className="min-h-screen bg-blue-50 relative overflow-hidden">
          {/* Global animated tile floor */}
          <AnimatedTileFloor buttonPhase={buttonAnimationPhase} />
          
          {/* Navigation Bar - Fixed at top */}
          <nav className="fixed top-6 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-1 sm:py-2 max-w-7xl mx-auto">
            <div 
              className="flex items-center justify-between px-3 sm:px-6 py-1 sm:py-2 w-full transition-all duration-200 hover:shadow-[0_35px_70px_-12px_rgba(0,0,0,0.4)] backdrop-blur-sm relative overflow-hidden border border-gray-200/20 hover:border-gray-300/30"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%),
                  linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.02) 75%),
                  linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15), rgba(59,130,246,0.15)),
                  linear-gradient(to bottom right, rgba(255,255,255,0.95), rgba(236,254,255,0.95))
                `,
                backgroundSize: '32px 32px, 24px 24px, cover, cover',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25), 0 15px 30px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex items-center space-x-4 sm:space-x-8">
                <div className="flex items-center space-x-2">
                  <Image 
                    src="/logo_small.png" 
                    alt="LoreBridge Logo" 
                    height={32} 
                    width={32}
                    className="w-6 h-6 sm:w-8 sm:h-8 select-none"
                    draggable={false}
                  />
                  <span className="text-lg sm:text-xl font-semibold text-gray-900">lorebridge</span>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <SignedOut>
                  <Link href="/sign-in" className="hidden sm:block text-gray-900 hover:text-blue-700 px-2 sm:px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 hover:border-blue-300 transition-all duration-200 text-sm sm:text-base" style={{
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 500,
                    fontStyle: 'normal'
                  }}>Login</Link>
                  <Link href="/sign-in" className="bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-6 py-2 rounded-md font-medium transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 text-xs sm:text-base" style={{
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 500,
                    fontStyle: 'normal'
                  }}>Sign up</Link>
                </SignedOut>
                <SignedIn>
                  <Link href="#boards" onClick={(e) => { e.preventDefault(); window.location.href = "/"; }} className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-6 py-2 rounded-md font-medium transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 text-sm sm:text-base" style={{
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 500,
                    fontStyle: 'normal'
                  }}>Go to Boards</Link>
                </SignedIn>
              </div>
            </div>
          </nav>

          {/* Hero Section - Add top padding to account for fixed nav */}
          <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 pt-32 sm:pt-40 lg:pt-48">
            <div className="text-center">
              {/* Main content */}
              <div className="max-w-6xl mx-auto relative px-4 sm:px-10 py-8 sm:py-12">
                <div className="relative z-30">
                  <h1 className="text-2xl font-bold text-gray-900 sm:text-[2.75rem] md:text-[3.5rem] mb-4 sm:mb-6 leading-tight" style={{
                    fontFamily: '"Lora", serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 700,
                    fontStyle: 'italic'
                  }}>
                  Stop juggling 10 ChatGPT tabs. <br className="hidden sm:block" />
                  <span className="sm:hidden"> One canvas to rule them all.</span>
                  <span className="hidden sm:inline">One canvas to rule them all.</span>
                  </h1>
                  <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 max-w-4xl mx-auto leading-relaxed px-2 sm:px-0" style={{
                    fontFamily: '"Lora", serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 400,
                    fontStyle: 'italic'
                  }}>
                  Drag, connect, and automate multi-node AI work.                  </p>


                  {/* Call to action button */}
                  <div className="max-w-md mx-auto mb-4">
                    <SignedOut>
                      <Link 
                        href="/sign-in" 
                        className={`w-full font-medium py-3 px-6 rounded-md block text-center transition-all duration-500 ${
                          buttonAnimationPhase === 'highlight' 
                            ? 'bg-white text-blue-600 shadow-xl scale-110 transform ring-2 ring-blue-500 ring-offset-2 animate-pulse'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md hover:scale-105'
                        }`}
                        style={{
                          fontFamily: '"Ubuntu", sans-serif',
                          fontOpticalSizing: 'auto',
                          fontWeight: 500,
                          fontStyle: 'normal',
                          boxShadow: buttonAnimationPhase === 'highlight' 
                            ? '0 20px 40px rgba(59, 130, 246, 0.3), 0 0 30px rgba(59, 130, 246, 0.2)'
                            : undefined
                        }}
                      >
                        Try LoreBridge Free
                      </Link>
                    </SignedOut>
                    <SignedIn>
                      <Link 
                        href="#boards" 
                        onClick={(e) => { e.preventDefault(); window.location.href = "/"; }} 
                        className={`w-full font-medium py-3 px-6 rounded-md block text-center transition-all duration-500 ${
                          buttonAnimationPhase === 'highlight' 
                            ? 'bg-white text-blue-600 shadow-xl scale-110 transform ring-2 ring-blue-500 ring-offset-2 animate-pulse'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md hover:scale-105'
                        }`}
                        style={{
                          fontFamily: '"Ubuntu", sans-serif',
                          fontOpticalSizing: 'auto',
                          fontWeight: 500,
                          fontStyle: 'normal',
                          boxShadow: buttonAnimationPhase === 'highlight' 
                            ? '0 20px 40px rgba(59, 130, 246, 0.3), 0 0 30px rgba(59, 130, 246, 0.2)'
                            : undefined
                        }}
                      >
                        Go to Your Boards
                      </Link>
                    </SignedIn>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Demo Section with Video Player */}
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-12 sm:pb-20">
            <div className="text-center">
              <div className="max-w-6xl mx-auto">
                <div className="w-full p-2 sm:p-[12px] rounded-xl" style={headerGradientStyle}>
                  <div 
                    className="aspect-video w-full overflow-hidden backdrop-blur-sm relative rounded-xl"
                    style={{
                      backgroundImage: `
                        linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%),
                        linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.02) 75%),
                        linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15), rgba(59,130,246,0.15), rgba(251,191,36,0.15)),
                        linear-gradient(to bottom right, rgb(243,244,246), rgb(236,254,255))
                      `,
                      backgroundSize: '32px 32px, 24px 24px, cover, cover',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <video 
                      ref={heroVideoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster="/video-poster.jpg"
                    >
                      <source src="/lorebridge_demo.webm" type="video/webm" />
                      <source src="/lorebridge_demo_compressed.mp4" type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Problem Section - New Design */}
          <div className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
            {/* Uses global dot overlay */}
            
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
              {/* Card Container with GraphCard-style background */}
              <div 
                className="p-6 sm:p-12 lg:p-16 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] hover:shadow-[0_35px_70px_-12px_rgba(0,0,0,0.4)] transition-all duration-300 backdrop-blur-sm relative overflow-hidden border border-gray-200/20 hover:border-gray-300/30"
                style={{
                backgroundColor: '#dbeafe',
                borderRadius: '0px',
                boxShadow: '8px 8px 25px rgba(0, 0, 0, 0.5), 4px 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  backgroundImage: `
                  linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%),
                  linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.02) 75%)
                `,
                  backgroundSize: '16px 16px, 12px 12px',
                backgroundBlendMode: 'overlay',
                minHeight: '300px',
              }}
              >
                {/* Main Heading */}
                <h2 className=" sm:text-3xl lg:text-4xl xl:text-6xl font-bold text-slate-800 text-center leading-tight mb-12 sm:mb-16 lg:mb-20" style={{
                  fontFamily: '"Ubuntu", sans-serif',
                  fontOpticalSizing: 'auto',
                  fontWeight: 700,
                  fontStyle: 'normal'
                }}>
                  <span className="bg-white text-blue-700 px-2 py-1 rounded-xl text-xl sm:text-2xl lg:text-3xl xl:text-6xl">AI is powerful </span> 
                  but keep it under your control
                </h2>

                {/* Problem Points Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12 max-w-6xl mx-auto">
                  {/* Problem 1 - Tab Jumping */}
                  <div className="flex items-start space-x-4 sm:space-x-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-700 text-base sm:text-lg leading-relaxed" style={{
                        fontFamily: '"Ubuntu", sans-serif',
                        fontOpticalSizing: 'auto',
                        fontWeight: 400,
                        fontStyle: 'normal'
                      }}>
                        <strong>One canvas. One goal.</strong>                         <br />
                        Stop switching tabs.
                      </p>
                    </div>
                  </div>

                  {/* Problem 2 - Messy Chat Threads */}
                  <div className="flex items-start space-x-4 sm:space-x-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-700 text-base sm:text-lg leading-relaxed" style={{
                        fontFamily: '"Ubuntu", sans-serif',
                        fontOpticalSizing: 'auto',
                        fontWeight: 400,
                        fontStyle: 'normal'
                      }}>
                        <strong>A clear workspace </strong>
                        <br />
                        No context salad

                      </p>
                    </div>
                  </div>

                  {/* Problem 3 - Lost Insights */}
                  <div className="flex items-start space-x-4 sm:space-x-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-700 text-base sm:text-lg leading-relaxed" style={{
                        fontFamily: '"Ubuntu", sans-serif',
                        fontOpticalSizing: 'auto',
                        fontWeight: 400,
                        fontStyle: 'normal'
                      }}>
                        <strong>Keep insights organized. </strong>                        <br />
                        Don&apos;t lose ideas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section - New Design */}
          <div className="relative bg-blue-50 py-16 sm:py-24 lg:py-32 overflow-hidden">
            
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
              {/* Main Heading */}
              <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-6xl font-bold text-slate-800 text-center leading-tight mb-12 sm:mb-16 lg:mb-20" style={{
                fontFamily: '"Ubuntu", sans-serif',
                fontOpticalSizing: 'auto',
                fontWeight: 700,
                fontStyle: 'normal'
              }}>
             Stop losing context. Start working with AI the way you actually think.
              </h2>

              {/* Video Section - Same style as hero video */}
              <div className="w-full p-2 sm:p-[12px] rounded-xl mb-12 sm:mb-16 lg:mb-20" style={headerGradientStyle}>
                <div 
                  className="aspect-video w-full overflow-hidden backdrop-blur-sm relative rounded-xl"
                  style={{
                    backgroundImage: `
                      linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%),
                      linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.02) 75%),
                      linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15), rgba(59,130,246,0.15), rgba(251,191,36,0.15)),
                      linear-gradient(to bottom right, rgb(243,244,246), rgb(236,254,255))
                    `,
                    backgroundSize: '32px 32px, 24px 24px, cover, cover',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <video 
                    ref={demoVideoRef}
                    key={selectedDemo}
                    autoPlay={isDemoVideoVisible}
                    muted
                    loop
                    playsInline
                    preload="none"
                    poster={demoVideos[selectedDemo].poster}
                    className="w-full h-full object-cover"
                  >
                    {isDemoVideoVisible && (
                      <>
                        {demoVideos[selectedDemo].webm && (
                          <source src={demoVideos[selectedDemo].webm} type="video/webm" />
                        )}
                        <source src={demoVideos[selectedDemo].mp4} type="video/mp4" />
                      </>
                    )}
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>

              {/* Three Feature Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12 max-w-6xl mx-auto">
                {/* Feature 1 - The Intelligent Canvas */}
                <div 
                  className="text-left cursor-pointer transition-all duration-200 p-4 sm:p-6 rounded-lg hover:bg-gray-50"
                  onClick={() => setSelectedDemo('canvas')}
                >
                  {/* Top line - blue if selected, gray if not */}
                  <div className={`w-full h-1 mb-6 sm:mb-8 ${selectedDemo === 'canvas' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6" style={{
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 700,
                    fontStyle: 'normal'
                  }}>
                  Work with YouTube, PDFs & Websites — Instantly
                  </h3>
                  <p className="text-slate-600 text-base sm:text-lg leading-relaxed" style={{
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 400,
                    fontStyle: 'normal'
                  }}>
                  Drop in a link or file. LoreBridge auto-fetches transcripts, searches docs, and grabs content. No more copy-pasting.
                  </p>
                </div>

                {/* Feature 2 - Custom-crafted to fit your needs */}
                <div 
                  className="text-left cursor-pointer transition-all duration-200 p-4 sm:p-6 rounded-lg hover:bg-gray-50"
                  onClick={() => setSelectedDemo('custom')}
                >
                  {/* Top line - blue if selected, gray if not */}
                  <div className={`w-full h-1 mb-6 sm:mb-8 ${selectedDemo === 'custom' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6" style={{
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 700,
                    fontStyle: 'normal'
                  }}>
                  Smarter AI, Less Effort
                  </h3>
                  <p className="text-slate-600 text-base sm:text-lg leading-relaxed" style={{
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 400,
                    fontStyle: 'normal'
                  }}>
                  Connect chats to your content. LoreBridge picks the right tools—PDF search, live web search, or both—while you stay in control.
                  </p>
                </div>

                {/* Feature 3 - Pure speed, no fluff */}
                <div 
                  className="text-left cursor-pointer transition-all duration-200 p-4 sm:p-6 rounded-lg hover:bg-gray-50"
                  onClick={() => setSelectedDemo('speed')}
                >
                  {/* Top line - blue if selected, gray if not */}
                  <div className={`w-full h-1 mb-6 sm:mb-8 ${selectedDemo === 'speed' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6" style={{
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 700,
                    fontStyle: 'normal'
                  }}>
                  Turn Chat into Documents & Visuals
                  </h3>
                  <p className="text-slate-600 text-base sm:text-lg leading-relaxed" style={{
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 400,
                    fontStyle: 'normal'
                  }}>
                  Ask AI to create summaries, slides, or tables. Edit directly, reuse results, and build faster without starting from scratch
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer - Sticky note style like ChatNode */}
          <footer className="relative z-10 max-w-screen-2xl mx-auto mt-12 sm:mt-20 mb-0 px-4 sm:px-6 pb-8 sm:pb-16">
            <div 
              className="relative overflow-visible p-6 sm:p-12 lg:p-16 xl:p-24"
              style={{
                backgroundColor: '#dbeafe',
                borderRadius: '0px',
                boxShadow: '8px 8px 25px rgba(0, 0, 0, 0.5), 4px 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  backgroundImage: `
                  linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%),
                  linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.02) 75%)
                `,
                  backgroundSize: '16px 16px, 12px 12px',
                backgroundBlendMode: 'overlay',
                minHeight: '200px',
              }}
            >
              {/* Side connectors: hidden on mobile, visible on larger screens */}
              <div className="absolute inset-0 pointer-events-none z-40 hidden lg:block" aria-hidden>
                {/* Left connector line */}
                <div
                  className="absolute animated-dotted-connector"
                  style={{
                    top: '50%',
                    right: 'calc(100% + 64px)',
                    transform: 'translateY(-50%)',
                    width: 'clamp(200px, 35vw, 1000px)',
                    height: '6px',
                  }}
                />

                {/* Right connector line */}
                <div
                  className="absolute animated-dotted-connector"
                  style={{
                    top: '50%',
                    left: 'calc(100% + 64px)',
                    transform: 'translateY(-50%)',
                    width: 'clamp(200px, 35vw, 1000px)',
                    height: '6px',
                  }}
                />
              </div>
              
              {/* Handles: hidden on mobile, visible on larger screens */}
              <div
                className="hidden lg:block"
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
                className="hidden lg:block"
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
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Image 
                    src="/logo_small.png" 
                    alt="LoreBridge Logo" 
                    height={28} 
                    width={28}
                    className="w-6 h-6 sm:w-7 sm:h-7 select-none"
                    draggable={false}
                  />
                  <span className="text-xs sm:text-sm" style={{ 
                    color: '#1e3a8a',
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 400,
                    fontStyle: 'normal'
                  }}>© {new Date().getFullYear()} lorebridge, Inc.</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-xs sm:text-sm">
                  {/* Email */}
                  <a href="mailto:team@lorebridge.com" className="transition-colors hover:text-blue-700" style={{ 
                    color: '#1e3a8a',
                    fontFamily: '"Ubuntu", sans-serif',
                    fontOpticalSizing: 'auto',
                    fontWeight: 400,
                    fontStyle: 'normal'
                  }}>team@lorebridge.com</a>
                  
                  {/* Social Links */}
                  <div className="flex gap-3 sm:gap-4">
                    <a href="https://www.instagram.com/lorebridgeapp/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-blue-700" style={{ color: '#1e3a8a' }} aria-label="Instagram">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </a>
                    <a href="https://x.com/lorebridge1521" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-blue-700" style={{ color: '#1e3a8a' }} aria-label="X (Twitter)">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </a>
                    <a href="https://www.linkedin.com/company/lorebridge/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-blue-700" style={{ color: '#1e3a8a' }} aria-label="LinkedIn">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </SignedOut>

      <SignedIn>
        <OnboardingWrapper>
          <DashboardLayout />
        </OnboardingWrapper>
      </SignedIn>
    </>
  );
}

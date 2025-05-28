import React, { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';

// Define the example query hints specifically for the landing page
const landingQueryHints = [
  "Work-friendly cafés with WiFi in Manhattan",
  "Quiet coffee shops with power outlets near me",
  "Coffee shops open now with good WiFi",
  "Affordable cafés for studying in Brooklyn",
  "Coffee shops with outdoor seating and charging",
  "24-hour coffee shops for late night work",
];

interface LandingPageProps {
  session: Session | null;
  onLoginClick: () => void;
  handleLogout: () => Promise<void>;
  landingPrompt: string;
  setLandingPrompt: (value: string) => void;
  handleLandingSearchSubmit: (e: FormEvent) => void;
  handleHintClick: (hint: string) => void;
  isLoading: boolean;
  requestLocation: () => void; // Add location request handler prop
}

const LandingPage: React.FC<LandingPageProps> = ({
  session,
  onLoginClick,
  handleLogout,
  landingPrompt,
  setLandingPrompt,
  handleLandingSearchSubmit,
  handleHintClick,
  isLoading,
  requestLocation, // Destructure location handler
}) => {
  return (
    <main className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-100 via-purple-100 to-indigo-200 relative" style={{ minHeight: '100vh' }}>

      {/* Auth Button - Top Right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        {session ? (
          <div className="flex items-center gap-2 bg-white rounded-full shadow px-3 py-1.5">
            <span className="text-sm text-gray-600 hidden sm:inline">{session.user.email?.split('@')[0]}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
              title="Logout"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="px-4 py-2 text-sm bg-white text-blue-600 rounded-full shadow hover:bg-gray-50 transition-colors font-medium"
            title="Login / Sign Up"
          >
            Login / Sign Up
          </button>
        )}
      </div>

      {/* Central Content */}
      <div className="text-center max-w-3xl w-full px-4 mb-16">
        {/* Logo Placeholder */}
        <div className="mb-8">
          <span className="text-5xl font-bold text-indigo-600">Coffeelover</span> {/* Simple text logo */}
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold mb-3 text-gray-800">Find Your Perfect Work Café</h1>
        <p className="text-lg sm:text-xl text-gray-600 mb-10">Discover work-friendly coffee shops with reliable Wi-Fi, power outlets, and the perfect vibe for productivity.</p>

        {/* Landing Search Form */}
        <form onSubmit={handleLandingSearchSubmit} className="w-full max-w-2xl mx-auto mb-4">
          <div className="flex items-center bg-white p-2 rounded-full shadow-xl border border-gray-200">
             {/* Location Button (Optional, placed inside the search bar) */}
             <button
                type="button"
                onClick={requestLocation}
                title={"Use current location"}
                className={`p-2 mx-1 rounded-full border bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300`}
                disabled={isLoading}
              >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                   <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                 </svg>
             </button>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> </svg>
            <input
              type="text"
              value={landingPrompt}
              onChange={(e) => setLandingPrompt(e.target.value)}
              placeholder="Find work-friendly cafés with WiFi, power outlets, quiet spaces..."
              className="flex-grow p-3 text-lg focus:outline-none w-full rounded-full"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="p-3 px-7 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-gray-400 flex items-center justify-center ml-2 flex-shrink-0 text-lg font-medium"
            >
              {isLoading ? ( <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> ) : ( 'Search' )}
            </button>
          </div>
        </form>

        {/* Example Hints for Landing Page */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center px-1 md:px-0">
          {landingQueryHints.map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => handleHintClick(hint)} // Use hint handler passed from App
              disabled={isLoading}
              className="text-sm bg-white/70 backdrop-blur-sm text-gray-700 px-3 py-1 rounded-full hover:bg-white transition-colors disabled:opacity-50 border border-gray-200"
            >
              {hint}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
};

export default LandingPage;

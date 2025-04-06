import React from 'react';
import { MapPinIcon, UserCircleIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline'; // Added icons
import type { Session } from '@supabase/supabase-js'; // Import Session type
// Removed unused supabase import
// import { supabase } from '../lib/supabaseClient';

interface HeaderProps {
  session: Session | null;
  onLoginClick: () => void;
  handleLogout: () => Promise<void>; // Add logout handler prop
  prompt: string;
  setPrompt: (value: string) => void;
  isGenerating: boolean;
  handlePromptSubmit: (e: React.FormEvent) => Promise<void>;
  requestLocation: () => void;
  hasLocation: boolean;
  onLogoClick: () => void;
}

// Define the smart query hints
const queryHints = [
  "Cafés with power outlets",
  "Stable Wi-Fi cafés",
  "No time limit, sunny spots",
];

const Header: React.FC<HeaderProps> = ({
  prompt,
  setPrompt,
  isGenerating,
  handlePromptSubmit,
  requestLocation,
  hasLocation,
  onLogoClick,
  session,
  onLoginClick,
  handleLogout, // Destructure logout handler
}) => {
  // Removed local handleLogout, use the one passed from App.tsx

  return (
    // Use flex-wrap and justify-between for responsiveness
    <header className="p-4 border-b bg-white shadow-sm flex flex-wrap items-center gap-4 justify-between">
      {/* Logo Button */}
      <button
        type="button"
        onClick={onLogoClick}
        className="text-xl font-bold text-blue-600 hover:text-blue-800 focus:outline-none flex-shrink-0"
        title="Reset Search"
      >
        Coffeelover
      </button>

      {/* Container for Search and Auth, allows wrapping */}
      <div className="flex flex-wrap items-center gap-4 flex-grow justify-end md:justify-start min-w-0">
        {/* Search Form - Allow growing */}
        <form onSubmit={handlePromptSubmit} className="flex-grow w-full sm:w-auto min-w-[250px] md:min-w-[300px] max-w-full sm:max-w-md md:max-w-lg"> {/* Constrain max width */}
          <div className="flex items-center">
            {/* Location Button */}
            <button
              type="button"
              onClick={requestLocation}
              title={hasLocation ? "Location acquired" : "Use current location"}
              className={`p-2 mr-2 rounded border ${hasLocation ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-600'} hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300`}
              disabled={isGenerating}
            >
              <MapPinIcon className="h-5 w-5" />
            </button>

            {/* Prompt Input */}
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Coffee shops near me, open late..."
              className="flex-grow p-2 border border-r-0 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-0" // Added min-w-0
              disabled={isGenerating}
            />
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isGenerating}
              className="p-2 px-4 bg-blue-500 text-white rounded-r hover:bg-blue-600 disabled:bg-gray-400 flex items-center justify-center flex-shrink-0" // Added flex-shrink-0
              style={{ minWidth: '80px' }}
            >
              {isGenerating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                'Ask'
              )}
            </button>
          </div>
          {/* Smart Query Hints */}
          <div className="mt-2 flex flex-wrap gap-2 justify-start px-1 md:px-0">
            {queryHints.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => setPrompt(hint)}
                disabled={isGenerating}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {hint}
              </button>
            ))}
          </div>
        </form>

        {/* Auth Section - Allow shrinking */}
        <div className="flex-shrink-0">
          {session ? (
            <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden lg:inline">{session.user.email?.split('@')[0]}</span> {/* Hide email on smaller screens, show username part */}
            <button
              onClick={handleLogout} // Use passed handler
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
              title="Logout"
            >
              <ArrowLeftOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span> {/* Show text on sm+ */}
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
              title="Login / Sign Up"
            >
              <UserCircleIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Login / Sign Up</span> {/* Show text on sm+ */}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

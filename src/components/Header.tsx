import React from 'react';
import { MapPinIcon, UserCircleIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline'; // Added icons
import type { Session } from '@supabase/supabase-js'; // Import Session type
import { supabase } from '../lib/supabaseClient'; // Import supabase for logout

interface HeaderProps {
  session: Session | null; // Add session prop
  onLoginClick: () => void; // Add login click handler prop
  prompt: string;
  setPrompt: (value: string) => void;
  isGenerating: boolean;
  handlePromptSubmit: (e: React.FormEvent) => Promise<void>;
  requestLocation: () => void; // Function to request location
  hasLocation: boolean; // Indicates if location is available
  onLogoClick: () => void; // Function to handle logo click
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
  session, // Destructure new props
  onLoginClick, // Destructure new props
}) => {

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Toast notification is handled by the listener in App.tsx
  };

  return (
    // Stack vertically on small screens, horizontally on medium+
    <header className="p-4 border-b bg-white shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between"> {/* Use justify-between */}
      {/* Left side: Logo + Search */}
      <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto flex-grow">
        {/* Logo Button */}
        <button
          type="button"
        onClick={onLogoClick}
        className="text-xl font-bold text-blue-600 hover:text-blue-800 focus:outline-none"
        title="Reset Search"
      >
          Coffeelover
        </button>

        {/* Search Form - takes remaining space */}
        <form onSubmit={handlePromptSubmit} className="flex-grow w-full md:w-auto">
          <div className="flex items-center">
            {/* Location Button */}
            <button
            type="button"
            onClick={requestLocation}
            title={hasLocation ? "Location acquired" : "Use current location"}
            className={`p-2 mr-2 rounded border ${hasLocation ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-600'} hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300`}
            disabled={isGenerating} // Disable while AI is working
          >
            <MapPinIcon className="h-5 w-5" />
          </button>

          {/* Prompt Input */}
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Coffee shops near me, open late... or try 'cafes with pretty girls'" // Updated placeholder with playful example
            className="flex-grow p-2 border border-r-0 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-300"
            disabled={isGenerating}
          />
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isGenerating}
            className="p-2 px-4 bg-blue-500 text-white rounded-r hover:bg-blue-600 disabled:bg-gray-400 flex items-center justify-center"
            style={{ minWidth: '80px' }} // Ensure button has some width
          >
            {isGenerating ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              'Ask'
            )}
          </button>
        </div>
        {/* Smart Query Hints */}
        <div className="mt-2 flex flex-wrap gap-2 justify-start md:justify-start px-1 md:px-0">
          {queryHints.map((hint) => (
            <button
              key={hint}
              type="button" // Important: prevent form submission
              onClick={() => setPrompt(hint)}
              disabled={isGenerating}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {hint}
            </button>
          ))}
        </div>
        </form>
      </div>

      {/* Right side: Auth Button */}
      <div className="flex-shrink-0">
        {session ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden md:inline">{session.user.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
              title="Logout"
            >
              <ArrowLeftOnRectangleIcon className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
            title="Login / Sign Up"
          >
            <UserCircleIcon className="h-5 w-5" />
            <span className="hidden md:inline">Login</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;

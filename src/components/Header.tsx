import React from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline'; // Keep only needed icons

// Remove Session type and auth-related props
interface HeaderProps {
  prompt: string;
  setPrompt: (value: string) => void;
  isGenerating: boolean;
  handlePromptSubmit: (e: React.FormEvent) => Promise<void>;
  requestLocation: () => void;
  hasLocation: boolean;
  onLogoClick: () => void; // Keep logo click handler
}

// Define the smart query hints (Keep)
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
  // Remove session, onLoginClick, handleLogout from destructuring
}) => {

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

      {/* Container for Search only - Allow it to grow and center its content */}
      <div className="flex-grow flex justify-center min-w-0 px-4"> {/* Added padding */}
        {/* Search Form - Allow growing up to a larger max-width */}
        <form onSubmit={handlePromptSubmit} className="w-full max-w-2xl"> {/* Increased max-w */}
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
      </div>
      {/* Removed Auth Section */}
    </header>
  );
};

export default Header;

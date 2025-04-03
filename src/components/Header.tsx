import React from 'react';

interface HeaderProps {
  prompt: string;
  setPrompt: (value: string) => void;
  isGenerating: boolean;
  handlePromptSubmit: (e: React.FormEvent) => Promise<void>;
}

const Header: React.FC<HeaderProps> = ({
  prompt,
  setPrompt,
  isGenerating,
  handlePromptSubmit,
}) => {
  return (
    // Stack vertically on small screens, horizontally on medium+
    <header className="p-4 border-b bg-white shadow-sm flex flex-col md:flex-row items-center">
      {/* Add bottom margin when stacked, right margin when horizontal */}
      <div className="text-xl font-bold text-blue-600 mb-2 md:mb-0 md:mr-6">Coffeelover</div>
      {/* Full width when stacked, grow with max-width when horizontal */}
      <form onSubmit={handlePromptSubmit} className="w-full md:flex-grow md:max-w-xl">
        <div className="flex">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask Coffeelover about coffee shops..."
            className="flex-grow p-2 border border-r-0 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-300"
            disabled={isGenerating}
          />
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
      </form>
    </header>
  );
};

export default Header;

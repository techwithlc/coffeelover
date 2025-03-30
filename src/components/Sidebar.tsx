import React, { useState } from 'react';
import { CoffeeShop } from '../lib/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI Client
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
// Use the specific experimental model requested by the user
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25"});

// Define the props for the Sidebar component
interface SidebarProps {
  locations: CoffeeShop[];
  onSelectLocation: (location: CoffeeShop) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ locations, onSelectLocation }) => {
  const [prompt, setPrompt] = useState('');
  const [geminiResponse, setGeminiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setGeminiResponse(''); // Clear previous response

    try {
      // Construct a more specific prompt for better results
      const fullPrompt = `Based on the following user request about coffee shops in Taichung, provide a helpful suggestion or answer: "${prompt}"`;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();
      setGeminiResponse(text);
    } catch (error: unknown) { // Use unknown for safer type handling
      console.error("Detailed Error calling Gemini API:", error);
      let errorMessage = 'An unknown error occurred. Please check console.';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error("Error Message:", errorMessage);
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        // Handle cases where error might be an object with a message property
        errorMessage = String((error as { message: unknown }).message);
         console.error("Error Object Message:", errorMessage);
      }
      // You could add more specific checks here if the SDK throws custom error types
      setGeminiResponse(`Sorry, an error occurred: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-80 border-r bg-background p-4 flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-4">Coffee Shops</h2>

      {/* Prompt Input */}
      <form onSubmit={handlePromptSubmit} className="mb-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask Gemini about coffee shops..."
          className="w-full p-2 border rounded"
          disabled={isGenerating}
        />
         <button type="submit" disabled={isGenerating} className="mt-2 w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400">
          {isGenerating ? 'Thinking...' : 'Ask Gemini'}
        </button>
      </form>

       {/* Gemini Response Area */}
      {geminiResponse && (
        <div className="mb-4 p-2 border rounded bg-gray-50 text-sm">
          <p className="font-semibold mb-1">Gemini says:</p>
          <p>{geminiResponse}</p>
        </div>
      )}

      {/* Coffee Shop List */}
      <div className="flex-grow overflow-y-auto border-t pt-4">
        {locations.length === 0 && !isGenerating ? ( // Show loading only if not waiting for Gemini
          <p className="text-sm text-muted-foreground">Loading coffee shops...</p>
        ) : (
          locations.map((location) => (
            <React.Fragment key={location.id}>
              <div
                className="p-2 hover:bg-gray-100 rounded cursor-pointer"
                onClick={() => onSelectLocation(location)}
              >
                <h3 className="font-medium">{location.name || 'Unnamed Shop'}</h3>
                {location.address && (
                  <p className="text-sm text-gray-500">{location.address}</p>
                )}
                {location.rating && (
                  <div className="flex items-center mt-1">
                    <span className="text-sm text-yellow-500">★</span>
                    <span className="text-sm ml-1">{location.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="my-1 border-b border-gray-200"></div>
            </React.Fragment>
          ))
        )}
      </div> {/* End of Coffee Shop List div */}
    </div> // End of main Sidebar div
  );
};

export default Sidebar;

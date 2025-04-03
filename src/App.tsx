import { useState, useEffect } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import LocationDetails from './components/LocationDetails';
import { Toaster, toast } from 'react-hot-toast';
import type { CoffeeShop } from './lib/types';
// import { supabase } from './lib/supabaseClient'; // Removed unused import
// import { mockFavorites } from './lib/mockData'; // Removed unused import
import Header from './components/Header'; // Import Header
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'; // Import Gemini and GenerativeModel

// Initialize Gemini AI Client outside component if API key is static
const apiKeyGemini = import.meta.env.VITE_GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null; // Use specific GenerativeModel type
if (apiKeyGemini) {
  genAI = new GoogleGenerativeAI(apiKeyGemini);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25"});
} else {
  console.error("Gemini API Key is missing!");
  // Handle missing key - maybe disable AI features
}

// Define interface for Google Places API response structure (simplified)
interface PlaceResult {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  vicinity: string;
  rating?: number;
}

interface PlacesNearbyResponse {
  results: PlaceResult[];
  status: string;
  error_message?: string;
  next_page_token?: string;
}


function App() {
  const [selectedLocation, setSelectedLocation] = useState<CoffeeShop | null>(null);
  const [coffeeShops, setCoffeeShops] = useState<CoffeeShop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [mapCenter] = useState({ lat: 24.1477, lng: 120.6736 });

  // AI State (moved from Sidebar)
  const [prompt, setPrompt] = useState('');
  // const [geminiResponse, setGeminiResponse] = useState(''); // Remove state for AI text response
  const [isGenerating, setIsGenerating] = useState(false);
  // const [aiFilteredShopIds, setAiFilteredShopIds] = useState<Set<string> | null>(null); // Remove AI filter state

  // Effect to fetch initial data (coffee shops and favorites)
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);

      // --- Fetch Coffee Shops ---
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        toast.error("Google Maps API Key is missing!");
        // Don't set loading false yet, try fetching favorites
      } else {
        const lat = mapCenter.lat;
        const lng = mapCenter.lng;
        const radius = 5000;
        const type = 'cafe';
        // Remove key=${apiKey} from the client-side fetch URL
        const apiUrl = `/maps-api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}`;
        try {
          const response = await fetch(apiUrl);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data: PlacesNearbyResponse = await response.json();
          if (data.status === 'OK') {
            const fetchedShops: CoffeeShop[] = data.results.map((place) => ({
              id: place.place_id, name: place.name, lat: place.geometry.location.lat, lng: place.geometry.location.lng,
              address: place.vicinity, rating: place.rating, opening_hours: undefined, price_range: undefined,
              wifi_available: undefined, pet_friendly: undefined, description: undefined, menu_highlights: [],
            }));
            setCoffeeShops(fetchedShops);
          } else if (data.status === 'ZERO_RESULTS') {
            toast.error('No coffee shops found nearby.'); setCoffeeShops([]);
          } else {
            console.error('Google Places API Error:', data.status, data.error_message);
            toast.error(`Error fetching places: ${data.error_message || data.status}`); setCoffeeShops([]);
          }
        } catch (error) {
          console.error('Failed to fetch coffee shops:', error);
          toast.error('Failed to load coffee shop data.'); setCoffeeShops([]);
        }
      }

      // --- Load Favorites from localStorage ---
      const savedFavorites = localStorage.getItem('coffeeLoverFavorites');
      if (savedFavorites) {
        try {
          const favoriteIdsArray = JSON.parse(savedFavorites);
          if (Array.isArray(favoriteIdsArray)) {
            setFavoriteIds(new Set(favoriteIdsArray));
          } else {
             console.warn("Invalid favorites format in localStorage");
             setFavoriteIds(new Set()); // Initialize empty if format is wrong
          }
        } catch (e) {
          console.error("Failed to parse favorites from localStorage", e);
          setFavoriteIds(new Set()); // Initialize empty on error
        }
      } else {
         setFavoriteIds(new Set()); // Initialize empty if nothing saved
      }


      // --- Finish Loading ---
      setIsLoading(false);
    };
    fetchInitialData();
  }, [mapCenter]); // Keep mapCenter dependency if needed for initial load

  // Effect to save favorites to localStorage whenever they change
  useEffect(() => {
    // Avoid saving the initial empty set before data is loaded if desired,
    // but saving on every change is simpler for now.
    localStorage.setItem('coffeeLoverFavorites', JSON.stringify(Array.from(favoriteIds)));
  }, [favoriteIds]);

  // Handler for AI Prompt Submit (moved from Sidebar)
  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !model) {
      if (!model) toast.error("AI model not initialized. Check API Key.");
      return;
    }

    setIsGenerating(true);
    // setGeminiResponse(''); // No longer displaying raw AI response
    // setAiFilteredShopIds(null); // No longer using this state

    try {
      // New prompt: Expanded guardrails - check relevance for multiple locations
      const allowedLocations = "Taichung (Taiwan), USA, Japan, Korea, Singapore, Hong Kong, Canada, or London (UK)";
      const structuredPrompt = `Analyze the following user request: "${prompt}".

First, determine if the request is primarily about finding or asking about coffee shops, cafes, or related amenities (like wifi, opening hours, quietness) specifically within any of the following locations: ${allowedLocations}.

If the request IS NOT related to coffee shops in any of these allowed locations, respond ONLY with the following JSON object:
{
  "related": false,
  "message": "I can only help with questions about coffee shops in ${allowedLocations}."
}

If the request IS related to coffee shops in one of the allowed locations, respond ONLY with a JSON object containing the following keys:
1. "related": true
2. "keywords": A string of the key search terms. Include the location name (e.g., "Tokyo", "Vancouver", "Singapore") and any specific criteria like "open late", "quiet", "wifi". If the query is unclear but related, use the original query as keywords. Ensure the location is part of the keywords if mentioned or implied.
3. "count": An integer representing the number of shops requested (e.g., 5, 10), or null if no specific number is mentioned.

Example Request (Related): "Find 5 quiet cafes with wifi open after 10pm in Vancouver"
Example JSON Response (Related):
{
  "related": true,
  "keywords": "quiet cafe wifi open after 10pm Vancouver",
  "count": 5
}

Example Request (Related): "Coffee shops near Shibuya station"
Example JSON Response (Related):
{
  "related": true,
  "keywords": "Coffee shops near Shibuya station Tokyo", // Add implied location if possible
  "count": null
}

Example Request (Unrelated): "Best restaurants in Paris"
Example JSON Response (Unrelated):
{
  "related": false,
  "message": "I can only help with questions about coffee shops in ${allowedLocations}."
}`;

      console.log("Sending structured prompt with expanded guardrails to AI:", structuredPrompt);
      const result = await model.generateContent(structuredPrompt);
      const response = await result.response;
      const rawJsonResponse = response.text().trim();
      console.log("Raw JSON response from AI:", rawJsonResponse);

      // Safely parse the JSON response
      // Define a type for the expected AI response structure (can be related or unrelated)
      type AiResponse =
        | { related: true; keywords: string; count: number | null }
        | { related: false; message: string };

      let parsedResponse: AiResponse | null = null; // Initialize as null

      try {
        // Attempt to find JSON within potential markdown code blocks
        const jsonMatch = rawJsonResponse.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
         if (jsonMatch) {
           const jsonString = jsonMatch[1] || jsonMatch[2]; // Get content from code block or direct object
           const tempParsed = JSON.parse(jsonString);

           // *** Corrected Validation Logic ***
           if (tempParsed.related === true && typeof tempParsed.keywords === 'string' && (tempParsed.count === null || typeof tempParsed.count === 'number')) {
             parsedResponse = tempParsed as AiResponse;
           } else if (tempParsed.related === false && typeof tempParsed.message === 'string') {
             // Ensure the message matches the expected format for safety
             if (tempParsed.message.includes("I can only help with questions about coffee shops in")) {
                parsedResponse = tempParsed as AiResponse;
             } else {
                // If message format is wrong, treat as invalid structure
                throw new Error("Unrelated response message format mismatch.");
             }
           } else {
             // If structure doesn't match either valid pattern
             throw new Error("Invalid JSON structure received from AI.");
           }
         } else {
            // If no JSON object/code block found
            throw new Error("No valid JSON found in AI response.");
         }

      } catch (parseError) {
        console.error("Failed to parse or validate JSON response from AI:", parseError, "Raw response:", rawJsonResponse);
        toast.error("Received an unexpected response from the AI assistant.");
        // Don't proceed if parsing/validation fails
        setIsGenerating(false);
        return; // Exit the function early
      }

      // Handle the parsed response based on relevance
      // We know parsedResponse is not null here due to the return in catch block
      if (parsedResponse.related === true) {
        // Type assertion is safe here because we validated the structure
        const { keywords, count } = parsedResponse;
        console.log("Parsed keywords:", keywords, "Parsed count:", count);
        if (keywords) {
          const searchMessage = count ? `Searching for ${count} result(s) matching: ${keywords}` : `Searching for: ${keywords}`;
          toast.success(searchMessage);
          await handleKeywordSearch(keywords, count); // Pass count to search handler
        } else {
          // Should not happen if AI follows prompt, but handle defensively
          toast.error("AI indicated relevance but didn't provide keywords.");
        }
      } else {
        // Type assertion is safe here
        const { message } = parsedResponse;
        // Query is not related
        console.log("AI determined query is unrelated:", message);
        toast.error(message); // Show the AI's rejection message
      }

    } catch (error: unknown) {
      // This catch block handles errors from model.generateContent or other unexpected issues
      console.error("Detailed Error calling Gemini API or during processing:", error);
      let errorMessage = 'An unknown error occurred calling the AI.';
      if (error instanceof Error) {
         errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
         errorMessage = String((error as { message: unknown }).message);
      }
      console.error("Formatted AI Error Message:", errorMessage);
      toast.error(`AI Error: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };


  // Handler for keyword search - now accepts an optional count
  const handleKeywordSearch = async (keyword: string, requestedCount: number | null = null) => {
    setIsLoading(true); setCoffeeShops([]);
    // API key check is still useful here to prevent unnecessary calls if missing locally,
    // but we don't include it in the fetch URL itself.
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { toast.error("Google Maps API Key is missing!"); setIsLoading(false); return; }
    // Remove key=${apiKey} from the client-side fetch URL
    const apiUrl = `/maps-api/place/textsearch/json?query=${encodeURIComponent(keyword)}&location=${mapCenter.lat},${mapCenter.lng}&radius=10000`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: PlacesNearbyResponse = await response.json();
      if (data.status === 'OK') {
        const fetchedShops: CoffeeShop[] = data.results.map((place) => ({
          id: place.place_id, name: place.name, lat: place.geometry.location.lat, lng: place.geometry.location.lng,
          address: place.vicinity, rating: place.rating, opening_hours: undefined, price_range: undefined,
          wifi_available: undefined, pet_friendly: undefined, description: undefined, menu_highlights: [],
        }));

        // Slice results if a specific count was requested
        const finalShops = requestedCount !== null ? fetchedShops.slice(0, requestedCount) : fetchedShops;

        setCoffeeShops(finalShops);

        if (finalShops.length === 0) {
           toast.success(`No results found for "${keyword}".`);
        } else if (requestedCount !== null && fetchedShops.length < requestedCount) {
           toast.success(`Found ${fetchedShops.length} result(s) for "${keyword}" (less than requested ${requestedCount}).`);
        } else if (requestedCount !== null && finalShops.length < requestedCount) {
           // This case shouldn't happen with slice, but good for robustness
           toast.success(`Displaying ${finalShops.length} result(s) for "${keyword}".`);
        }

      } else if (data.status === 'ZERO_RESULTS') {
        toast.error(`No results found for "${keyword}".`); setCoffeeShops([]);
      } else {
        console.error('Google Places Text Search API Error:', data.status, data.error_message);
        toast.error(`Error searching places: ${data.error_message || data.status}`); setCoffeeShops([]);
      }
    } catch (error) {
      console.error('Failed to fetch coffee shops via keyword:', error);
      toast.error('Failed to load search results.'); setCoffeeShops([]);
    } finally { setIsLoading(false); }
  };

  // Handler for toggling favorite status (using localStorage)
  const handleToggleFavorite = (shopId: string) => {
    const isCurrentlyFavorite = favoriteIds.has(shopId);

    // Update local state directly
    setFavoriteIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isCurrentlyFavorite) {
        newIds.delete(shopId);
        toast.success('Removed from favorites');
      } else {
        newIds.add(shopId);
        toast.success('Added to favorites');
      }
      // We will save to localStorage in a separate useEffect hook
      return newIds;
    });
  };

  const handleSelectLocation = (location: CoffeeShop) => {
    setSelectedLocation(location);
  };

  return (
    <> {/* Wrap in Fragment */}
      <div className="flex flex-col h-screen"> {/* Main container */}
        <Header
          prompt={prompt}
        setPrompt={setPrompt}
        isGenerating={isGenerating}
        handlePromptSubmit={handlePromptSubmit}
      />
      <div className="flex flex-1 overflow-hidden"> {/* Wrapper for sidebar/map */}
        {/* Sidebar: Hidden on small screens, flex column on medium+ */}
        <Sidebar
          locations={coffeeShops}
          onSelectLocation={handleSelectLocation}
          className="hidden md:flex w-96 flex-col" // Responsive classes applied
          // geminiResponse={geminiResponse} // AI text response not needed
          // aiFilteredShopIds={aiFilteredShopIds} // Removed prop
          // setAiFilteredShopIds={setAiFilteredShopIds} // Removed prop
        />
        {/* Map container: Takes remaining space */}
        <div className="flex-1 relative">
          <Map
            locations={coffeeShops}
            onMarkerClick={handleSelectLocation}
            favoriteIds={favoriteIds}
            // aiFilteredShopIds={aiFilteredShopIds} // Removed prop
           />
          {/* Location Details Overlay */}
          {selectedLocation && (
            <LocationDetails
              location={selectedLocation}
              isFavorite={favoriteIds.has(selectedLocation.id)} // Pass isFavorite
              onToggleFavorite={handleToggleFavorite} // Pass handler
              onClose={() => setSelectedLocation(null)}
            />
          )}
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          )}
        </div> {/* Close map container */}
      </div> {/* Close sidebar/map flex wrapper */}

      {/* Render LocationDetails OUTSIDE the overflow-hidden container */}
      {selectedLocation && (
        <LocationDetails
          location={selectedLocation}
          isFavorite={favoriteIds.has(selectedLocation.id)} // Pass isFavorite
          onToggleFavorite={handleToggleFavorite} // Pass handler
          onClose={() => setSelectedLocation(null)}
        />
      )}

      </div> {/* Close main flex container */}
      <Toaster />
    </> /* Close Fragment */
  );
}

export default App;

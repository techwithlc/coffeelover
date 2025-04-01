import { useState, useEffect } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import LocationDetails from './components/LocationDetails';
import { Toaster, toast } from 'react-hot-toast';
import type { CoffeeShop } from './lib/types';
// import { supabase } from './lib/supabaseClient'; // Removed unused import
// import { mockFavorites } from './lib/mockData'; // Removed unused import
import Header from './components/Header'; // Import Header
import { GoogleGenerativeAI } from '@google/generative-ai'; // Import Gemini

// Initialize Gemini AI Client outside component if API key is static
const apiKeyGemini = import.meta.env.VITE_GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let model: any = null; // Use 'any' or a more specific type if available
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
        const apiUrl = `/maps-api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
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
      // New prompt: Ask AI to extract keywords for Google Places search
      const keywordPrompt = `Extract the key search terms from the following user request about coffee shops in Taichung: "${prompt}". Respond with ONLY the keywords, separated by spaces. For example, if the user asks "quiet cafes with wifi open late", respond with "quiet cafe wifi open late". If the query is unclear, respond with the original query.`;

      console.log("Sending keyword extraction prompt to AI:", keywordPrompt);
      const result = await model.generateContent(keywordPrompt);
      const response = await result.response;
      const keywords = response.text().trim();
      console.log("Keywords extracted by AI:", keywords);

      if (keywords) {
        toast.success(`Searching for: ${keywords}`);
        await handleKeywordSearch(keywords); // Trigger Google Places search with extracted keywords
      } else {
        toast.error("AI could not extract keywords from your request.");
      }

    } catch (error: unknown) {
      console.error("Detailed Error calling Gemini API:", error);
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


  // Handler for keyword search
  const handleKeywordSearch = async (keyword: string) => {
    setIsLoading(true); setCoffeeShops([]);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { toast.error("Google Maps API Key is missing!"); setIsLoading(false); return; }
    const apiUrl = `/maps-api/place/textsearch/json?query=${encodeURIComponent(keyword)}&location=${mapCenter.lat},${mapCenter.lng}&radius=10000&key=${apiKey}`;
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
        if (fetchedShops.length === 0) toast.success(`No results found for "${keyword}".`);
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
      <div className="flex flex-1 overflow-hidden"> {/* Added wrapper for sidebar/map */}
        <Sidebar
          locations={coffeeShops}
          onSelectLocation={handleSelectLocation}
          className="w-96"
          // geminiResponse={geminiResponse} // AI text response not needed
          // aiFilteredShopIds={aiFilteredShopIds} // Removed prop
          // setAiFilteredShopIds={setAiFilteredShopIds} // Removed prop
        />
        <div className="flex-1 relative">
          <Map
            locations={coffeeShops}
            onMarkerClick={handleSelectLocation}
            favoriteIds={favoriteIds}
            // aiFilteredShopIds={aiFilteredShopIds} // Removed prop
           />
          {selectedLocation && (
          <LocationDetails
            location={selectedLocation}
            isFavorite={favoriteIds.has(selectedLocation.id)} // Pass isFavorite
            onToggleFavorite={handleToggleFavorite} // Pass handler
            onClose={() => setSelectedLocation(null)}
          />
        )}
        {/* Loading Overlay moved inside map container */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}
        </div> {/* Close map wrapper */}
      </div> {/* Close sidebar/map flex wrapper */}

        {/* Toaster moved outside main div, but inside Fragment */}
      </div> {/* Close main flex container */}
      <Toaster />
    </> /* Close Fragment */
  );
}

export default App;

import { useState, useEffect, FormEvent } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import LocationDetails from './components/LocationDetails';
import { Toaster, toast } from 'react-hot-toast';
// Import corrected types
import type { CoffeeShop, OpeningHours, OpeningHoursPeriod } from './lib/types';
// import { supabase } from './lib/supabaseClient';
// import { mockFavorites } from './lib/mockData';
import Header from './components/Header';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Initialize Gemini AI Client
const apiKeyGemini = import.meta.env.VITE_GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;
if (apiKeyGemini) {
  genAI = new GoogleGenerativeAI(apiKeyGemini);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25"});
} else {
  console.error("Gemini API Key is missing!");
}

// Google Places API Types (Simplified)
interface PlaceResult {
  place_id: string; name: string; geometry: { location: { lat: number; lng: number; }; }; vicinity: string; rating?: number;
}
interface PlaceDetailsResult {
  place_id: string; name?: string; formatted_address?: string; geometry?: { location: { lat: number; lng: number; }; }; rating?: number; opening_hours?: OpeningHours; // Use imported type
}
interface PlacesNearbyResponse { results: PlaceResult[]; status: string; error_message?: string; next_page_token?: string; }
interface PlaceDetailsResponse { result?: PlaceDetailsResult; status: string; error_message?: string; }

// AI Response Types
interface AiFilters { openAfter?: string; wifi?: boolean; }
type AiResponse = | { related: true; keywords: string; count: number | null; filters: AiFilters | null } | { related: false; message: string };

// --- Helper Function for Filtering ---
const filterShopsByCriteria = (shops: CoffeeShop[], filters: AiFilters): CoffeeShop[] => {
  return shops.filter(shop => {
    let matches = true;
    if (filters.openAfter) {
      if (!shop.opening_hours || !Array.isArray(shop.opening_hours.periods) || shop.opening_hours.periods.length === 0) {
        matches = false;
      } else {
        const [filterHour, filterMinute] = filters.openAfter.split(':').map(Number);
        if (isNaN(filterHour) || isNaN(filterMinute)) {
           console.warn(`Invalid openAfter time format: ${filters.openAfter}`);
           matches = false;
        } else {
            const filterTimeMinutes = filterHour * 60 + filterMinute;
            // Add explicit type for period
            const isOpenLateEnough = shop.opening_hours.periods.some((period: OpeningHoursPeriod) => {
               if (period?.close?.time && /^\d{4}$/.test(period.close.time)) {
                 const closeHour = parseInt(period.close.time.substring(0, 2), 10);
                 const closeMinute = parseInt(period.close.time.substring(2, 4), 10);
                 let closeTimeMinutes = closeHour * 60 + closeMinute;
                 if (period.open?.day !== undefined && period.close.day !== undefined && (period.close.day > period.open.day || (period.close.day === 0 && period.open.day === 6))) {
                    closeTimeMinutes += 24 * 60;
                 }
                 return closeTimeMinutes >= filterTimeMinutes;
               }
               if (!period.close && period.open?.time === '0000') return true; // 24/7 case
               return false;
            });
            if (!isOpenLateEnough) matches = false;
        }
      }
    }
    // Add other filters like wifi here if needed
    return matches;
  });
};


function App() {
  const [selectedLocation, setSelectedLocation] = useState<CoffeeShop | null>(null);
  const [coffeeShops, setCoffeeShops] = useState<CoffeeShop[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For initial load / major searches
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [mapCenter] = useState({ lat: 24.1477, lng: 120.6736 });
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false); // Specifically for AI interaction

  // Effect for initial data load
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const lat = mapCenter.lat; const lng = mapCenter.lng; const radius = 5000; const type = 'cafe';
        const apiUrl = `/maps-api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}`;
        try {
          const response = await fetch(apiUrl);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data: PlacesNearbyResponse = await response.json();
          if (data.status === 'OK') {
            const fetchedShops: CoffeeShop[] = data.results.map(place => ({
              id: place.place_id, name: place.name, lat: place.geometry.location.lat, lng: place.geometry.location.lng,
              address: place.vicinity, rating: place.rating, opening_hours: undefined, price_range: undefined,
              wifi_available: undefined, pet_friendly: undefined, description: undefined, menu_highlights: [],
            }));
            setCoffeeShops(fetchedShops);
          } else {
             toast.error(data.status === 'ZERO_RESULTS' ? 'No coffee shops found nearby.' : `Places API Error: ${data.error_message || data.status}`);
             setCoffeeShops([]);
          }
        } catch (error) {
          console.error('Failed to fetch initial coffee shops:', error);
          toast.error('Failed to load coffee shop data.'); setCoffeeShops([]);
        }
      } else {
         toast.error("Google Maps API Key is missing!");
      }
      // Load favorites regardless of maps API status
      const savedFavorites = localStorage.getItem('coffeeLoverFavorites');
      if (savedFavorites) {
        try {
          const favoriteIdsArray = JSON.parse(savedFavorites);
          setFavoriteIds(Array.isArray(favoriteIdsArray) ? new Set(favoriteIdsArray) : new Set());
        } catch (e) { console.error("Failed to parse favorites", e); setFavoriteIds(new Set()); }
      } else { setFavoriteIds(new Set()); }
      setIsLoading(false);
    };
    fetchInitialData();
  }, [mapCenter]);

  // Effect to save favorites
  useEffect(() => {
    localStorage.setItem('coffeeLoverFavorites', JSON.stringify(Array.from(favoriteIds)));
  }, [favoriteIds]);

  // Handler for AI Prompt Submit
  const handlePromptSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !model) {
      toast.error(!model ? "AI model not initialized." : "Please enter a prompt.");
      return;
    }

    setIsGenerating(true);
    let loadingToastId: string | undefined = undefined;
    let aiResponseRelated = false; // Track if AI response was related

    try {
      const allowedLocations = "Taiwan, USA, Japan, Korea, Singapore, Hong Kong, Canada, or London (UK)";
      const structuredPrompt = `Analyze the user request: "${prompt}". Check if it's about coffee shops in ${allowedLocations}. Respond ONLY with JSON. If related: {"related": true, "keywords": "...", "count": num|null, "filters": {"openAfter": "HH:MM"|null, "wifi": bool|null}|null}. If unrelated: {"related": false, "message": "I can only help with coffee shops in ${allowedLocations}."}. For "openAfter", use latest time mentioned (e.g., 10pm -> 22:00). Assume "late" means 21:00 if no time specified. Include location in keywords.`;

      console.log("Sending prompt to AI:", structuredPrompt);
      loadingToastId = toast.loading("Asking AI assistant...");

      const result = await model.generateContent(structuredPrompt);
      const response = await result.response;
      const rawJsonResponse = response.text().trim();
      console.log("Raw AI response:", rawJsonResponse);

      let parsedResponse: AiResponse | null = null;
      try {
        const jsonMatch = rawJsonResponse.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
        if (!jsonMatch) throw new Error("No valid JSON found in AI response.");
        const jsonString = jsonMatch[1] || jsonMatch[2];
        const tempParsed = JSON.parse(jsonString);

        // Validate structure
        if (tempParsed.related === true && typeof tempParsed.keywords === 'string' && (tempParsed.count === null || typeof tempParsed.count === 'number') && (tempParsed.filters === null || typeof tempParsed.filters === 'object')) {
          if (tempParsed.filters?.openAfter && !/^\d{2}:\d{2}$/.test(tempParsed.filters.openAfter)) throw new Error("Invalid 'openAfter' format.");
          parsedResponse = tempParsed as AiResponse;
        } else if (tempParsed.related === false && typeof tempParsed.message === 'string' && tempParsed.message.includes("I can only help with questions about coffee shops in")) {
          parsedResponse = tempParsed as AiResponse;
        } else { throw new Error("Invalid JSON structure."); }
      } catch (parseError) {
        console.error("AI response parsing/validation failed:", parseError, "Raw:", rawJsonResponse);
        toast.error("Received an unexpected response from the AI.", { id: loadingToastId });
        setIsGenerating(false); // Stop loading here on parse error
        return;
      }

      // Process valid response
      if (parsedResponse.related === true) {
        aiResponseRelated = true; // Mark as related to handle finally block correctly
        const { keywords, count, filters } = parsedResponse;
        if (keywords) {
          const searchMessage = `Searching for ${keywords}` + (count ? ` (limit ${count})` : '');
          toast.loading(searchMessage, { id: loadingToastId });
          await handleKeywordSearch(keywords, count, filters, loadingToastId); // Pass toast ID
        } else {
          toast.error("AI didn't provide keywords.", { id: loadingToastId });
          setIsGenerating(false); // Stop loading as search won't proceed
        }
      } else {
        const { message } = parsedResponse;
        console.log("AI determined query unrelated:", message);
        toast.error(message, { id: loadingToastId });
        // No search started, so set generating false in finally
      }

    } catch (error: unknown) {
      console.error("Error calling Gemini API:", error);
      const message = error instanceof Error ? error.message : "Unknown AI error";
      toast.error(`AI Error: ${message}`, { id: loadingToastId });
      // Error occurred before or during AI call, ensure loading stops
      setIsGenerating(false);
    } finally {
       // Set generating false ONLY if the process finished here (unrelated query or AI error before search)
       // If a related query started the search, handleKeywordSearch will set it false.
       if (!aiResponseRelated) {
           setIsGenerating(false);
       }
    }
  };

  // Handler for keyword search
  const handleKeywordSearch = async (keyword: string, requestedCount: number | null = null, filters: AiFilters | null = null, loadingToastId?: string) => {
    setIsLoading(true); // Use main loading overlay for search process
    setCoffeeShops([]);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      toast.error("Google Maps API Key is missing!", { id: loadingToastId });
      setIsLoading(false); setIsGenerating(false); return;
    }

    let candidateShops: PlaceResult[] = [];
    try {
      // Step 1: Initial Text Search
      const textSearchUrl = `/maps-api/place/textsearch/json?query=${encodeURIComponent(keyword)}&location=${mapCenter.lat},${mapCenter.lng}&radius=10000`;
      const response = await fetch(textSearchUrl);
      if (!response.ok) throw new Error(`Text Search HTTP error! status: ${response.status}`);
      const data: PlacesNearbyResponse = await response.json();
      if (data.status === 'OK') { candidateShops = data.results; }
      else if (data.status === 'ZERO_RESULTS') {
        toast.success(`No initial results found for "${keyword}".`, { id: loadingToastId });
        setIsLoading(false); setIsGenerating(false); return;
      } else { throw new Error(`Places API Error: ${data.status} - ${data.error_message || ''}`); }
    } catch (error) {
      console.error('Initial text search failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown search error';
      toast.error(`Initial search error: ${message}`, { id: loadingToastId });
      setIsLoading(false); setIsGenerating(false); return;
    }

    // Step 2 & 3: Fetch Details & Filter
    let detailedShops: CoffeeShop[] = [];
    const needsFiltering = filters && Object.keys(filters).length > 0;

    try {
        if (needsFiltering) {
           toast.loading('Fetching details for filtering...', { id: loadingToastId });
           const detailPromises = candidateShops.map(async (candidate) => {
             const fields = 'place_id,name,geometry,vicinity,rating,opening_hours,formatted_address'; // Added formatted_address
             const detailsApiUrl = `/maps-api/place/details/json?placeid=${candidate.place_id}&fields=${fields}`;
             try {
               const detailsResponse = await fetch(detailsApiUrl);
               if (!detailsResponse.ok) return null;
               const detailsData: PlaceDetailsResponse = await detailsResponse.json();
               if (detailsData.status === 'OK' && detailsData.result) {
                 return { // Map to CoffeeShop type
                   id: candidate.place_id,
                   name: detailsData.result.name || candidate.name,
                   lat: detailsData.result.geometry?.location.lat || candidate.geometry.location.lat,
                   lng: detailsData.result.geometry?.location.lng || candidate.geometry.location.lng,
                   address: detailsData.result.formatted_address || candidate.vicinity,
                   rating: detailsData.result.rating || candidate.rating,
                   opening_hours: detailsData.result.opening_hours,
                   // Initialize others
                   price_range: undefined, wifi_available: undefined, pet_friendly: undefined,
                   description: undefined, menu_highlights: [],
                 } as CoffeeShop;
               } return null;
             } catch (detailsError) { console.error(`Details fetch error for ${candidate.place_id}:`, detailsError); return null; }
           });
           const results = await Promise.all(detailPromises);
           const validDetailedShops = results.filter((shop): shop is CoffeeShop => shop !== null);
           detailedShops = filterShopsByCriteria(validDetailedShops, filters); // Apply filters
           toast.success(`Found ${detailedShops.length} shop(s) matching criteria.`, { id: loadingToastId });
        } else {
          // No filters, map basic data
          detailedShops = candidateShops.map(place => ({
            id: place.place_id, name: place.name, lat: place.geometry.location.lat, lng: place.geometry.location.lng,
            address: place.vicinity, rating: place.rating, opening_hours: undefined, price_range: undefined,
            wifi_available: undefined, pet_friendly: undefined, description: undefined, menu_highlights: [],
          }));
          if (loadingToastId) toast.success(`Found ${detailedShops.length} result(s).`, { id: loadingToastId });
        }

        // Step 4: Apply Count Limit
        const finalShops = requestedCount !== null ? detailedShops.slice(0, requestedCount) : detailedShops;

        // Step 5: Update State & UI
    setCoffeeShops(finalShops);

    // --- Refined Final User Messages ---
    // Dismiss the loading toast before showing the final status
    if (loadingToastId) toast.dismiss(loadingToastId);

    if (finalShops.length === 0) {
      // No results found, either initially or after filtering
      const reason = needsFiltering ? "matching criteria" : "for your search";
      toast.success(`No shops found ${reason}.`);
    } else if (requestedCount !== null) {
      // A specific count was requested
      if (finalShops.length < requestedCount) {
        // Fewer results shown than requested
        const reason = needsFiltering
          ? `Only ${finalShops.length} shop(s) matched the criteria (requested ${requestedCount}).`
          : `Only found ${finalShops.length} result(s) for "${keyword}" (requested ${requestedCount}).`;
        toast.success(reason);
      } else {
        // Exact count requested was found and shown
        toast.success(`Displaying ${finalShops.length} shop(s) as requested.`);
      }
    } else {
      // No specific count requested, just show how many were found
      const afterFiltering = needsFiltering ? " matching criteria" : "";
      toast.success(`Displaying ${finalShops.length} shop(s)${afterFiltering}.`);
    }

    } catch (error) {
        // Catch errors during details fetching or filtering
        console.error('Error during details fetch/filter:', error);
        const message = error instanceof Error ? error.message : 'Unknown error processing results';
        toast.error(`Error processing results: ${message}`, { id: loadingToastId });
    } finally {
        setIsLoading(false); // Hide main loading overlay
        setIsGenerating(false); // Re-enable AI button
    }
  };

  // Handler for toggling favorite status
  const handleToggleFavorite = (shopId: string) => {
    const isCurrentlyFavorite = favoriteIds.has(shopId);
    setFavoriteIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isCurrentlyFavorite) { newIds.delete(shopId); toast.success('Removed from favorites'); }
      else { newIds.add(shopId); toast.success('Added to favorites'); }
      return newIds;
    });
  };

  // Handler for selecting a location
  const handleSelectLocation = (location: CoffeeShop) => {
    setSelectedLocation(location);
  };

  return (
    <>
      <div className="flex flex-col h-screen">
        <Header prompt={prompt} setPrompt={setPrompt} isGenerating={isGenerating} handlePromptSubmit={handlePromptSubmit} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar locations={coffeeShops} onSelectLocation={handleSelectLocation} className="hidden md:flex w-96 flex-col" />
          <div className="flex-1 relative">
            <Map locations={coffeeShops} onMarkerClick={handleSelectLocation} favoriteIds={favoriteIds} />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            )}
          </div>
        </div>
        {selectedLocation && (
          <LocationDetails location={selectedLocation} isFavorite={favoriteIds.has(selectedLocation.id)} onToggleFavorite={handleToggleFavorite} onClose={() => setSelectedLocation(null)} />
        )}
      </div>
      <Toaster />
    </>
  );
}

export default App;

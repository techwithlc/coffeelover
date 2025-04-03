import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import LocationDetails from './components/LocationDetails';
import { Toaster, toast, Toast } from 'react-hot-toast'; // Import Toast type
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
  place_id: string; name: string; geometry: { location: { lat: number; lng: number; }; }; vicinity?: string; rating?: number; // vicinity is optional here
}
// Define a minimal Review type for PlaceDetailsResult
interface PlaceReview {
  author_name?: string;
  rating?: number;
  text?: string;
  time?: number;
}

interface PlaceDetailsResult {
  place_id: string; name?: string; formatted_address?: string; geometry?: { location: { lat: number; lng: number; }; }; rating?: number; opening_hours?: OpeningHours;
  reviews?: PlaceReview[]; // Use the defined type
  website?: string;
  editorial_summary?: { overview?: string };
  price_level?: number;
}
interface PlacesNearbyResponse { results: PlaceResult[]; status: string; error_message?: string; next_page_token?: string; }
interface PlaceDetailsResponse { result?: PlaceDetailsResult; status: string; error_message?: string; }

// AI Response Types - Enhanced Filters
interface AiFilters {
  openAfter?: string; // HH:MM
  openNow?: boolean;
  wifi?: boolean;
  charging?: boolean;
  pets?: boolean;
  menuItem?: string; // e.g., "latte", "americano"
  quality?: string; // e.g., "best", "good", "quiet"
}
type AiResponse = | { related: true; keywords: string; count: number | null; filters: AiFilters | null } | { related: false; message: string; suggestion?: string };

// --- Helper Function for Filtering ---
const filterShopsByCriteria = (shops: CoffeeShop[], filters: AiFilters): CoffeeShop[] => {
  if (!filters || Object.keys(filters).length === 0) {
    return shops;
  }

  return shops.filter(shop => {
    // Check openNow filter (client-side check if details were fetched for other reasons)
    if (filters.openNow === true) {
      if (shop.opening_hours?.open_now !== true) return false;
    }

    // Check openAfter filter
    if (filters.openAfter) {
      if (!shop.opening_hours?.periods) return false; // Need periods to check
      const [filterHour, filterMinute] = filters.openAfter.split(':').map(Number);
      if (isNaN(filterHour) || isNaN(filterMinute)) {
        console.warn(`Invalid openAfter time format: ${filters.openAfter}`);
        return false;
      }
      const filterTimeMinutes = filterHour * 60 + filterMinute;
      const isOpenLateEnough = shop.opening_hours.periods.some((period: OpeningHoursPeriod) => {
        if (period?.close?.time && /^\d{4}$/.test(period.close.time)) {
          const closeHour = parseInt(period.close.time.substring(0, 2), 10);
          const closeMinute = parseInt(period.close.time.substring(2, 4), 10);
          let closeTimeMinutes = closeHour * 60 + closeMinute;
          // Handle closing next day
          if (period.open?.day !== undefined && period.close.day !== undefined && (period.close.day > period.open.day || (period.close.day === 0 && period.open.day === 6))) {
            closeTimeMinutes += 24 * 60;
          }
          return closeTimeMinutes >= filterTimeMinutes;
        }
        if (!period.close && period.open?.time === '0000') return true; // 24/7 case
        return false;
      });
      if (!isOpenLateEnough) return false;
    }

    // Check wifi filter (using simulated data)
    if (filters.wifi === true && shop.wifi_available !== true) return false;

    // Check charging filter (using simulated data)
    if (filters.charging === true && shop.charging_available !== true) return false;

    // Check pets filter (using simulated data)
    if (filters.pets === true && shop.pet_friendly !== true) return false;

    // Placeholder checks for menuItem and quality (primarily influence keywords)
    if (filters.menuItem) console.warn(`Filtering by menu item "${filters.menuItem}" not fully implemented.`);
    if (filters.quality) console.warn(`Filtering by quality "${filters.quality}" not fully implemented.`);

    return true; // Passed all applicable filters
  });
};


// --- Helper Function for Fetching Place Details ---
const BASE_DETAIL_FIELDS = 'place_id,name,geometry,formatted_address,rating'; // Use formatted_address
const HOURS_FIELD = 'opening_hours';
// Fields that *might* hint at amenities
const WIFI_HINT_FIELDS = 'website,editorial_summary';
const PETS_HINT_FIELDS = 'website,editorial_summary';
const CHARGING_HINT_FIELDS = 'website,editorial_summary';
const MENU_HINT_FIELDS = 'website,reviews'; // Reviews might mention items

async function fetchPlaceDetails(placeId: string, requiredFields: string[]): Promise<CoffeeShop | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Missing Google Maps API Key for Place Details fetch.");
    return null;
  }

  // Combine base fields with required fields, removing duplicates
  const uniqueFields = Array.from(new Set([BASE_DETAIL_FIELDS, ...requiredFields])).join(',');
  const apiUrl = `/maps-api/place/details/json?place_id=${placeId}&fields=${uniqueFields}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`Place Details API HTTP error! status: ${response.status}`);
    const data: PlaceDetailsResponse = await response.json();

    if (data.status === 'OK' && data.result) {
      const details = data.result;
      // --- Simulated Data Population (Refined) ---
      const simulatedWifi = requiredFields.includes('wifi');
      const simulatedPets = requiredFields.includes('pets');
      const simulatedCharging = requiredFields.includes('charging');
      // --- End Simulation ---

      return {
        id: details.place_id,
        name: details.name || 'N/A',
        lat: details.geometry?.location.lat,
        lng: details.geometry?.location.lng,
        address: details.formatted_address || 'Address not available', // Use formatted_address
        rating: details.rating,
        opening_hours: details.opening_hours,
        // --- Populate based on simulation or actual parsed data ---
        wifi_available: simulatedWifi,
        pet_friendly: simulatedPets,
        charging_available: simulatedCharging,
        // --- Other fields ---
        price_range: details.price_level?.toString(),
        description: details.editorial_summary?.overview,
        menu_highlights: [], // Needs parsing logic if MENU_HINT_FIELDS used
      };
    } else {
      console.error(`Place Details API Error for ${placeId}: ${data.status} - ${data.error_message || ''}`);
      return null;
    }
  } catch (error: unknown) { // Use unknown
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to fetch details for ${placeId}:`, message);
    return null;
  }
}


// --- Custom Toast Renderer ---
const renderClosableToast = (message: string, toastInstance: Toast, type: 'success' | 'error' = 'success') => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
    <span style={{ marginRight: '10px' }}>{message}</span>
    <button
      onClick={() => toast.dismiss(toastInstance.id)}
      style={{
        border: 'none', background: 'transparent', cursor: 'pointer',
        fontWeight: 'bold', fontSize: '1.1em', lineHeight: '1', padding: '0 4px',
        color: type === 'error' ? '#DC2626' : '#10B981' // Example colors
      }}
      aria-label="Close"
    >
      &times;
    </button>
  </div>
);


function App() {
  const [selectedLocation, setSelectedLocation] = useState<CoffeeShop | null>(null);
  const [coffeeShops, setCoffeeShops] = useState<CoffeeShop[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Start false, true during load/search
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [currentMapCenter, setCurrentMapCenter] = useState({ lat: 24.1477, lng: 120.6736 });
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error((t) => renderClosableToast("Geolocation is not supported by your browser.", t, 'error'));
      return;
    }
    const loadingToast = toast.loading("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        setUserLocation(newLocation);
        setCurrentMapCenter(newLocation);
        toast.success((t) => renderClosableToast("Location found! Map centered.", t), { id: loadingToast });
      },
      (error) => {
        console.error("Geolocation error:", error);
        let message = "Failed to get location.";
        switch (error.code) {
          case error.PERMISSION_DENIED: message = "Location permission denied."; break;
          case error.POSITION_UNAVAILABLE: message = "Location information is currently unavailable."; break; // Slightly more specific
          case error.TIMEOUT: message = "Location request timed out."; break;
        }
        toast.error((t) => renderClosableToast(message, t, 'error'), { id: loadingToast });
        setUserLocation(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 } // Set enableHighAccuracy to false
    );
  }, []);

  // Effect for initial data load (removed automatic fetch)
  useEffect(() => {
    // Load favorites on initial mount
    const savedFavorites = localStorage.getItem('coffeeLoverFavorites');
    if (savedFavorites) {
      try {
        const ids = JSON.parse(savedFavorites);
        if (Array.isArray(ids)) {
          setFavoriteIds(new Set(ids));
        }
      } catch (e) { console.error("Failed to parse favorites", e); }
    }
  }, []);

  // Effect to save favorites
  useEffect(() => {
    localStorage.setItem('coffeeLoverFavorites', JSON.stringify(Array.from(favoriteIds)));
  }, [favoriteIds]);

  // Handler for AI Prompt Submit
  const handlePromptSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
       toast.error((t) => renderClosableToast("Please enter what you're looking for.", t, 'error'));
       return;
    }
    if (!model) {
      toast.error((t) => renderClosableToast("AI assistant is not available right now.", t, 'error'));
      return;
    }

    setIsGenerating(true);
    let loadingToastId: string | undefined = undefined;
    let aiResponseRelated = false;

    try {
      // Enhanced AI Prompt Instructions - Updated for Europe
      const structuredPrompt = `Analyze the user request: "${prompt}".
Is it about finding coffee shops/cafes, potentially in Europe or elsewhere?
Respond ONLY with JSON that strictly follows one of these formats:
1. If related to finding coffee shops: {"related": true, "keywords": "...", "count": num|null, "filters": {"openAfter": "HH:MM"|null, "openNow": bool|null, "wifi": bool|null, "charging": bool|null, "pets": bool|null, "menuItem": "string"|null, "quality": "string"|null}|null}
   - Extract relevant keywords (e.g., "quiet cafe Paris", "coffee near me Berlin", "latte Rome"). Include location if mentioned. If specific items like "latte" or "americano" are mentioned, include them in keywords AND set "menuItem".
   - If the user asks for places open "now", "currently", etc., set "openNow": true.
   - If the user asks for places open after a specific time (e.g., "after 10pm", "late night"), extract time as HH:MM (24h) for "openAfter". Assume "late" means 21:00.
   - Extract boolean filters for "wifi", "charging" (power outlets), "pets" (pet friendly) if mentioned.
   - Extract specific quality terms like "best", "good", "quiet" into the "quality" filter. These primarily influence keywords but note them.
   - Extract a specific number if requested (e.g., "find 3 cafes") for "count".
2. If unrelated or too ambiguous: {"related": false, "message": "...", "suggestion": "..."|null}
   - If unrelated to coffee shops, use message: "I can only help with coffee shop searches."
   - If too vague (e.g., "coffee"), use message: "Could you be more specific? e.g., 'cafes near me with wifi', 'quiet coffee shop in Paris', 'best latte nearby'."
   - If asking for impossible features (e.g., specific bean origin), use message: "I can search by location, hours, wifi, charging, pets, and menu items, but not bean origins yet."`;

      // console.log("Sending prompt to AI:", structuredPrompt); // REMOVED CONSOLE LOG
      loadingToastId = toast.loading("Asking AI assistant...");

      const result = await model.generateContent(structuredPrompt);
      const response = await result.response;
      const rawJsonResponse = response.text().trim();
      // console.log("Raw AI response:", rawJsonResponse); // REMOVED CONSOLE LOG

      let parsedResponse: AiResponse | null = null;
      try {
        const jsonMatch = rawJsonResponse.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
        if (!jsonMatch) throw new Error("No valid JSON found in AI response.");
        const jsonString = jsonMatch[1] || jsonMatch[2];
        const tempParsed = JSON.parse(jsonString);

        // Basic validation (can be expanded)
        if (tempParsed.related === true) {
            if (typeof tempParsed.keywords !== 'string' || !tempParsed.keywords.trim()) throw new Error("Missing or empty 'keywords'.");
            parsedResponse = tempParsed as AiResponse;
        } else if (tempParsed.related === false) {
            if (typeof tempParsed.message !== 'string' || !tempParsed.message.trim()) throw new Error("Missing or empty 'message'.");
            parsedResponse = tempParsed as AiResponse;
        } else {
            throw new Error("Invalid JSON structure: 'related' field missing or invalid.");
        }
      } catch (parseError: unknown) { // Use unknown
        const message = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        console.error("AI response parsing/validation failed:", message, "Raw:", rawJsonResponse);
        toast.error((t) => renderClosableToast(`AI response error: ${message}`, t, 'error'), { id: loadingToastId });
        setIsGenerating(false);
        return;
      }

      // Process valid response
      if (parsedResponse.related === true) {
        aiResponseRelated = true;
        const { keywords, count, filters } = parsedResponse;
        if (keywords.trim()) {
          let searchMessage = `Searching for ${keywords.trim()}`;
          // Add filter descriptions to search message
          if (filters?.openNow) searchMessage += " (open now)";
          if (filters?.openAfter) searchMessage += ` (open after ${filters.openAfter})`;
          if (filters?.wifi) searchMessage += " (wifi)";
          if (filters?.charging) searchMessage += " (charging)";
          if (filters?.pets) searchMessage += " (pet friendly)";
          if (filters?.menuItem) searchMessage += ` (menu: ${filters.menuItem})`;
          if (filters?.quality) searchMessage += ` (quality: ${filters.quality})`;
          if (count) searchMessage += ` (limit ${count})`;

          toast.loading(searchMessage, { id: loadingToastId });
          await handleKeywordSearch(keywords.trim(), count, filters, loadingToastId);
        } else {
          // Should be caught by validation, but handle defensively
          toast.error((t) => renderClosableToast("AI didn't provide keywords.", t, 'error'), { id: loadingToastId });
          setIsGenerating(false);
        }
      } else {
        const { message, suggestion } = parsedResponse;
        console.log("AI determined query unrelated/ambiguous:", message, suggestion);
        toast.error((t) => renderClosableToast(message, t, 'error'), { id: loadingToastId, duration: 5000 });
        if (suggestion) console.log("AI Suggestion:", suggestion);
      }

    } catch (error: unknown) { // Use unknown
      const message = error instanceof Error ? error.message : 'Unknown AI error';
      console.error("Error calling Gemini API:", error);
      toast.error((t) => renderClosableToast(`AI Error: ${message}`, t, 'error'), { id: loadingToastId });
    } finally {
       if (!aiResponseRelated) {
           setIsGenerating(false);
       }
    }
  };

  // --- Main Search and Filtering Logic ---
  const handleKeywordSearch = async (
    keyword: string,
    requestedCount: number | null,
    aiFilters: AiFilters | null,
    loadingToastId: string | undefined
  ) => {
    setIsLoading(true);
    setSelectedLocation(null);
    setCoffeeShops([]);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      toast.error((t) => renderClosableToast("Google Maps API Key is missing!", t, 'error'), { id: loadingToastId });
      setIsLoading(false); setIsGenerating(false); return;
    }

    let candidateShops: PlaceResult[] = [];
    const searchLocation = userLocation ?? currentMapCenter;
    const lat = searchLocation.lat;
    const lng = searchLocation.lng;
    const radius = 10000; // Use a reasonable radius

    // Determine if openNow parameter can be used directly
    const useOpenNowParam = aiFilters?.openNow === true &&
      !aiFilters.openAfter && !aiFilters.wifi && !aiFilters.charging &&
      !aiFilters.pets && !aiFilters.menuItem && !aiFilters.quality;

    // Use Text Search API - more flexible for keywords
    let searchApiUrl = `/maps-api/place/textsearch/json?query=${encodeURIComponent(keyword)}&location=${lat},${lng}&radius=${radius}&type=cafe`; // Added type=cafe
    if (useOpenNowParam) {
       searchApiUrl += '&opennow=true';
       console.log("Using opennow=true parameter in Text Search");
    }

    try {
      // console.log("Search API URL:", searchApiUrl); // REMOVED CONSOLE LOG
      const response = await fetch(searchApiUrl);
      if (!response.ok) throw new Error(`Search API HTTP error! status: ${response.status}`);
      const data: PlacesNearbyResponse = await response.json();

      if (data.status === 'OK') {
        candidateShops = data.results;
      } else if (data.status === 'ZERO_RESULTS') {
        toast.success((t) => renderClosableToast(`No initial results found for "${keyword}".`, t), { id: loadingToastId });
        setIsLoading(false); setIsGenerating(false); return;
      } else {
        throw new Error(`Places API Error: ${data.status} - ${data.error_message || ''}`);
      }
    } catch (error: unknown) { // Use unknown
      const message = error instanceof Error ? error.message : 'Unknown search error';
      console.error('Initial search failed:', error);
      toast.error((t) => renderClosableToast(`Initial search error: ${message}`, t, 'error'), { id: loadingToastId });
      setIsLoading(false); setIsGenerating(false); return;
    }

    // Step 2 & 3: Fetch Details & Filter
    let processedShops: CoffeeShop[] = [];
    const detailFieldsToFetch: string[] = [];
    // Determine required fields based on filters that need details
    if (aiFilters?.openAfter || (aiFilters?.openNow && !useOpenNowParam)) detailFieldsToFetch.push(HOURS_FIELD);
    if (aiFilters?.wifi) { detailFieldsToFetch.push(WIFI_HINT_FIELDS); detailFieldsToFetch.push('wifi'); }
    if (aiFilters?.charging) { detailFieldsToFetch.push(CHARGING_HINT_FIELDS); detailFieldsToFetch.push('charging'); }
    if (aiFilters?.pets) { detailFieldsToFetch.push(PETS_HINT_FIELDS); detailFieldsToFetch.push('pets'); }
    if (aiFilters?.menuItem) { detailFieldsToFetch.push(MENU_HINT_FIELDS); }

    const needsDetailsFetch = detailFieldsToFetch.length > 0;

    try {
      if (needsDetailsFetch) {
        toast.loading('Fetching details for filtering...', { id: loadingToastId });
        const detailPromises = candidateShops.map(candidate => fetchPlaceDetails(candidate.place_id, detailFieldsToFetch));
        const detailedResults = await Promise.all(detailPromises);
        const validDetailedShops = detailedResults.filter((shop): shop is CoffeeShop => shop !== null);

        console.log(`Fetched details for ${validDetailedShops.length} / ${candidateShops.length} shops.`);
        processedShops = aiFilters ? filterShopsByCriteria(validDetailedShops, aiFilters) : validDetailedShops;

        toast.success((t) => renderClosableToast(`Found ${processedShops.length} shop(s) after detailed check.`, t), { id: loadingToastId });
      } else {
        // Map basic data if no details needed
        processedShops = candidateShops.map(place => ({
          id: place.place_id, name: place.name,
          lat: place.geometry.location.lat, lng: place.geometry.location.lng,
          address: place.vicinity || 'Address not available', // Use vicinity from search result
          rating: place.rating, opening_hours: undefined,
          price_range: undefined, wifi_available: undefined, pet_friendly: undefined,
          charging_available: undefined, description: undefined, menu_highlights: [],
        }));
        // Apply filters that don't require details (if any - currently none besides openNow handled by API)
        processedShops = aiFilters ? filterShopsByCriteria(processedShops, aiFilters) : processedShops;
        toast.success((t) => renderClosableToast(`Found ${processedShops.length} initial result(s).`, t), { id: loadingToastId });
      }

      // Step 4: Apply Count Limit
      const finalShops = requestedCount !== null && requestedCount < processedShops.length
        ? processedShops.slice(0, requestedCount)
        : processedShops;

      // Step 5: Update State & Center Map
      setCoffeeShops(finalShops);
      if (finalShops.length > 0 && finalShops[0].lat && finalShops[0].lng) {
        setCurrentMapCenter({ lat: finalShops[0].lat, lng: finalShops[0].lng });
      }

      // Final user feedback if zero results after filtering
      if (finalShops.length === 0 && candidateShops.length > 0) {
          toast.success((t) => renderClosableToast("No shops matched all criteria after filtering.", t));
      }

    } catch (error: unknown) { // Use unknown
      const message = error instanceof Error ? error.message : 'Unknown processing error';
      console.error('Error processing search:', error);
      toast.error((t) => renderClosableToast(`Search processing error: ${message}`, t, 'error'), { id: loadingToastId });
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  // Handler for toggling favorite status
  const handleToggleFavorite = (shopId: string) => {
    setFavoriteIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(shopId)) {
        newIds.delete(shopId);
        toast.success((t) => renderClosableToast('Removed from favorites', t));
      } else {
        newIds.add(shopId);
        toast.success((t) => renderClosableToast('Added to favorites', t));
      }
      return newIds;
    });
  };

  // Handler for selecting a location
  const handleSelectLocation = (location: CoffeeShop) => {
    setSelectedLocation(location);
  };

  // Handler for resetting the search state
  const handleResetSearch = () => {
    setPrompt('');
    setCoffeeShops([]);
    setSelectedLocation(null);
    if (userLocation) {
        setCurrentMapCenter(userLocation);
    } else {
        setCurrentMapCenter({ lat: 24.1477, lng: 120.6736 });
    }
    toast((t) => renderClosableToast('Search reset.', t));
  };

  return (
    <>
      <div className="flex flex-col h-screen">
        <Header
          prompt={prompt}
          setPrompt={setPrompt}
          isGenerating={isGenerating}
          handlePromptSubmit={handlePromptSubmit}
          requestLocation={requestLocation}
          hasLocation={!!userLocation}
          onLogoClick={handleResetSearch}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar locations={coffeeShops} onSelectLocation={handleSelectLocation} className="hidden md:flex w-96 flex-col" />
          <div className="flex-1 relative">
            <Map
              center={currentMapCenter}
              locations={coffeeShops}
              onMarkerClick={handleSelectLocation}
              favoriteIds={favoriteIds}
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            )}
          </div>
        </div>
        {selectedLocation && (
          <LocationDetails
             location={selectedLocation}
             isFavorite={favoriteIds.has(selectedLocation.id)}
             onToggleFavorite={handleToggleFavorite}
             onClose={() => setSelectedLocation(null)}
          />
        )}
      </div>
      <Toaster position="top-center" reverseOrder={false} />
    </>
  );
}

export default App;

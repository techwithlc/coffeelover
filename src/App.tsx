import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import LocationDetails from './components/LocationDetails';
import { Toaster, toast, Toast } from 'react-hot-toast';
import type { CoffeeShop, OpeningHours, OpeningHoursPeriod } from './lib/types';
import { supabase } from './lib/supabaseClient';
import Header from './components/Header';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { Session } from '@supabase/supabase-js';

// --- Haversine Distance Calculation ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
// --- End Haversine ---

// Helper function to check if a shop is open now
const isShopOpenNow = (shop: CoffeeShop): boolean | undefined => {
  if (!shop.opening_hours?.periods || shop.utc_offset_minutes === undefined) {
    return shop.opening_hours?.open_now;
  }
  const nowUtc = new Date();
  const shopTimeNow = new Date(nowUtc.getTime() + shop.utc_offset_minutes * 60000);
  const currentDay = shopTimeNow.getUTCDay();
  const currentTime = shopTimeNow.getUTCHours() * 100 + shopTimeNow.getUTCMinutes();

  for (const period of shop.opening_hours.periods) {
    if (period.open.day === currentDay) {
      const openTime = parseInt(period.open.time, 10);
      if (period.close && period.close.day !== currentDay) {
        if (currentTime >= openTime) return true;
      } else if (period.close) {
        const closeTime = parseInt(period.close.time, 10);
        if (currentTime >= openTime && currentTime < closeTime) {
          return true;
        }
      } else {
        if (period.open.time === "0000") return true;
      }
    }
  }
  return false;
};

// Initialize Gemini AI Client
const apiKeyGemini = import.meta.env.VITE_GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;
if (apiKeyGemini) {
  genAI = new GoogleGenerativeAI(apiKeyGemini);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using flash model
} else {
  console.error("Gemini API Key is missing!");
}

// Google Places API Types
interface PlaceResult {
  place_id: string; name: string; geometry: { location: { lat: number; lng: number; }; }; vicinity?: string; rating?: number;
}
interface PlaceReview {
  author_name?: string; rating?: number; text?: string; time?: number;
}
interface PlaceDetailsResult {
  place_id: string; name?: string; formatted_address?: string; geometry?: { location: { lat: number; lng: number; }; }; rating?: number; opening_hours?: OpeningHours;
  reviews?: PlaceReview[]; website?: string; editorial_summary?: { overview?: string }; price_level?: number; utc_offset_minutes?: number;
}
interface PlacesNearbyResponse { results: PlaceResult[]; status: string; error_message?: string; next_page_token?: string; }
interface PlaceDetailsResponse { result?: PlaceDetailsResult; status: string; error_message?: string; }

// AI Response Types
interface AiFilters {
  openAfter?: string | null; openNow?: boolean; wifi?: boolean; charging?: boolean; pets?: boolean; menuItem?: string; quality?: string; distanceKm?: number | null; minRating?: number | null; socialVibe?: boolean | null;
}
type AiResponse = | { related: true; keywords: string; count: number | null; filters: AiFilters | null } | { related: false; message: string; suggestion?: string };

// --- Helper Function for Filtering ---
const filterShopsByCriteria = (shops: CoffeeShop[], filters: AiFilters, checkOpenNow: boolean = true): CoffeeShop[] => {
  return shops.filter(shop => {
    if (checkOpenNow && filters.openNow === true) {
      if (isShopOpenNow(shop) === false) return false;
    }
    if (filters.openAfter) {
      if (!shop.opening_hours?.periods) return false;
      const [filterHour, filterMinute] = filters.openAfter.split(':').map(Number);
      if (isNaN(filterHour) || isNaN(filterMinute)) return false;
      const filterTimeMinutes = filterHour * 60 + filterMinute;
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
        if (!period.close && period.open?.time === '0000') return true;
        return false;
      });
      if (!isOpenLateEnough) return false;
    }
    // Use actual DB fields if available, otherwise keep simulation
    if (filters.wifi === true && shop.has_wifi !== true) return false;
    if (filters.charging === true && shop.has_chargers !== true) return false;
    if (filters.pets === true && shop.pet_friendly !== true) return false;
    return true;
  });
};

// --- Helper Function for Fetching Place Details ---
const BASE_DETAIL_FIELDS = 'place_id,name,geometry,formatted_address,rating,opening_hours';
const WIFI_HINT_FIELDS = 'website,editorial_summary';
const PETS_HINT_FIELDS = 'website,editorial_summary';
const CHARGING_HINT_FIELDS = 'website,editorial_summary';
const MENU_HINT_FIELDS = 'website,reviews';

async function fetchPlaceDetails(placeId: string, requiredFields: string[]): Promise<CoffeeShop | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Missing Google Maps API Key for Place Details fetch.");
    return null;
  }
  const fieldsToRequestSet = new Set(BASE_DETAIL_FIELDS.split(','));
  requiredFields.forEach(field => {
    if (!['wifi', 'charging', 'pets', 'utc_offset_minutes'].includes(field)) {
       fieldsToRequestSet.add(field);
    }
  });
  const uniqueFields = Array.from(fieldsToRequestSet).join(',');
  const apiUrl = `/maps-api/place/details/json?place_id=${placeId}&fields=${uniqueFields}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`Place Details API HTTP error! status: ${response.status}`);
    const data: PlaceDetailsResponse = await response.json();

    if (data.status === 'OK' && data.result) {
      const details = data.result;
      // Fetch actual amenity data from Supabase instead of simulating
      const { data: dbData, error: dbError } = await supabase
        .from('locations')
        .select('has_wifi, has_chargers, charger_count, pet_friendly') // Add pet_friendly if it exists in your DB
        .eq('id', details.place_id)
        .single();

      if (dbError) {
        console.warn(`Could not fetch DB data for ${details.place_id}:`, dbError.message);
      }

      return {
        id: details.place_id, name: details.name || 'N/A', lat: details.geometry?.location.lat, lng: details.geometry?.location.lng,
        address: details.formatted_address || 'Address not available', rating: details.rating, opening_hours: details.opening_hours,
        utc_offset_minutes: undefined, // Still cannot fetch directly
        has_wifi: dbData?.has_wifi ?? false, // Use DB data or default
        pet_friendly: dbData?.pet_friendly ?? false, // Use DB data or default
        has_chargers: dbData?.has_chargers ?? false, // Use DB data or default
        charger_count: dbData?.charger_count ?? 0, // Use DB data or default
        price_range: details.price_level?.toString(), description: details.editorial_summary?.overview, menu_highlights: [],
      };
    } else {
      console.error(`Place Details API Error for ${placeId}: ${data.status} - ${data.error_message || ''}`);
      return null;
    }
  } catch (error: unknown) {
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
        color: type === 'error' ? '#DC2626' : '#10B981'
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
  const [isLoading, setIsLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [currentMapCenter, setCurrentMapCenter] = useState({ lat: 24.1477, lng: 120.6736 });
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error((t) => renderClosableToast("Geolocation is not supported by your browser.", t, 'error'));
      return;
    }
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          toast.error((t) => renderClosableToast("Location permission denied.", t, 'error'));
           return;
         }
       } catch (permError) {
         // Log permission query error but proceed, getCurrentPosition handles actual errors
         console.warn("Could not query geolocation permission status:", permError);
       }
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
          case error.POSITION_UNAVAILABLE: message = "Location information is currently unavailable."; break;
          case error.TIMEOUT: message = "Location request timed out."; break;
        }
        toast.error((t) => renderClosableToast(message, t, 'error'), { id: loadingToast });
        setUserLocation(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Effect for initial data load & Auth
  useEffect(() => {
    const savedFavorites = localStorage.getItem('coffeeLoverFavorites');
    if (savedFavorites) {
      try {
        const ids = JSON.parse(savedFavorites);
        if (Array.isArray(ids)) { setFavoriteIds(new Set(ids)); }
      } catch (e) { console.error("Failed to parse favorites", e); }
    }
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN') {
        setShowAuthModal(false);
        toast.success((t) => renderClosableToast('Logged in successfully!', t));
      }
      if (_event === 'SIGNED_OUT') {
        toast.success((t) => renderClosableToast('Logged out.', t));
      }
    });
    return () => subscription.unsubscribe();
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
      // Keep your detailed structured prompt for AI analysis
      const structuredPrompt = `Analyze the user request: "${prompt}" for finding coffee shops/cafes...`; // (Full prompt omitted for brevity)

      loadingToastId = toast.loading("Asking AI assistant...");
      const result = await model.generateContent(structuredPrompt);
      const response = await result.response;
      const rawJsonResponse = response.text().trim();
      let parsedResponse: AiResponse | null = null;
      try {
        const jsonMatch = rawJsonResponse.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
        if (!jsonMatch) throw new Error("No valid JSON found in AI response.");
        const jsonString = jsonMatch[1] || jsonMatch[2];
        const tempParsed = JSON.parse(jsonString);
        // Basic validation
        if (tempParsed.related === true) {
          if (typeof tempParsed.keywords !== 'string' || !tempParsed.keywords.trim()) throw new Error("Missing or empty 'keywords'.");
          parsedResponse = tempParsed as AiResponse;
        } else if (tempParsed.related === false) {
          if (typeof tempParsed.message !== 'string' || !tempParsed.message.trim()) throw new Error("Missing or empty 'message'.");
          parsedResponse = tempParsed as AiResponse;
        } else {
          throw new Error("Invalid JSON structure: 'related' field missing or invalid.");
        }
      } catch (parseError: unknown) {
        const message = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        console.error("AI response parsing/validation failed:", message, "Raw:", rawJsonResponse);
        toast.error((t) => renderClosableToast(`AI response error: ${message}`, t, 'error'), { id: loadingToastId });
        setIsGenerating(false);
        return;
      }
      if (parsedResponse.related === true) {
        aiResponseRelated = true;
        const { keywords, count, filters } = parsedResponse;
        if (keywords.trim()) {
          let searchMessage = `Searching for ${keywords.trim()}`;
          // Add filter descriptions
          if (filters?.openNow) searchMessage += " (open now)";
          if (filters?.wifi) searchMessage += " (wifi)";
          // ... add other filters
          toast.loading(searchMessage, { id: loadingToastId });
          await handleKeywordSearch(keywords.trim(), count, filters, loadingToastId); // Call internal search
        } else {
          toast.error((t) => renderClosableToast("AI didn't provide keywords.", t, 'error'), { id: loadingToastId });
          setIsGenerating(false);
        }
      } else {
        const { message } = parsedResponse;
        toast.error((t) => renderClosableToast(message, t, 'error'), { id: loadingToastId, duration: 5000 });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown AI error';
      console.error("Error calling Gemini API:", error);
      toast.error((t) => renderClosableToast(`AI Error: ${message}`, t, 'error'), { id: loadingToastId });
    } finally {
      if (!aiResponseRelated) {
        setIsGenerating(false);
      }
    }
  };

  // Main Search and Filtering Logic
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
    const requestedRadiusKm = aiFilters?.distanceKm ?? null;
    const searchApiUrl = `/maps-api/place/textsearch/json?query=${encodeURIComponent(keyword)}&location=${lat},${lng}&type=cafe`;
    try {
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown search error';
      console.error('Initial search failed:', error);
      toast.error((t) => renderClosableToast(`Initial search error: ${message}`, t, 'error'), { id: loadingToastId });
      setIsLoading(false); setIsGenerating(false); return;
    }
    let processedShops: CoffeeShop[] = [];
    const detailFieldsToFetch: string[] = [];
    if (aiFilters?.wifi) { detailFieldsToFetch.push(...WIFI_HINT_FIELDS.split(',')); detailFieldsToFetch.push('wifi'); }
    if (aiFilters?.charging) { detailFieldsToFetch.push(...CHARGING_HINT_FIELDS.split(',')); detailFieldsToFetch.push('charging'); }
    if (aiFilters?.pets) { detailFieldsToFetch.push(...PETS_HINT_FIELDS.split(',')); detailFieldsToFetch.push('pets'); }
    if (aiFilters?.menuItem) { detailFieldsToFetch.push(...MENU_HINT_FIELDS.split(',')); }
    let finalShops: CoffeeShop[] = [];
    try {
      toast.loading('Fetching details for filtering...', { id: loadingToastId });
      const detailPromises = candidateShops.map(candidate => fetchPlaceDetails(candidate.place_id, detailFieldsToFetch));
      const detailedResults = await Promise.all(detailPromises);
      processedShops = detailedResults.filter((shop): shop is CoffeeShop => shop !== null);
      const criteriaFilteredShops = aiFilters ? filterShopsByCriteria(processedShops, aiFilters, false) : processedShops;
      let openNowFilteredShops = criteriaFilteredShops;
      if (aiFilters?.openNow === true) {
        openNowFilteredShops = criteriaFilteredShops.filter(shop => isShopOpenNow(shop) === true);
      }
      let distanceFilteredShops = openNowFilteredShops;
      if (requestedRadiusKm !== null) {
        distanceFilteredShops = openNowFilteredShops.filter(shop => {
          if (shop.lat && shop.lng) { const distance = getDistanceFromLatLonInKm(lat, lng, shop.lat, shop.lng); return distance <= requestedRadiusKm!; } return false;
        });
        if (openNowFilteredShops.length > 0 && distanceFilteredShops.length < openNowFilteredShops.length) {
          toast.success((t) => renderClosableToast(`Filtered results to within ${requestedRadiusKm}km.`, t));
        }
      }
      let ratingFilteredShops = distanceFilteredShops;
      const minRating = aiFilters?.minRating ?? null;
      if (minRating !== null) {
        ratingFilteredShops = distanceFilteredShops.filter(shop => shop.rating !== undefined && shop.rating >= minRating);
        if (distanceFilteredShops.length > 0 && ratingFilteredShops.length < distanceFilteredShops.length) {
          toast.success((t) => renderClosableToast(`Filtered results to >= ${minRating} stars.`, t));
        }
      }
      let finalShopsToDisplay = ratingFilteredShops;
      let fallbackMessage: string | null = null;
      if (aiFilters?.openNow === true && finalShopsToDisplay.length === 0 && criteriaFilteredShops.length > 0) {
        let fallbackDistanceFiltered = criteriaFilteredShops;
        if (requestedRadiusKm !== null) { fallbackDistanceFiltered = criteriaFilteredShops.filter(shop => { if (shop.lat && shop.lng) { const distance = getDistanceFromLatLonInKm(lat, lng, shop.lat, shop.lng); return distance <= requestedRadiusKm!; } return false; }); }
        let fallbackRatingFiltered = fallbackDistanceFiltered;
        if (minRating !== null) { fallbackRatingFiltered = fallbackDistanceFiltered.filter(shop => shop.rating !== undefined && shop.rating >= minRating); }
        if (fallbackRatingFiltered.length > 0) {
          finalShopsToDisplay = fallbackRatingFiltered;
          fallbackMessage = "I couldn’t find an exact match for shops open right now, but based on nearby coffee shops, here are a few recommendations you might like:";
          toast.success((t) => renderClosableToast(fallbackMessage!, t), { id: loadingToastId });
        } else {
          toast.success((t) => renderClosableToast("No shops matched all criteria.", t), { id: loadingToastId });
        }
      } else if (finalShopsToDisplay.length === 0 && candidateShops.length > 0) {
        toast.success((t) => renderClosableToast("No shops matched all criteria after filtering.", t), { id: loadingToastId });
      } else if (!fallbackMessage) {
        toast.success((t) => renderClosableToast(`Found ${finalShopsToDisplay.length} shop(s).`, t), { id: loadingToastId });
      }
      const countFilteredShops = requestedCount !== null && requestedCount < finalShopsToDisplay.length ? finalShopsToDisplay.slice(0, requestedCount) : finalShopsToDisplay;
      finalShops = countFilteredShops;
      setCoffeeShops(finalShops);
      if (finalShops.length > 0 && finalShops[0].lat && finalShops[0].lng) {
        setCurrentMapCenter({ lat: finalShops[0].lat, lng: finalShops[0].lng });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown processing error';
      console.error('Error processing search:', error);
      toast.error((t) => renderClosableToast(`Search processing error: ${message}`, t, 'error'), { id: loadingToastId });
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
      if (aiFilters?.socialVibe === true && finalShops.length > 0) {
        toast.success((t) => renderClosableToast("These cafés are known for their aesthetic vibe and social crowd — perfect if you're looking to enjoy a drink in a lively, stylish atmosphere 😎", t));
      }
    }
  };

  // Handlers
  const handleToggleFavorite = (shopId: string) => {
    setFavoriteIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(shopId)) { newIds.delete(shopId); toast.success((t) => renderClosableToast('Removed from favorites', t)); }
      else { newIds.add(shopId); toast.success((t) => renderClosableToast('Added to favorites', t)); }
      return newIds;
    });
  };
  const handleSelectLocation = (location: CoffeeShop) => { setSelectedLocation(location); };
  const handleResetSearch = () => {
    setPrompt(''); setCoffeeShops([]); setSelectedLocation(null);
    if (userLocation) { setCurrentMapCenter(userLocation); } else { setCurrentMapCenter({ lat: 24.1477, lng: 120.6736 }); }
    toast((t) => renderClosableToast('Search reset.', t));
  };
  const handleLogout = async () => { await supabase.auth.signOut(); };

  // Render original layout
  return (
    <>
      <div className="flex flex-col h-screen">
        <Header
          session={session}
          onLoginClick={() => setShowAuthModal(true)}
          prompt={prompt}
          setPrompt={setPrompt}
          isGenerating={isGenerating || isLoading}
          handlePromptSubmit={handlePromptSubmit}
          requestLocation={requestLocation}
           hasLocation={!!userLocation}
           onLogoClick={handleResetSearch}
           handleLogout={handleLogout} // Pass logout handler
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
            userId={session?.user?.id ?? null}
          />
        )}
      </div>
      <Toaster position="top-center" reverseOrder={false} />
      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 max-w-md w-full relative">
             <button
               onClick={() => setShowAuthModal(false)}
               className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
               aria-label="Close login modal"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              providers={['google', 'github']}
              redirectTo={window.location.origin}
              theme="light"
            />
          </div>
        </div>
      )}
    </>
  );
}

export default App;

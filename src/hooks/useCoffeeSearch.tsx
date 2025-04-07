import React, { useState, useCallback } from 'react'; // Import React for JSX
import { CoffeeShop, OpeningHoursPeriod, AiFilters, AiResponse, PlaceResult, PlaceDetailsResponse, PlacesNearbyResponse } from '../lib/types'; // Assuming types are correctly defined/exported
import { supabase } from '../lib/supabaseClient';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { toast, Toast } from 'react-hot-toast'; // Import Toast type

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
function deg2rad(deg: number): number { return deg * (Math.PI / 180); }
// --- End Haversine ---

// Helper function to check if a shop is open now
const isShopOpenNow = (shop: CoffeeShop): boolean | undefined => {
  // Check Google's open_now first if available and periods/offset are missing
  if (!shop.opening_hours?.periods || shop.utc_offset_minutes === undefined) {
    return shop.opening_hours?.open_now;
  }

  // Timezone-aware check using periods and utc_offset_minutes
  const nowUtc = new Date();
  // Calculate shop's current time by applying the UTC offset
  const shopTimeNow = new Date(nowUtc.getTime() + shop.utc_offset_minutes * 60000);
  const currentDay = shopTimeNow.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentTime = shopTimeNow.getUTCHours() * 100 + shopTimeNow.getUTCMinutes(); // HHMM format

  for (const period of shop.opening_hours.periods) {
    if (period.open.day === currentDay) {
      const openTime = parseInt(period.open.time, 10);

      // Handle overnight hours (close day is next day or Sunday->Saturday wrap)
      if (period.close && (period.close.day > period.open.day || (period.close.day === 0 && period.open.day === 6))) {
        // Shop closes on a different day than it opens
        if (currentTime >= openTime) {
          // If current time is after opening time today, it's open (until close time tomorrow)
          return true;
        }
        // Need to also check if we are on the *closing* day but *before* the closing time
        const previousDay = (currentDay === 0) ? 6 : currentDay - 1;
        if (period.open.day === previousDay) { // Check if the opening period started yesterday
             const closeTime = parseInt(period.close.time, 10);
             if (currentTime < closeTime) {
                 return true; // Open from yesterday until the close time today
             }
        }

      } else if (period.close) {
        // Shop closes on the same day it opens
        const closeTime = parseInt(period.close.time, 10);
        if (currentTime >= openTime && currentTime < closeTime) {
          return true;
        }
      } else {
        // No close time specified (potentially 24 hours open from the 'open' time)
        // Google Places usually provides a close time even for 24h, but handle defensively.
        // If open time is "0000" and no close, assume 24h for that day.
        if (period.open.time === "0000") return true;
        // Otherwise, if open time is specific and no close, it's ambiguous.
        // Let's assume it's open from the open time onwards for that day segment.
        // This might need refinement based on how Google actually represents this.
        if (currentTime >= openTime) return true;
      }
    }
  }

   // After checking all periods for the current day, check if an overnight period from the *previous* day is still active
   const previousDay = (currentDay === 0) ? 6 : currentDay - 1;
   for (const period of shop.opening_hours.periods) {
       if (period.open.day === previousDay && period.close && (period.close.day === currentDay || (period.close.day === 0 && period.open.day === 6))) { // Check if it opened yesterday and closes today
           const closeTime = parseInt(period.close.time, 10);
           if (currentTime < closeTime) {
               return true; // Still open from yesterday's opening period
           }
       }
   }


  return false; // Not open according to any period
};


// --- Helper Function for Filtering ---
const filterShopsByCriteria = (shops: CoffeeShop[], filters: AiFilters, checkOpenNow: boolean = true): CoffeeShop[] => {
  return shops.filter(shop => {
    // 1. Open Now Filter (if requested)
    if (checkOpenNow && filters.openNow === true) {
      if (isShopOpenNow(shop) === false) return false; // Use the detailed check
    }

    // 2. Open After Filter
    if (filters.openAfter) {
      if (!shop.opening_hours?.periods) return false; // Cannot determine without periods

      const [filterHour, filterMinute] = filters.openAfter.split(':').map(Number);
      if (isNaN(filterHour) || isNaN(filterMinute)) return false; // Invalid filter format
      const filterTimeMinutes = filterHour * 60 + filterMinute; // e.g., 21:00 -> 1260

      const isOpenLateEnough = shop.opening_hours.periods.some((period: OpeningHoursPeriod) => {
        if (period?.close?.time && /^\d{4}$/.test(period.close.time)) {
          const closeHour = parseInt(period.close.time.substring(0, 2), 10);
          const closeMinute = parseInt(period.close.time.substring(2, 4), 10);
          let closeTimeMinutes = closeHour * 60 + closeMinute; // e.g., 23:30 -> 1410

          // Adjust for overnight closing times
          if (period.open?.day !== undefined && period.close.day !== undefined &&
              (period.close.day > period.open.day || (period.close.day === 0 && period.open.day === 6))) {
            closeTimeMinutes += 24 * 60; // Add 24 hours worth of minutes
          }

          return closeTimeMinutes >= filterTimeMinutes;
        }
        // Handle case where shop is open 24 hours (open: 0000, no close time)
        if (!period.close && period.open?.time === '0000') {
           return true; // Always open late enough if 24h
        }
        return false; // Cannot determine if open late enough without close time
      });

      if (!isOpenLateEnough) return false;
    }

    // 3. Amenity Filters (Wifi, Charging, Pets)
    if (filters.wifi === true && shop.has_wifi !== true) return false;
    if (filters.charging === true && shop.has_chargers !== true) return false;
    if (filters.pets === true && shop.pet_friendly !== true) return false;

    // TODO: Add filtering for menuItem, quality (might require AI analysis of reviews/description)

    return true; // Shop passes all applicable filters
  });
};


// --- Constants for Place Details Fetching ---
const BASE_DETAIL_FIELDS = 'place_id,name,geometry,formatted_address,rating,opening_hours,utc_offset_minutes,price_level'; // Added utc_offset_minutes, price_level
const WIFI_HINT_FIELDS = 'website,editorial_summary'; // Fields that *might* contain wifi info
const PETS_HINT_FIELDS = 'website,editorial_summary'; // Fields that *might* contain pet info
const CHARGING_HINT_FIELDS = 'website,editorial_summary'; // Fields that *might* contain charging info
const MENU_HINT_FIELDS = 'website,reviews'; // Fields that *might* contain menu info


// --- Helper Function for Fetching Place Details ---
async function fetchPlaceDetails(placeId: string, requiredFields: string[]): Promise<CoffeeShop | null> {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!googleApiKey) {
    console.error("Missing Google Maps API Key for Place Details fetch.");
    // Consider throwing an error or returning a specific error object
    return null;
  }

  // Check if Supabase client seems valid before querying DB
  if (!supabase || !supabase.from) {
      console.error("Supabase client not initialized correctly in fetchPlaceDetails.");
      // Decide how to handle this - maybe proceed without DB data?
  }

  // Determine all fields needed for the API call
  const fieldsToRequestSet = new Set(BASE_DETAIL_FIELDS.split(','));
  requiredFields.forEach(field => {
    // Add hint fields based on the *semantic* requirement (wifi, pets, etc.)
    if (field === 'wifi') WIFI_HINT_FIELDS.split(',').forEach(f => fieldsToRequestSet.add(f));
    else if (field === 'pets') PETS_HINT_FIELDS.split(',').forEach(f => fieldsToRequestSet.add(f));
    else if (field === 'charging') CHARGING_HINT_FIELDS.split(',').forEach(f => fieldsToRequestSet.add(f));
    else if (field === 'menuItem') MENU_HINT_FIELDS.split(',').forEach(f => fieldsToRequestSet.add(f));
    // Add other specific fields directly if they are part of PlaceDetailsResult
    else if (!['wifi', 'charging', 'pets'].includes(field)) { // Avoid adding abstract fields
         fieldsToRequestSet.add(field);
    }
  });

  const uniqueFields = Array.from(fieldsToRequestSet).join(',');
  const apiUrl = `/maps-api/place/details/json?place_id=${placeId}&fields=${uniqueFields}`; // Use the proxy path

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      // Log more details for HTTP errors
      const errorBody = await response.text();
      console.error(`Place Details API HTTP error! Status: ${response.status}, URL: ${apiUrl}, Body: ${errorBody}`);
      throw new Error(`Place Details API HTTP error! status: ${response.status}`);
    }
    const data: PlaceDetailsResponse = await response.json();

    if (data.status === 'OK' && data.result) {
      const details = data.result;
      let dbData: Partial<CoffeeShop> | null = null;
      let dbError: unknown = null; // Use unknown type

      // Fetch supplementary data from Supabase if client is valid
      if (supabase && supabase.from) {
        try {
            const { data: fetchedDbData, error: fetchDbError } = await supabase
            .from('locations')
            .select('has_wifi, has_chargers, charger_count, pet_friendly') // Select specific boolean/count fields
            .eq('id', details.place_id)
            .maybeSingle(); // Use maybeSingle to handle 0 or 1 result gracefully

            dbData = fetchedDbData;
            dbError = fetchDbError;

            // Log Supabase errors more informatively, ignoring "No rows found" which is expected
            // Use a type guard instead of 'as any'
            if (dbError && typeof dbError === 'object' && dbError !== null && 'code' in dbError && (dbError as { code: string }).code !== 'PGRST116') {
               console.error(`Supabase query error for ${details.place_id}:`, dbError); // Log the full error
            }
        } catch (supabaseQueryError) {
             console.error(`Supabase query exception for ${details.place_id}:`, supabaseQueryError);
             dbError = supabaseQueryError; // Store the exception as the error
        }
      } else {
          console.warn(`Supabase client not available, skipping DB query for ${details.place_id}`);
      }


      // Construct the CoffeeShop object, merging Google Places data and Supabase data
      const coffeeShopData: CoffeeShop = {
        id: details.place_id,
        name: details.name || 'N/A', // Provide default if name is missing
        lat: details.geometry?.location.lat,
        lng: details.geometry?.location.lng,
        address: details.formatted_address || 'Address not available',
        rating: details.rating,
        opening_hours: details.opening_hours, // Directly use the opening_hours object
        utc_offset_minutes: details.utc_offset_minutes, // Get UTC offset if available
        // --- Merge DB data with defaults ---
        has_wifi: dbData?.has_wifi ?? false, // Default to false if not in DB or DB fetch failed
        pet_friendly: dbData?.pet_friendly ?? false, // Default to false
        has_chargers: dbData?.has_chargers ?? false, // Default to false
        charger_count: dbData?.charger_count ?? 0, // Default to 0
        // --- Other details from Google ---
        price_range: details.price_level?.toString(), // Convert price level number to string if needed
        description: details.editorial_summary?.overview,
        // TODO: Potentially parse menu_highlights from reviews or website if needed by filters
        menu_highlights: [], // Placeholder
      };

      return coffeeShopData;

    } else {
      // Log API errors clearly
      console.error(`Place Details API Error for ${placeId}: ${data.status} - ${data.error_message || 'No error message provided.'}`);
      return null;
    }
  } catch (error: unknown) {
    // Log any other fetch/processing errors
    const message = error instanceof Error ? error.message : 'Unknown error during fetchPlaceDetails';
    console.error(`Failed to fetch details for ${placeId}:`, message, error);
    return null;
  }
}


// --- Initialize Gemini AI Client ---
const apiKeyGemini = import.meta.env.VITE_GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;
if (apiKeyGemini) {
  genAI = new GoogleGenerativeAI(apiKeyGemini);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
} else {
  console.error("Gemini API Key is missing!");
}

// --- Custom Toast Renderer (Keep or move to a UI utils file) ---
const renderClosableToast = (message: string, toastInstance: Toast, type: 'success' | 'error' = 'success') => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
    <span style={{ marginRight: '10px' }}>{message}</span>
    <button onClick={() => toast.dismiss(toastInstance.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1em', lineHeight: '1', padding: '0 4px', color: type === 'error' ? '#DC2626' : '#10B981' }} aria-label="Close" > &times; </button>
  </div>
);


export function useCoffeeSearch(
  userLocation: { lat: number; lng: number } | null,
  currentMapCenter: { lat: number; lng: number }
) {
  const [isLoading, setIsLoading] = useState(false); // General loading for map view
  const [isGenerating, setIsGenerating] = useState(false); // AI specific loading state
  const [searchResults, setSearchResults] = useState<CoffeeShop[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapCenterToUpdate, setMapCenterToUpdate] = useState<{ lat: number; lng: number } | null>(null); // To signal App to update map center

  const performSearch = useCallback(async (prompt: string, triggerViewSwitch: () => void) => {
    if (!prompt.trim()) {
      toast.error((t) => renderClosableToast("Please enter what you're looking for.", t, 'error'));
      return;
    }
    if (!model) {
      toast.error((t) => renderClosableToast("AI assistant is not available right now.", t, 'error'));
      return;
    }

    setIsGenerating(true);
    setIsLoading(true);
    setSearchError(null);
    setSearchResults([]); // Clear previous results
    setMapCenterToUpdate(null); // Reset map center update signal
    let loadingToastId: string | undefined = undefined;
    // let aiResponseRelated = false; // Removed unused variable

    // --- Define handleKeywordSearch internally to access hook state ---
    const handleKeywordSearchInternal = async ( keyword: string, requestedCount: number | null, aiFilters: AiFilters | null, internalLoadingToastId: string | undefined ) => {
      // No need to set loading states here, already set by performSearch
      // No need to clear selectedLocation (hook doesn't manage it)
      // No need to clear coffeeShops (using setSearchResults)

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        toast.error((t) => renderClosableToast("Google Maps API Key is missing!", t, 'error'), { id: internalLoadingToastId });
        setSearchError("Google Maps API Key is missing!"); // Set error state
        // No return here, finally block will handle loading state reset
        throw new Error("Google Maps API Key is missing!"); // Throw to be caught by outer try/catch
      }

      let candidateShops: PlaceResult[] = [];
      const searchLocation = userLocation ?? currentMapCenter;
      const lat = searchLocation.lat;
      const lng = searchLocation.lng;
      const requestedRadiusKm = aiFilters?.distanceKm ?? null;
      // Use the proxy path defined in vite.config.ts or netlify.toml
      const searchApiUrl = `/maps-api/place/textsearch/json?query=${encodeURIComponent(keyword)}&location=${lat},${lng}&type=cafe`;

      try {
        const response = await fetch(searchApiUrl);
        if (!response.ok) throw new Error(`Search API HTTP error! status: ${response.status}`);
        const data: PlacesNearbyResponse = await response.json();
        if (data.status === 'OK') {
          candidateShops = data.results;
        } else if (data.status === 'ZERO_RESULTS') {
          toast.success((t) => renderClosableToast(`No initial results found for "${keyword}".`, t), { id: internalLoadingToastId });
          // Set empty results, don't throw error
          setSearchResults([]);
          return; // Exit keyword search successfully but with no results
        } else {
          throw new Error(`Places API Error: ${data.status} - ${data.error_message || ''}`);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown search error';
        console.error('Initial search failed:', error);
        toast.error((t) => renderClosableToast(`Initial search error: ${message}`, t, 'error'), { id: internalLoadingToastId });
        setSearchError(`Initial search error: ${message}`);
        throw error; // Re-throw to be caught by outer try/catch
      }

      let processedShops: CoffeeShop[] = [];
      const detailFieldsToFetch: string[] = [];
      if (aiFilters?.wifi) { detailFieldsToFetch.push(...WIFI_HINT_FIELDS.split(',')); detailFieldsToFetch.push('wifi'); }
      if (aiFilters?.charging) { detailFieldsToFetch.push(...CHARGING_HINT_FIELDS.split(',')); detailFieldsToFetch.push('charging'); }
      if (aiFilters?.pets) { detailFieldsToFetch.push(...PETS_HINT_FIELDS.split(',')); detailFieldsToFetch.push('pets'); }
      if (aiFilters?.menuItem) { detailFieldsToFetch.push(...MENU_HINT_FIELDS.split(',')); }

      // This try/catch handles the details fetching and filtering part
      try {
        toast.loading('Fetching details for filtering...', { id: internalLoadingToastId });
        const detailPromises = candidateShops.map(candidate => fetchPlaceDetails(candidate.place_id, detailFieldsToFetch));
        const detailedResults = await Promise.all(detailPromises);
        processedShops = detailedResults.filter((shop): shop is CoffeeShop => shop !== null);

        // Apply criteria filters (excluding openNow initially)
        const criteriaFilteredShops = aiFilters ? filterShopsByCriteria(processedShops, aiFilters, false) : processedShops;

        // Apply openNow filter if requested
        let openNowFilteredShops = criteriaFilteredShops;
        if (aiFilters?.openNow === true) {
          openNowFilteredShops = criteriaFilteredShops.filter(shop => isShopOpenNow(shop) === true);
        }

        // Apply distance filter
        let distanceFilteredShops = openNowFilteredShops;
        if (requestedRadiusKm !== null) {
          distanceFilteredShops = openNowFilteredShops.filter(shop => {
            if (shop.lat && shop.lng) {
              const distance = getDistanceFromLatLonInKm(lat, lng, shop.lat, shop.lng);
              return distance <= requestedRadiusKm!;
            }
            return false;
          });
          if (openNowFilteredShops.length > 0 && distanceFilteredShops.length < openNowFilteredShops.length) {
            toast.success((t) => renderClosableToast(`Filtered results to within ${requestedRadiusKm}km.`, t));
          }
        }

        // Apply rating filter
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

        // Fallback logic if 'openNow' yielded no results but other criteria did
        if (aiFilters?.openNow === true && finalShopsToDisplay.length === 0 && criteriaFilteredShops.length > 0) {
          // Re-apply distance and rating filters to the *criteriaFilteredShops* (which weren't filtered by openNow)
          let fallbackDistanceFiltered = criteriaFilteredShops;
          if (requestedRadiusKm !== null) {
             fallbackDistanceFiltered = criteriaFilteredShops.filter(shop => { if (shop.lat && shop.lng) { const distance = getDistanceFromLatLonInKm(lat, lng, shop.lat, shop.lng); return distance <= requestedRadiusKm!; } return false; });
          }
          let fallbackRatingFiltered = fallbackDistanceFiltered;
          if (minRating !== null) {
             fallbackRatingFiltered = fallbackDistanceFiltered.filter(shop => shop.rating !== undefined && shop.rating >= minRating);
          }

          if (fallbackRatingFiltered.length > 0) {
            finalShopsToDisplay = fallbackRatingFiltered;
            fallbackMessage = "I couldn’t find an exact match for shops open right now, but based on nearby coffee shops, here are a few recommendations you might like:";
            toast.success((t) => renderClosableToast(fallbackMessage!, t), { id: internalLoadingToastId });
          } else {
            // No fallback results either
            toast.success((t) => renderClosableToast("No shops matched all criteria.", t), { id: internalLoadingToastId });
          }
        } else if (finalShopsToDisplay.length === 0 && candidateShops.length > 0) {
          // Had initial candidates, but filtering removed them all
          toast.success((t) => renderClosableToast("No shops matched all criteria after filtering.", t), { id: internalLoadingToastId });
        } else if (!fallbackMessage && finalShopsToDisplay.length > 0) {
           // Found results without needing fallback
           toast.success((t) => renderClosableToast(`Found ${finalShopsToDisplay.length} shop(s).`, t), { id: internalLoadingToastId });
        } else if (finalShopsToDisplay.length === 0 && candidateShops.length === 0) {
            // Already handled ZERO_RESULTS case earlier, this shouldn't be hit often
             toast.success((t) => renderClosableToast(`No results found for "${keyword}".`, t), { id: internalLoadingToastId });
        }


        // Apply requested count limit
        const countFilteredShops = requestedCount !== null && requestedCount < finalShopsToDisplay.length
          ? finalShopsToDisplay.slice(0, requestedCount)
          : finalShopsToDisplay;

        setSearchResults(countFilteredShops); // Update hook state

        // Signal App to update map center if results were found
        if (countFilteredShops.length > 0 && countFilteredShops[0].lat && countFilteredShops[0].lng) {
          setMapCenterToUpdate({ lat: countFilteredShops[0].lat, lng: countFilteredShops[0].lng });
        }

        // Social vibe toast (moved to finally block of outer function)

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown processing error';
        console.error('Error processing search details/filtering:', error);
        toast.error((t) => renderClosableToast(`Search processing error: ${message}`, t, 'error'), { id: internalLoadingToastId });
        setSearchError(`Search processing error: ${message}`);
        throw error; // Re-throw to be caught by outer try/catch
      }
       // No finally block needed here for loading states, handled by outer function
    };
    // --- End of handleKeywordSearchInternal ---


    // --- Main logic of performSearch (formerly handleAiSearch) ---
    try {
      const structuredPrompt = `Analyze the user request: "${prompt}" for finding coffee shops/cafes.
      Your response MUST be ONLY a JSON object. Do NOT include any text before or after the JSON object, including markdown formatting like \`\`\`json.
      The JSON object MUST strictly follow ONE of these two formats EXACTLY:

      1. If related to finding coffee shops:
         {"related": true, "keywords": "...", "count": num|null, "filters": {"openAfter": "HH:MM"|null, "openNow": bool|null, "wifi": bool|null, "charging": bool|null, "pets": bool|null, "menuItem": "string"|null, "quality": "string"|null, "distanceKm": num|null, "minRating": num|null, "socialVibe": bool|null}|null}
         - "related" MUST be true.
         - "keywords" MUST be a non-empty string containing relevant search terms (e.g., "quiet cafe Paris", "coffee near me Berlin", "latte Rome"). Include location if mentioned.
         - "count" is the number of results requested (e.g., "5 cafes") or null.
         - "filters" is an object containing boolean/string/number values for extracted criteria, or null if no filters. All filter keys MUST be included, set to null if not applicable.
         - **Filters Details:**
           - "openAfter": Time in HH:MM (24h) format (e.g., "21:00" for "late night") or null.
           - "openNow": true if user asks for places open now/currently, otherwise null.
           - "wifi", "charging", "pets": true if mentioned, otherwise null.
           - "menuItem": Specific item like "latte", "croissant", or null.
           - "quality": Terms like "best", "good", "quiet", or null.
           - "distanceKm": Numeric distance in KM (convert miles if needed, 1 mile = 1.60934 km) or null.
           - "minRating": Numeric rating (e.g., 4.0, 4.5) or null.
           - "socialVibe": true if query implies trendy, popular, aesthetic, "pretty girls", etc., otherwise null.

      2. If unrelated to finding coffee shops:
         {"related": false, "message": "...", "suggestion": "..."|null}
         - "related" MUST be false.
         - "message" MUST be a non-empty string explaining the app's purpose.
         - "suggestion" can be a relevant query suggestion string or null.

      Ensure the output is ONLY the JSON object, starting with { and ending with }.`;

      loadingToastId = toast.loading("Asking AI assistant...");
      const result = await model.generateContent(structuredPrompt);
      const response = await result.response;
      const rawJsonResponse = response.text().trim();
      let parsedResponse: AiResponse | null = null;

      try {
        parsedResponse = JSON.parse(rawJsonResponse);
        // Basic validation
        if (typeof parsedResponse?.related !== 'boolean') throw new Error("Invalid JSON: 'related' field missing or not boolean.");
        if (parsedResponse.related === true && (typeof parsedResponse.keywords !== 'string' || !parsedResponse.keywords.trim())) throw new Error("Invalid JSON: Missing or empty 'keywords'.");
        if (parsedResponse.related === false && (typeof parsedResponse.message !== 'string' || !parsedResponse.message.trim())) throw new Error("Invalid JSON: Missing or empty 'message'.");
      } catch (parseError: unknown) {
         console.warn("Direct JSON parsing failed, trying markdown extraction. Raw:", rawJsonResponse);
         try {
             const jsonMatch = rawJsonResponse.match(/```json\s*([\s\S]*?)\s*```/);
             if (jsonMatch && jsonMatch[1]) {
                 parsedResponse = JSON.parse(jsonMatch[1]);
                 // Re-validate
                 if (typeof parsedResponse?.related !== 'boolean') throw new Error("Invalid JSON (markdown): 'related' field missing or not boolean.");
                 if (parsedResponse.related === true && (typeof parsedResponse.keywords !== 'string' || !parsedResponse.keywords.trim())) throw new Error("Invalid JSON (markdown): Missing or empty 'keywords'.");
                 if (parsedResponse.related === false && (typeof parsedResponse.message !== 'string' || !parsedResponse.message.trim())) throw new Error("Invalid JSON (markdown): Missing or empty 'message'.");
             } else {
                  const message = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
                  throw new Error(`No valid JSON found. Parse Error: ${message}`);
             }
         } catch (fallbackParseError: unknown) {
              const fallbackMessage = fallbackParseError instanceof Error ? fallbackParseError.message : 'Unknown fallback parsing error';
              console.error("Fallback JSON extraction failed:", fallbackMessage, "Raw:", rawJsonResponse);
              throw new Error(`AI response error: ${fallbackMessage}`); // Throw to be caught by outer try/catch
         }
      }

      // Proceed with validated parsedResponse
      if (parsedResponse.related === true) {
        // aiResponseRelated = true; // Removed unused assignment
        const { keywords, count, filters } = parsedResponse;
        if (keywords.trim()) {
          let searchMessage = `Searching for ${keywords.trim()}`;
          if (filters?.openNow) searchMessage += " (open now)";
          // Update toast message
          toast.loading(searchMessage, { id: loadingToastId });
          // Call the internal keyword search logic
          await handleKeywordSearchInternal(keywords.trim(), count, filters, loadingToastId);
          triggerViewSwitch(); // Call the callback to switch view in App.tsx

          // Show social vibe toast if applicable *after* results are set
          if (filters?.socialVibe === true && searchResults.length > 0) { // Check searchResults state
             toast.success((t) => renderClosableToast("These cafés are known for their aesthetic vibe and social crowd — perfect if you're looking to enjoy a drink in a lively, stylish atmosphere 😎", t));
          }

        } else {
          // AI related but no keywords? Treat as error.
          throw new Error("AI didn't provide keywords.");
        }
      } else {
        // AI response is not related to coffee shop search
        const { message } = parsedResponse;
        toast.error((t) => renderClosableToast(message, t, 'error'), { id: loadingToastId, duration: 5000 });
        // No search results to set, error state is null, loading will be reset in finally
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown AI/Search error';
      console.error("Error during AI processing or keyword search:", error);
      toast.error((t) => renderClosableToast(`Error: ${message}`, t, 'error'), { id: loadingToastId });
      setSearchError(message); // Set error state in the hook
    } finally {
      // Always reset loading states, regardless of success or failure
      // Reset only if AI response wasn't related OR if it was related but resulted in an error handled above.
      // If AI was related and handleKeywordSearchInternal completed (even with 0 results), it manages its own state.
      // The isLoading/isGenerating should reflect the *entire* operation.
       setIsGenerating(false);
       setIsLoading(false);
    }

  }, [userLocation, currentMapCenter, setSearchResults, setIsLoading, setIsGenerating, setSearchError, setMapCenterToUpdate]); // Add state setters to dependencies

  // Explicitly type the returned performSearch function
  const typedPerformSearch: (prompt: string, triggerViewSwitch: () => void) => Promise<void> = performSearch;

  return {
    isLoading,
    isGenerating,
    searchResults,
    searchError,
    mapCenterToUpdate,
    performSearch: typedPerformSearch, // Return the explicitly typed function
    setMapCenterToUpdate // Allow App to reset the update signal
  };
}

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

    // 3. Amenity Filters (Pets only for now)
    // Filtering by wifi/chargers needs to happen after fetching details from related tables,
    // or by querying aggregated data if available in the main 'locations' table later.
    // if (filters.wifi_required === true && shop.has_wifi !== true) return false;
    // if (filters.power_outlets_required === true && shop.has_chargers !== true) return false;
    if (filters.pets === true && shop.pet_friendly !== true) return false; // Keep pets filter if applicable

    // TODO: Add filtering for menu_items, quality, vibe etc. based on available data

    return true; // Shop passes all applicable filters
  });
};


// --- Constants for Place Details Fetching ---
const BASE_DETAIL_FIELDS = 'place_id,name,geometry,formatted_address,rating,opening_hours,price_level'; // Removed unsupported utc_offset_minutes
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
      // --- Remove Supabase query for columns not in 'locations' table ---
      // The following query was causing errors because has_wifi, etc. are not in the locations table.
      // We will handle fetching related data (like wifi details) separately later.
      /*
      let dbData: Partial<CoffeeShop> | null = null;
      let dbError: unknown = null;
      if (supabase && supabase.from) {
        try {
            const { data: fetchedDbData, error: fetchDbError } = await supabase
            .from('locations')
            .select('has_wifi, has_chargers, charger_count, pet_friendly')
            .eq('id', details.place_id)
            .maybeSingle();
            dbData = fetchedDbData;
            dbError = fetchDbError;
            if (dbError && typeof dbError === 'object' && dbError !== null && 'code' in dbError && (dbError as { code: string }).code !== 'PGRST116') {
               console.error(`Supabase query error for ${details.place_id}:`, dbError);
            }
        } catch (supabaseQueryError) {
             console.error(`Supabase query exception for ${details.place_id}:`, supabaseQueryError);
             dbError = supabaseQueryError;
        }
      } else {
          console.warn(`Supabase client not available, skipping DB query for ${details.place_id}`);
      }
      */

      // Construct the CoffeeShop object using only Google Places data for now
      const coffeeShopData: CoffeeShop = {
        id: details.place_id,
        name: details.name || 'N/A', // Provide default if name is missing
        lat: details.geometry?.location.lat,
        lng: details.geometry?.location.lng,
        address: details.formatted_address || 'Address not available',
        rating: details.rating,
        opening_hours: details.opening_hours,
        utc_offset_minutes: details.utc_offset_minutes,
        // --- Set related fields to undefined/default for now ---
        has_wifi: undefined, // Set to undefined as we are not fetching it here
        pet_friendly: undefined, // Set to undefined
        has_chargers: undefined, // Set to undefined
        charger_count: undefined, // Set to undefined
        // --- Other details from Google ---
        price_range: details.price_level?.toString(),
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

  const performSearch = useCallback(async (prompt: string, triggerViewSwitch: () => void = () => {}) => {
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
      // Use updated filter names to decide which hint fields to add
      if (aiFilters?.wifi_required) { detailFieldsToFetch.push(...WIFI_HINT_FIELDS.split(',')); detailFieldsToFetch.push('wifi'); }
      if (aiFilters?.power_outlets_required) { detailFieldsToFetch.push(...CHARGING_HINT_FIELDS.split(',')); detailFieldsToFetch.push('charging'); }
      if (aiFilters?.pets) { detailFieldsToFetch.push(...PETS_HINT_FIELDS.split(',')); detailFieldsToFetch.push('pets'); }
      if (aiFilters?.menu_items && aiFilters.menu_items.length > 0) { detailFieldsToFetch.push(...MENU_HINT_FIELDS.split(',')); } // Check menu_items

      // This try/catch handles the details fetching and filtering part
      try {
        toast.loading(`Fetching details for top ${Math.min(candidateShops.length, 10)} results...`, { id: internalLoadingToastId });
        // --- Limit detail fetches to the first 10 candidates ---
        const candidatesToFetchDetails = candidateShops.slice(0, 10);
        const detailPromises = candidatesToFetchDetails.map(candidate => fetchPlaceDetails(candidate.place_id, detailFieldsToFetch));
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

        // Signal App to update map center based on the *filtered* results from the fetched details
        if (countFilteredShops.length > 0 && countFilteredShops[0].lat && countFilteredShops[0].lng) {
          setMapCenterToUpdate({ lat: countFilteredShops[0].lat, lng: countFilteredShops[0].lng });
        } else if (processedShops.length > 0 && processedShops[0].lat && processedShops[0].lng) {
           // Fallback: Center on the first processed shop if filtering removed all results but details were fetched
           setMapCenterToUpdate({ lat: processedShops[0].lat, lng: processedShops[0].lng });
        }

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


    // --- Main logic of performSearch ---
    try {
      // --- New Enhanced Prompt Template ---
      const structuredPrompt = `Analyze the user's request for finding coffee shops based on the following criteria. Your response MUST be ONLY a JSON object, without any markdown formatting (like \`\`\`json) or surrounding text.

User Request: "${prompt}"

Current Location Context (Optional, provide if available): ${userLocation ? `{ "latitude": ${userLocation.lat}, "longitude": ${userLocation.lng} }` : null}

Available Filter Criteria & Mapping:
- Location: City, district, or general area (e.g., "信義區", "Taipei", "near me"). Extract as \`location_term\`.
- Time Limit: "不限時" (no time limit). Map to \`no_time_limit: true\`.
- Wi-Fi: "WiFi 快", "有 WiFi". Map to \`wifi_required: true\`. If speed mentioned (e.g., "快", "穩定"), map to \`wifi_quality_min: 4\` (assuming a 1-5 scale later).
- Power Outlets: "有插座", "charging". Map to \`power_outlets_required: true\`.
- Price: "便宜", "cheap", "budget". Map to \`price_tier: 'cheap'\`. "中價位" -> \`price_tier: 'mid'\`. "高檔" -> \`price_tier: 'high'\`.
- Vibe/Atmosphere: "安靜", "quiet", "適合工作". Map to \`vibe: 'quiet'\`. "適合聊天", "lively" -> \`vibe: 'social'\`. "一個人" -> \`vibe: 'solo'\`. "有桌燈" -> \`amenities: ['desk_lamp']\` (example of specific amenity tag).
- Coffee Quality: "咖啡好喝", "good coffee". Map to \`coffee_quality_min: 4\`.
- Specific Items: "latte", "croissant". Map to \`menu_items: ["latte", "croissant"]\`.
- Result Count: "5家", "a few". Extract as \`limit: 5\` or a reasonable default like 10.

Output Format (JSON Object ONLY):
{
  "query_type": "find_cafe" | "unrelated" | "clarification_needed",
  "filters": {
    "location_term": string | null,
    "no_time_limit": boolean | null,
    "wifi_required": boolean | null,
    "wifi_quality_min": number | null,
    "power_outlets_required": boolean | null,
    "price_tier": "cheap" | "mid" | "high" | null,
    "vibe": "quiet" | "social" | "solo" | null,
    "amenities": string[] | null,
    "coffee_quality_min": number | null,
    "menu_items": string[] | null
  } | null,
  "limit": number | null,
  "explanation": string | null // For clarification or unrelated messages
}

Instructions:
- If the query is unrelated to finding coffee shops, set \`query_type\` to "unrelated", \`filters\` to null, and provide an explanation.
- If the query is ambiguous and needs clarification, set \`query_type\` to "clarification_needed", \`filters\` to null, and provide the clarification question in \`explanation\`.
- If a criterion is not mentioned, set its corresponding filter value to \`null\`.
- For "near me" location, set \`location_term\` to "near me" and rely on the provided latitude/longitude.
- Be strict with the JSON format. Only output the JSON object.`;
      // --- End of Enhanced Prompt Template ---

      loadingToastId = toast.loading("Asking AI assistant...");
      const result = await model.generateContent(structuredPrompt);
      const response = await result.response;
      const rawJsonResponse = response.text().trim();
      // --- New Parsing Logic for Structured Response ---
      let parsedResponse: { // Define expected structure inline or import from types
        query_type: "find_cafe" | "unrelated" | "clarification_needed";
        filters: AiFilters | null;
        limit: number | null;
        explanation: string | null;
      } | null = null;

      try {
        parsedResponse = JSON.parse(rawJsonResponse);
        // Add more robust validation based on the new structure if needed
        if (!parsedResponse || !parsedResponse.query_type) {
           throw new Error("Invalid JSON structure received from AI.");
        }
      } catch (parseError: unknown) {
         console.warn("Direct JSON parsing failed, trying markdown extraction. Raw:", rawJsonResponse);
         // Fallback extraction logic remains similar...
         try {
             const jsonMatch = rawJsonResponse.match(/```json\s*([\s\S]*?)\s*```/);
             if (jsonMatch && jsonMatch[1]) {
                 parsedResponse = JSON.parse(jsonMatch[1]);
                 // Re-validate
                 if (!parsedResponse || !parsedResponse.query_type) {
                    throw new Error("Invalid JSON structure (markdown) received from AI.");
                 }
             } else {
                  const message = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
                  throw new Error(`No valid JSON found. Parse Error: ${message}`);
             }
         } catch (fallbackParseError: unknown) {
              const fallbackMessage = fallbackParseError instanceof Error ? fallbackParseError.message : 'Unknown fallback parsing error';
              console.error("Fallback JSON extraction failed:", fallbackMessage, "Raw:", rawJsonResponse);
              throw new Error(`AI response error: ${fallbackMessage}`);
         }
      }
      // --- End New Parsing Logic ---

      // --- Handle different query types ---
      if (parsedResponse.query_type === "find_cafe" && parsedResponse.filters) {
        const { filters, limit } = parsedResponse;
        // Construct a descriptive search message based on filters
        let searchMessage = "Searching for coffee shops";
        if (filters.location_term && filters.location_term !== "near me") {
           searchMessage += ` in ${filters.location_term}`;
        } else if (filters.location_term === "near me") {
           searchMessage += " near you";
        }
        // Add more filter descriptions to the message if desired...
        toast.loading(searchMessage, { id: loadingToastId });

        // Call the internal keyword search logic, passing the structured filters
        // Refine keyword for Google Places search if needed
        let googleSearchKeyword = filters.location_term || "coffee shop"; // Default
        // If filters indicate amenities but location_term is generic or missing, add context
        if ((filters.wifi_required || filters.power_outlets_required || filters.menu_items?.length) && (!filters.location_term || ["wifi", "outlet", "charging", "power", "sockets"].includes(filters.location_term.toLowerCase()))) {
            googleSearchKeyword = `coffee shop ${filters.location_term || ''}`.trim(); // Append "coffee shop"
        }

        // Pass the potentially refined keyword and structured filters
        await handleKeywordSearchInternal(
            googleSearchKeyword,
            limit, // Pass the limit extracted by AI
            filters, // Pass the full filters object for detailed filtering
            loadingToastId
        );
        triggerViewSwitch(); // Call the callback to switch view in App.tsx

        // Show social vibe toast if applicable *after* results are set
        if (filters?.socialVibe === true && searchResults.length > 0) {
           toast.success((t) => renderClosableToast("These cafés are known for their aesthetic vibe and social crowd — perfect if you're looking to enjoy a drink in a lively, stylish atmosphere 😎", t));
        }

      } else if (parsedResponse.query_type === "clarification_needed") {
         toast.error((t) => renderClosableToast(`AI needs clarification: ${parsedResponse.explanation || 'Please refine your search.'}`, t, 'error'), { id: loadingToastId, duration: 6000 });
         setSearchError(parsedResponse.explanation || 'Ambiguous query.'); // Set error state
      } else { // Includes "unrelated" or potential errors
         const message = parsedResponse.explanation || "Sorry, I can only help with finding coffee shops.";
         toast.error((t) => renderClosableToast(message, t, 'error'), { id: loadingToastId, duration: 5000 });
         setSearchError(message); // Set error state
      }
      // --- End Handling Query Types ---

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown AI processing error';
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

  // Explicitly type the returned performSearch function with optional second argument
  const typedPerformSearch: (prompt: string, triggerViewSwitch?: () => void) => Promise<void> = performSearch;

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

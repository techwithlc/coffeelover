import React, { useState, useCallback } from 'react'; // Import React for JSX
// Import necessary types, including PlaceDetailsResult
import { CoffeeShop, OpeningHoursPeriod, AiFilters, PlaceResult, PlaceDetailsResponse, PlacesNearbyResponse, PlaceDetailsResult } from '../lib/types'; // Removed unused AiResponse
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
const BASE_DETAIL_FIELDS = 'place_id,name,geometry,formatted_address,rating,opening_hours,price_level,photos'; // Added photos
const WIFI_HINT_FIELDS = 'website,editorial_summary'; // Fields that *might* contain wifi info
const PETS_HINT_FIELDS = 'website,editorial_summary'; // Fields that *might* contain pet info
const CHARGING_HINT_FIELDS = 'website,editorial_summary'; // Fields that *might* contain charging info
const MENU_HINT_FIELDS = 'website,reviews'; // Fields that *might* contain menu info


// --- Helper Function for Fetching Place Details & Upserting to Supabase ---
async function fetchAndUpsertPlaceDetails(googlePlaceId: string, requiredFields: string[]): Promise<CoffeeShop | null> {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!googleApiKey) {
    console.error("Missing Google Maps API Key for Place Details fetch.");
    return null;
  }

  // Check if Supabase client seems valid before querying DB
  if (!supabase || !supabase.from) {
      console.error("Supabase client not initialized correctly in fetchAndUpsertPlaceDetails.");
      return null; // Cannot proceed without Supabase client
  }

  // Determine all fields needed for the Google Places API call
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
  const apiUrl = `/maps-api/place/details/json?place_id=${googlePlaceId}&fields=${uniqueFields}`; // Use googlePlaceId

  let googleDetails: PlaceDetailsResult | null = null;
  let apiError: Error | null = null;

  // 1. Fetch details from Google Places API via proxy
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Place Details API HTTP error! Status: ${response.status}, URL: ${apiUrl}, Body: ${errorBody}`);
      throw new Error(`Place Details API HTTP error! status: ${response.status}`);
    }
    const data: PlaceDetailsResponse = await response.json();
    if (data.status === 'OK' && data.result) {
      googleDetails = data.result;
    } else {
      console.error(`Place Details API Error for ${googlePlaceId}: ${data.status} - ${data.error_message || 'No error message provided.'}`);
      apiError = new Error(`Google Places API Error: ${data.status}`);
      // Don't return null yet, try finding in DB first
    }
  } catch (error) {
    apiError = error instanceof Error ? error : new Error('Unknown error fetching Google details');
    console.error(`Failed to fetch Google details for ${googlePlaceId}:`, apiError.message);
    // Don't return null yet, try finding in DB first
  }

  // 2. Check if location exists in Supabase 'locations' table by google_place_id
  try {
    const { data: existingLocationData, error: selectError } = await supabase
      .from('locations')
      .select('*') // Select all columns including the UUID 'id'
      .eq('google_place_id', googlePlaceId)
      .maybeSingle();

    if (selectError) {
      console.error(`Error checking Supabase for ${googlePlaceId}:`, selectError);
      // If Google fetch also failed, return null. Otherwise, proceed to insert.
      if (apiError) return null;
    }

    // 3a. If location exists in Supabase, return it (map to CoffeeShop type)
    if (existingLocationData) {
      // Map Supabase row to CoffeeShop type (ensure all fields match)
      // We need to explicitly cast because Supabase returns generic Row type
      const existingLocation = existingLocationData as CoffeeShop; // Assuming DB schema matches CoffeeShop type well enough
      return {
        ...existingLocation,
        // Ensure required fields from CoffeeShop type are present and merge/prioritize
        id: existingLocation.id, // Use the Supabase UUID
        google_place_id: existingLocation.google_place_id,
        name: existingLocation.name || googleDetails?.name || 'N/A', // Use DB name, fallback to Google or N/A
        address: existingLocation.address || googleDetails?.formatted_address,
        lat: existingLocation.lat || googleDetails?.geometry?.location.lat,
        lng: existingLocation.lng || googleDetails?.geometry?.location.lng,
        rating: existingLocation.rating || googleDetails?.rating,
        // Merge opening hours if needed, or prioritize one source (e.g., Google's)
        opening_hours: googleDetails?.opening_hours || existingLocation.opening_hours,
        utc_offset_minutes: googleDetails?.utc_offset_minutes || existingLocation.utc_offset_minutes,
        price_range: existingLocation.price_range || googleDetails?.price_level?.toString(),
        description: existingLocation.description || googleDetails?.editorial_summary?.overview,
        // Keep user-contributed fields from DB if they exist
        has_wifi: existingLocation.has_wifi,
        has_chargers: existingLocation.has_chargers,
        charger_count: existingLocation.charger_count,
        pet_friendly: existingLocation.pet_friendly,
        menu_highlights: existingLocation.menu_highlights || [],
        // Prioritize Google photos if available, otherwise use DB photos
        images: googleDetails?.photos?.map(p => p.photo_reference) || existingLocation.images || [],
        created_at: existingLocation.created_at,
        updated_at: existingLocation.updated_at,
      };
    }

    // 3b. If location doesn't exist AND Google fetch succeeded, insert it
    if (!existingLocationData && googleDetails) {
      // Get the current user ID to satisfy RLS policy
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("User not authenticated. Cannot insert location.");
        // Potentially show a toast message to the user here
        return null; // Cannot insert without a user ID
      }
      // Correct placement for the end of the if(!user) block is implicitly handled by the code flow continuing

      const userId = user.id;
      // Debugging logs removed

      const { data: newLocationData, error: insertError } = await supabase
        .from('locations')
        .insert({
          google_place_id: googlePlaceId,
          name: googleDetails.name || 'N/A',
          address: googleDetails.formatted_address, // Use 'address' which likely matches the DB column
          lat: googleDetails.geometry?.location.lat,
          lng: googleDetails.geometry?.location.lng,
          rating: googleDetails.rating,
          user_id: userId, // Include the user ID
          // Add other relevant fields from googleDetails if they exist in your 'locations' table
          // price_level: googleDetails.price_level, // Example
          // description: googleDetails.editorial_summary?.overview, // Example
        })
        .select('*') // Select the newly inserted row including the generated UUID 'id'
        .single();

      if (insertError) {
        console.error(`Error inserting new location ${googlePlaceId} into Supabase:`, insertError);
        return null; // Failed to insert
      }

      if (newLocationData) {
         // Map the newly inserted Supabase row to CoffeeShop type
         const newLocation = newLocationData as CoffeeShop; // Cast needed
         return {
            ...newLocation,
            // Ensure required fields are present, potentially adding defaults from Google
            id: newLocation.id, // Use the new Supabase UUID
            google_place_id: newLocation.google_place_id,
            opening_hours: googleDetails.opening_hours, // Add opening hours from Google
            utc_offset_minutes: googleDetails.utc_offset_minutes, // Add offset from Google
            price_range: googleDetails.price_level?.toString(), // Add price from Google
            description: googleDetails.editorial_summary?.overview, // Add description from Google
            // Set user-contributed fields to undefined initially
            has_wifi: undefined,
            has_chargers: undefined,
            charger_count: undefined,
            pet_friendly: undefined, // Could try basic text analysis on description later
            menu_highlights: [], // Default empty
            // Store photo references from Google details
            images: googleDetails.photos?.map(p => p.photo_reference) || [],
         };
      }
    }

    // If location doesn't exist and Google fetch failed, return null
    if (!existingLocationData && !googleDetails) {
       console.error(`Failed to fetch from Google and location not in DB for ${googlePlaceId}`);
       return null;
    }

    return null; // Should not be reached, but acts as a fallback

  } catch (error) {
    console.error(`General error in fetchAndUpsertPlaceDetails for ${googlePlaceId}:`, error);
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

// --- Helper function to validate and normalize location terms ---
const normalizeLocationTerm = (locationTerm: string | null): string | null => {
  if (!locationTerm || locationTerm === "near me") {
    return locationTerm;
  }
  
  // Common geographic locations that might be confused with business names
  const knownLocations = [
    // US Cities
    "new york", "nyc", "manhattan", "brooklyn", "queens", "bronx", "staten island",
    "los angeles", "la", "san francisco", "sf", "chicago", "houston", "phoenix",
    "philadelphia", "san antonio", "san diego", "dallas", "san jose", "austin",
    "seattle", "denver", "washington dc", "boston", "miami", "atlanta",
    
    // International Cities
    "london", "paris", "tokyo", "seoul", "beijing", "shanghai", "hong kong",
    "singapore", "sydney", "melbourne", "toronto", "vancouver", "montreal",
    
    // Taiwan Cities/Districts
    "taipei", "台北", "taichung", "台中", "tainan", "台南", "kaohsiung", "高雄",
    "xinyi", "信義區", "daan", "大安區", "zhongshan", "中山區", "songshan", "松山區"
  ];
  
  const normalized = locationTerm.toLowerCase().trim();
  
  // Check if it's a known geographic location
  if (knownLocations.some(loc => normalized.includes(loc) || loc.includes(normalized))) {
    return locationTerm; // Keep as is if it's a known location
  }
  
  // If it contains common business name patterns, be more cautious
  const businessPatterns = [
    "coffee", "café", "cafe", "roasters", "brewing", "espresso", "beans",
    "starbucks", "dunkin", "peet's", "blue bottle", "intelligentsia"
  ];
  
  if (businessPatterns.some(pattern => normalized.includes(pattern))) {
    console.warn(`Location term "${locationTerm}" might be a business name, treating as generic search`);
    return "near me"; // Fallback to location-based search
  }
  
  return locationTerm; // Return as is if it passes validation
};

// --- End Helper Function ---

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
      let searchApiUrl = `/maps-api/place/textsearch/json?query=${encodeURIComponent(keyword)}&type=cafe`;

      // Location bias strategy:
      // 1. If location_term is a specific place (not "near me"), rely on text search without coordinate bias
      // 2. If location_term is "near me" or null, use coordinate bias for local search
      // 3. Add radius only for coordinate-based searches
      if (!aiFilters?.location_term || aiFilters.location_term === "near me") {
        // Use coordinate-based search with location bias
        searchApiUrl += `&location=${lat},${lng}`;
        
        // Add radius for coordinate-based searches
        const searchRadius = aiFilters?.distanceKm ? aiFilters.distanceKm * 1000 : 10000; // Default 10km
        searchApiUrl += `&radius=${searchRadius}`;
      } else {
        // For specific named locations, let Google's text search handle the location
        // Don't add coordinate bias as it might conflict with the text-based location
        console.log(`Using text-based location search for: ${aiFilters.location_term}`);
      }

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
        // --- Limit detail fetches/upserts to the first 10 candidates ---
        const candidatesToFetchDetails = candidateShops.slice(0, 10);
        // Use fetchAndUpsertPlaceDetails now
        const detailPromises = candidatesToFetchDetails.map(candidate => fetchAndUpsertPlaceDetails(candidate.place_id, detailFieldsToFetch));
        const detailedResults = await Promise.all(detailPromises);
        processedShops = detailedResults.filter((shop): shop is CoffeeShop => shop !== null); // Filter out nulls if fetch/upsert failed

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
            fallbackMessage = "I couldn't find an exact match for shops open right now, but based on nearby coffee shops, here are a few recommendations you might like:";
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
- Location: Extract GEOGRAPHIC locations only (cities, districts, neighborhoods, states, countries). Examples: "New York" (city), "Manhattan" (district), "Brooklyn" (borough), "台北" (city), "信義區" (district). 
  IMPORTANT: Distinguish between geographic locations and business names. "Budapest New York Coffee" contains "New York" as part of a business name, NOT as a geographic location.
  If the user mentions "New York" in context of finding coffee shops, treat it as New York City, USA unless context suggests otherwise.
  Extract as \`location_term\`. If no specific location mentioned, use "near me".
- Time Limit: "不限時" (no time limit). Map to \`no_time_limit: true\`.
- Wi-Fi: "WiFi 快", "有 WiFi", "fast wifi", "stable wifi". Map to \`wifi_required: true\`. If speed mentioned (e.g., "快", "穩定", "fast"), map to \`wifi_quality_min: 4\` (assuming a 1-5 scale).
- Power Outlets: "有插座", "charging", "power outlets", "plugs". Map to \`power_outlets_required: true\`.
- Price: "便宜", "cheap", "budget", "affordable". Map to \`price_tier: 'cheap'\`. "中價位", "moderate" -> \`price_tier: 'mid'\`. "高檔", "expensive", "upscale" -> \`price_tier: 'high'\`.
- Vibe/Atmosphere: "安靜", "quiet", "適合工作", "work-friendly", "study" -> \`vibe: 'quiet'\`. "適合聊天", "lively", "social", "good vibe", "aesthetic" -> \`vibe: 'social'\`. "一個人", "solo", "alone" -> \`vibe: 'solo'\`. 
- Amenities: "有桌燈", "desk lamp" -> \`amenities: ['desk_lamp']\`. "outdoor seating" -> \`amenities: ['outdoor']\`.
- Coffee Quality: "咖啡好喝", "good coffee", "quality coffee", "specialty coffee". Map to \`coffee_quality_min: 4\`.
- Specific Items: "latte", "croissant", "pastries", "food". Map to \`menu_items: ["latte", "croissant"]\`.
- Result Count: "5家", "a few", "top 5". Extract as \`limit: 5\` or reasonable default.
- Distance: "nearby", "close", "within 1km", "walking distance" -> \`distanceKm: 1\`. "far", "anywhere" -> larger radius or null.
- Open Now: "open now", "currently open", "營業中" -> \`openNow: true\`.

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
    "menu_items": string[] | null,
    "distanceKm": number | null,
    "openNow": boolean | null,
    "minRating": number | null
  } | null,
  "limit": number | null,
  "explanation": string | null
}

Instructions:
- If the query is unrelated to finding coffee shops, set \`query_type\` to "unrelated", \`filters\` to null, and provide an explanation.
- If the query is ambiguous and needs clarification, set \`query_type\` to "clarification_needed", \`filters\` to null, and provide the clarification question in \`explanation\`.
- If a criterion is not mentioned, set its corresponding filter value to \`null\`.
- For location parsing, be very careful to distinguish between geographic locations and business names.
- If a city/district is mentioned (e.g., "Find cafes in New York"), extract it as \`location_term\` (e.g., "New York").
- If only "near me" or no location is mentioned, set \`location_term\` to "near me" and rely on the provided latitude/longitude.
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
        
        // Normalize and validate the location term
        const normalizedLocationTerm = normalizeLocationTerm(filters.location_term || null);
        const normalizedFilters = { ...filters, location_term: normalizedLocationTerm };
        
        // Construct a descriptive search message based on filters
        let searchMessage = "Searching for coffee shops";
        if (normalizedLocationTerm && normalizedLocationTerm !== "near me") {
           searchMessage += ` in ${normalizedLocationTerm}`;
        } else if (normalizedLocationTerm === "near me") {
           searchMessage += " near you";
        }
        // Add more filter descriptions to the message if desired...
        toast.loading(searchMessage, { id: loadingToastId });

        // Call the internal keyword search logic, passing the structured filters
        // Refine keyword for Google Places search if needed
        let googleSearchKeyword = "coffee shop"; // Start with base term
        
        // Handle location-specific search
        if (normalizedLocationTerm && normalizedLocationTerm !== "near me") {
          // For specific locations, construct a more targeted search
          googleSearchKeyword = `coffee shop in ${normalizedLocationTerm}`;
        } else {
          // For "near me" or no location, use generic term with location bias
          googleSearchKeyword = "coffee shop";
        }
        
        // Add vibe/atmosphere context to search if specified
        if (normalizedFilters.vibe === "quiet" || normalizedFilters.vibe === "solo") {
          googleSearchKeyword += " quiet study work";
        } else if (normalizedFilters.vibe === "social") {
          googleSearchKeyword += " social trendy";
        }
        
        // Add amenity context if specified
        if (normalizedFilters.wifi_required) {
          googleSearchKeyword += " wifi";
        }
        if (normalizedFilters.power_outlets_required) {
          googleSearchKeyword += " power outlets charging";
        }

        // Pass the potentially refined keyword and structured filters
        await handleKeywordSearchInternal(
            googleSearchKeyword,
            limit, // Pass the limit extracted by AI
            normalizedFilters, // Pass the normalized filters object for detailed filtering
            loadingToastId
        );
        triggerViewSwitch(); // Call the callback to switch view in App.tsx

        // Show social vibe toast if applicable *after* results are set
        // Note: This toast will be shown in a separate effect or after state update
        // if (filters?.socialVibe === true && searchResults.length > 0) {
        //    toast.success((t) => renderClosableToast("These cafés are known for their aesthetic vibe and social crowd — perfect if you're looking to enjoy a drink in a lively, stylish atmosphere 😎", t));
        // }

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

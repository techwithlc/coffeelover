import { useState, useEffect, FormEvent, useCallback, useMemo } from 'react';

// ... (rest of the code remains the same)

// --- Helper Function for Filtering ---
// (filterShopsByCriteria remains the same, assuming data is populated)
// ... (rest of the code remains the same)

// --- Helper Function for Fetching Place Details ---
// Define fields needed based on potential filters
const BASE_DETAIL_FIELDS = 'place_id,name,geometry,vicinity,rating,formatted_address';
const HOURS_FIELD = 'opening_hours';
// Note: Wifi, pets, charging aren't direct standard fields.
// We can request fields that *might* contain hints (reviews, photos, editorial_summary)
// but parsing them is complex and unreliable. For now, we'll simulate fetching based on filters.
const WIFI_HINT_FIELDS = 'reviews,website,editorial_summary'; // Example fields that *might* hint at wifi

async function fetchPlaceDetails(placeId: string, requiredFields: string[]): Promise<CoffeeShop | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Missing Google Maps API Key for Place Details fetch.");
    return null;
  }

  // Combine base fields with required fields, removing duplicates
  const uniqueFields = Array.from(new Set([BASE_DETAIL_FIELDS, ...requiredFields])).join(',');

  const apiUrl = "/maps-api/place/details/json?place_id=" + placeId + "&fields=" + uniqueFields;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Place Details API HTTP error! status: " + response.status);
    const data: PlaceDetailsResponse = await response.json();

    if (data.status === 'OK' && data.result) {
      const details = data.result;
      // --- Simulated Data Population (Replace with real data mapping if available) ---
      // This section simulates finding wifi/pets/charging based on whether they were requested.
      // In a real app, you'd parse reviews, website, etc. or use a different data source.
      const simulatedWifi = requiredFields.includes(WIFI_HINT_FIELDS); // Simulate based on request
      const simulatedPets = requiredFields.includes('pets'); // Simulate
      const simulatedCharging = requiredFields.includes('charging'); // Simulate
      // --- End Simulation ---

      return {
        id: details.place_id,
        name: details.name || 'N/A',
        lat: details.geometry?.location.lat,
        lng: details.geometry?.location.lng,
        address: details.formatted_address || details.vicinity || 'N/A',
        rating: details.rating,
        opening_hours: details.opening_hours,
        // --- Populate based on simulation or actual parsed data ---
        wifi_available: simulatedWifi, // Use simulation for now
        pet_friendly: simulatedPets, // Use simulation for now
        charging_available: simulatedCharging, // Use simulation for now
        // --- Other fields remain undefined or need real data ---
        price_range: undefined, // Example: parse price_level if requested
        description: undefined, // Example: use editorial_summary if requested
        menu_highlights: [], // Example: parse reviews if requested
      };
    } else {
      console.error("Place Details API Error for " + placeId + ": " + data.status + " - " + (data.error_message || ''));
      return null;
    }
  } catch (error) {
    console.error("Failed to fetch details for " + placeId + ":", error);
    return null;
  }
}

function App() {
  // ... (rest of the code remains the same)

  const handlePromptSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // ... (validation checks remain the same)

    let loadingToastId: string | undefined = undefined;
    let aiResponseRelated = false;

    try {
      // Removed unused allowedLocations variable
      const promptForAI = "You understand natural language queries about finding coffee shops.";
      // ... (rest of the code remains the same)
      if (parsedResponse.related === true) {
        aiResponseRelated = true; // Mark as related to handle finally block correctly
        const { keywords, count, filters } = parsedResponse;
        if (keywords.trim()) {
          // Construct search message (logic remains the same)
          let searchMessage = "Searching for " + keywords.trim();
          if (filters?.openNow) searchMessage += " (open now)";
          if (filters?.openAfter) searchMessage += " (open after " + filters.openAfter + ")";
          // ... (rest of the code remains the same)
  // --- Main Search and Filtering Logic ---
  const handleKeywordSearch = async (
    keyword: string,
    requestedCount: number | null,
    aiFilters: AiFilters | null, // Renamed from 'filters' for clarity
    loadingToastId: string | undefined // Pass toast ID for updates
  ) => {
    setIsLoading(true); // Show general loading overlay
    setSelectedLocation(null);
    setCoffeeShops([]);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      // ... (rest of the code remains the same)
    let candidateShops: PlaceResult[] = [];
    const searchLocation = userLocation || currentMapCenter;
    const lat = searchLocation.lat;
    const lng = searchLocation.lng;
    const radius = 10000; // Increased radius for potentially more results
    const type = 'cafe'; // Stick to cafe for relevance

    // Determine if openNow parameter can be used directly in Nearby Search
    // Only use it if 'openNow' is the *only* filter or if other filters don't require details
    const useOpenNowParam = aiFilters?.openNow === true &&
      !aiFilters.openAfter &&
      !aiFilters.wifi &&
      !aiFilters.charging &&
      !aiFilters.pets &&
      !aiFilters.menuItem &&
      !aiFilters.quality;

    const nearbySearchUrl = "/maps-api/place/nearbysearch/json?location=" + lat + "," + lng + "&radius=" + radius + "&type=" + type + "&keyword=" + encodeURIComponent(keyword) + (useOpenNowParam ? '&opennow=true' : '');
    console.log("Nearby Search URL:", nearbySearchUrl); // Log the search URL
    // ... (rest of the code remains the same)
    // Step 2 & 3: Fetch Details & Filter
    let processedShops: CoffeeShop[] = [];

    // Determine precisely which details are needed based *only* on the active filters
    const detailFieldsToFetch: string[] = [];
    if (aiFilters?.openAfter || (aiFilters?.openNow && !useOpenNowParam)) {
      detailFieldsToFetch.push(HOURS_FIELD);
    }
    if (aiFilters?.wifi) {
      detailFieldsToFetch.push(WIFI_HINT_FIELDS); // Request fields that might hint at wifi
      detailFieldsToFetch.push('wifi'); // Add marker for simulation
    }
    if (aiFilters?.charging) {
      detailFieldsToFetch.push('charging'); // Add marker for simulation
    }
    if (aiFilters?.pets) {
      detailFieldsToFetch.push('pets'); // Add marker for simulation
    }
    // Add more fields if needed for menuItem, quality (e.g., reviews, website)

    const needsDetailsFetch = detailFieldsToFetch.length > 0;

    try {
      if (needsDetailsFetch) {
        // Fetch details ONLY for candidate shops
        const detailPromises = candidateShops.map(candidate => fetchPlaceDetails(candidate.place_id, detailFieldsToFetch));
        const detailedResults = await Promise.all(detailPromises);
        const validDetailedShops = detailedResults.filter(shop => shop !== null) as CoffeeShop[];

        console.log("Fetched details for " + validDetailedShops.length + " / " + candidateShops.length + " shops.");

        // Apply ALL AI filters now that we have details (or simulated details)
        processedShops = aiFilters ? filterShopsByCriteria(validDetailedShops, aiFilters) : validDetailedShops;

        // Use custom render for closable toast
        toast.success((t) => (
          <span>
            Found {processedShops.length} shop(s) after detailed check.
            <button onClick={() => toast.dismiss(t.id)} style={{ marginLeft: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
          </span>
        ), { id: loadingToastId });
      } else {
        // No details fetch needed, map basic data directly from initial search results
        processedShops = candidateShops.map(place => ({
          id: place.place_id, name: place.name,
          lat: place.geometry.location.lat, lng: place.geometry.location.lng,
          address: place.vicinity, rating: place.rating, opening_hours: undefined,
          // Initialize potentially fetchable fields as undefined
          price_range: undefined,
          wifi_available: undefined, // No details fetched
          pet_friendly: undefined, // No details fetched
          charging_available: undefined, // No details fetched
          description: undefined,
          menu_highlights: [],
        }));
        // Apply filters that *don't* require details (e.g., maybe keyword refinement if AI provided nuances)
        // Note: filterShopsByCriteria currently checks all, so only call if filters exist BUT details weren't needed.
        // This path might need refinement depending on exact filter implementation.
        processedShops = aiFilters ? filterShopsByCriteria(processedShops, aiFilters) : processedShops;

        // Use custom render for closable toast
        toast.success((t) => (
          <span>
            Found {processedShops.length} initial result(s).
            <button onClick={() => toast.dismiss(t.id)} style={{ marginLeft: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
          </span>
        ), { id: loadingToastId });
      }

      // Step 4: Apply Count Limit
      const finalShops = requestedCount !== null && requestedCount < processedShops.length
        ? processedShops.slice(0, requestedCount)
        : processedShops;

      // Step 5: Update State & Provide Feedback
      setCoffeeShops(finalShops);
    } catch (error) {
      console.error('Error processing search:', error);
      if (loadingToastId) {
        toast.update(loadingToastId, { render: "Search failed. Please try again.", type: "error", isLoading: false, autoClose: 5000, closeButton: true });
      }
    } finally {
      setIsLoading(false);
    }
  }

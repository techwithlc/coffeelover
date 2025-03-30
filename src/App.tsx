import { useState, useEffect } from 'react';
// Removed duplicate import
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import LocationDetails from './components/LocationDetails';
import { Toaster, toast } from 'react-hot-toast';
// import { mockCoffeeShops } from './lib/mockData'; // Remove mock data import
import type { CoffeeShop, Favorite } from './lib/types'; // Add Favorite type
import { supabase } from './lib/supabaseClient'; // Import supabase
import { mockFavorites } from './lib/mockData'; // Import mock favorites

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
  vicinity: string; // Nearby Search often returns 'vicinity' instead of 'formatted_address'
  rating?: number;
  // Add other fields as needed, though Nearby Search is limited
}

interface PlacesNearbyResponse {
  results: PlaceResult[];
  status: string;
  error_message?: string;
  next_page_token?: string; // For pagination, not handled in this basic example
}


function App() {
  const [selectedLocation, setSelectedLocation] = useState<CoffeeShop | null>(null);
  const [coffeeShops, setCoffeeShops] = useState<CoffeeShop[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Combined loading state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set()); // State for favorite IDs
  // Keep mapCenter for initial fetch coordinates, remove setMapCenter
  const [mapCenter] = useState({ lat: 24.1477, lng: 120.6736 }); // Default to Taichung

  // Effect to fetch initial data (coffee shops and favorites)
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);

      // --- Fetch Coffee Shops (existing logic) ---
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        toast.error("Google Maps API Key is missing!");
        setIsLoading(false);
        return;
      }

      // Taichung coordinates and search radius
      const lat = mapCenter.lat;
      const lng = mapCenter.lng;
      const radius = 5000; // 5km radius
      const type = 'cafe'; // Search for cafes

      // Using a CORS proxy for client-side requests to Google Places API Web Service
      // Option 1: Use a public proxy (less secure, rate limits) - e.g., cors-anywhere
      // Option 2: Set up your own proxy (recommended for production)
      // Option 3: Use Google Maps JS API PlacesService (requires map instance, more complex setup here)
      // Use the Vite proxy path configured in vite.config.ts
      const apiUrl = `/maps-api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;


      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: PlacesNearbyResponse = await response.json();

        if (data.status === 'OK') {
          const fetchedShops: CoffeeShop[] = data.results.map((place) => ({
            id: place.place_id,
            name: place.name,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            address: place.vicinity, // Use vicinity as address
            rating: place.rating,
            // Other fields will be undefined initially from Nearby Search
            opening_hours: undefined,
            price_range: undefined,
            wifi_available: undefined,
            pet_friendly: undefined,
            description: undefined,
            menu_highlights: [],
          }));
          setCoffeeShops(fetchedShops);
           // Optionally, update map center based on results if needed
           if (fetchedShops.length > 0 && fetchedShops[0].lat && fetchedShops[0].lng) {
             // setMapCenter({ lat: fetchedShops[0].lat, lng: fetchedShops[0].lng }); // Keep center for now
           }
        } else if (data.status === 'ZERO_RESULTS') {
           toast.error('No coffee shops found nearby.');
           setCoffeeShops([]);
        } else {
          console.error('Google Places API Error:', data.status, data.error_message);
          toast.error(`Error fetching places: ${data.error_message || data.status}`);
          setCoffeeShops([]); // Clear shops on error
        }
      } catch (error) {
        console.error('Failed to fetch coffee shops:', error);
        toast.error('Failed to load coffee shop data. Please try again later.');
        setCoffeeShops([]); // Clear shops on fetch error
      } // End of coffee shop fetch try-catch

      // --- Fetch Favorites ---
      let initialFavoriteIds = new Set<string>();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: favoritesData, error: favoritesError } = await supabase
            .from('favorites')
            .select('coffee_shop_id')
            .eq('user_id', user.id);

          if (favoritesError) {
            console.error("Error fetching favorites:", favoritesError);
            // Fallback to mock favorites if Supabase fails
            initialFavoriteIds = new Set(mockFavorites.filter(fav => fav.user_id === 'user-1').map(fav => fav.coffee_shop_id));
          } else if (favoritesData) {
            initialFavoriteIds = new Set(favoritesData.map(fav => fav.coffee_shop_id));
          }
        } else {
           // Use mock favorites if no user
           initialFavoriteIds = new Set(mockFavorites.filter(fav => fav.user_id === 'user-1').map(fav => fav.coffee_shop_id));
        }
      } catch (err) {
         console.error("Error getting user or fetching favorites:", err);
         initialFavoriteIds = new Set(mockFavorites.filter(fav => fav.user_id === 'user-1').map(fav => fav.coffee_shop_id));
      }
      setFavoriteIds(initialFavoriteIds);

      // --- Finish Loading ---
      setIsLoading(false); // Set loading false after both fetches attempt
    }; // End of fetchInitialData function

    fetchInitialData();
  }, [mapCenter]); // Dependency remains mapCenter for initial load trigger

  // Handler for keyword search triggered from Sidebar
  const handleKeywordSearch = async (keyword: string) => {
    setIsLoading(true);
    setCoffeeShops([]); // Clear existing shops before new search
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      toast.error("Google Maps API Key is missing!");
      setIsLoading(false);
      return;
    }

    // Use Text Search API with the keyword
    const apiUrl = `/maps-api/place/textsearch/json?query=${encodeURIComponent(keyword)}&location=${mapCenter.lat},${mapCenter.lng}&radius=10000&key=${apiKey}`; // Increased radius for text search

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: PlacesNearbyResponse = await response.json(); // Reuse same response type for simplicity

      if (data.status === 'OK') {
        const fetchedShops: CoffeeShop[] = data.results.map((place) => ({
          id: place.place_id,
          name: place.name,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          address: place.vicinity, // Text Search might return formatted_address, but vicinity is safer fallback
          rating: place.rating,
          opening_hours: undefined,
          price_range: undefined,
          wifi_available: undefined,
          pet_friendly: undefined,
          description: undefined,
          menu_highlights: [],
        }));
        setCoffeeShops(fetchedShops);
        if (fetchedShops.length === 0) {
          toast.success(`No results found for "${keyword}".`);
        }
      } else if (data.status === 'ZERO_RESULTS') {
        toast.error(`No results found for "${keyword}".`);
        setCoffeeShops([]);
      } else {
        console.error('Google Places Text Search API Error:', data.status, data.error_message);
        toast.error(`Error searching places: ${data.error_message || data.status}`);
        setCoffeeShops([]);
      }
    } catch (error) {
      console.error('Failed to fetch coffee shops via keyword:', error);
      toast.error('Failed to load search results. Please try again later.');
      setCoffeeShops([]);
    } finally {
      // Ensure loading is false even if keyword search fails
      setIsLoading(false);
    }
  };

  // Handler for toggling favorite status
  const handleToggleFavorite = async (shopId: string) => {
    const isCurrentlyFavorite = favoriteIds.has(shopId);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'user-1'; // Use mock user ID if not logged in

    // Optimistically update UI
    setFavoriteIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isCurrentlyFavorite) {
        newIds.delete(shopId);
      } else {
        newIds.add(shopId);
      }
      return newIds;
    });

    // Update backend (Supabase) - Attempt even if not logged in, using mock user ID
    try {
       // Log the key being used just before the call
       console.log("Using Supabase Anon Key:", import.meta.env.VITE_SUPABASE_ANON_KEY);
      // if (user) { // Remove login check for now
        if (isCurrentlyFavorite) {
          const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('coffee_shop_id', shopId)
            .eq('user_id', userId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('favorites')
            .insert({ coffee_shop_id: shopId, user_id: userId, created_at: new Date().toISOString() });
           if (error) throw error;
        }
      // } else { // Remove else block
      //    console.log(`Mock toggle favorite for shop ${shopId} (user not logged in)`);
      // }
    } catch (error) {
      console.error("Error updating favorite status in Supabase:", error);
      toast.error("Failed to update favorite status.");
      // Revert optimistic UI update on error
      setFavoriteIds(prevIds => {
        const newIds = new Set(prevIds);
        if (isCurrentlyFavorite) {
          // It failed to delete, so add it back
          newIds.add(shopId);
        } else {
          // It failed to add, so delete it
          newIds.delete(shopId);
        }
        return newIds;
      });
    }
  };

  const handleSelectLocation = (location: CoffeeShop) => {
    setSelectedLocation(location);
  };

  return (
    <div className="flex h-screen">
      {/* Pass the new handler to Sidebar */}
      <Sidebar
        locations={coffeeShops}
        onSelectLocation={handleSelectLocation}
        onKeywordSearch={handleKeywordSearch}
      />
      <div className="flex-1 relative">
        {/* Pass favoriteIds to Map */}
        <Map
          locations={coffeeShops}
          onMarkerClick={handleSelectLocation}
          favoriteIds={favoriteIds}
         />
        {selectedLocation && (
          // Pass favoriteIds and toggle handler to LocationDetails
          <LocationDetails
            location={selectedLocation}
            isFavorite={favoriteIds.has(selectedLocation.id)}
            onToggleFavorite={handleToggleFavorite}
            onClose={() => setSelectedLocation(null)}
          />
        )}
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      )}
      <Toaster />
    </div>
  );
}

export default App;

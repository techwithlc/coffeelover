import { useState, useEffect } from 'react';
// Removed duplicate import
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import LocationDetails from './components/LocationDetails';
import { Toaster, toast } from 'react-hot-toast';
// import { mockCoffeeShops } from './lib/mockData'; // Remove mock data import
import type { CoffeeShop } from './lib/types';

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
  const [isLoading, setIsLoading] = useState(true);
  // Keep mapCenter for initial fetch coordinates, remove setMapCenter
  const [mapCenter] = useState({ lat: 24.1477, lng: 120.6736 }); // Default to Taichung

  useEffect(() => {
    const fetchCoffeeShops = async () => {
      setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoffeeShops();
  }, [mapCenter]); // Re-fetch if mapCenter changes (though we don't change it currently)

  const handleSelectLocation = (location: CoffeeShop) => {
    setSelectedLocation(location);
  };

  return (
    <div className="flex h-screen">
      <Sidebar locations={coffeeShops} onSelectLocation={handleSelectLocation} />
      <div className="flex-1 relative">
        {/* Remove initialCenter prop */}
        <Map locations={coffeeShops} onMarkerClick={handleSelectLocation} />
        {selectedLocation && (
          <LocationDetails
            location={selectedLocation}
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

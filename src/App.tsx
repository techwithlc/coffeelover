import { useState, useEffect } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import LocationDetails from './components/LocationDetails';
import { Toaster } from 'react-hot-toast';
import { mockCoffeeShops } from './lib/mockData';
import type { CoffeeShop } from './lib/types'; 

function App() {
  const [selectedLocation, setSelectedLocation] = useState<CoffeeShop | null>(null);
  const [coffeeShops, setCoffeeShops] = useState<CoffeeShop[]>([]); 
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading data
    setIsLoading(true);
    
    // Set mock data with a slight delay to simulate loading
    setTimeout(() => {
      setCoffeeShops(mockCoffeeShops);
      setIsLoading(false);
    }, 800);
  }, []);

  const handleSelectLocation = (location: CoffeeShop) => {
    setSelectedLocation(location);
  };

  return (
    <div className="flex h-screen">
      <Sidebar locations={coffeeShops} onSelectLocation={handleSelectLocation} />
      <div className="flex-1 relative">
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

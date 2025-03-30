import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Map from './components/Map';
import LocationDetails from './components/LocationDetails';
import Sidebar from './components/Sidebar';
import type { Database } from './lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];

function App() {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  return (
    <div className="flex h-screen">
      <Sidebar onLocationSelect={setSelectedLocation} />
      <div className="flex-1 relative">
        <Map />
        {selectedLocation && (
          <LocationDetails
            location={selectedLocation}
            onClose={() => setSelectedLocation(null)}
          />
        )}
      </div>
      <Toaster />
    </div>
  );
}

export default App;
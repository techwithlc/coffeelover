import { useCallback, useEffect, useState } from 'react';
import { GoogleMap, useLoadScript, MarkerClusterer, Marker } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

const mapOptions = {
  disableDefaultUI: true,
  clickableIcons: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

type Location = Database['public']['Tables']['locations']['Row'];

export default function Map() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*');
      
      if (error) {
        console.error('Error fetching locations:', error);
        return;
      }

      setLocations(data);
    };

    fetchLocations();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLocations((prev) => [...prev, payload.new as Location]);
        } else if (payload.eventType === 'DELETE') {
          setLocations((prev) => prev.filter((loc) => loc.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in to add locations');
      return;
    }

    const name = prompt('Enter location name:');
    if (!name) return;

    const { error } = await supabase
      .from('locations')
      .insert({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        name,
        user_id: user.id,
      });

    if (error) {
      console.error('Error adding location:', error);
    }
  }, []);

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <GoogleMap
      zoom={12}
      center={{ lat: 40.7128, lng: -74.0060 }}
      mapContainerClassName="w-full h-full"
      options={mapOptions}
      onClick={handleMapClick}
    >
      <MarkerClusterer>
        {(clusterer) => (
          <>
            {locations.map((location) => (
              <Marker
                key={location.id}
                position={{ lat: location.lat, lng: location.lng }}
                clusterer={clusterer}
                icon={{
                  url: `data:image/svg+xml,${encodeURIComponent(
                    MapPin({ color: '#ef4444', size: 32 }).outerHTML
                  )}`,
                }}
                onClick={() => setSelectedLocation(location)}
              />
            ))}
          </>
        )}
      </MarkerClusterer>
    </GoogleMap>
  );
}
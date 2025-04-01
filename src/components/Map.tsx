import { useEffect, useState } from 'react';
import { GoogleMap, useLoadScript, /* MarkerClusterer, */ Marker } from '@react-google-maps/api'; // Comment out unused import
import { CoffeeShop } from '../lib/types';

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

interface MapProps {
  locations: CoffeeShop[];
  onMarkerClick: (location: CoffeeShop) => void;
  favoriteIds: Set<string>;
  // aiFilteredShopIds: Set<string> | null; // Remove prop
}

export default function Map({ locations, onMarkerClick, favoriteIds }: MapProps) { // Remove prop
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const [center, setCenter] = useState({ lat: 24.1477, lng: 120.6736 });

  useEffect(() => {
    if (locations.length > 0 && locations[0].lat && locations[0].lng) {
      setCenter({ lat: locations[0].lat, lng: locations[0].lng });
    }
  }, [locations]);

  if (!isLoaded) return <div className="w-full h-full flex items-center justify-center">Loading Maps...</div>;

  return (
    <GoogleMap
      zoom={13}
      center={center}
      mapContainerClassName="w-full h-full"
      options={mapOptions}
    >
      {/* <MarkerClusterer> Temporarily removed for debugging */}
        {/* {(clusterer) => ( */}
          <>
            {/* Map directly over locations passed as props */}
            {locations.map((location) => {
                const isFavorite = favoriteIds.has(location.id);
                return location.lat && location.lng ? (
                  <Marker
                    key={`${location.id}-${isFavorite}`}
                    position={{ lat: location.lat, lng: location.lng }}
                    // clusterer={clusterer} // Keep clusterer commented out
                  icon={{
                    url: `data:image/svg+xml,${encodeURIComponent(
                      // Use isFavorite variable for fill color
                      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${isFavorite ? '#DC2626' : '#8B4513'}" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>`
                    )}`,
                  }}
                  onClick={() => onMarkerClick(location)}
                />
              ) : null;
            })}
            </>
        {/* )} */}
      {/* </MarkerClusterer> */}
    </GoogleMap>
  );
}

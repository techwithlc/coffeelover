// Remove unused useEffect and useState
import { GoogleMap, useLoadScript, /* MarkerClusterer, */ Marker } from '@react-google-maps/api'; // Comment out unused import
import { CoffeeShop } from '../lib/types';

const mapOptions = {
  disableDefaultUI: true,
  clickableIcons: false,
  styles: [ // Keep existing styles
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

interface MapProps {
  center: { lat: number; lng: number }; // Add center prop
  locations: CoffeeShop[];
  onMarkerClick: (location: CoffeeShop) => void;
  favoriteIds: Set<string>;
}

export default function Map({ center, locations, onMarkerClick, favoriteIds }: MapProps) { // Add center prop
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // Remove internal center state and the useEffect that sets it

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
                        // Use a text element for the emoji, apply favorite color
                        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                           <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="24" fill="${isFavorite ? '#DC2626' : '#6B4F41'}">☕️</text>
                         </svg>`
                      )}`,
                      scaledSize: new google.maps.Size(32, 32), // Ensure size is consistent
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

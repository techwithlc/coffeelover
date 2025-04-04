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
                        // Use a text element for the emoji with a background circle for visibility
                        // NOTE: open_now status might be undefined if details weren't fetched
                        `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                           <circle cx="24" cy="24" r="20" fill="white" fill-opacity="0.8" stroke="#444" stroke-width="1"/>
                           <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="30" fill="${isFavorite ? '#DC2626' : '#6B4F41'}">
                             ${location.opening_hours?.open_now === false ? '🚫' : '☕️'}
                           </text>
                         </svg>`
                      )}`,
                      scaledSize: new google.maps.Size(48, 48), // Keep increased size
                      anchor: new google.maps.Point(24, 24), // Center the anchor point
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

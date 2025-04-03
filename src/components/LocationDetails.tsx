import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for Portals
import { Heart, Clock, DollarSign, Wifi, PawPrint, ExternalLink, Globe, MapPin } from 'lucide-react'; // Added MapPin
// import { supabase } from '../lib/supabaseClient'; // Removed unused import
import { CoffeeShop /*, Review */ } from '../lib/types'; // Remove unused Review type
// import { mockReviews } from '../lib/mockData'; // Remove unused import

// Define structure for Place Details response
interface PlaceDetailsResult {
  formatted_address?: string;
  opening_hours?: {
    weekday_text?: string[];
    open_now?: boolean;
  };
  photos?: {
    photo_reference: string;
    height: number;
    width: number;
    html_attributions: string[];
  }[];
  website?: string;
}

interface PlaceDetailsResponse {
  result?: PlaceDetailsResult;
  status: string;
  error_message?: string;
}

// Define structure for Photo Proxy response
interface PhotoProxyResponse {
  imageUrl?: string;
  error?: string;
}

interface Props {
  location: CoffeeShop;
  isFavorite: boolean;
  onToggleFavorite: (shopId: string) => void;
  onClose: () => void;
}

export default function LocationDetails({ location, isFavorite, onToggleFavorite, onClose }: Props) {
  const [placeDetails, setPlaceDetails] = useState<PlaceDetailsResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  // Helper to construct the PROXY URL for fetching the actual photo URL
  const getPhotoProxyUrl = (photoReference: string, maxWidth = 400) => {
    return `/maps-api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}`;
  };

  // Effect to fetch Place Details
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingDetails(true);
      setPlaceDetails(null);
      setPhotoUrl(null);

      // No API key needed here, proxy handles it
      const fields = 'formatted_address,opening_hours,website,photo,name';
      const detailsApiUrl = `/maps-api/place/details/json?placeid=${location.id}&fields=${fields}`;

      try {
        const detailsResponse = await fetch(detailsApiUrl);
        if (!detailsResponse.ok) throw new Error(`HTTP error! status: ${detailsResponse.status}`);
        const detailsData: PlaceDetailsResponse = await detailsResponse.json();

        if (detailsData.status === 'OK' && detailsData.result) {
          setPlaceDetails(detailsData.result);
        } else {
          console.error('Google Place Details API Error:', detailsData.status, detailsData.error_message);
        }
      } catch (error) {
        console.error('Failed to fetch place details:', error);
      } finally {
         // Set loading false only after details attempt
         setIsLoadingDetails(false);
      }
    };

    fetchData();
  }, [location.id]);

  // Separate effect to fetch photo URL *after* placeDetails are loaded
  useEffect(() => {
    const fetchPhoto = async () => {
      if (placeDetails?.photos && placeDetails.photos.length > 0) {
        const photoRef = placeDetails.photos[0].photo_reference;
        const proxyUrl = getPhotoProxyUrl(photoRef, 800);
        try {
          const photoResponse = await fetch(proxyUrl);
          if (!photoResponse.ok) throw new Error(`Photo proxy error! status: ${photoResponse.status}`);
          const photoData: PhotoProxyResponse = await photoResponse.json();
          if (photoData.imageUrl) {
            setPhotoUrl(photoData.imageUrl);
          } else {
            console.error("Photo proxy did not return an imageUrl:", photoData.error);
          }
        } catch (error) {
          console.error("Failed to fetch photo URL via proxy:", error);
        }
      } else {
        setPhotoUrl(null);
      }
    };

    if (placeDetails) {
      fetchPhoto();
    }
  }, [placeDetails]);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/shop/${location.id}`;
    if (navigator.share) {
      navigator.share({
        title: `Check out ${location.name}`,
        text: `I found a great coffee shop: ${location.name}`,
        url: shareUrl,
      }).catch(err => {
        console.error('Error sharing:', err);
        copyToClipboard(shareUrl);
      });
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('Link copied to clipboard!'))
      .catch(err => console.error('Could not copy text: ', err));
  };

  // Function to open Google Maps directions
  const handleGetDirections = () => {
    if (location.lat && location.lng) {
      // Use "current+location" which prompts the user for their location in Google Maps
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${location.lat},${location.lng}`;
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert("Location coordinates are not available for directions.");
    }
  };

  // Loading state
  if (isLoadingDetails && !placeDetails) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          <p className="ml-4 text-gray-600">Loading details...</p>
        </div>
      </div>
    );
  }

  // Get the portal target node
  const modalRoot = document.getElementById('modal-root');

  // If modalRoot doesn't exist, don't render the portal (shouldn't happen with correct index.html)
  if (!modalRoot) {
    return null;
  }

  // Render using a Portal into modal-root
  return ReactDOM.createPortal(
    // Use fixed positioning again, as portal handles DOM hierarchy issues
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 md:mb-6 border-b pb-3 md:pb-4">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-800">{location.name || 'Coffee Shop'}</h2>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => onToggleFavorite(location.id)}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={`p-2 rounded-full transition-colors duration-200 ease-in-out ${
                isFavorite
                  ? 'text-red-500 bg-red-100 hover:bg-red-200'
                  : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              }`}
            >
              <Heart size={20} className={isFavorite ? 'fill-current' : ''} />
            </button>
            <button
              onClick={onClose}
              title="Close details"
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 ease-in-out p-1 rounded-full hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

         {/* Photo */}
         {photoUrl ? (
           <div className="mb-4 md:mb-6 rounded-lg overflow-hidden">
             <img
                src={photoUrl}
                alt={`Photo of ${location.name}`}
                className="w-full object-cover" // Removed h-48
              />
            </div>
         ) : isLoadingDetails ? (
            <div className="mb-4 md:mb-6 rounded-lg overflow-hidden bg-gray-200 h-48 flex items-center justify-center">
                <p className="text-gray-500 text-sm">Loading photo...</p>
            </div>
         ) : null }

        {/* Coffee Shop Details */}
        <div className="mb-6">
          <p className="text-gray-600 mb-2">{placeDetails?.formatted_address || location.address}</p>
           {placeDetails?.website && (
             <a
               href={placeDetails.website}
               target="_blank"
               rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4"
             >
               <Globe size={14} /> Website <ExternalLink size={12} className="ml-1"/>
             </a>
           )}
          {placeDetails?.opening_hours?.weekday_text && (
            <div className="mb-4 p-3 bg-gray-50 rounded border">
              <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                <Clock size={16} /> Opening Hours
                {placeDetails.opening_hours.open_now !== undefined && (
                   <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${placeDetails.opening_hours.open_now ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {placeDetails.opening_hours.open_now ? 'Open Now' : 'Closed Now'}
                   </span>
                )}
              </h4>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {placeDetails.opening_hours.weekday_text.map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ul>
            </div>
          )}
          {/* Stack grid on xs, two columns on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {location.price_range && (
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-gray-500" />
                <span className="text-sm">{location.price_range}</span>
              </div>
            )}
            {location.wifi_available && (
              <div className="flex items-center gap-2">
                <Wifi size={18} className="text-green-500" />
                <span className="text-sm">Wi-Fi Available</span>
              </div>
            )}
            {location.pet_friendly && (
              <div className="flex items-center gap-2">
                <PawPrint size={18} className="text-green-500" />
                <span className="text-sm">Pet Friendly</span>
              </div>
            )}
          </div>
          {location.description && (
            <p className="text-gray-700 mt-4">{location.description}</p>
          )}
          {location.menu_highlights && location.menu_highlights.length > 0 && (
            <div className="mt-4">
              <h3 className="text-md font-semibold text-gray-700">Menu Highlights</h3>
              <ul className="list-disc list-inside mt-2">
                {location.menu_highlights.map((item, index) => (
                  <li key={index} className="text-sm text-gray-600">{item}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={handleShare}
            className="mt-6 flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            Share this coffee shop
          </button>
          {/* Get Directions Button */}
          <button
            onClick={handleGetDirections}
            className="mt-6 ml-4 flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            disabled={!location.lat || !location.lng} // Disable if no coordinates
          >
            <MapPin size={18} />
            Get Directions
          </button>
        </div>

        {/* Removed Reviews Section */}
        {/* Removed Review Form Section */}

      </div>
    </div>,
    modalRoot // Target node for the portal
  );
}

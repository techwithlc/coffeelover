import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for Portals
import { Heart, Clock, DollarSign, Wifi, PawPrint, ExternalLink, Globe, MapPin, BatteryCharging, Eye, EyeOff, AlertTriangle, Star, Coffee, User, QrCode } from 'lucide-react'; // Added QrCode icon
import { supabase } from '../lib/supabaseClient'; // Corrected import name
import { Database } from '../lib/database.types'; // Import generated types
import { QRCodeCanvas } from 'qrcode.react'; // Import QR Code component
import { CoffeeShop } from '../lib/types';
import { Carousel } from 'react-responsive-carousel';
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader

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

// Define structure for Photo Proxy response (needed for fetching image URLs)
interface PhotoProxyResponse {
  imageUrl?: string;
  error?: string;
}

// Define type for Wi-Fi details fetched from Supabase
type WifiDetail = Database['public']['Tables']['location_wifi_details']['Row'];
// Define type for Charger details (assuming table structure)
interface ChargerDetail {
  id: string; // Assuming UUID primary key
  location_id: string;
  user_id: string;
  has_chargers: boolean;
  charger_count: number | null; // Allow null if user only confirms availability
  created_at: string;
}


interface Props {
  location: CoffeeShop;
  isFavorite: boolean;
  onToggleFavorite: (shopId: string) => void;
  onClose: () => void;
  userId: string | null; // Add userId prop
}

export default function LocationDetails({ location, isFavorite, onToggleFavorite, onClose, userId }: Props) { // Destructure userId
  const [placeDetails, setPlaceDetails] = useState<PlaceDetailsResult | null>(null);
  // Removed photoUrl state
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [wifiDetails, setWifiDetails] = useState<WifiDetail[]>([]);
  const [isLoadingWifi, setIsLoadingWifi] = useState(true);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({}); // Store visibility per wifi entry
  const [coffeeRating, setCoffeeRating] = useState<number | null>(null);
  const [wifiRating, setWifiRating] = useState<number | null>(null);
  const [staffRating, setStaffRating] = useState<number | null>(null); // Optional
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSuccessMessage, setRatingSuccessMessage] = useState<string | null>(null);
  const [showWifiForm, setShowWifiForm] = useState(false);
  const [newSsid, setNewSsid] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newWifiType, setNewWifiType] = useState<'public' | 'private' | 'ask_staff'>('ask_staff');
  const [isSubmittingWifi, setIsSubmittingWifi] = useState(false);
  const [wifiSubmitError, setWifiSubmitError] = useState<string | null>(null);
  const [wifiSubmitSuccess, setWifiSubmitSuccess] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState<Record<string, boolean>>({}); // State for QR code visibility
  // const [currentUserHasSubmittedWifi, setCurrentUserHasSubmittedWifi] = useState(false); // Removed unused state

  // State for Charger Details
  const [chargerDetails, setChargerDetails] = useState<ChargerDetail[]>([]);
  const [isLoadingChargers, setIsLoadingChargers] = useState(true);
  const [showChargerForm, setShowChargerForm] = useState(false);
  const [newHasChargers, setNewHasChargers] = useState<boolean | null>(null); // Use null for unselected
  const [newChargerCount, setNewChargerCount] = useState<string>(''); // Use string for input
  const [isSubmittingCharger, setIsSubmittingCharger] = useState(false);
  const [chargerSubmitError, setChargerSubmitError] = useState<string | null>(null);
  const [chargerSubmitSuccess, setChargerSubmitSuccess] = useState<string | null>(null);
  const [fetchedImageUrls, setFetchedImageUrls] = useState<string[]>([]); // State for actual image URLs
  const [isLoadingImages, setIsLoadingImages] = useState(false); // Loading state for images


  // Helper to construct the PROXY URL for fetching the actual photo URL JSON
  const getPhotoProxyUrl = (photoReference: string, maxWidth = 800) => {
    return `/maps-api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}`;
  };

  // Helper function to render price level
  const renderPriceLevel = (priceLevelString?: string): string => {
    const priceLevel = priceLevelString ? parseInt(priceLevelString, 10) : NaN;
    if (isNaN(priceLevel) || priceLevel < 0) return ''; // Handle invalid or missing data
    if (priceLevel === 0) return 'Free'; // Google uses 0 for free sometimes
    return '$'.repeat(priceLevel); // Repeat '$' based on the level (1-4)
  };


  // Effect to fetch Place Details (excluding photos, as we use location.images)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingDetails(true);
      setPlaceDetails(null);
      // Removed setPhotoUrl(null);

      // No API key needed here, proxy handles it
      // Removed 'photo' from fields as we use location.images now
      const fields = 'formatted_address,opening_hours,website,name';
      const detailsApiUrl = `/maps-api/place/details/json?placeid=${location.google_place_id}&fields=${fields}`; // Use google_place_id

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
         setIsLoadingDetails(false);
      }
    };

    fetchData();
  }, [location.google_place_id]); // Depend on google_place_id

  // Effect to fetch actual image URLs from the proxy
  useEffect(() => {
    const fetchImageUrls = async () => {
      if (!location.images || location.images.length === 0) {
        setFetchedImageUrls([]);
        return;
      }

      setIsLoadingImages(true);
      const urls: string[] = [];
      // Fetch up to 3 images
      const imageRefsToFetch = location.images.slice(0, 3);

      for (const photoRef of imageRefsToFetch) {
        const proxyUrl = getPhotoProxyUrl(photoRef);
        try {
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            console.error(`Photo proxy error for ${photoRef}! status: ${response.status}`);
            continue; // Skip this image on error
          }
          const data: PhotoProxyResponse = await response.json(); // Expect JSON { imageUrl: "..." }
          if (data.imageUrl) {
            urls.push(data.imageUrl);
          } else {
            console.error(`Photo proxy did not return an imageUrl for ${photoRef}:`, data.error);
          }
        } catch (error) {
          console.error(`Failed to fetch photo URL via proxy for ${photoRef}:`, error);
        }
      }
      setFetchedImageUrls(urls);
      setIsLoadingImages(false);
    };

    fetchImageUrls();
  }, [location.images]); // Re-run when location images change


  // Effect to fetch Wi-Fi Details from Supabase
  useEffect(() => {
    const fetchWifiDetails = async () => {
      if (!location.id) return;
      setIsLoadingWifi(true);
      try {
        const { data, error } = await supabase // Use correct client variable
          .from('location_wifi_details')
          .select('*')
          .eq('location_id', location.id)
          .order('created_at', { ascending: false }); // Get latest first

        if (error) {
          throw error;
        }
        setWifiDetails(data || []);
      } catch (error) {
        console.error('Error fetching Wi-Fi details:', error);
        setWifiDetails([]); // Set empty on error
      } finally {
        setIsLoadingWifi(false);
      }
    };

    fetchWifiDetails();
  }, [location.id]);

  // Effect to fetch Charger Details from Supabase
  useEffect(() => {
    const fetchChargerDetails = async () => {
      if (!location.id) return;
      setIsLoadingChargers(true);
      try {
        // Assuming table name is 'location_charger_details'
        const { data, error } = await supabase
          .from('location_charger_details')
          .select('*')
          .eq('location_id', location.id)
          .order('created_at', { ascending: false });

        if (error) {
          // If table doesn't exist yet (42P01), treat as empty, otherwise throw
          if (error.code === '42P01') {
             console.warn("location_charger_details table not found, assuming no charger data.");
             setChargerDetails([]);
          } else {
            throw error;
          }
        } else {
          setChargerDetails(data || []);
        }
      } catch (error) {
        console.error('Error fetching Charger details:', error);
        setChargerDetails([]); // Set empty on error
      } finally {
        setIsLoadingChargers(false);
      }
    };

    fetchChargerDetails();
  }, [location.id]);


  // Removed useEffect that set currentUserHasSubmittedWifi


  // Function to handle rating submission
  const handleRatingSubmit = async () => {
    if (!userId) {
      setRatingError("You must be logged in to submit a rating.");
      return;
    }
    if (coffeeRating === null || wifiRating === null) {
      setRatingError("Please provide ratings for Coffee and Wi-Fi.");
      return;
    }

    setIsSubmittingRating(true);
    setRatingError(null);
    setRatingSuccessMessage(null);

    try {
      const { error } = await supabase
        .from('location_ratings')
        .insert({
          location_id: location.id,
          user_id: userId,
          coffee_rating: coffeeRating,
          wifi_rating: wifiRating,
          staff_rating: staffRating, // Will be null if not set
        });

      if (error) {
        // Handle potential unique constraint violation if user already rated
        if (error.code === '23505') { // PostgreSQL unique violation code
           setRatingError("You have already rated this location.");
        } else {
          throw error;
        }
      } else {
        setRatingSuccessMessage("Rating submitted successfully!");
        // Optionally clear ratings after successful submission
        // setCoffeeRating(null);
        // setWifiRating(null);
        // setStaffRating(null);
      }
    } catch (err) {
      console.error('Error submitting rating:', err);
      setRatingError("Failed to submit rating. Please try again.");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Function to handle Wi-Fi detail submission
  const handleWifiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setWifiSubmitError("You must be logged in to submit Wi-Fi details.");
      return;
    }
    if (!newSsid && newWifiType === 'private') {
       setWifiSubmitError("SSID is required for private networks.");
       return;
    }
     if (!newPassword && newWifiType === 'private') {
       setWifiSubmitError("Password is required for private networks.");
       return;
     }

    setIsSubmittingWifi(true);
    setWifiSubmitError(null);
    setWifiSubmitSuccess(null);

    try {
      const { data, error } = await supabase
        .from('location_wifi_details')
        .insert({
          location_id: location.id,
          user_id: userId,
          ssid: newSsid || null, // Store empty string as null
          password: newPassword || null, // Store empty string as null
          wifi_type: newWifiType,
        })
        .select() // Select the newly inserted row
        .single(); // Expect only one row

      if (error) {
        throw error;
      }

      // Add the new details to the top of the displayed list
      if (data) {
         setWifiDetails(prev => [data as WifiDetail, ...prev]);
         // setCurrentUserHasSubmittedWifi(true); // Removed setting unused state
      }

      setWifiSubmitSuccess("Wi-Fi details submitted successfully!");
      // Reset form and hide it
      setNewSsid('');
      setNewPassword('');
      setNewWifiType('ask_staff');
      setShowWifiForm(false);

    } catch (err) {
      console.error('Error submitting Wi-Fi details:', err);
      setWifiSubmitError("Failed to submit Wi-Fi details. Please try again.");
    } finally {
      setIsSubmittingWifi(false);
    }
  };

  // Function to handle Charger detail submission
  const handleChargerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setChargerSubmitError("You must be logged in to submit charger details.");
      return;
    }
    if (newHasChargers === null) {
      setChargerSubmitError("Please indicate if chargers are available (Yes/No).");
      return;
    }
    const count = newHasChargers ? parseInt(newChargerCount, 10) : null;
    if (newHasChargers && (isNaN(count!) || count! < 0)) {
       setChargerSubmitError("Please enter a valid number for charger count (0 or more).");
       return;
    }


    setIsSubmittingCharger(true);
    setChargerSubmitError(null);
    setChargerSubmitSuccess(null);

    try {
      const { data, error } = await supabase
        .from('location_charger_details')
        .insert({
          location_id: location.id,
          user_id: userId,
          has_chargers: newHasChargers,
          charger_count: newHasChargers ? count : null, // Store count only if available
        })
        .select()
        .single();

      if (error) {
         // Handle potential unique constraint violation if user already submitted for this location?
         // Or allow multiple submissions? For now, assume multiple allowed or handle via RLS/triggers later.
        throw error;
      }

      // Add the new details to the state (optional, could just refetch)
      if (data) {
         setChargerDetails(prev => [data as ChargerDetail, ...prev]);
      }

      setChargerSubmitSuccess("Charger details submitted successfully!");
      // Reset form and hide it
      setNewHasChargers(null);
      setNewChargerCount('');
      setShowChargerForm(false);

    } catch (err: unknown) { // Use unknown for better type safety
      console.error('Error submitting Charger details:', err);
       // Check if it's a Supabase error with a code property
       if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '42P01') {
           setChargerSubmitError("Feature under development: Charger details table not found.");
       } else {
           const message = err instanceof Error ? err.message : "Failed to submit charger details. Please try again.";
           setChargerSubmitError(message);
       }
    } finally {
      setIsSubmittingCharger(false);
    }
  };


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
              // Increased padding for easier tapping on mobile
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 ease-in-out p-2 rounded-full hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
         </div>

         {/* Photo Carousel */}
         {isLoadingImages ? (
            <div className="mb-4 md:mb-6 rounded-lg overflow-hidden bg-gray-200 h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
                <p className="text-gray-500 text-sm">Loading photos...</p>
            </div>
         ) : fetchedImageUrls.length > 0 ? (
           <div className="mb-4 md:mb-6 rounded-lg overflow-hidden bg-gray-100">
             <Carousel
               showThumbs={false} // Thumbnails might be complex with proxy fetching
               showStatus={false}
               infiniteLoop={fetchedImageUrls.length > 1} // Only loop if more than one image
               useKeyboardArrows={true}
               className="location-carousel"
             >
               {fetchedImageUrls.map((imageUrl, index) => (
                 <div key={index}>
                   <img
                     src={imageUrl} // Use the fetched final image URL
                     alt={`Photo ${index + 1} of ${location.name}`}
                     className="w-full object-cover max-h-64" // Limit height
                   />
                 </div>
               ))}
             </Carousel>
           </div>
         ) : (
            <div className="mb-4 md:mb-6 rounded-lg overflow-hidden bg-gray-200 h-48 flex items-center justify-center">
                <p className="text-gray-500 text-sm">No photos available</p>
            </div>
         )}

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
                <span className="text-sm font-medium text-gray-700">{renderPriceLevel(location.price_range)}</span>
              </div>
            )}
            {/* Charger info display removed from here, handled in dedicated section */}
            {/* Pet friendly display remains */}
             {location.pet_friendly && (
              <div className="flex items-center gap-2">
                <PawPrint size={18} className="text-green-500" />
                <span className="text-sm">Pet Friendly</span>
              </div>
            )}
          </div>

          {/* Detailed Wi-Fi Information Section */}
          <div className="mt-6 border-t pt-4">
            <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
              <Wifi size={18} /> Wi-Fi Details
            </h4>

            {/* --- Conditional Rendering Logic for Wi-Fi Details --- */}
            {!userId ? (
              // Case 1: User not logged in
              <p className="text-sm text-gray-500">Please log in to view or add Wi-Fi details.</p>
            ) : isLoadingWifi ? (
              // Case 2: Logged in, but data is loading
              <p className="text-sm text-gray-500">Loading Wi-Fi info...</p>
            ) : wifiDetails.length > 0 ? ( // Check if details exist
              // Case 3: Logged in AND Wi-Fi details EXIST for this location (show them)
              <div className="space-y-3">
                {wifiDetails.map((wifi) => {
                  // Generate QR code string only for private networks with credentials
                      const canGenerateQr = wifi.wifi_type === 'private' && wifi.ssid && wifi.password;
                      const qrCodeValue = canGenerateQr
                        ? `WIFI:T:WPA;S:${wifi.ssid};P:${wifi.password};;`
                        : '';

                      return (
                        <div key={wifi.id} className="p-3 bg-gray-50 rounded border text-sm">
                          {/* Wi-Fi Info */}
                          {wifi.ssid && <p><span className="font-medium">Network (SSID):</span> {wifi.ssid}</p>}
                          {wifi.password && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Password:</span>
                              <span className={`flex-1 ${showPassword[wifi.id] ? '' : 'blur-sm select-none'}`}>
                                {wifi.password}
                              </span>
                              <button
                                onClick={() => setShowPassword(prev => ({ ...prev, [wifi.id]: !prev[wifi.id] }))}
                                title={showPassword[wifi.id] ? 'Hide password' : 'Show password'}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {showPassword[wifi.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          )}
                          {wifi.wifi_type && (
                            <p><span className="font-medium">Type:</span> <span className="capitalize">{wifi.wifi_type?.replace('_', ' ')}</span></p>
                          )}
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-gray-500">Added: {new Date(wifi.created_at).toLocaleDateString()}</p>
                            {/* QR Code Button/Display */}
                            {canGenerateQr && (
                              <div>
                                <button
                                  onClick={() => setShowQrCode(prev => ({ ...prev, [wifi.id]: !prev[wifi.id] }))}
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  title={showQrCode[wifi.id] ? "Hide QR Code" : "Show QR Code"}
                                >
                                  <QrCode size={14} /> {showQrCode[wifi.id] ? "Hide" : "QR"}
                                </button>
                              </div>
                            )}
                          </div>
                          {/* QR Code Canvas */}
                          {canGenerateQr && showQrCode[wifi.id] && (
                            <div className="mt-2 p-2 bg-white inline-block border rounded">
                              <QRCodeCanvas value={qrCodeValue} size={128} />
                              <p className="text-xs text-center mt-1 text-gray-600">Scan to connect</p>
                            </div>
                          )}
                        </div>
                      ); // Closing parenthesis for return statement inside map
                    })}
                {/* Disclaimer shown only when list is displayed */}
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <AlertTriangle size={14} className="text-orange-500" />
                  Wi-Fi details are user-submitted. Use with caution.
                </p>
              </div> // Closing div for space-y-3
            ) : (
              // Case 4: Logged in BUT NO Wi-Fi details exist for this location yet
              <p className="text-sm text-gray-500">No Wi-Fi details submitted for this location yet. Be the first!</p>
            )}
            {/* --- End Conditional Rendering --- */}


            {/* Add/Show Wi-Fi Form Button & Form Container - Always show if logged in */}
            {userId && (
              <div className="mt-4"> {/* Container for button and form */}
                {/* Show "Add" button only if form is hidden */}
                {!showWifiForm && (
                  <button
                    onClick={() => setShowWifiForm(true)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Wi-Fi Info
                  </button>
                )}

                {/* Wi-Fi Submission Form */}
                {showWifiForm && (
                  <form onSubmit={handleWifiSubmit} className="mt-4 p-4 border rounded bg-indigo-50 space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="font-medium text-sm">Add New Wi-Fi Details</h5>
                      <button
                        type="button"
                        onClick={() => setShowWifiForm(false)} // Close button
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                    <div>
                      <label htmlFor="wifi_type" className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                      <select
                        id="wifi_type"
                        value={newWifiType}
                        onChange={(e) => setNewWifiType(e.target.value as 'public' | 'private' | 'ask_staff')}
                        className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="ask_staff">Ask Staff</option>
                        <option value="public">Public (No Password)</option>
                        <option value="private">Private (Password Required)</option>
                      </select>
                    </div>
                    {newWifiType === 'private' && (
                      <>
                        <div>
                          <label htmlFor="ssid" className="block text-xs font-medium text-gray-700 mb-1">Network Name (SSID)</label>
                          <input
                            type="text"
                            id="ssid"
                            value={newSsid}
                            onChange={(e) => setNewSsid(e.target.value)}
                            className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                          <input
                            type="text" // Consider type="password" but might hinder usability
                            id="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          />
                        </div>
                      </>
                    )}
                    {newWifiType === 'public' && (
                       <div>
                          <label htmlFor="ssid_public" className="block text-xs font-medium text-gray-700 mb-1">Network Name (SSID) <span className="text-gray-500">(Optional)</span></label>
                          <input
                            type="text"
                            id="ssid_public"
                            value={newSsid}
                            onChange={(e) => setNewSsid(e.target.value)}
                            className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmittingWifi}
                      className="w-full px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isSubmittingWifi ? 'Submitting...' : 'Submit Wi-Fi Info'}
                    </button>
                    {wifiSubmitError && <p className="text-red-600 text-xs mt-1">{wifiSubmitError}</p>}
                    {wifiSubmitSuccess && <p className="text-green-600 text-xs mt-1">{wifiSubmitSuccess}</p>}
                 </form>
               )}
             </div>
           )}
          </div>

          {/* Detailed Charger Information Section */}
          <div className="mt-6 border-t pt-4">
            <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
              <BatteryCharging size={18} /> Power Outlets / Chargers
            </h4>
             {!userId ? (
              // Case 1: User not logged in
              <p className="text-sm text-gray-500">Please log in to view or add charger details.</p>
            ) : isLoadingChargers ? (
              // Case 2: Logged in, but data is loading
              <p className="text-sm text-gray-500">Loading charger info...</p>
            ) : chargerDetails.length > 0 ? (
              // Case 3: Logged in AND Charger details EXIST for this location (show summary)
              <div className="text-sm">
                 {/* Simple display: Check if *any* report says chargers are available */}
                 {chargerDetails.some(d => d.has_chargers) ? (
                    <p className="text-green-700 flex items-center gap-1">
                       <BatteryCharging size={16} /> Charging likely available (based on user reports).
                       {/* Optionally calculate average count */}
                       {(() => {
                           const counts = chargerDetails.filter(d => d.has_chargers && d.charger_count !== null).map(d => d.charger_count!);
                           if (counts.length > 0) {
                               const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
                               return <span className="text-xs text-gray-500 ml-1">(Avg. count: ~{avg})</span>;
                           }
                           return null;
                       })()}
                    </p>
                 ) : (
                    <p className="text-red-700 flex items-center gap-1">
                       <AlertTriangle size={16} /> Charging likely unavailable (based on user reports).
                    </p>
                 )}
                 <p className="text-xs text-gray-500 mt-1">Based on {chargerDetails.length} user report(s).</p>
              </div>
            ) : (
              // Case 4: Logged in BUT NO Charger details exist for this location yet
              <p className="text-sm text-gray-500">No charger details submitted for this location yet. Be the first!</p>
            )}

             {/* Add/Show Charger Form Button & Form Container - Always show if logged in */}
             {userId && (
              <div className="mt-4">
                {!showChargerForm && (
                  <button
                    onClick={() => setShowChargerForm(true)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Charger Info
                  </button>
                )}

                {/* Charger Submission Form */}
                {showChargerForm && (
                  <form onSubmit={handleChargerSubmit} className="mt-4 p-4 border rounded bg-indigo-50 space-y-3">
                     <div className="flex justify-between items-center mb-2">
                      <h5 className="font-medium text-sm">Add Charger Details</h5>
                      <button type="button" onClick={() => setShowChargerForm(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                    {/* Has Chargers Radio */}
                    <div className="space-y-1">
                       <label className="block text-xs font-medium text-gray-700">Are chargers/outlets available?</label>
                       <div className="flex gap-4">
                           <label className="flex items-center gap-1 text-sm">
                               <input type="radio" name="has_chargers" value="yes" checked={newHasChargers === true} onChange={() => setNewHasChargers(true)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/> Yes
                           </label>
                            <label className="flex items-center gap-1 text-sm">
                               <input type="radio" name="has_chargers" value="no" checked={newHasChargers === false} onChange={() => setNewHasChargers(false)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/> No
                           </label>
                       </div>
                    </div>
                    {/* Charger Count Input (conditional) */}
                    {newHasChargers === true && (
                       <div>
                          <label htmlFor="charger_count" className="block text-xs font-medium text-gray-700 mb-1">Approximate number of outlets/ports? <span className="text-gray-500">(Optional)</span></label>
                          <input
                            type="number"
                            id="charger_count"
                            min="0"
                            step="1"
                            value={newChargerCount}
                            onChange={(e) => setNewChargerCount(e.target.value)}
                            className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., 5"
                          />
                        </div>
                    )}
                     <button
                      type="submit"
                      disabled={isSubmittingCharger || newHasChargers === null}
                      className="w-full px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isSubmittingCharger ? 'Submitting...' : 'Submit Charger Info'}
                    </button>
                    {chargerSubmitError && <p className="text-red-600 text-xs mt-1">{chargerSubmitError}</p>}
                    {chargerSubmitSuccess && <p className="text-green-600 text-xs mt-1">{chargerSubmitSuccess}</p>}
                  </form>
                )}
              </div>
             )}
          </div>


          {/* Experience Rating Section */}
          {userId && ( // Only show rating form if user is logged in
            <div className="mt-6 border-t pt-4">
              <h4 className="text-md font-semibold mb-3">Rate Your Experience</h4>
              <div className="space-y-4">
                {/* Coffee Rating */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700"><Coffee size={16} /> Coffee Quality:</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setCoffeeRating(star)}
                        className={`p-1 rounded transition-colors ${
                          coffeeRating !== null && star <= coffeeRating
                            ? 'text-yellow-500'
                            : 'text-gray-300 hover:text-yellow-400'
                        }`}
                      >
                        <Star size={20} fill={coffeeRating !== null && star <= coffeeRating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
                {/* Wi-Fi Rating */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700"><Wifi size={16} /> Wi-Fi Speed/Stability:</label>
                   <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setWifiRating(star)}
                        className={`p-1 rounded transition-colors ${
                          wifiRating !== null && star <= wifiRating
                            ? 'text-yellow-500'
                            : 'text-gray-300 hover:text-yellow-400'
                        }`}
                      >
                        <Star size={20} fill={wifiRating !== null && star <= wifiRating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
                {/* Staff Rating (Optional) */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700"><User size={16} /> Staff Attractiveness <span className="text-xs text-gray-500">(Optional)</span>:</label>
                   <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setStaffRating(star)}
                        className={`p-1 rounded transition-colors ${
                          staffRating !== null && star <= staffRating
                            ? 'text-yellow-500'
                            : 'text-gray-300 hover:text-yellow-400'
                        }`}
                      >
                        <Star size={20} fill={staffRating !== null && star <= staffRating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Submit Button & Messages */}
              <div className="mt-4">
                <button
                  onClick={handleRatingSubmit}
                  disabled={isSubmittingRating || coffeeRating === null || wifiRating === null}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
                </button>
                {ratingError && <p className="text-red-600 text-sm mt-2">{ratingError}</p>}
                {ratingSuccessMessage && <p className="text-green-600 text-sm mt-2">{ratingSuccessMessage}</p>}
              </div>
            </div>
          )}
          {!userId && (
             <p className="text-sm text-gray-600 mt-6 border-t pt-4">Please log in to rate this location.</p>
          )}


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

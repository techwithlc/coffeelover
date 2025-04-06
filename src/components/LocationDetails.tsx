import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for Portals
import { Heart, Clock, DollarSign, Wifi, PawPrint, ExternalLink, Globe, MapPin, BatteryCharging, Eye, EyeOff, AlertTriangle, Star, Coffee, User, QrCode } from 'lucide-react'; // Added QrCode icon
import { supabase } from '../lib/supabaseClient'; // Corrected import name
import { Database } from '../lib/database.types'; // Import generated types
import { QRCodeCanvas } from 'qrcode.react'; // Import QR Code component
import { CoffeeShop } from '../lib/types';

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

// Define type for Wi-Fi details fetched from Supabase
type WifiDetail = Database['public']['Tables']['location_wifi_details']['Row'];

interface Props {
  location: CoffeeShop;
  isFavorite: boolean;
  onToggleFavorite: (shopId: string) => void;
  onClose: () => void;
  userId: string | null; // Add userId prop
}

export default function LocationDetails({ location, isFavorite, onToggleFavorite, onClose, userId }: Props) { // Destructure userId
  const [placeDetails, setPlaceDetails] = useState<PlaceDetailsResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
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
  const [currentUserHasSubmittedWifi, setCurrentUserHasSubmittedWifi] = useState(false);

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

  // Separate effect to check if user has submitted, runs when wifiDetails or userId changes
  useEffect(() => {
    if (userId && wifiDetails.length > 0) {
      const userSubmitted = wifiDetails.some(detail => detail.user_id === userId);
      setCurrentUserHasSubmittedWifi(userSubmitted);
    } else {
      setCurrentUserHasSubmittedWifi(false); // Reset if user logs out or details are cleared
    }
  }, [wifiDetails, userId]);


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

      // Add the new details to the top of the displayed list and mark as submitted
      if (data) {
         setWifiDetails(prev => [data as WifiDetail, ...prev]);
         setCurrentUserHasSubmittedWifi(true); // User has now submitted
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
            {/* Wi-Fi section removed from here, will be added below */}
            {location.has_chargers && ( // Added charger info display
              <div className="flex items-center gap-2">
                <BatteryCharging size={18} className="text-green-500" />
                <span className="text-sm">
                  Charging Available {location.charger_count !== undefined && location.charger_count > 0 ? `(${location.charger_count})` : ''}
                </span>
              </div>
            )}
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
            ) : currentUserHasSubmittedWifi ? (
              // Case 3: Logged in AND has submitted for this location
              <>
                {wifiDetails.length > 0 ? (
                  // Sub-case 3a: Details exist, show the list
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
                  // Sub-case 3b: User submitted, but somehow no details exist (edge case)
                  <p className="text-sm text-gray-500">No Wi-Fi details found (including yours).</p>
                )}
              </> // Closing fragment for Case 3
            ) : (
              // Case 4: Logged in BUT has NOT submitted for this location
              <p className="text-sm text-gray-500">Submit the Wi-Fi details for this location to view information shared by others.</p>
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

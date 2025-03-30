import { useState, useEffect } from 'react';
import { Star, Heart, Clock, DollarSign, Wifi, PawPrint, ExternalLink, Globe } from 'lucide-react'; // Added ExternalLink, Globe
import { supabase } from '../lib/supabaseClient';
import { CoffeeShop, Review } from '../lib/types';
import { mockReviews } from '../lib/mockData';

// Define structure for Place Details response (add fields as needed)
interface PlaceDetailsResult {
  formatted_address?: string;
  opening_hours?: {
    weekday_text?: string[];
    open_now?: boolean; // Useful to show current status
  };
  photos?: {
    photo_reference: string;
    height: number;
    width: number;
    html_attributions: string[];
  }[];
  website?: string;
  // Add other fields like international_phone_number, etc. if needed
}

interface PlaceDetailsResponse {
  result?: PlaceDetailsResult;
  status: string;
  error_message?: string;
}


interface Props {
  location: CoffeeShop; // Base location info from list/map
  isFavorite: boolean;
  onToggleFavorite: (shopId: string) => void;
  onClose: () => void;
}

export default function LocationDetails({ location, isFavorite, onToggleFavorite, onClose }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [placeDetails, setPlaceDetails] = useState<PlaceDetailsResult | null>(null); // State for details
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isLoadingDetails, setIsLoadingDetails] = useState(true); // Loading for details + reviews

  // Fetch Place Details and Reviews when location changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingDetails(true);
      setReviews([]);
      setPlaceDetails(null); // Clear previous details

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
         console.error("Google Maps API Key missing for Place Details fetch");
         // Don't fully stop loading if reviews might still load from mock
      }

      // --- Fetch Place Details (if API key exists) ---
      if (apiKey) {
        // Define fields to request (manage costs!)
        const fields = 'formatted_address,opening_hours,website,photo,name'; // Add more fields as needed
        const detailsApiUrl = `/maps-api/place/details/json?placeid=${location.id}&fields=${fields}&key=${apiKey}`;

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
        }
      }

      // --- Fetch Reviews (existing logic, might still fail with 401) ---
      try {
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('*')
          .eq('coffee_shop_id', location.id);

        if (reviewsError || !reviewsData || reviewsData.length === 0) {
          console.warn(`Using mock reviews data for ${location.id}`);
          const filteredReviews = mockReviews.filter(
            review => review.coffee_shop_id === location.id
          );
          setReviews(filteredReviews);
        } else {
          setReviews(reviewsData);
        }
      } catch (err) {
        console.error('Error fetching reviews:', err);
        const filteredReviews = mockReviews.filter(
          review => review.coffee_shop_id === location.id
        );
        setReviews(filteredReviews);
      } finally {
        // Set loading false after both fetches attempt
        setIsLoadingDetails(false);
      }
    };

    fetchData();
  }, [location.id]); // Depend only on location.id

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    // ... (review submission logic remains the same)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'user-1';
      const newReviewObj: Partial<Review> = {
        coffee_shop_id: location.id,
        user_id: userId,
        rating: newReview.rating,
        comment: newReview.comment,
        created_at: new Date().toISOString()
      };
      if (user) {
        const { error } = await supabase.from('reviews').insert(newReviewObj);
        if (error) console.error('Error submitting review to Supabase:', error);
      }
      const newReviewWithId: Review = { ...newReviewObj as Review, id: `review-${Date.now()}` };
      setReviews(prev => [newReviewWithId, ...prev]);
      setNewReview({ rating: 5, comment: '' });
    } catch (err) {
      console.error('Error in handleSubmitReview:', err);
      alert('Failed to submit review. Please try again.');
    }
  };

  const handleShare = () => {
    // ... (share logic remains the same)
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

  // Helper to get photo URL
  const getPhotoUrl = (photoReference: string, maxWidth = 400) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return ''; // Or a placeholder image URL
    // Use the Vite proxy path
    return `/maps-api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`;
  };


  // Use the new loading state for the whole panel initially
  if (isLoadingDetails) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          <p className="ml-4 text-gray-600">Loading details...</p>
        </div>
      </div>
    );
  }

  return (
    // Modal backdrop
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      {/* Modal Panel */}
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b pb-4">
          <h2 className="text-3xl font-semibold text-gray-800">{location.name || 'Coffee Shop'}</h2>
          <div className="flex items-center gap-3">
            {/* Favorite Button */}
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
            {/* Close Button */}
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
         {placeDetails?.photos && placeDetails.photos.length > 0 && (
           <div className="mb-6 rounded-lg overflow-hidden">
             <img
               src={getPhotoUrl(placeDetails.photos[0].photo_reference, 800)} // Get URL for the first photo
               alt={`Photo of ${location.name}`}
               className="w-full h-48 object-cover"
               // Consider adding attribution if required by photos[0].html_attributions
             />
           </div>
         )}

        {/* Coffee Shop Details */}
        <div className="mb-6">
          {/* Use formatted_address from details if available, fallback to original address */}
          <p className="text-gray-600 mb-2">{placeDetails?.formatted_address || location.address}</p>

          {/* Website Link */}
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

          {/* Opening Hours */}
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

          {/* Original Amenities (still useful as fallbacks or if not in Place Details) */}
          <div className="grid grid-cols-2 gap-4 mt-4">
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

          {/* Share Button */}
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
        </div>

        {/* Reviews Section */}
        <div className="mb-8 border-t pt-6">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Reviews</h3>
          {/* Review display logic remains the same */}
          <div className="space-y-4">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-4">
                  <div className="flex items-center gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} className={ i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300' } />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm">
                    {review.comment || <span className="italic text-gray-500">No comment provided.</span>}
                  </p>
                  {review.created_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic">No reviews yet for this coffee shop.</p>
            )}
          </div>
        </div>

        {/* Review Form Section */}
        <form onSubmit={handleSubmitReview} className="space-y-4 border-t border-gray-200 pt-6 mt-6">
           {/* Review form logic remains the same */}
           <h3 className="text-xl font-semibold text-gray-700 mb-4">Leave a Review</h3>
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Your Rating</label>
             <div className="flex items-center gap-1">
               {[1, 2, 3, 4, 5].map((ratingValue) => (
                 <button key={ratingValue} type="button" title={`Rate ${ratingValue} star${ratingValue > 1 ? 's' : ''}`} onClick={() => setNewReview(prev => ({ ...prev, rating: ratingValue }))} className="p-1 rounded-full text-gray-300 hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 transition-colors duration-150 ease-in-out">
                   <Star size={24} className={`transition-colors duration-150 ease-in-out ${ ratingValue <= newReview.rating ? 'text-yellow-400 fill-yellow-400' : 'hover:text-yellow-300' }`} />
                 </button>
               ))}
             </div>
           </div>
           <div>
             <label htmlFor="comment" className="block text-sm font-medium text-gray-700">Your Comment</label>
             <textarea id="comment" value={newReview.comment} onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3" rows={4} placeholder="Share your experience at this coffee shop..."></textarea>
           </div>
           <button type="submit" className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
             Submit Review
           </button>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Star, Heart, Clock, DollarSign, Wifi, PawPrint } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { CoffeeShop, Review } from '../lib/types';
import { mockReviews, mockFavorites } from '../lib/mockData';

interface Props {
  location: CoffeeShop;
  onClose: () => void;
}

export default function LocationDetails({ location, onClose }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Try to fetch from Supabase first
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('*')
          .eq('coffee_shop_id', location.id);

        if (reviewsError || !reviewsData || reviewsData.length === 0) {
          console.warn('Using mock reviews data');
          // Filter mock reviews for this coffee shop
          const filteredReviews = mockReviews.filter(
            review => review.coffee_shop_id === location.id
          );
          setReviews(filteredReviews);
        } else {
          setReviews(reviewsData);
        }

        // Check if this coffee shop is in the user's favorites
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: favoriteData, error: favoriteError } = await supabase
            .from('favorites')
            .select('*')
            .eq('coffee_shop_id', location.id)
            .eq('user_id', user.id)
            .single();
          
          if (!favoriteError && favoriteData) {
            setIsFavorite(true);
          } else {
            // Check mock favorites
            const mockFavorite = mockFavorites.find(
              fav => fav.coffee_shop_id === location.id && fav.user_id === 'user-1'
            );
            setIsFavorite(!!mockFavorite);
          }
        } else {
          // For demo purposes, check if this coffee shop is in the mock user's favorites
          const mockFavorite = mockFavorites.find(
            fav => fav.coffee_shop_id === location.id && fav.user_id === 'user-1'
          );
          setIsFavorite(!!mockFavorite);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        // Use mock data as fallback
        const filteredReviews = mockReviews.filter(
          review => review.coffee_shop_id === location.id
        );
        setReviews(filteredReviews);
        
        const mockFavorite = mockFavorites.find(
          fav => fav.coffee_shop_id === location.id && fav.user_id === 'user-1'
        );
        setIsFavorite(!!mockFavorite);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [location]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'user-1'; // Use mock user ID if not logged in
      
      // Create a new review object
      const newReviewObj: Partial<Review> = {
        coffee_shop_id: location.id,
        user_id: userId,
        rating: newReview.rating,
        comment: newReview.comment,
        created_at: new Date().toISOString()
      };
      
      // Try to save to Supabase if user is logged in
      if (user) {
        const { error } = await supabase
          .from('reviews')
          .insert(newReviewObj);
          
        if (error) {
          console.error('Error submitting review to Supabase:', error);
          // Fall back to local state update
        }
      }
      
      // Update local state regardless of Supabase result
      const newReviewWithId: Review = {
        ...newReviewObj as Review,
        id: `review-${Date.now()}`
      };
      
      setReviews(prev => [newReviewWithId, ...prev]);
      setNewReview({ rating: 5, comment: '' });
      
    } catch (err) {
      console.error('Error in handleSubmitReview:', err);
      alert('Failed to submit review. Please try again.');
    }
  };

  const toggleFavorite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'user-1'; // Use mock user ID if not logged in
      
      // If user is logged in, try to update Supabase
      if (user) {
        if (isFavorite) {
          await supabase
            .from('favorites')
            .delete()
            .eq('coffee_shop_id', location.id)
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('favorites')
            .insert({
              coffee_shop_id: location.id,
              user_id: user.id,
              created_at: new Date().toISOString()
            });
        }
      }
      
      // Update local state regardless of Supabase result
      setIsFavorite(!isFavorite);
      
    } catch (err) {
      console.error('Error in toggleFavorite:', err);
      // Still update UI for better UX
      setIsFavorite(!isFavorite);
    }
  };

  const handleShare = () => {
    // Create a shareable link
    const shareUrl = `${window.location.origin}/shop/${location.id}`;
    
    // Check if the Web Share API is available
    if (navigator.share) {
      navigator.share({
        title: `Check out ${location.name}`,
        text: `I found a great coffee shop: ${location.name}`,
        url: shareUrl,
      }).catch(err => {
        console.error('Error sharing:', err);
        // Fallback to clipboard
        copyToClipboard(shareUrl);
      });
    } else {
      // Fallback for browsers that don't support the Web Share API
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('Link copied to clipboard!'))
      .catch(err => console.error('Could not copy text: ', err));
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
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
              onClick={toggleFavorite}
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

        {/* Coffee Shop Details */}
        <div className="mb-6">
          {location.address && (
            <p className="text-gray-600 mb-2">{location.address}</p>
          )}
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            {location.opening_hours && (
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-gray-500" />
                <span className="text-sm">{location.opening_hours}</span>
              </div>
            )}
            
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
          <div className="space-y-4">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-4">
                  {/* Star Rating */}
                  <div className="flex items-center gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={
                          i < review.rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }
                      />
                    ))}
                  </div>
                  {/* Review Comment */}
                  <p className="text-gray-700 text-sm">
                    {review.comment || <span className="italic text-gray-500">No comment provided.</span>}
                  </p>
                  {/* Optional: Add user info/timestamp if available */}
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
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Leave a Review</h3>
          {/* Rating Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Rating</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((ratingValue) => (
                <button
                  key={ratingValue}
                  type="button"
                  title={`Rate ${ratingValue} star${ratingValue > 1 ? 's' : ''}`}
                  onClick={() => setNewReview(prev => ({ ...prev, rating: ratingValue }))}
                  className="p-1 rounded-full text-gray-300 hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 transition-colors duration-150 ease-in-out"
                >
                  <Star
                    size={24} // Slightly larger stars
                    className={`transition-colors duration-150 ease-in-out ${
                      ratingValue <= newReview.rating
                        ? 'text-yellow-400 fill-yellow-400' // Selected stars
                        : 'hover:text-yellow-300' // Hover effect for unselected
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment Input */}
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
              Your Comment
            </label>
            <textarea
              id="comment"
              value={newReview.comment}
              onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3"
              rows={4}
              placeholder="Share your experience at this coffee shop..."
            ></textarea>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Submit Review
          </button>
        </form>
      </div>
    </div>
  );
}

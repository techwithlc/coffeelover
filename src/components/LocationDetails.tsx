import { useState, useEffect } from 'react';
import { Star, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];
type Review = Database['public']['Tables']['reviews']['Row'];

interface Props {
  location: Location;
  onClose: () => void;
}

export default function LocationDetails({ location, onClose }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  useEffect(() => {
    const fetchData = async () => {
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('location_id', location.id);

      const { data: user } = await supabase.auth.getUser();
      if (user) {
        const { data: favoriteData } = await supabase
          .from('favorites')
          .select('*')
          .eq('location_id', location.id)
          .eq('user_id', user.id)
          .single();
        
        setIsFavorite(!!favoriteData);
      }

      setReviews(reviewsData || []);
    };

    fetchData();
  }, [location]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in to leave a review');
      return;
    }

    const { error } = await supabase
      .from('reviews')
      .insert({
        location_id: location.id,
        user_id: user.id,
        rating: newReview.rating,
        comment: newReview.comment,
      });

    if (error) {
      console.error('Error submitting review:', error);
      return;
    }

    setNewReview({ rating: 5, comment: '' });
  };

  const toggleFavorite = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in to favorite locations');
      return;
    }

    if (isFavorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('location_id', location.id)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('favorites')
        .insert({
          location_id: location.id,
          user_id: user.id,
        });
    }

    setIsFavorite(!isFavorite);
  };

  return (
    // Modal backdrop
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      {/* Modal Panel */}
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b pb-4">
          <h2 className="text-3xl font-semibold text-gray-800">{location.name || 'Location Details'}</h2>
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

        {/* Reviews Section */}
        <div className="mb-8">
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
                  {/* <p className="text-xs text-gray-400 mt-1">Reviewed by User {review.user_id?.substring(0, 6)} on {new Date(review.created_at).toLocaleDateString()}</p> */}
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic">No reviews yet for this location.</p>
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
              placeholder="Share your thoughts about this location..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
          >
            Submit Review
          </button>
        </form>
      </div>
    </div>
  );
}

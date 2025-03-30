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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{location.name}</h2>
          <div className="flex gap-2">
            <button
              onClick={toggleFavorite}
              className={`p-2 rounded-full ${isFavorite ? 'text-red-500' : 'text-gray-500'}`}
            >
              <Heart className={isFavorite ? 'fill-current' : ''} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">Reviews</h3>
          {reviews.map((review) => (
            <div key={review.id} className="border-b py-2">
              <div className="flex items-center gap-1">
                {[...Array(review.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-600">{review.comment}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmitReview} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setNewReview(prev => ({ ...prev, rating }))}
                  className="focus:outline-none"
                >
                  <Star
                    className={`w-6 h-6 ${
                      rating <= newReview.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Comment</label>
            <textarea
              value={newReview.comment}
              onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Submit Review
          </button>
        </form>
      </div>
    </div>
  );
}
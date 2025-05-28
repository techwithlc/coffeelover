import React, { useState } from 'react';
import { Wifi, BatteryCharging, Volume2, Clock, Coffee, Star } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

interface WorkFeedbackWidgetProps {
  locationId: string;
  userId: string | null;
  onFeedbackSubmitted?: () => void;
}

interface WorkFeedback {
  wifi_speed: number | null; // 1-5 scale
  power_outlets: number | null; // 1-5 scale (availability/accessibility)
  noise_level: number | null; // 1-5 scale (1 = very quiet, 5 = very loud)
  work_friendly: number | null; // 1-5 scale
  coffee_quality: number | null; // 1-5 scale
  overall_rating: number | null; // 1-5 scale
}

const WorkFeedbackWidget: React.FC<WorkFeedbackWidgetProps> = ({
  locationId,
  userId,
  onFeedbackSubmitted
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<WorkFeedback>({
    wifi_speed: null,
    power_outlets: null,
    noise_level: null,
    work_friendly: null,
    coffee_quality: null,
    overall_rating: null,
  });

  const handleRatingChange = (category: keyof WorkFeedback, rating: number) => {
    setFeedback(prev => ({ ...prev, [category]: rating }));
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast.error('Please log in to submit feedback');
      return;
    }

    // Check if at least one rating is provided
    const hasAnyRating = Object.values(feedback).some(value => value !== null);
    if (!hasAnyRating) {
      toast.error('Please provide at least one rating');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('work_feedback')
        .insert({
          location_id: locationId,
          user_id: userId,
          ...feedback,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('You have already submitted feedback for this location');
        } else {
          throw error;
        }
      } else {
        toast.success('Thank you for your feedback!');
        setIsExpanded(false);
        setFeedback({
          wifi_speed: null,
          power_outlets: null,
          noise_level: null,
          work_friendly: null,
          coffee_quality: null,
          overall_rating: null,
        });
        onFeedbackSubmitted?.();
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarRating = (
    category: keyof WorkFeedback,
    label: string,
    icon: React.ReactNode,
    description?: string
  ) => {
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="font-medium text-sm">{label}</span>
        </div>
        {description && (
          <p className="text-xs text-gray-600 mb-2">{description}</p>
        )}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => handleRatingChange(category, rating)}
              className={`p-1 rounded transition-colors ${
                feedback[category] && feedback[category]! >= rating
                  ? 'text-yellow-500'
                  : 'text-gray-300 hover:text-yellow-400'
              }`}
            >
              <Star size={20} fill={feedback[category] && feedback[category]! >= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (!isExpanded) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-blue-900">Help fellow remote workers!</h3>
            <p className="text-sm text-blue-700">Share your work experience at this café</p>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Quick Review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Work-Friendly Review</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {renderStarRating(
          'wifi_speed',
          'Wi-Fi Speed',
          <Wifi size={16} className="text-blue-500" />,
          '1 = Very slow, 5 = Very fast'
        )}

        {renderStarRating(
          'power_outlets',
          'Power Outlets',
          <BatteryCharging size={16} className="text-green-500" />,
          '1 = None available, 5 = Plenty available'
        )}

        {renderStarRating(
          'noise_level',
          'Noise Level',
          <Volume2 size={16} className="text-purple-500" />,
          '1 = Very quiet, 5 = Very loud'
        )}

        {renderStarRating(
          'work_friendly',
          'Work Environment',
          <Clock size={16} className="text-orange-500" />,
          '1 = Not suitable for work, 5 = Perfect for work'
        )}

        {renderStarRating(
          'coffee_quality',
          'Coffee Quality',
          <Coffee size={16} className="text-brown-500" />,
          '1 = Poor, 5 = Excellent'
        )}

        {renderStarRating(
          'overall_rating',
          'Overall Rating',
          <Star size={16} className="text-yellow-500" />,
          'Your overall experience'
        )}
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Review'}
        </button>
        <button
          onClick={() => setIsExpanded(false)}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default WorkFeedbackWidget; 
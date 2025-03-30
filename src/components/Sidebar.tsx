import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Location = Database['public']['Tables']['locations']['Row'];

interface Props {
  onLocationSelect: (location: Location) => void;
}

export default function Sidebar({ onLocationSelect }: Props) {
  const [favorites, setFavorites] = useState<Location[]>([]);

  useEffect(() => {
    const fetchFavorites = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favorites')
        .select(`
          location_id,
          locations (*)
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching favorites:', error);
        return;
      }

      // Let Supabase infer types, filter out entries where the joined location is missing
      const validFavorites = data
        ?.filter(f => f.locations) // Ensure the joined 'locations' object exists and data is not null
        .map(f => f.locations as unknown as Location); // Cast via unknown first

      setFavorites(validFavorites || []); // Ensure we set an array even if data is null/undefined initially
    };

    fetchFavorites();

    // Subscribe to favorites changes
    const subscription = supabase
      .channel('favorites')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'favorites' }, () => {
        fetchFavorites();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    // Sidebar container
    <div className="w-72 bg-gray-50 h-screen p-4 overflow-y-auto border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="mb-6 pb-3 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Heart className="text-red-500" size={20} />
          Favorite Locations
        </h2>
      </div>

      {/* Favorites List */}
      {favorites.length > 0 ? (
        <div className="space-y-2 flex-1">
          {favorites.map((location) => (
            <button
              key={location.id}
              onClick={() => onLocationSelect(location)}
              className="w-full text-left p-3 hover:bg-indigo-100 rounded-lg transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              <h3 className="font-medium text-gray-800 truncate">{location.name || 'Unnamed Location'}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}
              </p>
            </button>
          ))}
        </div>
      ) : (
        // Empty State
        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
           <Heart size={32} className="mb-3 text-gray-400" />
           <p className="text-sm">No favorite locations yet.</p>
           <p className="text-xs mt-1">Click the heart icon on a location's details to add it here.</p>
        </div>
      )}
    </div>
  );
}

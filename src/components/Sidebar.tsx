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

      setFavorites(data.map((f: any) => f.locations));
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
    <div className="w-64 bg-white h-full p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Heart className="text-red-500" />
        Favorites
      </h2>
      
      <div className="space-y-2">
        {favorites.map((location) => (
          <button
            key={location.id}
            onClick={() => onLocationSelect(location)}
            className="w-full text-left p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <h3 className="font-medium">{location.name}</h3>
            <p className="text-sm text-gray-500">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
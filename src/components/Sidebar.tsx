import React from 'react'; // Removed useState import
import { CoffeeShop } from '../lib/types';
// Removed AI imports as logic is moved to App

// Define the props for the Sidebar component
interface SidebarProps {
  locations: CoffeeShop[];
  onSelectLocation: (location: CoffeeShop) => void;
  className?: string;
  // Removed all AI-related props
}

const Sidebar: React.FC<SidebarProps> = ({
  locations,
  onSelectLocation,
  className,
}) => {

  // Locations are now directly the search results passed from App
  const displayedLocations = locations;

  return (
    <div className={`${className} border-r bg-background p-4 flex flex-col h-full`}>
      {/* Changed Title */}
      <h2 className="text-lg font-semibold mb-4">Nearby Coffee Shops</h2>

      {/* Removed Filter Clear Button */}

      {/* Coffee Shop List - Displays current 'locations' */}
      <div className="flex-grow overflow-y-auto border-t pt-4 space-y-3">
        {displayedLocations.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2">
            {'No coffee shops found or still loading...'} {/* Simplified message */}
          </p>
        ) : (
          displayedLocations.map((location) => (
            <div
              key={location.id}
              className="border rounded-lg p-4 shadow-sm hover:shadow-md cursor-pointer bg-white transition-shadow duration-200"
              onClick={() => onSelectLocation(location)}
            >
              <h3 className="font-semibold text-base mb-1">{location.name || 'Unnamed Shop'}</h3>
              {location.address && (
                <p className="text-sm text-gray-600 mb-1">{location.address}</p>
              )}
              {location.rating && (
                <div className="flex items-center">
                  <span className="text-sm text-yellow-500">★</span>
                  <span className="text-sm ml-1 text-gray-700">{location.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;

import React from 'react';
import { CoffeeShop } from '../lib/types';

// Define the props for the Sidebar component
interface SidebarProps {
  locations: CoffeeShop[];
  onSelectLocation: (location: CoffeeShop) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ locations, onSelectLocation }) => {
  return (
    <div className="w-80 border-r bg-background p-4 flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-4">Coffee Shops</h2>
      <div className="flex-grow overflow-y-auto">
        {locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading coffee shops...</p>
        ) : (
          locations.map((location) => (
            <React.Fragment key={location.id}>
              <div
                className="p-2 hover:bg-gray-100 rounded cursor-pointer"
                onClick={() => onSelectLocation(location)}
              >
                <h3 className="font-medium">{location.name || 'Unnamed Shop'}</h3>
                {location.address && (
                  <p className="text-sm text-gray-500">{location.address}</p>
                )}
                {location.rating && (
                  <div className="flex items-center mt-1">
                    <span className="text-sm text-yellow-500">★</span>
                    <span className="text-sm ml-1">{location.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="my-1 border-b border-gray-200"></div>
            </React.Fragment>
          ))
        )}
      </div>
      {/* Add search/filter input here later */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search or prompt..."
          className="w-full p-2 border rounded"
          // Add state and onChange handler for search/prompt later
        />
      </div>
    </div>
  );
};

export default Sidebar;

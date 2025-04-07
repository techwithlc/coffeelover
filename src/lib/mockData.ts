import type { CoffeeShop } from './types';

export const mockCoffeeShops: CoffeeShop[] = [
  {
    id: 'mock-uuid-1', // Placeholder UUID
    google_place_id: 'mock-google-place-id-1', // Placeholder Google Place ID
    name: 'Example Cafe A',
    address: '123 Main St, Taipei',
    lat: 25.0330,
    lng: 121.5654,
    opening_hours: { open_now: true },
    utc_offset_minutes: 480,
    has_wifi: true,
    pet_friendly: true,
    has_chargers: true,
    charger_count: 4,
    price_range: '$$',
    description: 'A cozy cafe with fast Wi-Fi and plenty of power outlets.',
    rating: 4.5,
    menu_highlights: ['Latte', 'Croissant'],
    images: [],
  },
  {
    id: 'mock-uuid-2', // Placeholder UUID
    google_place_id: 'mock-google-place-id-2', // Placeholder Google Place ID
    name: 'Example Cafe B',
    address: '456 Second St, Taipei',
    lat: 25.0340,
    lng: 121.5640,
    opening_hours: { open_now: false },
    utc_offset_minutes: 480,
    has_wifi: false,
    pet_friendly: false,
    has_chargers: false,
    charger_count: 0,
    price_range: '$',
    description: 'A budget-friendly spot with basic amenities.',
    rating: 3.8,
    menu_highlights: ['Americano', 'Bagel'],
    images: [],
  },
];

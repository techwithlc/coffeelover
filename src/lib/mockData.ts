import { CoffeeShop, Review, User, Favorite } from './types';

// Sample users
export const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'Coffee Enthusiast',
    email: 'coffee@example.com',
    avatar_url: 'https://i.pravatar.cc/150?u=coffee'
  },
  {
    id: 'user-2',
    name: 'Espresso Lover',
    email: 'espresso@example.com',
    avatar_url: 'https://i.pravatar.cc/150?u=espresso'
  }
];

// Sample coffee shops in Taichung
export const mockCoffeeShops: CoffeeShop[] = [
  {
    id: 'coffee-1',
    name: 'Fong Jia Cafe',
    address: 'No. 123, Fuxing Rd, Xitun District, Taichung City',
    lat: 24.179,
    lng: 120.646,
    opening_hours: '10:00 AM - 10:00 PM',
    description: 'A cozy cafe near Feng Chia University with a wide selection of coffee and desserts.',
    rating: 4.5,
    price_range: '$$',
    wifi_available: true,
    pet_friendly: true,
    has_power_outlets: true,
    menu_highlights: ['Honey Latte', 'Tiramisu', 'Avocado Toast'],
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-03-20T10:30:00Z'
  },
  {
    id: 'coffee-2',
    name: 'Taichung Roasters',
    address: 'No. 45, Zhongming S Rd, West District, Taichung City',
    lat: 24.151,
    lng: 120.663,
    opening_hours: '08:00 AM - 06:00 PM',
    description: 'Specialty coffee shop with beans roasted in-house. Known for their pour-overs and cold brew.',
    rating: 4.8,
    price_range: '$$$',
    wifi_available: true,
    pet_friendly: false,
    has_power_outlets: true,
    menu_highlights: ['Single Origin Pour-Over', 'Cold Brew', 'Almond Croissant'],
    created_at: '2023-11-05T09:15:00Z',
    updated_at: '2024-02-28T14:20:00Z'
  },
  {
    id: 'coffee-3',
    name: 'Green Garden Coffee',
    address: 'No. 78, Gongyi Rd, Nantun District, Taichung City',
    lat: 24.144,
    lng: 120.651,
    opening_hours: '09:00 AM - 11:00 PM',
    description: 'A spacious cafe with a beautiful garden setting. Perfect for studying or meetings.',
    rating: 4.3,
    price_range: '$$',
    wifi_available: true,
    pet_friendly: true,
    has_power_outlets: true,
    menu_highlights: ['Matcha Latte', 'Fruit Waffles', 'Chicken Sandwich'],
    created_at: '2023-08-20T11:30:00Z',
    updated_at: '2024-01-10T16:45:00Z'
  },
  {
    id: 'coffee-4',
    name: 'Night Owl Coffee',
    address: 'No. 156, Taiwan Boulevard, North District, Taichung City',
    lat: 24.163,
    lng: 120.684,
    opening_hours: '12:00 PM - 02:00 AM',
    description: 'Late-night coffee shop perfect for night owls. Offers a quiet environment for working late.',
    rating: 4.6,
    price_range: '$$',
    wifi_available: true,
    pet_friendly: false,
    has_power_outlets: true,
    menu_highlights: ['Espresso Tonic', 'Affogato', 'Cheesecake'],
    created_at: '2023-10-12T14:20:00Z',
    updated_at: '2024-03-15T19:10:00Z'
  },
  {
    id: 'coffee-5',
    name: 'Mountain View Beans',
    address: 'No. 92, Dadun Rd, Nantun District, Taichung City',
    lat: 24.132,
    lng: 120.637,
    opening_hours: '07:30 AM - 09:00 PM',
    description: 'Coffee shop with a view of the mountains. Specializes in Taiwanese coffee beans.',
    rating: 4.7,
    price_range: '$$',
    wifi_available: true,
    pet_friendly: true,
    has_power_outlets: true,
    menu_highlights: ['Taiwan High Mountain Coffee', 'Honey Toast', 'Egg Tarts'],
    created_at: '2023-09-05T10:45:00Z',
    updated_at: '2024-02-20T08:30:00Z'
  }
];

// Sample reviews
export const mockReviews: Review[] = [
  {
    id: 'review-1',
    coffee_shop_id: 'coffee-1',
    user_id: 'user-1',
    rating: 5,
    comment: 'Great atmosphere and the honey latte is to die for!',
    created_at: '2024-02-10T14:30:00Z'
  },
  {
    id: 'review-2',
    coffee_shop_id: 'coffee-1',
    user_id: 'user-2',
    rating: 4,
    comment: 'Cozy place but can get crowded during peak hours.',
    created_at: '2024-01-25T18:15:00Z'
  },
  {
    id: 'review-3',
    coffee_shop_id: 'coffee-2',
    user_id: 'user-1',
    rating: 5,
    comment: 'The single origin pour-over changed my life. Best coffee in Taichung!',
    created_at: '2024-03-05T11:20:00Z'
  },
  {
    id: 'review-4',
    coffee_shop_id: 'coffee-3',
    user_id: 'user-2',
    rating: 4,
    comment: 'Beautiful garden setting, great for a relaxing afternoon.',
    created_at: '2024-02-18T16:40:00Z'
  },
  {
    id: 'review-5',
    coffee_shop_id: 'coffee-4',
    user_id: 'user-1',
    rating: 5,
    comment: 'Perfect for late night work sessions. The espresso tonic is amazing!',
    created_at: '2024-03-10T23:50:00Z'
  }
];

// Sample favorites
export const mockFavorites: Favorite[] = [
  {
    id: 'favorite-1',
    user_id: 'user-1',
    coffee_shop_id: 'coffee-1',
    list_name: 'My Favorites',
    created_at: '2024-02-15T09:30:00Z'
  },
  {
    id: 'favorite-2',
    user_id: 'user-1',
    coffee_shop_id: 'coffee-2',
    list_name: 'Best Coffee',
    created_at: '2024-03-08T14:20:00Z'
  },
  {
    id: 'favorite-3',
    user_id: 'user-2',
    coffee_shop_id: 'coffee-3',
    list_name: 'Study Spots',
    created_at: '2024-02-20T11:15:00Z'
  },
  {
    id: 'favorite-4',
    user_id: 'user-2',
    coffee_shop_id: 'coffee-4',
    list_name: 'Night Spots',
    created_at: '2024-03-12T22:10:00Z'
  }
];

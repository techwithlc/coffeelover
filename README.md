# Coffeelover - Work-Friendly Coffee Shop Discovery Platform

A community-driven platform for discovering and reviewing work-friendly coffee shops, optimized for remote workers, digital nomads, and tech professionals.

## 🌟 Features

### Core Functionality
- **AI-Powered Search**: Natural language search with location-aware results
- **Work-Focused Filters**: Find cafés by Wi-Fi quality, power outlets, noise level, and work environment
- **Geographic Intelligence**: Smart location parsing to distinguish between business names and geographic locations
- **Real-time Data**: Opening hours, ratings, and amenities from Google Places API

### User-Generated Content (UGC)
- **Work Environment Reviews**: Rate Wi-Fi speed, power outlet availability, noise level, and work-friendliness
- **Community Validation**: User-contributed data on work amenities
- **Quick Feedback System**: Streamlined review process for busy professionals

### Technical Features
- **Responsive Design**: Mobile-first approach with modern UI
- **Real-time Updates**: Live search results and user feedback
- **Offline-Ready**: Progressive Web App capabilities
- **Authentication**: Secure user accounts with Supabase Auth

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Google Maps API key
- Google Gemini API key

### Environment Variables
Create a `.env` file in the root directory:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/coffeelover.git
cd coffeelover
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Hot Toast** for notifications
- **Lucide React** for icons

### Backend Services
- **Supabase** for database and authentication
- **Google Places API** for location data
- **Google Gemini AI** for natural language processing
- **Netlify Functions** for API proxying

### Database Schema
Key tables:
- `locations` - Coffee shop data
- `work_feedback` - Work-friendly reviews
- `location_wifi_details` - Wi-Fi information
- `location_charger_details` - Power outlet data
- `users` - User accounts
- `favorites` - User bookmarks

## 🎯 Work-Focused Features

### Search Intelligence
The AI understands work-related queries like:
- "Quiet coffee shops with power outlets near me"
- "Work-friendly cafés with fast WiFi in Manhattan"
- "24-hour coffee shops for late night work"
- "Affordable cafés for studying in Brooklyn"

### Data Points Collected
- **Wi-Fi Speed**: User-tested connection quality (1-5 scale)
- **Power Outlets**: Availability and accessibility (1-5 scale)
- **Noise Level**: Work environment assessment (1-5 scale)
- **Work-Friendliness**: Overall suitability for productivity (1-5 scale)
- **Coffee Quality**: Beverage rating (1-5 scale)
- **Opening Hours**: Community-validated hours
- **Price Level**: Cost assessment for budget-conscious users

### UGC Engagement Features
- **Quick Review Widget**: Streamlined feedback collection
- **Work Environment Ratings**: Specific metrics for remote workers
- **Community Validation**: Crowd-sourced accuracy improvements
- **Reward System**: Recognition for active contributors (planned)

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run tests

### Code Structure
```
src/
├── components/          # React components
│   ├── LandingPage.tsx  # Main landing page
│   ├── Map.tsx          # Interactive map
│   ├── Sidebar.tsx      # Results sidebar
│   ├── LocationDetails.tsx # Café detail modal
│   └── WorkFeedbackWidget.tsx # UGC collection
├── hooks/               # Custom React hooks
│   └── useCoffeeSearch.tsx # Main search logic
├── lib/                 # Utilities and types
│   ├── types.ts         # TypeScript definitions
│   ├── supabaseClient.ts # Database client
│   └── database.types.ts # Generated DB types
└── App.tsx              # Main application component
```

### Key Improvements Made

1. **Enhanced Location Parsing**: Better distinction between business names and geographic locations
2. **Work-Focused Search**: Improved AI prompts for work-related queries
3. **UGC Collection**: New WorkFeedbackWidget for community data
4. **Search Specificity**: Refined Google Places API queries for better results
5. **User Experience**: Updated copy and hints for work-focused positioning

## 🌐 Deployment

### Netlify Deployment
The app is configured for Netlify with:
- Automatic builds from Git
- Serverless functions for API proxying
- Environment variable management
- Custom redirects for SPA routing

### Production Considerations
- Enable RLS (Row Level Security) in Supabase
- Set up proper CORS policies
- Configure rate limiting for API endpoints
- Implement caching strategies
- Monitor API usage and costs

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Priority Areas
- Mobile app development
- Advanced filtering algorithms
- Machine learning for recommendation engine
- Integration with coworking space APIs
- Accessibility improvements

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Places API for location data
- Supabase for backend infrastructure
- The remote work community for inspiration
- Contributors and beta testers

---

**Built for the remote work community** 🏠💻☕

import React, { useState, useEffect, FormEvent, useCallback, Suspense, lazy } from 'react';
// Lazy load large components for faster initial load
const Map = lazy(() => import('./components/Map'));
const Sidebar = lazy(() => import('./components/Sidebar'));
const LocationDetails = lazy(() => import('./components/LocationDetails'));

import { Toaster, toast, Toast } from 'react-hot-toast';
import type { CoffeeShop } from './lib/types'; // Removed unused OpeningHours, OpeningHoursPeriod
import { supabase } from './lib/supabaseClient';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
// Removed Gemini imports
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { Session } from '@supabase/supabase-js';
import { useCoffeeSearch } from './hooks/useCoffeeSearch'; // Import the hook

// --- Removed Helper Functions and Constants ---
// getDistanceFromLatLonInKm, deg2rad, isShopOpenNow, filterShopsByCriteria, fetchPlaceDetails
// BASE_DETAIL_FIELDS, WIFI_HINT_FIELDS, etc.
// Removed Gemini Initialization
// Removed Places API and AI Response type definitions

// --- Custom Toast Renderer (Keep for now, could move to utils) ---
const renderClosableToast = (message: string, toastInstance: Toast, type: 'success' | 'error' = 'success') => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
    <span style={{ marginRight: '10px' }}>{message}</span>
    <button onClick={() => toast.dismiss(toastInstance.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1em', lineHeight: '1', padding: '0 4px', color: type === 'error' ? '#DC2626' : '#10B981' }} aria-label="Close" > &times; </button>
  </div>
);


// ErrorBoundary for catching rendering errors
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('ErrorBoundary caught:', error, info); }
  render() {
    if (this.state.hasError) return <div className="p-8 text-red-600">Something went wrong. Please reload the page.</div>;
    return this.props.children;
  }
}

function App() {
  // State for view mode
  const [viewMode, setViewMode] = useState<'landing' | 'map'>('landing');

  // State for prompts
  const [prompt, setPrompt] = useState(''); // Used by Header in map view
  const [landingPrompt, setLandingPrompt] = useState(''); // Used by Landing Page search

  // --- Removed isLoading, isGenerating, coffeeShops state ---

  // Auth state
  const [session, setSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Map/Sidebar specific state (Keep these)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedLocation, setSelectedLocation] = useState<CoffeeShop | null>(null);
  const [currentMapCenter, setCurrentMapCenter] = useState({ lat: 24.1477, lng: 120.6736 });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // --- Instantiate the Search Hook ---
  const {
    isLoading,
    isGenerating,
    searchResults, // Renamed from coffeeShops
    searchError,
    mapCenterToUpdate,
    performSearch,
    setMapCenterToUpdate // Function to reset the signal
  } = useCoffeeSearch(userLocation, currentMapCenter);

  // --- Effect to perform an initial default search on first load ---
  // (Removed to prevent unwanted fetch on refresh or navigation)

  // --- Effect to update map center based on hook signal ---
  useEffect(() => {
    if (mapCenterToUpdate) {
      setCurrentMapCenter(mapCenterToUpdate);
      setMapCenterToUpdate(null); // Reset the signal after updating
    }
  }, [mapCenterToUpdate, setMapCenterToUpdate]);

  // --- Effect to show search errors from the hook ---
   useEffect(() => {
     if (searchError) {
       toast.error((t) => renderClosableToast(`Search Error: ${searchError}`, t, 'error'));
       // Optionally clear the error state in the hook after showing toast?
       // Depends on whether you want the error to persist or be transient.
     }
   }, [searchError]);


  // --- Geolocation Handler (Keep) ---
  const requestLocation = useCallback(async () => {
    // ... (geolocation logic remains the same) ...
    if (!navigator.geolocation) { toast.error((t) => renderClosableToast("Geolocation is not supported by your browser.", t, 'error')); return; }
    if (navigator.permissions && navigator.permissions.query) { try { const permissionStatus = await navigator.permissions.query({ name: 'geolocation' }); if (permissionStatus.state === 'denied') { toast.error((t) => renderClosableToast("Location permission denied.", t, 'error')); return; } } catch (permError) { console.warn("Could not query geolocation permission status:", permError); } }
    const loadingToast = toast.loading("Getting your location..."); navigator.geolocation.getCurrentPosition( (position) => { const { latitude, longitude } = position.coords; const newLocation = { lat: latitude, lng: longitude }; setUserLocation(newLocation); setCurrentMapCenter(newLocation); toast.success((t) => renderClosableToast("Location found! Map centered.", t), { id: loadingToast }); }, (error) => { console.error("Geolocation error:", error); let message = "Failed to get location."; switch (error.code) { case error.PERMISSION_DENIED: message = "Location permission denied."; break; case error.POSITION_UNAVAILABLE: message = "Location information is currently unavailable."; break; case error.TIMEOUT: message = "Location request timed out."; break; } toast.error((t) => renderClosableToast(message, t, 'error'), { id: loadingToast }); setUserLocation(null); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 } );
  }, []);

  // Auth Listener & Favorites Loading (Keep)
  useEffect(() => {
    // ... (auth and favorites loading logic remains the same) ...
    const savedFavorites = localStorage.getItem('coffeeLoverFavorites'); if (savedFavorites) { try { const ids = JSON.parse(savedFavorites); if (Array.isArray(ids)) { setFavoriteIds(new Set(ids)); } } catch (e) { console.error("Failed to parse favorites", e); } }
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); }); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); if (_event === 'SIGNED_IN') { setShowAuthModal(false); toast.success((t) => renderClosableToast('Logged in successfully!', t)); } if (_event === 'SIGNED_OUT') { toast.success((t) => renderClosableToast('Logged out.', t)); } }); return () => subscription.unsubscribe();
  }, []);

  // Save Favorites Effect (Keep)
  useEffect(() => { localStorage.setItem('coffeeLoverFavorites', JSON.stringify(Array.from(favoriteIds))); }, [favoriteIds]);

  // --- Removed handleKeywordSearch and handleAiSearch ---

  // --- Updated Handlers to use performSearch ---
  const handleLandingSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPrompt(landingPrompt); // Keep updating main prompt for consistency if needed
    setSelectedLocation(null); // Clear selected location on new search
    performSearch(landingPrompt).then(() => setViewMode('map'));
  };

  const handleHeaderSearchSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setSelectedLocation(null);
    await performSearch(prompt);
  };

   const handleHintClick = (hint: string) => {
     setLandingPrompt(hint);
     setSelectedLocation(null);
     performSearch(hint).then(() => setViewMode('map'));
   };

  // Other Handlers (Keep)
  const handleToggleFavorite = (shopId: string) => {
    setFavoriteIds(prevIds => { const newIds = new Set(prevIds); if (newIds.has(shopId)) { newIds.delete(shopId); toast.success((t) => renderClosableToast('Removed from favorites', t)); } else { newIds.add(shopId); toast.success((t) => renderClosableToast('Added to favorites', t)); } return newIds; });
  };
  const handleSelectLocation = (location: CoffeeShop) => { setSelectedLocation(location); };
  const handleLogout = async () => { await supabase.auth.signOut(); };

  // --- Render Logic ---
  return (
    <ErrorBoundary>
      <Toaster position="top-right" />
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><span className="loader" /> Loading app...</div>}>
        {viewMode === 'landing' ? (
          <LandingPage
            session={session}
            onLoginClick={() => setShowAuthModal(true)}
            handleLogout={handleLogout}
            landingPrompt={landingPrompt}
            setLandingPrompt={setLandingPrompt}
            handleLandingSearchSubmit={handleLandingSearchSubmit}
            handleHintClick={handleHintClick}
            isLoading={isLoading}
            requestLocation={requestLocation}
          />
        ) : (
          <div className="flex h-screen">
            <Sidebar
              locations={searchResults}
              onSelectLocation={handleSelectLocation}
              className="w-80"
            />
            <main className="flex-1 relative">
              <Header
                prompt={prompt}
                setPrompt={setPrompt}
                isGenerating={isGenerating}
                handlePromptSubmit={handleHeaderSearchSubmit} 
                requestLocation={requestLocation}
                hasLocation={!!userLocation}
                onLogoClick={() => {
                  setViewMode('landing');
                  setPrompt('');
                  setLandingPrompt('');
                  setSelectedLocation(null);
                }}
              />
              <Map
                center={currentMapCenter}
                locations={searchResults}
                onMarkerClick={handleSelectLocation}
                favoriteIds={favoriteIds}
              />
              {selectedLocation && (
                <LocationDetails
                  location={selectedLocation}
                  onClose={() => setSelectedLocation(null)}
                  isFavorite={favoriteIds.has(selectedLocation.id)}
                  onToggleFavorite={handleToggleFavorite}
                  userId={session?.user?.id ?? null}
                />
              )}
            </main>
          </div>
        )}
      </Suspense>


      {/* Auth Modal (Keep) */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 max-w-md w-full relative">
             <button onClick={() => setShowAuthModal(false)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100" aria-label="Close login modal" > <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> </svg> </button>
            <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={['google', 'github']} redirectTo={window.location.origin} theme="light" />
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}

export default App;

import React, { useState, useEffect, FormEvent } from 'react';
import { Toaster, toast, Toast } from 'react-hot-toast';
import { supabase } from './lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { Session } from '@supabase/supabase-js';
// Removed unused imports: LocationDetails, CoffeeShop

// --- Custom Toast Renderer ---
const renderClosableToast = (message: string, toastInstance: Toast, type: 'success' | 'error' = 'success') => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
    <span style={{ marginRight: '10px' }}>{message}</span>
    <button
      onClick={() => toast.dismiss(toastInstance.id)}
      style={{
        border: 'none', background: 'transparent', cursor: 'pointer',
        fontWeight: 'bold', fontSize: '1.1em', lineHeight: '1', padding: '0 4px',
        color: type === 'error' ? '#DC2626' : '#10B981'
      }}
      aria-label="Close"
    >
      &times;
    </button>
  </div>
);

// Define the example query hints
const queryHints = [
  "Cafés with power outlets near Taipei 101",
  "Stable Wi-Fi cafés Taichung",
  "Coffee shops open now",
];

function App() {
  const [prompt, setPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Removed unused state: favoriteIds, selectedLocation

  // Effect for Auth Listener
  useEffect(() => {
    // Removed loading favorites logic
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN') {
        setShowAuthModal(false);
        toast.success((t) => renderClosableToast('Logged in successfully!', t));
      }
      if (_event === 'SIGNED_OUT') {
        toast.success((t) => renderClosableToast('Logged out.', t));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

   // Removed Effect to save favorites

  // Handler to redirect to Google Maps Search
  const handleGoogleMapsRedirect = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      toast.error((t) => renderClosableToast("Please enter a location or search term.", t, 'error'));
      return;
    }
    setIsSearching(true);
    const googleMapsQuery = encodeURIComponent(searchTerm.trim());
    const googleMapsUrl = `https://www.google.com/maps/search/${googleMapsQuery}`;

    toast.loading(`Redirecting to Google Maps for "${searchTerm.trim()}"...`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay

    window.location.href = googleMapsUrl;
  };

  // Form submission handler
  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleGoogleMapsRedirect(prompt);
  };

  // Hint button click handler
  const handleHintClick = (hint: string) => {
    setPrompt(hint); // Set the prompt value
    handleGoogleMapsRedirect(hint); // Immediately trigger redirect
  };

   // Removed handleToggleFavorite handler

   const handleLogout = async () => { await supabase.auth.signOut(); };

  return (
    <>
      {/* Main Landing Page Content Area */}
      <main className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-100 via-purple-100 to-indigo-200 relative" style={{ minHeight: '100vh' }}>

         {/* Auth Button - Top Right */}
         <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
           {session ? (
             <div className="flex items-center gap-2 bg-white rounded-full shadow px-3 py-1.5">
                <span className="text-sm text-gray-600 hidden sm:inline">{session.user.email?.split('@')[0]}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                  title="Logout"
                >
                  Logout
                </button>
             </div>
           ) : (
             <button
               onClick={() => setShowAuthModal(true)}
               className="px-4 py-2 text-sm bg-white text-blue-600 rounded-full shadow hover:bg-gray-50 transition-colors font-medium"
               title="Login / Sign Up"
             >
               Login / Sign Up
             </button>
           )}
         </div>

        {/* Central Content Area */}
        <div className="text-center max-w-3xl w-full px-4 mb-16"> {/* Added bottom margin */}
          {/* Logo Placeholder */}
          <div className="mb-8">
             <span className="text-5xl font-bold text-indigo-600">Coffeelover</span> {/* Simple text logo */}
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold mb-3 text-gray-800">Find Your Next Coffee Stop</h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-10">Discover cafes with the perfect vibe, Wi-Fi, and more.</p>

          {/* Central Search Form */}
          <form onSubmit={handleFormSubmit} className="w-full max-w-2xl mx-auto mb-4">
            <div className="flex items-center bg-white p-2 rounded-full shadow-xl border border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 mx-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Search cafes by name, location, features..."
                className="flex-grow p-3 text-lg focus:outline-none w-full rounded-full" // Adjusted padding/rounding
                disabled={isSearching}
              />
              <button
                type="submit"
                disabled={isSearching}
                className="p-3 px-7 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-gray-400 flex items-center justify-center ml-2 flex-shrink-0 text-lg font-medium" // Adjusted styling
              >
                {isSearching ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </form>

           {/* Example Query Hints */}
           <div className="mt-4 flex flex-wrap gap-2 justify-center px-1 md:px-0">
             {queryHints.map((hint) => (
               <button
                 key={hint}
                 type="button"
                 onClick={() => handleHintClick(hint)} // Use specific handler
                 disabled={isSearching}
                 className="text-sm bg-white/70 backdrop-blur-sm text-gray-700 px-3 py-1 rounded-full hover:bg-white transition-colors disabled:opacity-50 border border-gray-200"
               >
                 {hint}
               </button>
             ))}
           </div>

        </div>
      </main>

      {/* Removed LocationDetails modal rendering */}

      <Toaster position="top-center" reverseOrder={false} />

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 max-w-md w-full relative">
             <button
               onClick={() => setShowAuthModal(false)}
               className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
               aria-label="Close login modal"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              providers={['google', 'github']}
              redirectTo={window.location.origin}
              theme="light"
            />
          </div>
        </div>
      )}
    </>
  );
}

export default App;

# Coffee Lover - Taichung Coffee Shop Finder

Coffee Lover is an interactive web application designed for discovering, exploring, and reviewing coffee shops in Taichung, Taiwan. Built with modern web technologies, it provides a seamless user experience for finding the perfect cafe.

The application leverages React, TypeScript, and Vite for a fast and type-safe frontend development experience, styled with Tailwind CSS. It integrates with the Google Maps API for interactive mapping and Supabase for backend services (currently utilizing mock data for demonstration and development purposes).

## Features

*   **Interactive Map:** Visualize coffee shop locations across Taichung using Google Maps, with marker clustering for performance.
*   **Dynamic Sidebar:** Browse a list of coffee shops, dynamically updated from the data source.
*   **Detailed Location View:** Click on a shop in the sidebar or a map marker to view comprehensive details in a modal window, including:
    *   Address, Description, Menu Highlights
    *   Amenities (Opening Hours, Price Range, Wi-Fi, Pet-Friendly - *data pending*)
*   **User Reviews:** View existing reviews and submit new ones for each coffee shop. (Currently uses mock data, Supabase integration planned).
*   **Natural Language Search:** Use the "Ask Coffeelover" search bar in the header. The AI extracts keywords from your query (e.g., "quiet cafes open late") and searches for matching shops using the Google Places API.
*   **Favorites System:** Mark coffee shops as favorites (pins) directly without login. Favorites are saved locally in your browser using `localStorage`.
*   **Sharing:** Easily share coffee shop details via the Web Share API or by copying a link to the clipboard.
*   **Loading States:** Provides visual feedback while data (maps, shop details) is being loaded.
*   **Responsive Design:** Adapts to different screen sizes (basic structure).

## Component Architecture

The application follows a component-based architecture managed primarily by the main `App` component, which holds the core state and logic.

```mermaid
graph TD
    subgraph "App Component (Manages State & Logic)"
        direction LR
        State[("State<br/>- coffeeShops[]<br/>- selectedLocation<br/>- isLoading<br/>- favoriteIds<br/>- prompt<br/>- isGenerating")]
        Handlers[("Handlers<br/>- handleSelectLocation<br/>- handleToggleFavorite<br/>- handlePromptSubmit<br/>- handleKeywordSearch")]
    end

    subgraph "UI Components"
        direction TB
        HeaderComp[Header] -- Displays Search --> State
        HeaderComp -- Triggers AI Search --> Handlers
        SidebarComp[Sidebar] -- Displays List --> State
        SidebarComp -- Triggers Selection --> Handlers
        MapComp[Map] -- Displays Markers --> State
        MapComp -- Triggers Selection --> Handlers
        Details[LocationDetails] -- Displays Details --> State
        Details -- Triggers Favorite Toggle --> Handlers
        Details -- Triggers Close --> Handlers
    end

    App --> HeaderComp
    App --> SidebarComp
    App --> MapComp
    App -- Conditionally Renders --> Details

    State --> HeaderComp
    State --> SidebarComp
    State --> MapComp
    State --> Details
    Handlers --> State

    style State fill:#f9f,stroke:#333,stroke-width:2px
    style Handlers fill:#ccf,stroke:#333,stroke-width:2px

```

*   **App:** The root component holding the main application state (`coffeeShops`, `selectedLocation`, `isLoading`, `favoriteIds`, AI prompt state) and handlers (selection, favorites, AI search, keyword search).
*   **Header:** Contains the "Ask Coffeelover" search bar, taking prompt input and triggering the AI search handler in `App`.
*   **Sidebar:** Displays the list of `coffeeShops` (updated by search results) and triggers `handleSelectLocation` on click. Title changed to "Nearby Coffee Shops".
*   **Map:** Displays `coffeeShops` as markers on Google Maps, updates pin colors based on `favoriteIds`, and triggers `handleSelectLocation` on marker click.
*   **LocationDetails:** Conditionally rendered modal displaying details of the `selectedLocation`. Handles toggling favorites (which updates state in `App`) and closing itself.

## Key Technologies

*   **Frontend Framework:** React
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **Styling:** Tailwind CSS
*   **Mapping:** React Google Maps API (`@react-google-maps/api`)
*   **Backend/Database:** Google Places API (via Vite proxy), `localStorage` (for favorites)
*   **AI:** Google Generative AI (`@google/generative-ai`)
*   **UI Icons:** Lucide React
*   **Notifications:** React Hot Toast
*   **Schema Validation:** Zod (Used in `types.ts`)
*   **Testing:** Vitest, React Testing Library (Setup present, tests need implementation)

---

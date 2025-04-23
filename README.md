# CoffeeLover App

A React + TypeScript + Supabase app for discovering and contributing info about coffee shops.

## Features

- Natural language search powered by Gemini AI (understands city names, filters, etc.)
- Filters for Wi-Fi, power outlets, price, vibe, open hours, etc.
- Google Places API integration for shop details, photos, and search
- Displays up to 3 photos per shop in an image carousel
- Shows accurate price level (e.g., $, $$, $$$)
- Supabase backend with RLS policies
- User-contributed Wi-Fi passwords, charger info, and ratings
- OAuth login with Google and GitHub
- Netlify deployment with serverless function proxy for Google API

## Architecture Overview

```mermaid
flowchart TD
    A[User enters search prompt] --> B[Gemini AI processes prompt]
    B --> C{Gemini returns JSON filters}
    C -->|query_type: find_cafe| D[Google Places Text Search API]
    C -->|query_type: unrelated| E[Show unrelated message]
    C -->|query_type: clarification_needed| F[Ask user for clarification]

    D --> G[Get list of candidate Google Place IDs]
    G --> H[For each Place ID, call fetchAndUpsertPlaceDetails]
    H --> I[Check Supabase locations table by google_place_id]
    I -->|Exists| J[Return Supabase UUID + details]
    I -->|Doesn't exist| K[Insert new location, return UUID + details]
    J --> L[Build CoffeeShop objects with Supabase UUIDs]
    K --> L

    L --> M["Apply filters<br>(distance, open now,<br>rating, etc.)"]
    M --> N[Display filtered coffee shops on map/list]

    N --> O[User selects a coffee shop]
    O --> P[Fetch Wi-Fi & Charger details from Supabase by UUID]
    P --> Q[Display details, allow user to contribute info]

    O --> R[User submits rating, Wi-Fi, or charger info]
    R --> S[Insert into Supabase with UUID foreign key]

    style E fill:#fdd
    style F fill:#ffd
    style S fill:#dfd
```

## Setup Notes

- Supabase `locations` table uses UUID primary key and stores `google_place_id` (text, unique).
- Related tables (`location_ratings`, `location_wifi_details`, `location_charger_details`) use UUID foreign keys referencing `locations.id`.
- OAuth providers (Google, GitHub) configured with correct redirect URIs.
- RLS policies allow authenticated users to insert and select their own data.

## TODO

- Fix any remaining bugs in search and submission flows.
- Improve UI/UX for contribution forms.
- Add more fallback logic and error handling.
- Polish and deploy.

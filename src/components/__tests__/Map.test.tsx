import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Map from '../Map';

// Mock the Google Maps JavaScript API
vi.mock('@react-google-maps/api', () => ({
  useLoadScript: () => ({ isLoaded: true, loadError: null }),
  GoogleMap: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  MarkerClusterer: ({ children }: { children: (clusterer: unknown) => React.ReactNode }) => (
    <div data-testid="clusterer">{children({})}</div>
  ),
  Marker: () => <div data-testid="marker" />,
}));

describe('Map Component', () => {
  it('renders loading state when map is not loaded', () => {
    vi.mock('@react-google-maps/api', () => ({
      useLoadScript: () => ({ isLoaded: false, loadError: null }),
    }));

    render(<Map />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the map when loaded', () => {
    render(<Map />);
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('renders markers within a clusterer', () => {
    render(<Map />);
    expect(screen.getByTestId('clusterer')).toBeInTheDocument();
  });
});
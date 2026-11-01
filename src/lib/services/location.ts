/**
 * Location & Venue Autocomplete Service
 * Hybrid implementation:
 * - Uses Google Places API (New) when VITE_GOOGLE_PLACES_API_KEY is configured
 * - Automatically falls back to OpenStreetMap / Photon geocoder (fast, free, no API key needed)
 */

export interface VenuePlace {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  provider: 'google' | 'photon';
}

const GOOGLE_API_KEY = (import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '').trim();

/**
 * Searches venues and locations using Google Places API (if key available) or Photon fallback.
 */
export async function searchVenues(query: string, signal?: AbortSignal): Promise<VenuePlace[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  if (GOOGLE_API_KEY) {
    try {
      const googleResults = await searchGooglePlaces(trimmed, signal);
      if (googleResults.length > 0) return googleResults;
    } catch (err) {
      console.warn('[LocationService] Google Places search failed, falling back to Photon:', err);
    }
  }

  return searchPhotonPlaces(trimmed, signal);
}

/**
 * Google Places API (New) Autocomplete
 */
async function searchGooglePlaces(query: string, signal?: AbortSignal): Promise<VenuePlace[]> {
  const url = 'https://places.googleapis.com/v1/places:autocomplete';
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
    },
    body: JSON.stringify({
      input: query,
      includedPrimaryTypes: [
        'establishment',
        'point_of_interest',
        'event_venue',
        'restaurant',
        'bar',
        'night_club',
        'performing_arts_theater',
        'stadium',
        'hotel',
        'geocode',
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Places HTTP ${response.status}`);
  }

  const data = await response.json();
  const suggestions = data.suggestions || [];

  return suggestions.map((item: any): VenuePlace => {
    const pred = item.placePrediction;
    const name = pred.structuredFormat?.mainText?.text || pred.text?.text || query;
    const secondary = pred.structuredFormat?.secondaryText?.text || '';
    const parts = secondary.split(',').map((p: string) => p.trim());

    // Guess address & city from secondary text (e.g. "Largo Luchino Visconti 4, Cernobbio, Italy")
    const address = parts[0] || undefined;
    const city = parts[1] || undefined;
    const country = parts[parts.length - 1] || undefined;

    return {
      name,
      address,
      city,
      country,
      fullAddress: pred.text?.text || [name, secondary].filter(Boolean).join(', '),
      placeId: pred.placeId,
      provider: 'google',
    };
  });
}

/**
 * Fetch detailed address components from Google Places API if placeId is available
 */
export async function getGooglePlaceDetails(placeId: string, signal?: AbortSignal): Promise<Partial<VenuePlace> | null> {
  if (!GOOGLE_API_KEY || !placeId) return null;

  try {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=displayName,formattedAddress,addressComponents,location&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();

    let streetNumber = '';
    let route = '';
    let city = '';
    let state = '';
    let country = '';
    let postcode = '';

    (data.addressComponents || []).forEach((c: any) => {
      const types = c.types || [];
      if (types.includes('street_number')) streetNumber = c.longText || c.shortText;
      if (types.includes('route')) route = c.longText || c.shortText;
      if (types.includes('locality') || types.includes('postal_town')) city = c.longText || c.shortText;
      if (types.includes('administrative_area_level_1')) state = c.longText || c.shortText;
      if (types.includes('country')) country = c.longText || c.shortText;
      if (types.includes('postal_code')) postcode = c.longText || c.shortText;
    });

    const streetAddress = [route, streetNumber].filter(Boolean).join(' ') || undefined;

    return {
      name: data.displayName?.text,
      address: streetAddress,
      city: city || undefined,
      state: state || undefined,
      country: country || undefined,
      postcode: postcode || undefined,
      fullAddress: data.formattedAddress,
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
      provider: 'google',
    };
  } catch (err) {
    console.warn('[LocationService] getGooglePlaceDetails failed:', err);
    return null;
  }
}

/**
 * Photon / OpenStreetMap Geocoder (Free, zero-config fallback)
 */
async function searchPhotonPlaces(query: string, signal?: AbortSignal): Promise<VenuePlace[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Photon HTTP ${response.status}`);
  }

  const data = await response.json();
  const features = data.features || [];

  return features.map((f: any): VenuePlace => {
    const p = f.properties || {};
    const geom = f.geometry || {};
    const coords = geom.coordinates || [];

    const name = p.name || p.street || query;
    const streetAddress = [p.street, p.housenumber].filter(Boolean).join(' ') || undefined;
    const city = p.city || p.town || p.village || p.municipality || p.district || undefined;
    const state = p.state || undefined;
    const country = p.country || undefined;
    const postcode = p.postcode || undefined;

    const fullParts = [
      p.name,
      streetAddress,
      city,
      p.state,
      p.country
    ].filter(Boolean);

    // Deduplicate consecutive parts
    const uniqueParts = fullParts.filter((item, idx, arr) => arr.indexOf(item) === idx);

    return {
      name,
      address: streetAddress,
      city,
      state,
      country,
      postcode,
      fullAddress: uniqueParts.join(', '),
      latitude: coords[1],
      longitude: coords[0],
      provider: 'photon',
    };
  });
}

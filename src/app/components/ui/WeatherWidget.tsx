import React, { useState, useEffect } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  Droplet,
  Wind,
  MapPin,
  Calendar,
} from '@/app/components/icons';
import { cn } from './utils';

export type WeatherCondition = 'sun' | 'cloud' | 'rain';

export interface WeatherData {
  temp: number;
  precipitationProbability: number;
  windSpeed: number;
  condition: WeatherCondition;
  city?: string;
}

type WidgetState =
  | { status: 'loading' }
  | { status: 'missing_location' }
  | { status: 'too_early' }
  | { status: 'past' }
  | { status: 'error'; message: string }
  | { status: 'available'; data: WeatherData };

const geoCache = new Map<string, { lat: number; lng: number; name: string } | null>();
const weatherCache = new Map<string, WeatherData>();

function parseEventDate(dateStr?: string): { date: Date; isoDate: string } | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  let d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    const currentYear = new Date().getFullYear();
    d = new Date(`${trimmed} ${currentYear}`);
  }

  if (isNaN(d.getTime())) return null;

  if (d.getFullYear() < 2000) {
    d.setFullYear(new Date().getFullYear());
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const isoDate = `${yyyy}-${mm}-${dd}`;

  return { date: d, isoDate };
}

function mapWeatherCodeToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return 'sun';
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloud';
  return 'rain';
}

function extractLocationCandidates(locationStr: string): string[] {
  const parts = locationStr
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return [];
  if (parts.length === 1) return [parts[0]];

  const candidates: string[] = [];

  if (parts.length >= 2) {
    const cityCandidate = parts[parts.length - 2];
    candidates.push(cityCandidate);
  }

  const lastPart = parts[parts.length - 1].replace(/\d+/g, '').trim();
  if (lastPart && !candidates.includes(lastPart)) {
    candidates.push(lastPart);
  }

  if (!candidates.includes(parts[0])) {
    candidates.push(parts[0]);
  }

  return candidates;
}

async function geocodeLocation(locationStr: string): Promise<{ lat: number; lng: number; name: string } | null> {
  const normalizedKey = locationStr.trim().toLowerCase();
  if (geoCache.has(normalizedKey)) {
    return geoCache.get(normalizedKey)!;
  }

  const candidates = extractLocationCandidates(locationStr);

  for (const candidate of candidates) {
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=1&language=en&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        const topResult = data.results?.[0];
        if (topResult && typeof topResult.latitude === 'number' && typeof topResult.longitude === 'number') {
          const coords = {
            lat: topResult.latitude,
            lng: topResult.longitude,
            name: topResult.name || candidate,
          };
          geoCache.set(normalizedKey, coords);
          return coords;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  geoCache.set(normalizedKey, null);
  return null;
}

async function fetchForecast(lat: number, lng: number, isoDate: string, cityName?: string): Promise<WeatherData | null> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}_${isoDate}`;
  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max&timezone=auto&start_date=${isoDate}&end_date=${isoDate}`
    );

    if (!res.ok) return null;

    const data = await res.json();
    const wmo = data.daily?.weather_code?.[0] ?? 0;
    const temp = Math.round(data.daily?.temperature_2m_max?.[0] ?? 20);
    const rainProb = Math.round(data.daily?.precipitation_probability_max?.[0] ?? 0);
    const wind = Math.round(data.daily?.wind_speed_10m_max?.[0] ?? 0);

    const weatherData: WeatherData = {
      temp,
      precipitationProbability: rainProb,
      windSpeed: wind,
      condition: mapWeatherCodeToCondition(wmo),
      city: cityName,
    };

    weatherCache.set(cacheKey, weatherData);
    return weatherData;
  } catch (err) {
    console.error('Error fetching weather forecast:', err);
    return null;
  }
}

export interface WeatherWidgetProps {
  eventDate?: string;
  location?: string;
  textColor?: string;
  className?: string;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  eventDate,
  location,
  textColor,
  className,
}) => {
  const [state, setState] = useState<WidgetState>({ status: 'loading' });

  useEffect(() => {
    let isCancelled = false;

    async function evaluateWeather() {
      // 1. Check if location is missing or placeholder
      const cleanLoc = (location || '').trim();
      const isMissingLoc =
        !cleanLoc ||
        cleanLoc.toUpperCase() === 'TBD' ||
        cleanLoc.toUpperCase() === 'UNKNOWN' ||
        cleanLoc.toUpperCase() === 'NONE';

      if (isMissingLoc) {
        if (!isCancelled) setState({ status: 'missing_location' });
        return;
      }

      // 2. Check event date and calculate days difference
      const parsed = parseEventDate(eventDate);
      if (!parsed) {
        if (!isCancelled) setState({ status: 'too_early' });
        return;
      }

      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const targetMidnight = new Date(
        parsed.date.getFullYear(),
        parsed.date.getMonth(),
        parsed.date.getDate()
      ).getTime();

      const diffDays = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

      // If more than 7 days ahead (before 1-week mark)
      if (diffDays > 7) {
        if (!isCancelled) setState({ status: 'too_early' });
        return;
      }

      // If past date
      if (diffDays < 0) {
        if (!isCancelled) setState({ status: 'past' });
        return;
      }

      // 3. Within 1-week mark (0 <= diffDays <= 7) -> fetch forecast
      if (!isCancelled) setState({ status: 'loading' });

      const coords = await geocodeLocation(cleanLoc);
      if (isCancelled) return;

      if (!coords) {
        setState({ status: 'error', message: 'Location not found' });
        return;
      }

      const forecast = await fetchForecast(coords.lat, coords.lng, parsed.isoDate, coords.name);
      if (isCancelled) return;

      if (!forecast) {
        setState({ status: 'error', message: 'Forecast unavailable' });
        return;
      }

      setState({ status: 'available', data: forecast });
    }

    evaluateWeather();

    return () => {
      isCancelled = true;
    };
  }, [eventDate, location]);

  return (
    <div
      className={cn(
        'rounded-[12px] bg-foreground/[0.04] border border-foreground/10 px-[10px] py-[8px] shrink-0 flex items-center justify-center transition-all min-w-[130px] max-w-[155px] font-sans select-none',
        className
      )}
      style={textColor ? { color: textColor } : undefined}
    >
      {state.status === 'loading' && (
        <div className="flex items-center gap-[10px] w-full animate-pulse px-[2px] py-[4px]">
          <div className="w-[36px] h-[36px] rounded-full bg-foreground/10 shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-4 w-8 bg-foreground/10 rounded" />
            <div className="h-2.5 w-12 bg-foreground/10 rounded" />
            <div className="h-2.5 w-10 bg-foreground/10 rounded" />
          </div>
        </div>
      )}

      {state.status === 'available' && (
        <div
          className="flex items-center gap-[10px] w-full text-current"
          title={state.data.city ? `Forecast for ${state.data.city}` : 'Daily forecast'}
        >
          {/* Big icon on left - Monochromatic */}
          <div className="shrink-0 flex items-center justify-center w-[38px] h-[38px]">
            {state.data.condition === 'sun' && (
              <Sun className="w-[34px] h-[34px] text-current opacity-90" strokeWidth={1.5} />
            )}
            {state.data.condition === 'cloud' && (
              <Cloud className="w-[34px] h-[34px] text-current opacity-90" strokeWidth={1.5} />
            )}
            {state.data.condition === 'rain' && (
              <CloudRain className="w-[34px] h-[34px] text-current opacity-90" strokeWidth={1.5} />
            )}
          </div>

          {/* Temperature, rain possibility, wind on right - Monochromatic */}
          <div className="flex flex-col items-start leading-none min-w-0">
            <span className="text-[18px] font-bold tracking-tight text-current leading-none">
              {state.data.temp}°
            </span>
            <div className="flex items-center gap-1 mt-[4px] text-[11px] font-semibold text-current opacity-70 whitespace-nowrap">
              <Droplet className="w-[10px] h-[10px] text-current shrink-0" strokeWidth={1.5} />
              <span>{state.data.precipitationProbability}%</span>
            </div>
            <div className="flex items-center gap-1 mt-[3px] text-[10px] font-medium text-current opacity-50 whitespace-nowrap">
              <Wind className="w-[10px] h-[10px] text-current shrink-0" strokeWidth={1.5} />
              <span>{state.data.windSpeed} km/h</span>
            </div>
          </div>
        </div>
      )}

      {state.status === 'too_early' && (
        <div className="flex items-center gap-[8px] px-[2px] py-[4px] text-current w-full">
          <Calendar className="w-[15px] h-[15px] shrink-0 opacity-40" strokeWidth={1.5} />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] uppercase font-bold tracking-wider opacity-40 leading-none">
              FORECAST
            </span>
            <span className="text-[11px] font-medium leading-tight opacity-70 mt-[2px]">
              Available 7 days prior
            </span>
          </div>
        </div>
      )}

      {state.status === 'missing_location' && (
        <div className="flex items-center gap-[8px] px-[2px] py-[4px] text-current w-full">
          <MapPin className="w-[15px] h-[15px] shrink-0 opacity-40" strokeWidth={1.5} />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] uppercase font-bold tracking-wider opacity-40 leading-none">
              FORECAST
            </span>
            <span className="text-[11px] font-medium leading-tight opacity-70 mt-[2px]">
              Location missing
            </span>
          </div>
        </div>
      )}

      {state.status === 'past' && (
        <div className="flex items-center gap-[8px] px-[2px] py-[4px] text-current opacity-50 w-full">
          <Calendar className="w-[15px] h-[15px] shrink-0 opacity-40" strokeWidth={1.5} />
          <span className="text-[11px] font-medium leading-tight opacity-70">
            Past event
          </span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-center gap-[8px] px-[2px] py-[4px] text-current opacity-50 w-full">
          <Cloud className="w-[15px] h-[15px] shrink-0 opacity-40" strokeWidth={1.5} />
          <span className="text-[11px] font-medium leading-tight opacity-70">
            {state.message}
          </span>
        </div>
      )}
    </div>
  );
};

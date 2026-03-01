import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning,
  CloudDrizzle, Cloudy
} from 'lucide-react';

interface WeatherData {
  temp: number;
  condition: string;
  precipitation: string;
  humidity: number;
}

const WEATHER_ICONS: Record<string, React.ElementType> = {
  sunny: Sun,
  clear: Sun,
  cloudy: Cloudy,
  clouds: Cloud,
  rain: CloudRain,
  drizzle: CloudDrizzle,
  snow: CloudSnow,
  thunderstorm: CloudLightning,
};

const getWeatherIcon = (condition: string): React.ElementType => {
  const lower = condition.toLowerCase();
  for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return Sun;
};

const fetchWeather = async (date: string, _location: string): Promise<WeatherData> => {
  try {
    const eventDate = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 16) {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=40.67&longitude=-74.04&daily=temperature_2m_max,precipitation_sum,relative_humidity_2m_max,weather_code&timezone=auto&start_date=${date}&end_date=${date}`
      );
      if (res.ok) {
        const data = await res.json();
        const wmo = data.daily?.weather_code?.[0] ?? 0;
        let condition = 'sunny';
        if (wmo >= 71) condition = 'snow';
        else if (wmo >= 61) condition = 'rain';
        else if (wmo >= 51) condition = 'drizzle';
        else if (wmo >= 45) condition = 'cloudy';
        else if (wmo >= 2) condition = 'clouds';
        return {
          temp: Math.round(data.daily?.temperature_2m_max?.[0] ?? 22),
          condition,
          precipitation: `${data.daily?.precipitation_sum?.[0] ?? 0} MM`,
          humidity: Math.round(data.daily?.relative_humidity_2m_max?.[0] ?? 60),
        };
      }
    }
  } catch { /* fallback below */ }

  const month = new Date(date).getMonth();
  const isSummer = month >= 5 && month <= 8;
  return {
    temp: isSummer ? 28 : 12,
    condition: isSummer ? 'sunny' : 'cloudy',
    precipitation: '0 MM',
    humidity: isSummer ? 55 : 72,
  };
};

interface WeatherWidgetProps {
  eventDate?: string;
  location?: string;
  textColor: string;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  eventDate,
  location,
  textColor,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (eventDate) {
      fetchWeather(eventDate, location || '').then(setWeather);
    }
  }, [eventDate, location]);

  const IconComponent = weather ? getWeatherIcon(weather.condition) : Sun;

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="relative w-[110px] h-[110px] shrink-0"
      style={{ color: textColor }}
    >
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.div
            key="icon"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute right-0 top-0 w-[90px] h-[90px] flex items-center justify-center"
          >
            <IconComponent className="w-[70px] h-[70px]" strokeWidth={1.5} />
          </motion.div>
        ) : (
          <motion.div
            key="data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-end justify-start text-right"
          >
            <div className="flex items-baseline gap-[2px]">
              <span className="text-[32px] font-bold leading-none">
                {weather?.temp ?? '--'}
              </span>
              <span className="text-[20px] font-bold leading-none">°</span>
              <span className="text-[32px] font-bold leading-none">C</span>
            </div>
            <div className="mt-[8px] w-[110px]">
              <span className="text-[12px] font-light block">PRECIPITATION</span>
              <span className="text-[12px] font-bold block">
                {weather?.precipitation ?? '0 MM'}
              </span>
            </div>
            <div className="mt-[4px] w-[110px]">
              <span className="text-[12px] font-light block">HUMIDITY</span>
              <span className="text-[12px] font-bold block">
                {weather?.humidity ?? 60}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

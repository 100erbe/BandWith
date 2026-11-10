import React, { useState, useEffect, useRef, useId } from 'react';
import { MapPin, Loader2 } from '@/app/components/icons';
import { cn } from './utils';
import { searchVenues, getGooglePlaceDetails, type VenuePlace } from '@/lib/services/location';

export interface VenueAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: VenuePlace) => void;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
}

export const VenueAutocomplete: React.FC<VenueAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Venue name',
  className,
  containerClassName,
  disabled = false,
  autoFocus = false,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<VenuePlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const listboxId = useId();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Debounced search when user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onChange(query);
    setHighlightedIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const results = await searchVenues(query, controller.signal);
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('[VenueAutocomplete] Error fetching suggestions:', err);
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);
  };

  const handleSelectPlace = async (place: VenuePlace) => {
    let selectedPlace = place;
    if (place.provider === 'google' && place.placeId && (!place.latitude || !place.city || !place.address)) {
      try {
        const details = await getGooglePlaceDetails(place.placeId);
        if (details) {
          selectedPlace = {
            ...place,
            ...details,
            // Keep user-friendly display name if details name is available
            name: details.name || place.name,
          };
        }
      } catch (err) {
        console.warn('[VenueAutocomplete] Could not fetch place details:', err);
      }
    }
    onChange(selectedPlace.name);
    onSelect(selectedPlace);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectPlace(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', containerClassName)}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          className={cn(
            'w-full bg-transparent bw-body-lg text-foreground focus:outline-none placeholder:text-muted-foreground/60 transition-colors pr-8',
            className
          )}
        />

        {/* Loading or Clear action indicator */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {isLoading && (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" aria-label="Searching" />
          )}
        </div>
      </div>

      {/* Suggestions: dark sheet list (Figma Picker sheets: bg/sheet, radius 24, pill rows) */}
      {isOpen && suggestions.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-2 p-2 bg-sheet text-sheet-foreground rounded-3xl shadow-[0_12px_32px_rgba(0,0,0,0.14)] max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="px-3 pt-2 pb-2 flex items-center justify-between gap-3">
            <span className="bw-label-sm text-sheet-foreground/85">Suggested venues</span>
            <span className="bw-label-xs text-sheet-foreground/60">
              {suggestions[0]?.provider === 'google' ? 'Google Places' : 'OpenStreetMap'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {suggestions.map((item, idx) => {
              const isSelected = idx === highlightedIndex;
              const subtext = [item.address, item.city, item.country].filter(Boolean).join(', ');

              return (
                <button
                  key={`${item.placeId || item.name}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelectPlace(item)}
                  className={cn(
                    'w-full text-left p-3 rounded-full flex items-center gap-3 transition-colors',
                    isSelected ? 'bg-sheet-foreground/[0.08]' : 'hover:bg-sheet-foreground/[0.08]'
                  )}
                >
                  <MapPin className="w-5 h-5 shrink-0 text-sheet-foreground/85" aria-hidden />
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="bw-label-md text-sheet-foreground truncate">{item.name}</span>
                    {subtext && <span className="bw-body-sm text-sheet-foreground/70 truncate">{subtext}</span>}
                  </span>
                  <span className="bw-label-xs text-sheet-foreground/60 shrink-0">
                    {item.provider === 'google' ? 'Google' : 'Map'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

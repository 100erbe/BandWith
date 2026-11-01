import React, { useState, useEffect, useRef, useId } from 'react';
import { MapPin, Loader2, X, Check } from 'lucide-react';
import { cn } from './utils';
import { searchVenues, type VenuePlace } from '@/lib/services/location';

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
  placeholder = 'VENUE NAME',
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

  const handleSelectPlace = (place: VenuePlace) => {
    onChange(place.name);
    onSelect(place);
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
            'w-full bg-transparent border-b pb-2 text-[22px] font-bold uppercase focus:outline-none placeholder:text-foreground/30 focus:border-foreground transition-colors pr-8',
            className
          )}
        />

        {/* Loading or Clear action indicator */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {isLoading && (
            <Loader2 className="w-4 h-4 text-foreground/40 animate-spin" />
          )}
        </div>
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-2 bg-card border border-foreground/15 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 max-h-72 overflow-y-auto"
        >
          <div className="p-1.5">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40 flex items-center justify-between">
              <span>Suggested Venues & Locations</span>
              <span className="text-[9px] lowercase opacity-60">powered by {suggestions[0]?.provider === 'google' ? 'google places' : 'openstreetmap'}</span>
            </div>
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
                    'w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-3 transition-colors',
                    isSelected ? 'bg-foreground/15 text-foreground' : 'text-foreground/90 hover:bg-foreground/10'
                  )}
                >
                  <div className="p-1.5 rounded-md bg-foreground/10 text-foreground shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold uppercase tracking-wide truncate block">
                        {item.name}
                      </span>
                      <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/50 shrink-0">
                        {item.provider === 'google' ? 'Google' : 'Map'}
                      </span>
                    </div>
                    {subtext && (
                      <span className="text-xs text-foreground/60 truncate block mt-0.5">
                        {subtext}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

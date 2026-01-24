import { useRef, useCallback, useState } from 'react';

export interface CardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseCardExpandReturn {
  cardRef: React.RefObject<HTMLDivElement>;
  getCardRect: () => CardRect | null;
  captureRect: () => void;
  capturedRect: CardRect | null;
}

export function useCardExpand(): UseCardExpandReturn {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturedRect, setCapturedRect] = useState<CardRect | null>(null);

  const getCardRect = useCallback((): CardRect | null => {
    if (!cardRef.current) return null;
    const rect = cardRef.current.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }, []);

  const captureRect = useCallback(() => {
    const rect = getCardRect();
    if (rect) {
      setCapturedRect(rect);
    }
  }, [getCardRect]);

  return { cardRef, getCardRect, captureRect, capturedRect };
}

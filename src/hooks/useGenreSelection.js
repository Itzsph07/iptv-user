// src/hooks/useGenreSelection.js
import { useState, useCallback, useRef } from 'react';

export const useGenreSelection = (sections) => {
  const [selectedGenre, setSelectedGenre] = useState(null);
  const lastUpdateTime = useRef(0);

  const handleGenrePress = useCallback((genre) => {
    const now = Date.now();
    
    // Prevent double presses within 50ms
    if (now - lastUpdateTime.current < 50) return;
    lastUpdateTime.current = now;
    
    // Update immediately - no debounce, no delay
    setSelectedGenre(genre);
  }, []);

  return {
    selectedGenre,
    handleGenrePress,
  };
};
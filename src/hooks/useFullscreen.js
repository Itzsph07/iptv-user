// src/hooks/useFullscreen.js
import { useState, useCallback, useRef } from 'react';
import { StatusBar } from 'react-native';

export const useFullscreen = (initialState = false) => {
  const [isFullscreen, setIsFullscreen] = useState(initialState);
  const [showControls, setShowControls] = useState(true);
  const [focusPanel, setFocusPanel] = useState('sidebar');
  const controlsTimer = useRef(null);

  const resetControlsTimer = useCallback((hideDelay = 4000) => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), hideDelay);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => {
      const next = !prev;
      StatusBar.setHidden(next);
      setFocusPanel(next ? 'player' : 'sidebar');
      return next;
    });
    resetControlsTimer();
  }, [resetControlsTimer]);

  const enterFullscreen = useCallback(() => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      StatusBar.setHidden(true);
      setFocusPanel('player');
      resetControlsTimer();
    }
  }, [isFullscreen, resetControlsTimer]);

  const exitFullscreen = useCallback(() => {
    if (isFullscreen) {
      setIsFullscreen(false);
      StatusBar.setHidden(false);
      setFocusPanel('sidebar');
    }
  }, [isFullscreen]);

  const showControlsTemporarily = useCallback(() => {
    resetControlsTimer();
  }, [resetControlsTimer]);

  return {
    isFullscreen,
    showControls,
    focusPanel,
    setFocusPanel,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
    showControlsTemporarily,
  };
};
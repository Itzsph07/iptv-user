// src/hooks/useChannelData.js
import { useState, useEffect, useMemo, useCallback } from 'react';
import channelService from '../services/channelService';
import { groupChannelsByGenre, sortChannelsByName } from '../utils'; // Fixed import


export const useChannelData = () => {
  const [allChannels, setAllChannels] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [lastChannel, setLastChannel] = useState(null);

  // Load channels
  useEffect(() => {
    channelService.getMyChannels()
      .then(data => {
        const sorted = sortChannelsByName(data);
        setAllChannels(sorted);
        
        const grouped = groupChannelsByGenre(sorted);
        setSections(grouped);
        
        if (grouped.length > 0) {
          setSelectedGenre(grouped[0].title);
        }
      })
      .catch(() => {});
  }, []);

  const filteredChannels = useMemo(() => {
    if (!selectedGenre || !sections.length) return allChannels; // FIX: Added guard
    const section = sections.find(s => s.title === selectedGenre);
    return section?.data ?? [];
  }, [selectedGenre, sections, allChannels]);

  const selectChannel = useCallback((channel) => {
    if (!channel) return; // FIX: Added guard
    setLastChannel(currentChannel);
    setCurrentChannel(channel);
  }, [currentChannel]);

  return {
    allChannels,
    sections,
    selectedGenre,
    setSelectedGenre,
    currentChannel,
    setCurrentChannel,
    lastChannel,
    setLastChannel,
    filteredChannels,
    selectChannel,
  };
};
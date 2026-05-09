// src/utils/channelHelpers.js
export const getChannelId = (channel) => {
  if (!channel) return null;
  return channel.channelId || channel._id;
};

export const isSameChannel = (channel1, channel2) => {
  if (!channel1 || !channel2) return false;
  return getChannelId(channel1) === getChannelId(channel2);
};

export const groupChannelsByGenre = (channels) => {
  if (!channels || !channels.length) return [];
  
  const genreMap = new Map();
  
  channels.forEach(ch => {
    const genre = ch.group || ch.category || 'General';
    if (!genreMap.has(genre)) {
      genreMap.set(genre, []);
    }
    genreMap.get(genre).push(ch);
  });
  
  return Array.from(genreMap.keys())
    .sort((a, b) => a.localeCompare(b))
    .map(title => ({
      title,
      data: genreMap.get(title)
    }));
};

export const sortChannelsByName = (channels) => {
  if (!channels) return [];
  return [...channels].sort((a, b) => 
    (a.name || '').localeCompare(b.name || '')
  );
};

export const filterChannelsBySearch = (channels, query) => {
  if (!channels) return [];
  if (!query.trim()) return channels;
  return channels.filter(ch => 
    ch.name?.toLowerCase().includes(query.toLowerCase())
  );
};

export const findChannelIndex = (channels, channelId) => {
  if (!channels || !channelId) return -1;
  return channels.findIndex(ch => getChannelId(ch) === channelId);
};

export const getNextChannel = (channels, currentId) => {
  if (!channels || !channels.length || !currentId) return channels?.[0];
  
  const idx = findChannelIndex(channels, currentId);
  if (idx === -1) return channels[0];
  return channels[idx >= channels.length - 1 ? 0 : idx + 1];
};

export const getPreviousChannel = (channels, currentId) => {
  if (!channels || !channels.length || !currentId) return channels?.[channels.length - 1];
  
  const idx = findChannelIndex(channels, currentId);
  if (idx === -1) return channels[channels.length - 1];
  return channels[idx <= 0 ? channels.length - 1 : idx - 1];
};
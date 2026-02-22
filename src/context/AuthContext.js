import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const [storedUser, token] = await Promise.all([
        AsyncStorage.getItem('@IPTV:user'),
        AsyncStorage.getItem('@IPTV:token')
      ]);
      
      if (storedUser && token) {
        const parsedUser = JSON.parse(storedUser);
        api.defaults.headers.Authorization = `Bearer ${token}`;
        setUser(parsedUser);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to load auth data:', error);
      await AsyncStorage.multiRemove(['@IPTV:user', '@IPTV:token']);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      
      if (response.data.success) {
        const { user, token } = response.data;
        
        await AsyncStorage.multiSet([
          ['@IPTV:user', JSON.stringify(user)],
          ['@IPTV:token', token]
        ]);
        
        api.defaults.headers.Authorization = `Bearer ${token}`;
        
        setUser(user);
        setIsAuthenticated(true);
        
        return { success: true, user, token };
      }
      
      return {
        success: false,
        message: response.data?.message || 'Login failed'
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed. Check your connection.'
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['@IPTV:user', '@IPTV:token']);
      delete api.defaults.headers.Authorization;
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
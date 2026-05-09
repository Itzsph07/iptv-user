// src/context/AuthContext.js
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

// Helper function to check expiry and show alerts - FIXED WITH UTC
const checkExpiryAndAlert = async (user, showAlert = true) => {
  const expiryDate = user?.expiryDate || user?.customer?.expiryDate;
  if (!expiryDate) {
    console.log('⚠️ No expiry date found for user');
    return 'active';
  }
  
  // Use UTC for both dates to avoid timezone issues
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  
  const expiry = new Date(expiryDate);
  const expiryUTC = new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate()));
  
  const diffTime = expiryUTC - todayUTC;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // DEBUG LOGS
  console.log('🔍 EXPIRY CHECK DEBUG:');
  console.log('  Raw expiryDate from server:', expiryDate);
  console.log('  Today (UTC):', todayUTC.toISOString().split('T')[0]);
  console.log('  Expiry (UTC):', expiryUTC.toISOString().split('T')[0]);
  console.log('  Difference in days:', diffDays);
  console.log('  Is expired?', diffDays < 0);
  
  // If expired (diffDays < 0 means expiry date is in the past)
  if (diffDays < 0) {
    console.log('❌ ACCOUNT IS EXPIRED! Should logout.');
    if (showAlert) {
      alert('❌ SUBSCRIPTION EXPIRED\n\nYour subscription has expired. You will be logged out.');
    }
    return 'expired';
  }
  
  // If 0 days left
  if (diffDays === 0) {
    console.log('⚠️ FINAL DAY!');
    if (showAlert) {
      alert('⚠️ FINAL DAY!\n\nYour subscription ends TODAY. Renew now to continue service.');
    }
    return 'warning';
  }
  
  // If 10 days or less (and not already alerted today)
  if (diffDays <= 10 && diffDays > 0) {
    const lastAlertDay = await AsyncStorage.getItem('@IPTV:lastAlertDay');
    if (lastAlertDay !== String(diffDays)) {
      console.log(`⚠️ ${diffDays} days remaining - showing alert`);
      if (showAlert) {
        alert(`⚠️ SUBSCRIPTION WARNING\n\nYou have ${diffDays} day${diffDays === 1 ? '' : 's'} remaining.\n\nPlease renew to avoid service interruption.`);
        await AsyncStorage.setItem('@IPTV:lastAlertDay', String(diffDays));
      }
      return 'warning';
    }
  }
  
  console.log('✅ Subscription active with', diffDays, 'days remaining');
  return 'active';
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
        
        // Check expiry on app start
        setTimeout(() => {
          checkExpiryAndAlert(parsedUser, true).then(status => {
            if (status === 'expired') {
              logout();
            }
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to load auth data:', error);
      await AsyncStorage.multiRemove(['@IPTV:user', '@IPTV:token']);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerExpiry = async () => {
    try {
      console.log('📡 Fetching customer data from /customers/me...');
      const response = await api.get('/customers/me');
      
      if (response.data.success && response.data.customer) {
        const customer = response.data.customer;
        
        console.log('✅ Got customer expiryDate:', customer.expiryDate);
        
        setUser(prevUser => {
          const updatedUser = { 
            ...prevUser,
            customer: customer,
            expiryDate: customer.expiryDate,
            customerName: customer.name,
            customerStatus: customer.status
          };
          
          console.log('✅ Updated user with expiryDate:', updatedUser.expiryDate);
          AsyncStorage.setItem('@IPTV:user', JSON.stringify(updatedUser));
          return updatedUser;
        });
        
        return true;
      }
    } catch (error) {
      console.log('❌ Could not fetch expiry date:', error.message);
    }
    return false;
  };

  const checkSubscriptionStatus = async (showAlert = true) => {
    return await checkExpiryAndAlert(user, showAlert);
  };

  const logoutIfExpired = async () => {
    const status = await checkExpiryAndAlert(user, false);
    if (status === 'expired') {
      console.log('🚪 Logging out due to expiration');
      await logout();
      return true;
    }
    return false;
  };

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      
      console.log('🔍 Login response:', JSON.stringify(response.data, null, 2));
      
      if (response.data.success) {
        const { user: userData, token } = response.data;
        
        await AsyncStorage.multiSet([
          ['@IPTV:user', JSON.stringify(userData)],
          ['@IPTV:token', token]
        ]);
        
        api.defaults.headers.Authorization = `Bearer ${token}`;
        
        setUser(userData);
        setIsAuthenticated(true);
        
        // Fetch expiry date after login
        await fetchCustomerExpiry();
        
        // Check subscription status after login
        const status = await checkSubscriptionStatus(true);
        if (status === 'expired') {
          await logout();
          return { success: false, message: 'Subscription expired' };
        }
        
        return { success: true, user: userData, token };
      }
      
      return {
        success: false,
        message: response.data?.message || 'Login failed'
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed. Check your connection.'
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['@IPTV:user', '@IPTV:token', '@IPTV:lastAlertDay']);
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
        logout,
        fetchCustomerExpiry,
        checkSubscriptionStatus,
        logoutIfExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
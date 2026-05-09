// src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@env';

console.log('API URL configured:', API_URL);

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Request interceptor with logging
api.interceptors.request.use(
    async (config) => {
        console.log(`Making ${config.method.toUpperCase()} request to:`, config.baseURL + config.url);
        console.log('Request data:', config.data);
        
        // Check if request was aborted before sending
        if (config.signal?.aborted) {
            console.log('Request was already aborted, skipping');
            throw new axios.Cancel('Request aborted');
        }
        
        const token = await AsyncStorage.getItem('@IPTV:token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('Token added to request');
        }
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor with logging
api.interceptors.response.use(
    (response) => {
        console.log('Response received:', {
            status: response.status,
            data: response.data
        });
        return response;
    },
    async (error) => {
        // Handle aborted requests gracefully
        if (axios.isCancel(error)) {
            console.log('Request was cancelled:', error.message);
            return Promise.reject({ ...error, isCancelled: true });
        }
        
        console.error('Response error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            headers: error.response?.headers
        });
        
        if (error.response?.status === 401) {
            console.log('Unauthorized access - clearing storage');
            await AsyncStorage.multiRemove(['@IPTV:user', '@IPTV:token']);
        }
        
        return Promise.reject(error);
    }
);

export default api;
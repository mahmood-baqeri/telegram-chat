import axios from 'axios';
import { storage } from '../services/storage';
import { store } from '../store';
import { refreshToken, logout } from '../store/slices/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    timeout: 30000
});

// Request interceptor
apiClient.interceptors.request.use(
    (config) => {
        const token = storage.get('token');
        const sessionId = storage.get('sessionId');
        
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        if (sessionId) {
            config.headers['X-Session-ID'] = sessionId;
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                await store.dispatch(refreshToken());
                const token = storage.get('token');
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                await store.dispatch(logout());
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);
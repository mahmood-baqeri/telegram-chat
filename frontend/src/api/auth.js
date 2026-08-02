import { apiClient } from './client';

export const authAPI = {
    sendOTP: (phone) => apiClient.post('/auth/send-otp', { phone }),
    verifyOTP: (phone, code) => apiClient.post('/auth/verify-otp', { phone, code }),
    refreshToken: (refreshToken) => apiClient.post('/auth/refresh-token', { refreshToken }),
    logout: (sessionId) => apiClient.post('/auth/logout', { sessionId }),
    getMe: () => apiClient.get('/auth/me'),
    getSessions: () => apiClient.get('/auth/sessions')
};
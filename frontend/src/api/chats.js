import { apiClient } from './client';

export const chatAPI = {
    getChats: (params) => apiClient.get('/chats', { params }),
    getChat: (chatId) => apiClient.get(`/chats/${chatId}`),
    createChat: (data) => apiClient.post('/chats', data),
    getMessages: (chatId, params) => apiClient.get(`/chats/${chatId}/messages`, { params }),
    sendMessage: (chatId, data) => apiClient.post(`/chats/${chatId}/messages`, data),
    editMessage: (messageId, data) => apiClient.put(`/messages/${messageId}`, data),
    deleteMessage: (messageId, forEveryone) => apiClient.delete(`/messages/${messageId}`, { params: { forEveryone } }),
    archiveChat: (chatId) => apiClient.put(`/chats/${chatId}/archive`),
    unarchiveChat: (chatId) => apiClient.put(`/chats/${chatId}/unarchive`),
    muteChat: (chatId, data) => apiClient.put(`/chats/${chatId}/mute`, data),
    unmuteChat: (chatId) => apiClient.put(`/chats/${chatId}/unmute`),
    pinChat: (chatId) => apiClient.put(`/chats/${chatId}/pin`),
    unpinChat: (chatId) => apiClient.put(`/chats/${chatId}/unpin`),
    markAsRead: (chatId, data) => apiClient.put(`/chats/${chatId}/read`, data),
    deleteChat: (chatId) => apiClient.delete(`/chats/${chatId}`),
    getParticipants: (chatId) => apiClient.get(`/chats/${chatId}/participants`)
};
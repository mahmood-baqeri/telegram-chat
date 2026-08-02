import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSocket } from './useSocket';
import { chatAPI } from '../api/chats';
import { addMessage, updateMessage, deleteMessage, setMessages, addMessages } from '../store/slices/messageSlice';
import { updateChat, updateUnread } from '../store/slices/chatSlice';

export const useChat = (chatId) => {
    const dispatch = useDispatch();
    const socket = useSocket();
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    
    const messages = useSelector(state => state.messages[chatId] || []);
    const chat = useSelector(state => state.chats.items.find(c => c.id === chatId));
    
    // Load messages
    const loadMessages = useCallback(async (reset = false) => {
        if (loading) return;
        
        setLoading(true);
        try {
            const params = {
                page: reset ? 1 : page,
                limit: 50
            };
            
            const response = await chatAPI.getMessages(chatId, params);
            const { messages: newMessages, pagination } = response.data;
            
            if (reset) {
                dispatch(setMessages({ chatId, messages: newMessages }));
            } else {
                dispatch(addMessages({ chatId, messages: newMessages }));
            }
            
            setHasMore(pagination.hasMore);
            setPage(pagination.page + 1);
        } catch (error) {
            console.error('Failed to load messages:', error);
        } finally {
            setLoading(false);
        }
    }, [chatId, page, loading, dispatch]);
    
    // Send message
    const sendMessage = useCallback(async (content, type = 'text', replyTo = null) => {
        try {
            const response = await chatAPI.sendMessage(chatId, {
                content,
                type,
                replyTo
            });
            
            const message = response.data;
            dispatch(addMessage({ chatId, message }));
            
            // Update chat last message
            dispatch(updateChat({
                id: chatId,
                lastMessage: message.content,
                lastMessageAt: message.createdAt
            }));
            
            return message;
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    }, [chatId, dispatch]);
    
    // Edit message
    const editMessage = useCallback(async (messageId, content) => {
        try {
            const response = await chatAPI.editMessage(messageId, { content });
            const message = response.data;
            dispatch(updateMessage({ chatId, message }));
            return message;
        } catch (error) {
            console.error('Failed to edit message:', error);
            throw error;
        }
    }, [chatId, dispatch]);
    
    // Delete message
    const deleteMessage = useCallback(async (messageId, forEveryone = false) => {
        try {
            await chatAPI.deleteMessage(messageId, forEveryone);
            dispatch(deleteMessage({ chatId, messageId }));
            return true;
        } catch (error) {
            console.error('Failed to delete message:', error);
            throw error;
        }
    }, [chatId, dispatch]);
    
    // Mark as read
    const markAsRead = useCallback(async () => {
        try {
            await chatAPI.markAsRead(chatId);
            dispatch(updateUnread({ chatId, count: 0 }));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    }, [chatId, dispatch]);
    
    // Socket events
    useEffect(() => {
        if (!socket) return;
        
        // Join chat room
        socket.emit('chat:join', { chatId });
        
        // Message events
        socket.on('message:created', (data) => {
            if (data.chatId === chatId) {
                dispatch(addMessage({ chatId, message: data.message }));
            }
        });
        
        socket.on('message:updated', (data) => {
            if (data.chatId === chatId) {
                dispatch(updateMessage({ chatId, message: data.message }));
            }
        });
        
        socket.on('message:deleted', (data) => {
            if (data.chatId === chatId) {
                dispatch(deleteMessage({ chatId, messageId: data.messageId }));
            }
        });
        
        socket.on('message:seen', (data) => {
            if (data.chatId === chatId) {
                // Update message seen status
            }
        });
        
        return () => {
            socket.emit('chat:leave', { chatId });
            socket.off('message:created');
            socket.off('message:updated');
            socket.off('message:deleted');
            socket.off('message:seen');
        };
    }, [socket, chatId, dispatch]);
    
    return {
        messages,
        chat,
        loading,
        hasMore,
        loadMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        markAsRead
    };
};
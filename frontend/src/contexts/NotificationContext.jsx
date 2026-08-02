import React, { createContext, useContext, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from '../hooks/useAuth';

const NotificationContext = createContext(null);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const { socket } = useSocket();
    const { user } = useAuth();

    useEffect(() => {
        if (!socket || !user) return;

        const handleNotification = (data) => {
            // Show notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(data.title, {
                    body: data.body,
                    icon: '/icons/icon-192x192.png'
                });
            }
        };

        socket.on('notification:new', handleNotification);

        return () => {
            socket.off('notification:new', handleNotification);
        };
    }, [socket, user]);

    const requestPermission = async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    };

    return (
        <NotificationContext.Provider value={{ requestPermission }}>
            {children}
        </NotificationContext.Provider>
    );
};
import React, { createContext, useContext, useEffect, useState } from 'react';
import { socketService } from '../services/socket';

const SocketContext = createContext(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const newSocket = socketService.connect();
        setSocket(newSocket);

        newSocket.on('connect', () => setConnected(true));
        newSocket.on('disconnect', () => setConnected(false));

        return () => {
            newSocket.off('connect');
            newSocket.off('disconnect');
            socketService.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
};
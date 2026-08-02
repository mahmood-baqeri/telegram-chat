import { io } from 'socket.io-client';
import { storage } from './storage';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
    }

    connect() {
        if (this.socket?.connected) return this.socket;

        const token = storage.get('token');
        const sessionId = storage.get('sessionId');

        this.socket = io(SOCKET_URL, {
            auth: {
                token,
                sessionId
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
            this.connected = true;
            console.log('Socket connected');
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('Socket disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }

    getSocket() {
        if (!this.socket || !this.connected) {
            return this.connect();
        }
        return this.socket;
    }

    emit(event, data) {
        const socket = this.getSocket();
        socket.emit(event, data);
    }

    on(event, callback) {
        const socket = this.getSocket();
        socket.on(event, callback);
    }

    off(event, callback) {
        const socket = this.getSocket();
        socket.off(event, callback);
    }
}

export const socketService = new SocketService();
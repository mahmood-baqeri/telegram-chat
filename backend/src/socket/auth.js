const { getAuthService } = require('../modules/auth/services/AuthService');

const setupAuthSocket = (io) => {
    // Authentication middleware for socket
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            const sessionId = socket.handshake.auth.sessionId;

            if (!token || !sessionId) {
                return next(new Error('Authentication required'));
            }

            const authService = await getAuthService();
            const sessionData = await authService.validateSession(sessionId, token);

            socket.user = sessionData.user;
            socket.sessionId = sessionId;
            socket.deviceId = sessionData.deviceId;

            next();
        } catch (error) {
            next(new Error('Authentication failed'));
        }
    });

    // Connection handler
    io.on('connection', (socket) => {
        const userId = socket.user.id;

        // Join user room
        socket.join(`user:${userId}`);

        // Update user status
        socket.user.status = 'online';
        socket.user.save();

        // Broadcast online status
        io.emit('user:online', {
            userId: socket.user.uuid,
            timestamp: new Date().toISOString()
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            // Update user status
            socket.user.status = 'offline';
            socket.user.last_seen_at = new Date();
            socket.user.save();

            // Broadcast offline status
            io.emit('user:offline', {
                userId: socket.user.uuid,
                timestamp: new Date().toISOString()
            });
        });

        // Handle ping
        socket.on('ping', () => {
            socket.emit('pong');
        });
    });
};

module.exports = {
    setupAuthSocket
};
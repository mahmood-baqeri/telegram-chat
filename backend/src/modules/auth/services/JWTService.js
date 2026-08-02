const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../../config');

class JWTService {
    constructor() {
        this.secret = config.jwt.secret;
        this.refreshSecret = config.jwt.refreshSecret;
        this.expiresIn = config.jwt.expiresIn;
        this.refreshExpiresIn = config.jwt.refreshExpiresIn;
    }

    /**
     * Generate access token
     */
    generateAccessToken(payload) {
        return jwt.sign(
            {
                ...payload,
                type: 'access'
            },
            this.secret,
            {
                expiresIn: this.expiresIn
            }
        );
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(payload) {
        return jwt.sign(
            {
                ...payload,
                type: 'refresh'
            },
            this.refreshSecret,
            {
                expiresIn: this.refreshExpiresIn
            }
        );
    }

    /**
     * Generate both tokens
     */
    generateTokens(payload) {
        const accessToken = this.generateAccessToken(payload);
        const refreshToken = this.generateRefreshToken(payload);
        
        return {
            accessToken,
            refreshToken,
            expiresIn: this.getExpiresInSeconds(this.expiresIn),
            refreshExpiresIn: this.getExpiresInSeconds(this.refreshExpiresIn)
        };
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, this.secret);
            
            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }
            
            return decoded;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Verify refresh token
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, this.refreshSecret);
            
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            
            return decoded;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Decode token without verification
     */
    decodeToken(token) {
        try {
            return jwt.decode(token);
        } catch (error) {
            return null;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    refreshAccessToken(refreshToken) {
        try {
            const decoded = this.verifyRefreshToken(refreshToken);
            
            // Generate new tokens
            const { userId, deviceId, sessionId } = decoded;
            const newAccessToken = this.generateAccessToken({
                userId,
                deviceId,
                sessionId
            });

            return {
                accessToken: newAccessToken,
                expiresIn: this.getExpiresInSeconds(this.expiresIn)
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get expires in seconds from string
     */
    getExpiresInSeconds(expiresIn) {
        if (typeof expiresIn === 'number') {
            return expiresIn;
        }

        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            return 3600; // default 1 hour
        }

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 3600;
            case 'd': return value * 86400;
            default: return 3600;
        }
    }

    /**
     * Generate random token for session
     */
    generateRandomToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash token for storage
     */
    hashToken(token) {
        return crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');
    }
}

module.exports = JWTService;
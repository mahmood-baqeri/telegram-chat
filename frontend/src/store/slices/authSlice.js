import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '../../api/auth';
import { storage } from '../../services/storage';

const initialState = {
    user: null,
    token: null,
    refreshToken: null,
    sessionId: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    otpSent: false,
    otpVerified: false,
    phone: null
};

export const sendOTP = createAsyncThunk(
    'auth/sendOTP',
    async (phone, { rejectWithValue }) => {
        try {
            const response = await authAPI.sendOTP(phone);
            return { phone, ...response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to send OTP');
        }
    }
);

export const verifyOTP = createAsyncThunk(
    'auth/verifyOTP',
    async ({ phone, code }, { rejectWithValue }) => {
        try {
            const response = await authAPI.verifyOTP(phone, code);
            const { user, accessToken, refreshToken, sessionId } = response.data;
            
            // Store tokens
            storage.set('token', accessToken);
            storage.set('refreshToken', refreshToken);
            storage.set('sessionId', sessionId);
            storage.set('user', user);
            
            return { user, accessToken, refreshToken, sessionId };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Invalid OTP');
        }
    }
);

export const logout = createAsyncThunk(
    'auth/logout',
    async (_, { getState }) => {
        const { sessionId } = getState().auth;
        await authAPI.logout(sessionId);
        
        storage.remove('token');
        storage.remove('refreshToken');
        storage.remove('sessionId');
        storage.remove('user');
    }
);

export const refreshToken = createAsyncThunk(
    'auth/refreshToken',
    async (_, { getState, rejectWithValue }) => {
        try {
            const refreshToken = getState().auth.refreshToken;
            const response = await authAPI.refreshToken(refreshToken);
            const { accessToken, refreshToken: newRefreshToken } = response.data;
            
            storage.set('token', accessToken);
            storage.set('refreshToken', newRefreshToken);
            
            return { accessToken, refreshToken: newRefreshToken };
        } catch (error) {
            storage.remove('token');
            storage.remove('refreshToken');
            storage.remove('sessionId');
            storage.remove('user');
            return rejectWithValue('Session expired');
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        resetOTP: (state) => {
            state.otpSent = false;
            state.otpVerified = false;
            state.phone = null;
        },
        restoreSession: (state) => {
            const token = storage.get('token');
            const refreshToken = storage.get('refreshToken');
            const sessionId = storage.get('sessionId');
            const user = storage.get('user');

            if (token && sessionId && user) {
                state.token = token;
                state.refreshToken = refreshToken;
                state.sessionId = sessionId;
                state.user = user;
                state.isAuthenticated = true;
            }
        },
        updateUser: (state, action) => {
            state.user = { ...state.user, ...action.payload };
            storage.set('user', state.user);
        }
    },
    extraReducers: (builder) => {
        builder
            // Send OTP
            .addCase(sendOTP.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(sendOTP.fulfilled, (state, action) => {
                state.isLoading = false;
                state.otpSent = true;
                state.phone = action.payload.phone;
            })
            .addCase(sendOTP.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            // Verify OTP
            .addCase(verifyOTP.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(verifyOTP.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.otpVerified = true;
                state.user = action.payload.user;
                state.token = action.payload.accessToken;
                state.refreshToken = action.payload.refreshToken;
                state.sessionId = action.payload.sessionId;
            })
            .addCase(verifyOTP.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            // Logout
            .addCase(logout.fulfilled, (state) => {
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.refreshToken = null;
                state.sessionId = null;
                state.otpSent = false;
                state.otpVerified = false;
                state.phone = null;
            })
            // Refresh Token
            .addCase(refreshToken.fulfilled, (state, action) => {
                state.token = action.payload.accessToken;
                state.refreshToken = action.payload.refreshToken;
            })
            .addCase(refreshToken.rejected, (state) => {
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.refreshToken = null;
                state.sessionId = null;
            });
    }
});

export const { clearError, resetOTP, restoreSession, updateUser } = authSlice.actions;
export default authSlice.reducer;
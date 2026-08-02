import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP, logout, clearError, resetOTP, restoreSession } from '../store/slices/authSlice';
import { storage } from '../services/storage';

export const useAuth = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    const {
        user,
        isAuthenticated,
        isLoading,
        error,
        otpSent,
        otpVerified,
        token,
        refreshToken: refreshTokenValue,
        sessionId,
        phone
    } = useSelector(state => state.auth);
    
    const handleSendOTP = async (phoneNumber) => {
        const result = await dispatch(sendOTP(phoneNumber));
        if (result.meta.requestStatus === 'fulfilled') {
            navigate('/otp', { state: { phone: phoneNumber } });
        }
        return result;
    };
    
    const handleVerifyOTP = async (code) => {
        const result = await dispatch(verifyOTP({ phone, code }));
        if (result.meta.requestStatus === 'fulfilled') {
            navigate('/');
        }
        return result;
    };
    
    const handleLogout = async () => {
        await dispatch(logout());
        navigate('/login');
    };
    
    const handleClearError = () => {
        dispatch(clearError());
    };
    
    const handleResetOTP = () => {
        dispatch(resetOTP());
    };
    
    const restore = () => {
        dispatch(restoreSession());
    };
    
    return {
        user,
        isAuthenticated,
        isLoading,
        error,
        otpSent,
        otpVerified,
        token,
        refreshToken: refreshTokenValue,
        sessionId,
        phone,
        sendOTP: handleSendOTP,
        verifyOTP: handleVerifyOTP,
        logout: handleLogout,
        clearError: handleClearError,
        resetOTP: handleResetOTP,
        restoreSession: restore
    };
};
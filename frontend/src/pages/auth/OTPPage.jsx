import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './OTPPage.scss';

export const OTPPage = () => {
    const [code, setCode] = useState(['', '', '', '']);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(60);
    const { verifyOTP, resendOTP, isLoading, phone } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (!location.state?.phone && !phone) {
            navigate('/login');
        }
    }, [location, phone, navigate]);

    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => {
                setTimer(t => t - 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [timer]);

    const handleCodeChange = (index, value) => {
        const newCode = [...code];
        newCode[index] = value.slice(0, 1);
        setCode(newCode);

        // Auto-focus next input
        if (value && index < 3) {
            document.getElementById(`otp-${index + 1}`)?.focus();
        }

        // Auto-submit on complete
        if (index === 3 && value) {
            handleSubmit(newCode.join(''));
        }
    };

    const handleSubmit = async (otpCode) => {
        setError('');
        try {
            const result = await verifyOTP(otpCode || code.join(''));
            if (result.meta.requestStatus === 'fulfilled') {
                navigate('/');
            } else {
                setError(result.payload || 'کد تأیید نامعتبر است');
            }
        } catch (err) {
            setError('خطا در ارتباط با سرور');
        }
    };

    const handleResend = async () => {
        if (timer > 0) return;
        try {
            await resendOTP(location.state?.phone || phone);
            setTimer(60);
        } catch (err) {
            setError('خطا در ارسال مجدد کد');
        }
    };

    return (
        <div className="otp-page">
            <h2>کد تأیید</h2>
            <p>کد ۴ رقمی ارسال شده به شماره {location.state?.phone || phone} را وارد کنید</p>
            <div className="otp-inputs">
                {code.map((digit, index) => (
                    <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        disabled={isLoading}
                        autoFocus={index === 0}
                    />
                ))}
            </div>
            {error && <div className="error-message">{error}</div>}
            <button 
                onClick={() => handleSubmit(code.join(''))} 
                disabled={isLoading || code.some(d => !d)}
            >
                {isLoading ? 'در حال تأیید...' : 'تأیید کد'}
            </button>
            <div className="resend">
                {timer > 0 ? (
                    <span>ارسال مجدد کد در {timer} ثانیه</span>
                ) : (
                    <button onClick={handleResend}>ارسال مجدد کد</button>
                )}
            </div>
        </div>
    );
};
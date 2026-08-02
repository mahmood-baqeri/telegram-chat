import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './LoginPage.scss';

export const LoginPage = () => {
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const { sendOTP, isLoading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (phone.length < 10) {
            setError('شماره موبایل معتبر نیست');
            return;
        }

        try {
            const result = await sendOTP(phone);
            if (result.meta.requestStatus === 'fulfilled') {
                navigate('/otp', { state: { phone } });
            } else {
                setError(result.payload || 'خطا در ارسال کد');
            }
        } catch (err) {
            setError('خطا در ارتباط با سرور');
        }
    };

    return (
        <div className="login-page">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>شماره موبایل</label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09123456789"
                        dir="ltr"
                        disabled={isLoading}
                    />
                </div>
                {error && <div className="error-message">{error}</div>}
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'در حال ارسال...' : 'ارسال کد تأیید'}
                </button>
            </form>
        </div>
    );
};
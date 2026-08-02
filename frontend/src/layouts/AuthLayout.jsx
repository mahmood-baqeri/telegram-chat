import React from 'react';
import { Outlet } from 'react-router-dom';
import './AuthLayout.scss';

export const AuthLayout = () => {
    return (
        <div className="auth-layout">
            <div className="auth-container">
                <div className="auth-brand">
                    <h1>پیام‌رسان</h1>
                    <p>ورود به حساب کاربری</p>
                </div>
                <Outlet />
            </div>
        </div>
    );
};
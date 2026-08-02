import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import './Sidebar.scss';

export const Sidebar = () => {
    const location = useLocation();
    const user = useSelector(state => state.auth.user);

    const menuItems = [
        { path: '/chats', icon: '💬', label: 'پیام‌ها' },
        { path: '/groups', icon: '👥', label: 'گروه‌ها' },
        { path: '/channels', icon: '📢', label: 'کانال‌ها' },
        { path: '/contacts', icon: '👤', label: 'مخاطبین' },
        { path: '/settings', icon: '⚙️', label: 'تنظیمات' },
    ];

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className="user-avatar">
                    {user?.display_name?.[0] || 'U'}
                </div>
                <div className="user-name">{user?.display_name || 'کاربر'}</div>
            </div>
            <nav className="sidebar-nav">
                {menuItems.map(item => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
};
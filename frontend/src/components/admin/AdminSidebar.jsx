import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './AdminSidebar.scss';

export const AdminSidebar = () => {
    const location = useLocation();

    const menuItems = [
        { path: '/admin', icon: '📊', label: 'داشبورد' },
        { path: '/admin/users', icon: '👤', label: 'کاربران' },
        { path: '/admin/groups', icon: '👥', label: 'گروه‌ها' },
        { path: '/admin/channels', icon: '📢', label: 'کانال‌ها' },
        { path: '/admin/features', icon: '⚡', label: 'قابلیت‌ها' },
        { path: '/admin/reports', icon: '📋', label: 'گزارش‌ها' },
        { path: '/admin/audit', icon: '📝', label: 'لاگ‌ها' },
        { path: '/admin/settings', icon: '⚙️', label: 'تنظیمات' },
    ];

    return (
        <div className="admin-sidebar">
            <div className="admin-sidebar-header">
                <h2>پنل مدیریت</h2>
            </div>
            <nav className="admin-sidebar-nav">
                {menuItems.map(item => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
};
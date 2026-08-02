import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import './AdminLayout.scss';

export const AdminLayout = () => {
    return (
        <div className="admin-layout">
            <AdminSidebar />
            <div className="admin-content">
                <Outlet />
            </div>
        </div>
    );
};
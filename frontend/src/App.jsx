import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './routes/guard';
import { AuthLayout } from './layouts/AuthLayout';
import { MainLayout } from './layouts/MainLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { LoginPage, OTPPage } from './pages/auth';
import { ChatsPage, ChatPage, GroupsPage, GroupPage, ChannelsPage, ChannelPage } from './pages/chat';
import { ContactsPage } from './pages/contacts';
import { SettingsPage, ProfilePage, PrivacyPage, AppearancePage, NotificationsPage } from './pages/settings';
import { AdminDashboardPage, AdminUsersPage, AdminFeaturesPage, AdminReportsPage, AdminSettingsPage } from './pages/admin';
import { initializeApp } from './services/init';
import { useAuth } from './hooks/useAuth';

const App = () => {
    const dispatch = useDispatch();
    const { isAuthenticated, isLoading } = useAuth();
    const theme = useSelector(state => state.theme.mode);
    const language = useSelector(state => state.language.current);

    useEffect(() => {
        initializeApp(dispatch);
    }, [dispatch]);

    if (isLoading) {
        return <div className="loading-screen">Loading...</div>;
    }

    return (
        <ThemeProvider theme={theme}>
            <LanguageProvider language={language}>
                <SocketProvider>
                    <NotificationProvider>
                        <Routes>
                            {/* Auth Routes */}
                            <Route element={<AuthLayout />}>
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/otp" element={<OTPPage />} />
                            </Route>

                            {/* Main App Routes */}
                            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                                <Route path="/" element={<Navigate to="/chats" replace />} />
                                <Route path="/chats" element={<ChatsPage />} />
                                <Route path="/chats/:chatId" element={<ChatPage />} />
                                <Route path="/groups" element={<GroupsPage />} />
                                <Route path="/groups/:groupId" element={<GroupPage />} />
                                <Route path="/channels" element={<ChannelsPage />} />
                                <Route path="/channels/:channelId" element={<ChannelPage />} />
                                <Route path="/contacts" element={<ContactsPage />} />
                                <Route path="/settings" element={<SettingsPage />} />
                                <Route path="/settings/profile" element={<ProfilePage />} />
                                <Route path="/settings/privacy" element={<PrivacyPage />} />
                                <Route path="/settings/appearance" element={<AppearancePage />} />
                                <Route path="/settings/notifications" element={<NotificationsPage />} />
                            </Route>

                            {/* Admin Routes */}
                            <Route element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
                                <Route path="/admin" element={<AdminDashboardPage />} />
                                <Route path="/admin/users" element={<AdminUsersPage />} />
                                <Route path="/admin/features" element={<AdminFeaturesPage />} />
                                <Route path="/admin/reports" element={<AdminReportsPage />} />
                                <Route path="/admin/settings" element={<AdminSettingsPage />} />
                            </Route>

                            {/* 404 */}
                            <Route path="*" element={<div>404 - Page Not Found</div>} />
                        </Routes>
                    </NotificationProvider>
                </SocketProvider>
            </LanguageProvider>
        </ThemeProvider>
    );
};

export default App;
import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import './MessageBubble.scss';

export const MessageBubble = ({ message }) => {
    const { user } = useAuth();
    const isOwn = message.sender?.id === user?.id;

    return (
        <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
            {!isOwn && (
                <div className="message-sender">
                    {message.sender?.displayName || 'کاربر'}
                </div>
            )}
            <div className="message-content">
                {message.content}
            </div>
            <div className="message-time">
                {new Date(message.createdAt).toLocaleTimeString('fa-IR')}
            </div>
        </div>
    );
};
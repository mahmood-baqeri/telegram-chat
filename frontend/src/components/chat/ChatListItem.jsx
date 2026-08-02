import React from 'react';
import './ChatListItem.scss';

export const ChatListItem = ({ chat, onClick }) => {
    const getAvatar = () => {
        if (chat.avatarUrl) return chat.avatarUrl;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.title || '')}&background=2196f3&color=fff&size=40`;
    };

    return (
        <div className="chat-list-item" onClick={onClick}>
            <div className="chat-avatar">
                <img src={getAvatar()} alt={chat.title} />
                {chat.unreadCount > 0 && (
                    <span className="unread-badge">{chat.unreadCount}</span>
                )}
            </div>
            <div className="chat-info">
                <div className="chat-title">{chat.title || 'گفتگو'}</div>
                <div className="chat-last-message">
                    {chat.lastMessagePreview || 'هیچ پیامی وجود ندارد'}
                </div>
            </div>
            {chat.lastMessageAt && (
                <div className="chat-time">
                    {new Date(chat.lastMessageAt).toLocaleTimeString('fa-IR')}
                </div>
            )}
        </div>
    );
};
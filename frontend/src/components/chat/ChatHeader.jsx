import React from 'react';
import './ChatHeader.scss';

export const ChatHeader = ({ chat }) => {
    const getAvatar = () => {
        if (chat.avatarUrl) return chat.avatarUrl;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.title || '')}&background=2196f3&color=fff&size=40`;
    };

    return (
        <div className="chat-header">
            <div className="chat-header-avatar">
                <img src={getAvatar()} alt={chat.title} />
            </div>
            <div className="chat-header-title">
                {chat.title || 'گفتگو'}
            </div>
            <div className="chat-header-actions">
                <button>🔍</button>
                <button>⚙️</button>
            </div>
        </div>
    );
};
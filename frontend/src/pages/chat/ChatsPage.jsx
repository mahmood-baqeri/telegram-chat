import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { ChatListItem } from '../../components/chat/ChatListItem';
import './ChatsPage.scss';

export const ChatsPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const chats = useSelector(state => state.chats.items);
    const { loadChats, loading } = useChat();

    useEffect(() => {
        loadChats();
    }, []);

    const handleChatClick = (chatId) => {
        navigate(`/chats/${chatId}`);
    };

    if (loading) {
        return <div className="loading">در حال بارگذاری...</div>;
    }

    return (
        <div className="chats-page">
            <div className="chats-header">
                <h2>پیام‌ها</h2>
            </div>
            <div className="chats-list">
                {chats.length === 0 ? (
                    <div className="empty-state">هیچ پیامی وجود ندارد</div>
                ) : (
                    chats.map(chat => (
                        <ChatListItem
                            key={chat.id}
                            chat={chat}
                            onClick={() => handleChatClick(chat.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
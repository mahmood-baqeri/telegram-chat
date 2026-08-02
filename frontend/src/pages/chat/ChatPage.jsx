import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useChat } from '../../hooks/useChat';
import { MessageList } from '../../components/chat/MessageList';
import { MessageInput } from '../../components/chat/MessageInput';
import { ChatHeader } from '../../components/chat/ChatHeader';
import './ChatPage.scss';

export const ChatPage = () => {
    const { chatId } = useParams();
    const { messages, chat, loadMessages, sendMessage, loading, hasMore } = useChat(chatId);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadMessages(true);
    }, [chatId]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async (content) => {
        await sendMessage(content);
    };

    if (!chat) {
        return <div className="loading">در حال بارگذاری...</div>;
    }

    return (
        <div className="chat-page">
            <ChatHeader chat={chat} />
            <div className="chat-messages">
                <MessageList 
                    messages={messages} 
                    loading={loading}
                    hasMore={hasMore}
                    onLoadMore={() => loadMessages(false)}
                />
                <div ref={messagesEndRef} />
            </div>
            <MessageInput onSend={handleSend} />
        </div>
    );
};
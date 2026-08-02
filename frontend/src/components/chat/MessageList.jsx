import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import './MessageList.scss';

export const MessageList = ({ messages, loading, hasMore, onLoadMore }) => {
    const listRef = useRef(null);

    useEffect(() => {
        const handleScroll = () => {
            if (listRef.current && listRef.current.scrollTop === 0 && hasMore && !loading) {
                onLoadMore();
            }
        };

        const element = listRef.current;
        if (element) {
            element.addEventListener('scroll', handleScroll);
            return () => element.removeEventListener('scroll', handleScroll);
        }
    }, [hasMore, loading, onLoadMore]);

    return (
        <div className="message-list" ref={listRef}>
            {loading && <div className="loading-messages">در حال بارگذاری...</div>}
            {messages.map(message => (
                <MessageBubble key={message.id} message={message} />
            ))}
        </div>
    );
};
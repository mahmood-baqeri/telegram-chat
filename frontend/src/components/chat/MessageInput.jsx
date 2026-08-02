import React, { useState } from 'react';
import './MessageInput.scss';

export const MessageInput = ({ onSend }) => {
    const [message, setMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim()) {
            onSend(message.trim());
            setMessage('');
        }
    };

    return (
        <form className="message-input" onSubmit={handleSubmit}>
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="پیام خود را بنویسید..."
                dir="rtl"
            />
            <button type="submit" disabled={!message.trim()}>
                ارسال
            </button>
        </form>
    );
};
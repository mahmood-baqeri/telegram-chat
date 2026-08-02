import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import chatReducer from './slices/chatSlice';
import messageReducer from './slices/messageSlice';
import groupReducer from './slices/groupSlice';
import channelReducer from './slices/channelSlice';
import notificationReducer from './slices/notificationSlice';
import featureReducer from './slices/featureSlice';
import themeReducer from './slices/themeSlice';
import languageReducer from './slices/languageSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        user: userReducer,
        chats: chatReducer,
        messages: messageReducer,
        groups: groupReducer,
        channels: channelReducer,
        notifications: notificationReducer,
        features: featureReducer,
        theme: themeReducer,
        language: languageReducer,
        ui: uiReducer
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        })
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
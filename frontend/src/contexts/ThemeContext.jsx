import React, { createContext, useContext, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setTheme, toggleTheme } from '../store/slices/themeSlice';
import { storage } from '../services/storage';

const ThemeContext = createContext(null);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const dispatch = useDispatch();
    const theme = useSelector(state => state.theme.mode);

    useEffect(() => {
        const savedTheme = storage.get('theme') || 'system';
        dispatch(setTheme(savedTheme));
    }, [dispatch]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        storage.set('theme', theme);
    }, [theme]);

    const toggle = () => {
        dispatch(toggleTheme());
    };

    return (
        <ThemeContext.Provider value={{ theme, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
};
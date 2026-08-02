import React, { createContext, useContext, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setLanguage } from '../store/slices/languageSlice';
import { storage } from '../services/storage';

const LanguageContext = createContext(null);

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
};

export const LanguageProvider = ({ children }) => {
    const dispatch = useDispatch();
    const language = useSelector(state => state.language.current);

    useEffect(() => {
        const savedLanguage = storage.get('language') || 'fa';
        dispatch(setLanguage(savedLanguage));
    }, [dispatch]);

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
        storage.set('language', language);
    }, [language]);

    const changeLanguage = (lang) => {
        dispatch(setLanguage(lang));
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};
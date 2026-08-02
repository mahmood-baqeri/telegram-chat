import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    current: 'fa' // 'fa' | 'en'
};

const languageSlice = createSlice({
    name: 'language',
    initialState,
    reducers: {
        setLanguage: (state, action) => {
            state.current = action.payload;
        }
    }
});

export const { setLanguage } = languageSlice.actions;
export default languageSlice.reducer;
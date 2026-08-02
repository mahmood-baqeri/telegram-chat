import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    mode: 'system' // 'light' | 'dark' | 'system'
};

const themeSlice = createSlice({
    name: 'theme',
    initialState,
    reducers: {
        setTheme: (state, action) => {
            state.mode = action.payload;
        },
        toggleTheme: (state) => {
            state.mode = state.mode === 'light' ? 'dark' : 
                         state.mode === 'dark' ? 'system' : 'light';
        }
    }
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;
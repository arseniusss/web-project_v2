import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState({
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
        userId: localStorage.getItem('userId'),
        username: localStorage.getItem('username')
    });
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('accessToken'));

    const login = async (username, password) => {
        try {
            const { data } = await axios.post('http://localhost:5000/auth/login', { username, password });
            setAuth({ ...data, username, userId: data.userId });
            setIsAuthenticated(true);
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            localStorage.setItem('username', username);
            localStorage.setItem('userId', data.userId);
        } catch (error) {
            console.error('Login failed', error);
            throw error;
        }
    };

    const signup = async (username, password) => {
        try {
            await axios.post('http://localhost:5000/auth/signup', { username, password });
        } catch (error) {
            console.error('Signup failed', error);
            throw error;
        }
    };

    const logout = () => {
        setAuth({ accessToken: null, refreshToken: null, userId: null, username: null });
        setIsAuthenticated(false);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
    };

    const refreshAccessToken = async () => {
        try {
            const { data } = await axios.post('http://localhost:5000/auth/token', { token: auth.refreshToken });
            setAuth(prevAuth => ({ ...prevAuth, accessToken: data.accessToken }));
            localStorage.setItem('accessToken', data.accessToken);
        } catch (error) {
            console.error('Token refresh failed', error);
            logout();
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (auth.refreshToken) {
                refreshAccessToken();
                console.log('Trying to refresh token')
            }
        }, 0.9 * 60 * 1000);
        return () => clearInterval(interval);
    }, [auth.refreshToken]);

    return (
        <AuthContext.Provider value={{ auth, isAuthenticated, login, signup, logout, refreshAccessToken }}>
            {children}
        </AuthContext.Provider>
    );
};
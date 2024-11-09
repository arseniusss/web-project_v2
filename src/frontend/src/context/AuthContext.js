import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_SERVER_URL = 'http://localhost:5000';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState({
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
        isAdmin: false
    });
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('accessToken'));

    const login = async (username, password) => {
        try {
            const { data } = await axios.post(`${BACKEND_SERVER_URL}/auth/login`, { username, password });
            setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken, isAdmin: data.isAdmin });
            setIsAuthenticated(true);
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
        } catch (error) {
            console.error('Login failed', error);
            throw error;
        }
    };

    const signup = async (username, password, isAdmin) => {
        try {
            await axios.post(`${BACKEND_SERVER_URL}/auth/signup`, { username, password, isAdmin });
        } catch (error) {
            console.error('Signup failed', error);
            throw error;
        }
    };

    const logout = () => {
        setAuth({ accessToken: null, refreshToken: null, isAdmin: false });
        setIsAuthenticated(false);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    };

    const refreshAccessToken = async () => {
        try {
            const { data } = await axios.post(`${BACKEND_SERVER_URL}/auth/token`, { token: auth.refreshToken });
            setAuth(prevAuth => ({ ...prevAuth, accessToken: data.accessToken }));
            localStorage.setItem('accessToken', data.accessToken);
        } catch (error) {
            console.error('Token refresh failed', error);
            logout();
        }
    };

    const REFRESH_INTERVAL = 0.9 * 60* 15 * 1000;
    
    useEffect(() => {
        const interval = setInterval(() => {
            if (auth.refreshToken) {
                refreshAccessToken();
            }
        }, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [auth.refreshToken]);

    return (
        <AuthContext.Provider value={{ auth, isAuthenticated, login, signup, logout, refreshAccessToken }}>
            {children}
        </AuthContext.Provider>
    );
};
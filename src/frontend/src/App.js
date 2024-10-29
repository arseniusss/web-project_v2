import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import MainPage from './components/MainPage';

const App = () => {
    const { isAuthenticated } = useContext(AuthContext);
    console.log(isAuthenticated);
    useEffect(() => {
        // This effect will run whenever isAuthenticated changes
    }, [isAuthenticated]);

    return (
        <Router>
            <Routes>
                <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
                <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <Signup />} />
                <Route path="/" element={isAuthenticated ? <MainPage /> : <Navigate to="/login" />} />
            </Routes>
        </Router>
    );
};

export default App;
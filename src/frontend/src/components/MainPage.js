import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import '../styles/Table.css';
import '../styles/ServerLoads.css';
import '../styles/App.css';

const MainPage = () => {
    const { auth } = useContext(AuthContext);

    const [number, setNumber] = useState('');
    const [tasks, setTasks] = useState([]);
    const [allTasks, setAllTasks] = useState([]);
    const [serverLoads, setServerLoads] = useState([]);
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState({});
    const [currentTab, setCurrentTab] = useState('tribonacci');

    const validate = () => {
        const errors = {};
        if (!number) {
            errors.number = 'Number is required';
        } else if (isNaN(number) || number < 0) {
            errors.number = 'Number must be a non-negative integer';
        }
        return errors;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        setErrors({});
        const response = await fetch('http://localhost:5000/calculate_tribonacci', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${auth.accessToken}`
            },
            body: JSON.stringify({ number: number })
        });

        const data = await response.json();
        if (data.message) {
            setMessage(data.message);
        } else {
            setMessage('');
            fetchTasks();
        }
    };

    const fetchTasks = async () => {
        try {
            const response = await fetch('http://localhost:5000/tasks', {
                headers: {
                    'Authorization': `Bearer ${auth.accessToken}`
                }
            });
            const data = await response.json();
            setTasks(data);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };

    const fetchAllTasks = async () => {
        try {
            const response = await fetch('http://localhost:5000/all-tasks', {
                headers: {
                    'Authorization': `Bearer ${auth.accessToken}`
                }
            });
            const data = await response.json();
            setAllTasks(data);
        } catch (error) {
            console.error('Error fetching all tasks:', error);
        }
    };

    const fetchServerLoads = async () => {
        try {
            const response = await fetch('http://localhost:5000/server-loads', {
                headers: {
                    'Authorization': `Bearer ${auth.accessToken}`
                }
            });
            const data = await response.json();
            setServerLoads(data);
        } catch (error) {
            console.error('Error fetching server loads:', error);
        }
    };

    const cancelTask = async (taskId) => {
        try {
            await fetch(`http://localhost:5000/cancel/${taskId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${auth.accessToken}`
                }
            });
            fetchTasks();
        } catch (error) {
            console.error('Error cancelling task:', error);
        }
    };

    useEffect(() => {
        fetchTasks();
        fetchServerLoads();
        if (auth.isAdmin) {
            fetchAllTasks();
        }
        const interval = setInterval(() => {
            fetchTasks();
            fetchServerLoads();
            if (auth.isAdmin) {
                fetchAllTasks();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [auth]);

    const getLoadClass = (load) => {
        if (load === null) return 'load-critical';
        if (load < 1500000000) return 'load-low';
        if (load <= 3000000000) return 'load-medium';
        if (load < 450000000) return 'load-high';
        return 'load-critical';
    };

    return (
        <div className="main-page">
            <nav className="nav-container">
                <button className={`nav-button ${currentTab === 'tribonacci' ? 'active' : ''}`} onClick={() => setCurrentTab('tribonacci')}>Calculate tribonacci</button>
                {auth.isAdmin && <button className={`nav-button ${currentTab === 'admin' ? 'active' : ''}`} onClick={() => setCurrentTab('admin')}>Admin Panel</button>}
            </nav>
            <h1>Welcome</h1>
            <div className="content-container">
                {currentTab === 'tribonacci' && (
                    <div className="tribonacci-section">
                        <form onSubmit={handleSubmit} className={`main-form ${message ? 'has-error' : ''}`}>
                            <h2>Calculate Tribonacci</h2>
                            <div className={`form-group ${errors.number ? 'error' : ''}`}>
                                <label>Number:</label>
                                <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} />
                                {errors.number && <p className="error-text">{errors.number}</p>}
                            </div>
                            <button type="submit">Submit</button>
                        </form>
                        {message && <p className="error-message">{message}</p>}
                        <div className="table-container">
                            <h2>Your requests</h2>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Number</th>
                                        <th>Status</th>
                                        <th>Progress</th>
                                        <th>Result</th>
                                        <th>Server</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tasks && tasks.map(task => (
                                        <tr key={task._id}>
                                            <td>{task._id}</td>
                                            <td>{task.number}</td>
                                            <td>
                                                <span className={`status-bubble status-${task.status}`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td>{task.progress}%</td>
                                            <td>{task.result || ''}</td>
                                            <td>{task.server}</td>
                                            <td>
                                                {task.status === 'in-progress' && (
                                                    <button onClick={() => cancelTask(task._id)}>Cancel</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {currentTab === 'admin' && auth.isAdmin && (
                    <div className="admin-section">
                        <div className="server-loads-container">
                            <h2>Server Loads</h2>
                            <table className="server-loads-table">
                                <thead>
                                    <tr>
                                        <th>Server</th>
                                        <th>Load</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {serverLoads && serverLoads.map((server, index) => (
                                        <tr key={index}>
                                            <td>{server.server}</td>
                                            <td>
                                                <span className={`load-status ${getLoadClass(server.load)}`}>
                                                    {server.load || 'N/A'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-container">
                            <h2>All Tasks</h2>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>User ID</th>
                                        <th>Number</th>
                                        <th>Status</th>
                                        <th>Progress</th>
                                        <th>Result</th>
                                        <th>Server</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allTasks && allTasks.map(task => (
                                        <tr key={task._id}>
                                            <td>{task._id}</td>
                                            <td>{task.userId}</td>
                                            <td>{task.number}</td>
                                            <td>
                                                <span className={`status-bubble status-${task.status}`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td>{task.progress}%</td>
                                            <td>{task.result || ''}</td>
                                            <td>{task.server}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MainPage;
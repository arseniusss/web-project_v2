import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import '../Table.css';
import '../ServerLoads.css';
import '../App.css';

const MainPage = () => {
    const { auth } = useContext(AuthContext);

    const [func, setFunc] = useState('');
    const [lowerBound, setLowerBound] = useState('');
    const [upperBound, setUpperBound] = useState('');
    const [points, setPoints] = useState('');
    const [tasks, setTasks] = useState([]);
    const [allTasks, setAllTasks] = useState([]);
    const [serverLoads, setServerLoads] = useState([]);
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState({});
    const [currentTab, setCurrentTab] = useState('integrate');

    const validate = () => {
        const errors = {};
        if (!func) {
            errors.func = 'Function is required';
        } else {
            try {
                new Function('x', `return ${func}`);
            } catch {
                errors.func = 'Function must be a valid function of x';
            }
        }

        if (!lowerBound) {
            errors.lowerBound = 'Lower bound is required';
        } else if (isNaN(lowerBound)) {
            errors.lowerBound = 'Lower bound must be a number';
        }

        if (!upperBound) {
            errors.upperBound = 'Upper bound is required';
        } else if (isNaN(upperBound)) {
            errors.upperBound = 'Upper bound must be a number';
        }

        if (Number(lowerBound) >= Number(upperBound)) {
            errors.bounds = 'Lower bound must be less than upper bound';
        }

        if (!points) {
            errors.points = 'Points are required';
        } else if (isNaN(points) || points > 100000 || points < 0) {
            errors.points = 'Points must be a number between 1 and 100000';
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
        const interval = `${lowerBound},${upperBound}`;
        const response = await fetch('http://localhost:5000/integrate', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${auth.accessToken}`
            },
            body: JSON.stringify({ function: func, interval, points })
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
        if (load < 150000) return 'load-low';
        if (load <= 350000) return 'load-medium';
        if (load < 400000) return 'load-high';
        return 'load-critical';
    };

    return (
        <div className="main-page">
            <nav className="nav-container">
                <button className={`nav-button ${currentTab === 'integrate' ? 'active' : ''}`} onClick={() => setCurrentTab('integrate')}>Integrate</button>
                {auth.isAdmin && <button className={`nav-button ${currentTab === 'admin' ? 'active' : ''}`} onClick={() => setCurrentTab('admin')}>Admin Panel</button>}
            </nav>
            <h1>Welcome</h1>
            <div className="content-container">
                {currentTab === 'integrate' && (
                    <div className="integrate-section">
                        <form onSubmit={handleSubmit} className={`main-form ${message ? 'has-error' : ''}`}>
                            <h2>Function Integration</h2>
                            <div className={`form-group ${errors.func ? 'error' : ''}`}>
                                <label>Function:</label>
                                <input type="text" value={func} onChange={(e) => setFunc(e.target.value)} />
                                {errors.func && <p className="error-text">{errors.func}</p>}
                            </div>
                            <div className={`form-group ${errors.lowerBound || errors.bounds ? 'error' : ''}`}>
                                <label>Lower Bound:</label>
                                <input type="text" value={lowerBound} onChange={(e) => setLowerBound(e.target.value)} />
                                {errors.lowerBound && <p className="error-text">{errors.lowerBound}</p>}
                            </div>
                            <div className={`form-group ${errors.upperBound || errors.bounds ? 'error' : ''}`}>
                                <label>Upper Bound:</label>
                                <input type="text" value={upperBound} onChange={(e) => setUpperBound(e.target.value)} />
                                {errors.upperBound && <p className="error-text">{errors.upperBound}</p>}
                                {errors.bounds && <p className="error-text">{errors.bounds}</p>}
                            </div>
                            <div className={`form-group ${errors.points ? 'error' : ''}`}>
                                <label>Points:</label>
                                <input type="text" value={points} onChange={(e) => setPoints(e.target.value)} />
                                {errors.points && <p className="error-text">{errors.points}</p>}
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
                                        <th>Function</th>
                                        <th>Interval</th>
                                        <th>Points</th>
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
                                            <td>{task.function}</td>
                                            <td>{task.interval}</td>
                                            <td>{task.points}</td>
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
                                        <th>Function</th>
                                        <th>Interval</th>
                                        <th>Points</th>
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
                                            <td>{task.function}</td>
                                            <td>{task.interval}</td>
                                            <td>{task.points}</td>
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
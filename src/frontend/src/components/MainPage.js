import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const MainPage = () => {
    const { auth } = useContext(AuthContext);

    const [userId, setUserId] = useState('');
    const [func, setFunc] = useState('');
    const [lowerBound, setLowerBound] = useState('');
    const [upperBound, setUpperBound] = useState('');
    const [points, setPoints] = useState('');
    const [tasks, setTasks] = useState([]);
    const [serverLoads, setServerLoads] = useState([]);
    const [message, setMessage] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        const interval = `${lowerBound},${upperBound}`;
        const response = await fetch('http://localhost:5000/integrate', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${auth.accessToken}`
            },
            body: JSON.stringify({ userId, function: func, interval, points })
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
        await fetch(`http://localhost:5000/cancel/${taskId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`
            }
        });
        fetchTasks();
    };

    useEffect(() => {
        fetchTasks();
        fetchServerLoads();
        const interval = setInterval(() => {
            fetchTasks();
            fetchServerLoads();
        }, 1000);
        return () => clearInterval(interval);
    }, [auth]);

    return (
        <div>
            <h1>Welcome, {auth.username}</h1>
            <h1>{auth.isadmin}</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>User ID:</label>
                    <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} />
                </div>
                <div>
                    <label>Function:</label>
                    <input type="text" value={func} onChange={(e) => setFunc(e.target.value)} />
                </div>
                <div>
                    <label>Lower Bound:</label>
                    <input type="text" value={lowerBound} onChange={(e) => setLowerBound(e.target.value)} />
                </div>
                <div>
                    <label>Upper Bound:</label>
                    <input type="text" value={upperBound} onChange={(e) => setUpperBound(e.target.value)} />
                </div>
                <div>
                    <label>Points:</label>
                    <input type="text" value={points} onChange={(e) => setPoints(e.target.value)} />
                </div>
                <button type="submit">Submit</button>
            </form>
            {message && <p>{message}</p>}
            <button onClick={fetchTasks}>Refresh Table</button>
            <table>
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
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {tasks && tasks.map(task => (
                        <tr key={task._id}>
                            <td>{task._id}</td>
                            <td>{task.userId}</td>
                            <td>{task.function}</td>
                            <td>{task.interval}</td>
                            <td>{task.points}</td>
                            <td>{task.status}</td>
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
            <h2>Server Loads</h2>
            <table>
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
                            <td>{server.load}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MainPage;
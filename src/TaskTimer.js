import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Download, Trash2, Users } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, remove } from 'firebase/database';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB0duQhUDrYZrnLRWR0O4sBI9i1p3NXaMk",
  authDomain: "tasktimerforadam.firebaseapp.com",
  databaseURL: "https://tasktimerforadam-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tasktimerforadam",
  storageBucket: "tasktimerforadam.firebasestorage.app",
  messagingSenderId: "390956096870",
  appId: "1:390956096870:web:c872dc0e2223d5700d7ca7",
  measurementId: "G-PQB5EGHG3X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const TaskTimer = () => {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [records, setRecords] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [workerCount, setWorkerCount] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      // Tasks listener
      const tasksRef = ref(database, 'tasks');
      onValue(tasksRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const taskList = Object.entries(data).map(([id, val]) => ({
            id,
            name: typeof val === 'string' ? val : val.name
          }));
          setTasks(taskList);
        } else {
          // If no tasks exist, initialize with predefined tasks
          const predefinedTasks = [
            "Laposvas szegély",
            "Növényültetés (geotex-en lyufúróva)",
            "Geotextilez"
            // ... további taskok
          ];
          
          predefinedTasks.forEach(task => {
            push(tasksRef, { name: task });
          });
        }
      }, (error) => {
        setError(`Tasks error: ${error.message}`);
      });

      // Active task listener
      const activeTaskRef = ref(database, 'activeTask');
      onValue(activeTaskRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setActiveTask(data.name);
          setIsRunning(data.isRunning);
          setTimer(data.timer);
          setLastUpdate(data.lastUpdate);
          setWorkerCount(data.workerCount || 1);
        }
      }, (error) => {
        setError(`Active task error: ${error.message}`);
      });

      // Records listener
      const recordsRef = ref(database, 'records');
      onValue(recordsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setRecords(Object.entries(data).map(([id, record]) => ({ id, ...record })));
        }
      }, (error) => {
        setError(`Records error: ${error.message}`);
      });
    } catch (error) {
      setError(`Setup error: ${error.message}`);
    }
  }, []);

  // Timer effect
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        const now = Date.now();
        const timeDiff = lastUpdate ? Math.floor((now - lastUpdate) / 1000) : 0;
        setTimer(prev => prev + timeDiff);
        setLastUpdate(now);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, lastUpdate]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTaskStart = async (taskName) => {
    try {
      if (activeTask) {
        const recordsRef = ref(database, 'records');
        await push(recordsRef, {
          task: activeTask,
          duration: timer,
          endTime: new Date().toISOString(),
          workerCount
        });
        await set(ref(database, 'activeTask'), null);
      }

      if (taskName !== activeTask) {
        await set(ref(database, 'activeTask'), {
          name: taskName,
          isRunning: true,
          timer: 0,
          lastUpdate: Date.now(),
          workerCount
        });
      }
    } catch (error) {
      setError(`Task start error: ${error.message}`);
    }
  };

  if (error) {
    return (
      <div className="max-w-md mx-auto p-4 bg-red-100 text-red-700 rounded-lg">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-lg shadow">
      {/* Timer Display */}
      <div className="mb-6 text-center">
        <div className="text-4xl font-bold mb-2">
          {formatTime(timer)}
        </div>
        <div className="text-gray-600">
          {activeTask ? `Currently tracking: ${activeTask}` : 'No active task'}
        </div>
        
        {/* Worker Count Controls */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={() => setWorkerCount(prev => Math.max(1, prev - 1))}
            className="p-2 rounded bg-gray-200 hover:bg-gray-300"
            disabled={workerCount <= 1}
          >
            -
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <span>{workerCount} worker{workerCount !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => setWorkerCount(prev => prev + 1)}
            className="p-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            +
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2 mb-6">
        {tasks.map((task) => (
          <div key={task.id} className="flex gap-2">
            <button
              onClick={() => handleTaskStart(task.name)}
              className={`flex-1 p-3 rounded-lg flex items-center justify-between ${
                task.name === activeTask
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <span>{task.name}</span>
              {task.name === activeTask ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Records Summary */}
      {records.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold mb-2">Completed Tasks:</h3>
          <div className="space-y-2">
            {records.map((record) => (
              <div key={record.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <div>{record.task}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {record.workerCount || 1} worker{(record.workerCount || 1) !== 1 ? 's' : ''}
                  </div>
                </div>
                <span>{formatTime(record.duration)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskTimer;
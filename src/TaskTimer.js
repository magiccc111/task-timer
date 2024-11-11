import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Download, Clock } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push } from 'firebase/database';

// Firebase konfiguráció - ezeket a Firebase console-ból kell beállítani
const firebaseConfig = {

  apiKey: "AIzaSyB0duQhUDrYZrnLRWR0O4sBI9i1p3NXaMk",

  authDomain: "tasktimerforadam.firebaseapp.com",

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

  // Firebase listeners setup
  useEffect(() => {
    const tasksRef = ref(database, 'tasks');
    const activeTaskRef = ref(database, 'activeTask');
    const recordsRef = ref(database, 'records');
    const timerRef = ref(database, 'timer');
    const lastUpdateRef = ref(database, 'lastUpdate');

    // Listen for tasks changes
    onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setTasks(Object.values(data));
    });

    // Listen for active task changes
    onValue(activeTaskRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setActiveTask(data.name);
        setIsRunning(data.isRunning);
        setTimer(data.timer);
        setLastUpdate(data.lastUpdate);
      } else {
        setActiveTask(null);
        setIsRunning(false);
        setTimer(0);
      }
    });

    // Listen for records changes
    onValue(recordsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setRecords(Object.values(data));
    });
  }, []);

  // Timer effect with Firebase sync
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        const now = Date.now();
        const timeDiff = lastUpdate ? Math.floor((now - lastUpdate) / 1000) : 0;
        const newTimer = timer + timeDiff;
        
        // Update Firebase
        set(ref(database, 'activeTask'), {
          name: activeTask,
          isRunning: true,
          timer: newTimer,
          lastUpdate: now
        });
        
        setTimer(newTimer);
        setLastUpdate(now);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timer, activeTask, lastUpdate]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTaskStart = async (taskName) => {
    if (activeTask) {
      // Save current task record
      const record = {
        task: activeTask,
        duration: timer,
        endTime: new Date().toISOString()
      };
      
      // Add record to Firebase
      const recordsRef = ref(database, 'records');
      push(recordsRef, record);

      // Clear active task
      await set(ref(database, 'activeTask'), null);
    }

    if (taskName !== activeTask) {
      // Start new task
      const now = Date.now();
      await set(ref(database, 'activeTask'), {
        name: taskName,
        isRunning: true,
        timer: 0,
        lastUpdate: now
      });
    }
  };

  const handleAddNewTask = async (e) => {
    e.preventDefault();
    if (newTaskName.trim()) {
      // Add task to Firebase
      const tasksRef = ref(database, 'tasks');
      push(tasksRef, newTaskName);
      
      setNewTaskName('');
      setShowNewTaskForm(false);
    }
  };

  const downloadRecords = () => {
    let allRecords = [...records];
    if (activeTask) {
      allRecords.push({
        task: activeTask,
        duration: timer,
        endTime: new Date().toISOString()
      });
    }

    const csv = [
      ['Task', 'Duration (seconds)', 'End Time'],
      ...allRecords.map(record => [
        record.task,
        record.duration,
        record.endTime
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `task-records-${new Date().toISOString()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-lg shadow">
      {/* Active Timer Display */}
      <div className="mb-6 text-center">
        <div className="text-4xl font-bold mb-2">
          {formatTime(timer)}
        </div>
        <div className="text-gray-600">
          {activeTask ? `Currently tracking: ${activeTask}` : 'No active task'}
        </div>
      </div>

      {/* Task Buttons */}
      <div className="space-y-2 mb-6">
        {tasks.map((task) => (
          <button
            key={task}
            onClick={() => handleTaskStart(task)}
            className={`w-full p-3 rounded-lg flex items-center justify-between ${
              task === activeTask
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <span>{task}</span>
            {task === activeTask ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
        ))}
      </div>

      {/* New Task Form */}
      {showNewTaskForm ? (
        <form onSubmit={handleAddNewTask} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Enter task name"
              className="flex-1 p-2 border rounded"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Add
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowNewTaskForm(true)}
          className="w-full p-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center justify-center gap-2 mb-6"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Task</span>
        </button>
      )}

      {/* Records Summary */}
      {records.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold mb-2">Completed Tasks:</h3>
          <div className="space-y-2">
            {records.map((record, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>{record.task}</span>
                <span>{formatTime(record.duration)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download Button */}
      {(records.length > 0 || activeTask) && (
        <button
          onClick={downloadRecords}
          className="w-full p-3 rounded-lg bg-gray-800 text-white hover:bg-gray-900 flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          <span>Export Records</span>
        </button>
      )}
    </div>
  );
};

export default TaskTimer;

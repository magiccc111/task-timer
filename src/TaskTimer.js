import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Download, Clock } from 'lucide-react';

const TaskTimer = () => {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [records, setRecords] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [startTime, setStartTime] = useState(null);

  // Initialize IndexedDB
  useEffect(() => {
    const request = indexedDB.open('TaskTimerDB', 1);

    request.onerror = (event) => {
      console.error("Database error:", event.target.error);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create records store
      if (!db.objectStoreNames.contains('records')) {
        db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
      }
      
      // Create active task store
      if (!db.objectStoreNames.contains('activeTask')) {
        db.createObjectStore('activeTask', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      
      // Load records
      const transaction = db.transaction(['records', 'activeTask'], 'readonly');
      const recordsStore = transaction.objectStore('records');
      const activeTaskStore = transaction.objectStore('activeTask');

      recordsStore.getAll().onsuccess = (event) => {
        setRecords(event.target.result);
      };

      activeTaskStore.get(1).onsuccess = (event) => {
        const savedActiveTask = event.target.result;
        if (savedActiveTask) {
          setActiveTask(savedActiveTask.taskName);
          setStartTime(savedActiveTask.startTime);
          setIsRunning(true);
          
          // Calculate elapsed time
          const elapsedSeconds = Math.floor((Date.now() - savedActiveTask.startTime) / 1000);
          setTimer(elapsedSeconds);
        }
      };
    };
  }, []);

  // Load tasks from localStorage
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  }, []);

  // Timer effect
  useEffect(() => {
    let interval;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        setTimer(elapsedSeconds);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // Save active task to IndexedDB
  const saveActiveTask = (taskName, timestamp) => {
    const request = indexedDB.open('TaskTimerDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['activeTask'], 'readwrite');
      const store = transaction.objectStore('activeTask');
      
      store.put({
        id: 1,
        taskName: taskName,
        startTime: timestamp
      });
    };
  };

  // Save record to IndexedDB
  const saveRecord = (record) => {
    const request = indexedDB.open('TaskTimerDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['records'], 'readwrite');
      const store = transaction.objectStore('records');
      
      store.add(record);
    };
  };

  // Clear active task from IndexedDB
  const clearActiveTask = () => {
    const request = indexedDB.open('TaskTimerDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['activeTask'], 'readwrite');
      const store = transaction.objectStore('activeTask');
      
      store.delete(1);
    };
  };

  const handleTaskStart = (taskName) => {
    if (activeTask) {
      // Save current task record
      const record = {
        task: activeTask,
        duration: timer,
        startTime: startTime,
        endTime: Date.now()
      };
      setRecords(prev => [...prev, record]);
      saveRecord(record);
      clearActiveTask();
    }

    if (taskName === activeTask) {
      // Stop current task
      setActiveTask(null);
      setIsRunning(false);
      setStartTime(null);
      clearActiveTask();
    } else {
      // Start new task
      const now = Date.now();
      setActiveTask(taskName);
      setStartTime(now);
      setTimer(0);
      setIsRunning(true);
      saveActiveTask(taskName, now);
    }
  };

  const handleAddNewTask = (e) => {
    e.preventDefault();
    if (newTaskName.trim()) {
      const updatedTasks = [...tasks, newTaskName];
      setTasks(updatedTasks);
      localStorage.setItem('tasks', JSON.stringify(updatedTasks));
      setNewTaskName('');
      setShowNewTaskForm(false);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadRecords = () => {
    let allRecords = [...records];
    if (activeTask && startTime) {
      allRecords.push({
        task: activeTask,
        duration: timer,
        startTime: startTime,
        endTime: Date.now()
      });
    }

    const csv = [
      ['Task', 'Duration (seconds)', 'Start Time', 'End Time'],
      ...allRecords.map(record => [
        record.task,
        record.duration,
        new Date(record.startTime).toISOString(),
        new Date(record.endTime).toISOString()
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
      <div className="mb-6 text-center">
        <div className="text-4xl font-bold mb-2">
          {formatTime(timer)}
        </div>
        <div className="text-gray-600">
          {activeTask ? `Currently tracking: ${activeTask}` : 'No active task'}
        </div>
        {startTime && (
          <div className="text-sm text-gray-500">
            Started: {new Date(startTime).toLocaleString()}
          </div>
        )}
      </div>

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

      {records.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold mb-2">Completed Tasks:</h3>
          <div className="space-y-2">
            {records.map((record, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <div>{record.task}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(record.startTime).toLocaleString()}
                  </div>
                </div>
                <span>{formatTime(record.duration)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Download, Users, Trash2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, update, remove } from 'firebase/database';

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

// Predefined tasks
const predefinedTasks = [
  "Laposvas szegély", 
  "Növényültetés (geotex-en lyufúróva)", 
  "Geotextilez",
  "Öntözőárok ásás (kotró)", 
  "Csepi csövezés", 
  "Szórófejezés (csőtől -szórófej rögzítésig)",
  "Szelepakna beszerelés", 
  "Talajmarózás", 
  "Öntözőárok temetés", 
  "Komputer, vezérlés, kábel",
  "Faültetés (karózva)", 
  "Növényültetés(geotex-kotrolyfuró)", 
  "Növényültetés (geon kézzel)",
  "kavicsterites depobol (kotro+teher)(m2)", 
  "Gépi simítás (ráccsal, kotróval)",
  "Kézi placcolás (első körös)", 
  "Szántás kotróval", 
  "Talajmarás (castoro)",
  "Kézi placc (többed körös)", 
  "Vetés (szellőztet, vet, hengerel)",
  "Gyepszellőztetés-gereblyézés- vetés-hengerezs", 
  "Gyepszellő-gereb-homok-vetés-trágya-henger",
  "öntöző Árkolás (láncos árokásó)", 
  "árkolás (kézzel)", 
  "Gyomirtózás",
  "Vakondhálózás kotróval", 
  "fűnyírás (gyűjtéssel, szegélyezve)", 
  "műtrágyázás"
];

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
  const [error, setError] = useState(null);


  useEffect(() => {
    try {
      // Tasks listener
      const tasksRef = ref(database, 'tasks');
      onValue(tasksRef, async (snapshot) => {
        const data = snapshot.val();
        if (!data || Object.keys(data).length === 0) {
          console.log("Initializing predefined tasks...");
          const promises = predefinedTasks.map(taskName => 
            push(tasksRef, { name: taskName })
          );
          try {
            await Promise.all(promises);
            console.log("Predefined tasks initialized successfully");
          } catch (error) {
            console.error("Error initializing predefined tasks:", error);
            setError(`Failed to initialize predefined tasks: ${error.message}`);
          }
        } else {
          const taskList = Object.entries(data).map(([id, val]) => ({
            id,
            name: typeof val === 'string' ? val : val.name
          }));
          console.log("Loaded existing tasks:", taskList);
          setTasks(taskList);
        }
      }, (error) => {
        console.error("Tasks listener error:", error);
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
        } else {
          setActiveTask(null);
          setIsRunning(false);
          setTimer(0);
        }
      }, (error) => {
        setError(`Active task error: ${error.message}`);
      });

      // Records listener
      const recordsRef = ref(database, 'records');
      onValue(recordsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const recordsList = Object.entries(data).map(([id, record]) => ({
            id,
            ...record,
            workerCount: record.workerCount || 1
          }));
          setRecords(recordsList);
        } else {
          setRecords([]);
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
        const newTimer = timer + timeDiff;
        
        setTimer(newTimer);
        setLastUpdate(now);
        
        set(ref(database, 'activeTask'), {
          name: activeTask,
          isRunning: true,
          timer: newTimer,
          lastUpdate: now,
          workerCount: 1
        });
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, timer, activeTask, lastUpdate]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTaskStart = async (taskName) => {
    try {
      if (activeTask === taskName) {
        // Same task - toggle running state
        const newIsRunning = !isRunning;
        setIsRunning(newIsRunning);
        await set(ref(database, 'activeTask'), {
          name: activeTask,
          isRunning: newIsRunning,
          timer,
          lastUpdate: Date.now(),
          workerCount: 1
        });

        if (!newIsRunning) {
          // If stopping the task, save it as a record
          const recordsRef = ref(database, 'records');
          await push(recordsRef, {
            task: activeTask,
            duration: timer,
            endTime: new Date().toISOString(),
            workerCount: 1
          });
          // Reset active task
          await set(ref(database, 'activeTask'), null);
          setActiveTask(null);
          setTimer(0);
        }
      } else {
        // Different task - save current if exists and start new
        if (activeTask) {
          const recordsRef = ref(database, 'records');
          await push(recordsRef, {
            task: activeTask,
            duration: timer,
            endTime: new Date().toISOString(),
            workerCount: 1
          });
        }

        // Start new task
        setActiveTask(taskName);
        setIsRunning(true);
        setTimer(0);
        setLastUpdate(Date.now());
        await set(ref(database, 'activeTask'), {
          name: taskName,
          isRunning: true,
          timer: 0,
          lastUpdate: Date.now(),
          workerCount: 1
        });
      }
    } catch (error) {
      setError(`Task start error: ${error.message}`);
    }
  };

  const handleCompletedTaskWorkerChange = async (recordId, currentWorkers, delta) => {
    const newWorkerCount = Math.max(1, currentWorkers + delta);
    try {
      const recordRef = ref(database, `records/${recordId}`);
      await update(recordRef, { workerCount: newWorkerCount });
    } catch (error) {
      setError(`Worker count update error: ${error.message}`);
    }
  };

  const handleAddNewTask = async (e) => {
    e.preventDefault();
    if (newTaskName.trim()) {
      try {
        const tasksRef = ref(database, 'tasks');
        await push(tasksRef, { name: newTaskName.trim() });
        setNewTaskName('');
        setShowNewTaskForm(false);
      } catch (error) {
        setError(`Add task error: ${error.message}`);
      }
    }
  };

  const handleDeleteRecord = async (recordId) => {
    try {
      if (window.confirm('Biztosan törölni szeretnéd ezt a feladatot?')) {
        const recordRef = ref(database, `records/${recordId}`);
        await remove(recordRef);
      }
    } catch (error) {
      setError(`Delete record error: ${error.message}`);
    }
  };

  const downloadRecords = () => {
    let allRecords = [...records];
    if (activeTask) {
      allRecords.push({
        task: activeTask,
        duration: timer,
        endTime: new Date().toISOString(),
        workerCount: 1
      });
    }

    const csv = [
      ['Task', 'Duration (seconds)', 'End Time', 'Workers'],
      ...allRecords.map(record => [
        record.task,
        record.duration,
        record.endTime,
        record.workerCount
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
      </div>

      {/* Task List */}
      <div className="space-y-2 mb-6">
        {tasks.map((task) => (
          <div key={task.id} className="flex gap-2">
            <button
              onClick={() => handleTaskStart(task.name)}
              className={`flex-1 p-3 rounded-lg flex items-center justify-between ${
                task.name === activeTask
                  ? isRunning 
                    ? 'bg-green-500 text-white'
                    : 'bg-yellow-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <span>{task.name}</span>
              {task.name === activeTask ? (
                isRunning ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
          </div>
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

      {/* Completed Tasks with Worker Count Controls and Delete Button */}
      {records.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold mb-2">Completed Tasks:</h3>
          <div className="space-y-2">
            {records.map((record) => (
              <div key={record.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <div>{record.task}</div>
                  <div className="text-sm text-gray-500">
                    {formatTime(record.duration)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCompletedTaskWorkerChange(record.id, record.workerCount, -1)}
                    className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                    disabled={record.workerCount <= 1}
                  >
                    -
                  </button>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{record.workerCount}</span>
                  </div>
                  <button
                    onClick={() => handleCompletedTaskWorkerChange(record.id, record.workerCount, 1)}
                    className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                  >
                    +
                  </button>
                  <button
                    onClick={() => handleDeleteRecord(record.id)}
                    className="p-1 rounded bg-red-100 hover:bg-red-200 text-red-600"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download Button remains unchanged... */}
    </div>
  );
};

export default TaskTimer;
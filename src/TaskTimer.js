import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Download, Clock } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push } from 'firebase/database';

// Firebase konfiguráció - ezeket a Firebase console-ból kell beállítani
const firebaseConfig = {

  apiKey: "AIzaSyB0duQhUDrYZrnLRWR0O4sBI9i1p3NXaMk",

  authDomain: "tasktimerforadam.firebaseapp.com",

  databaseURL: "https://tasktimerforadam-default-rtdb.europe-west1.firebasedatabase.app/", // Ez a legfontosabb!

  projectId: "tasktimerforadam",

  storageBucket: "tasktimerforadam.firebasestorage.app",

  messagingSenderId: "390956096870",

  appId: "1:390956096870:web:c872dc0e2223d5700d7ca7",

  measurementId: "G-PQB5EGHG3X"

};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Predefined tasks from tasks.json
const predefinedTasks = [
  "Laposvas szegély", "Növényültetés (geotex-en lyufúróva)", "Geotextilez", 
  "Öntözőárok ásás (kotró)", "Csepi csövezés", "Szórófejezés (csőtől -szórófej rögzítésig)",
  "Szelepakna beszerelés", "Talajmarózás", "Öntözőárok temetés", "Komputer, vezérlés, kábel",
  "Faültetés (karózva)", "Növényültetés(geotex-kotrolyfuró)", "Növényültetés (geon kézzel)",
  "kavicsterites depobol (kotro+teher)(m2)", "Gépi simítás (ráccsal, kotróval)",
  "Kézi placcolás (első körös)", "Szántás kotróval", "Talajmarás (castoro)",
  "Kézi placc (többed körös)", "Vetés (szellőztet, vet, hengerel)",
  "Gyepszellőztetés-gereblyézés- vetés-hengerezs", "Gyepszellő-gereb-homok-vetés-trágya-henger",
  "öntöző Árkolás (láncos árokásó)", "árkolás (kézzel)", "Gyomirtózás",
  "Vakondhálózás kotróval", "fűnyírás (gyűjtéssel, szegélyezve)", "műtrágyázás"
];

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

  // Initialize Firebase listeners and load predefined tasks
  useEffect(() => {
    const tasksRef = ref(database, 'tasks');
    const activeTaskRef = ref(database, 'activeTask');
    const recordsRef = ref(database, 'records');

    // Initialize predefined tasks if no tasks exist
    onValue(tasksRef, (snapshot) => {
      if (!snapshot.exists()) {
        predefinedTasks.forEach(task => {
          push(tasksRef, { name: task });
        });
      } else {
        const taskData = snapshot.val();
        const formattedTasks = Object.entries(taskData).map(([id, value]) => ({
          id,
          name: typeof value === 'string' ? value : value.name
        }));
        setTasks(formattedTasks);
      }
    });

    // Listen for active task changes
    onValue(activeTaskRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setActiveTask(data.name);
        setIsRunning(data.isRunning);
        setTimer(data.timer);
        setLastUpdate(data.lastUpdate);
        setWorkerCount(data.workerCount || 1);
      } else {
        setActiveTask(null);
        setIsRunning(false);
        setTimer(0);
        setWorkerCount(1);
      }
    });

    // Listen for records changes
    onValue(recordsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const recordsList = Object.entries(data).map(([id, record]) => ({
          id,
          ...record
        }));
        setRecords(recordsList);
      } else {
        setRecords([]);
      }
    });
  }, []);

  // Timer effect
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        const now = Date.now();
        const timeDiff = lastUpdate ? Math.floor((now - lastUpdate) / 1000) : 0;
        const newTimer = timer + timeDiff;
        
        set(ref(database, 'activeTask'), {
          name: activeTask,
          isRunning: true,
          timer: newTimer,
          lastUpdate: now,
          workerCount
        });
        
        setTimer(newTimer);
        setLastUpdate(now);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timer, activeTask, lastUpdate, workerCount]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTaskStart = async (taskName) => {
    if (activeTask) {
      const record = {
        task: activeTask,
        duration: timer,
        endTime: new Date().toISOString(),
        workerCount: workerCount
      };
      
      const recordsRef = ref(database, 'records');
      await push(recordsRef, record);
      await set(ref(database, 'activeTask'), null);
    }

    if (taskName !== activeTask) {
      const now = Date.now();
      await set(ref(database, 'activeTask'), {
        name: taskName,
        isRunning: true,
        timer: 0,
        lastUpdate: now,
        workerCount: workerCount
      });
    }
  };

  const handleAddNewTask = async (e) => {
    e.preventDefault();
    if (newTaskName.trim()) {
      const tasksRef = ref(database, 'tasks');
      await push(tasksRef, { name: newTaskName.trim() });
      setNewTaskName('');
      setShowNewTaskForm(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      const taskRef = ref(database, `tasks/${taskId}`);
      await remove(taskRef);
    }
  };

  const handleWorkerCountChange = (delta) => {
    const newCount = Math.max(1, workerCount + delta);
    setWorkerCount(newCount);
    if (activeTask) {
      set(ref(database, 'activeTask/workerCount'), newCount);
    }
  };

  const downloadRecords = () => {
    let allRecords = [...records];
    if (activeTask) {
      allRecords.push({
        task: activeTask,
        duration: timer,
        endTime: new Date().toISOString(),
        workerCount: workerCount
      });
    }

    const csv = [
      ['Task', 'Duration (seconds)', 'End Time', 'Workers'],
      ...allRecords.map(record => [
        record.task,
        record.duration,
        record.endTime,
        record.workerCount || 1
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
            onClick={() => handleWorkerCountChange(-1)}
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
            onClick={() => handleWorkerCountChange(1)}
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
            <button
              onClick={() => handleDeleteTask(task.id)}
              className="p-3 rounded-lg bg-red-100 hover:bg-red-200 text-red-600"
            >
              <Trash2 className="w-5 h-5" />
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

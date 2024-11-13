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
  "műtrágyázás",
  "Téliesítés (zónák)"
];

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const TaskTimer = () => {
  const [tasks, setTasks] = useState([]);
  const [activeTasks, setActiveTasks] = useState({});  // Changed to object for multiple active tasks
  const [records, setRecords] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
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
          await Promise.all(promises);
        } else {
          const taskList = Object.entries(data).map(([id, val]) => ({
            id,
            name: typeof val === 'string' ? val : val.name
          }));
          setTasks(taskList);
        }
      });

      // Active tasks listener
      const activeTasksRef = ref(database, 'activeTasks');
      onValue(activeTasksRef, (snapshot) => {
        const data = snapshot.val() || {};
        setActiveTasks(data);
      });

      // Records listener
      const recordsRef = ref(database, 'records');
      onValue(recordsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const recordsList = Object.entries(data).map(([id, record]) => ({
            id,
            ...record,
            workerCount: record.workerCount || 1,
            units: record.units || 0  // Add this line
          }));
          setRecords(recordsList);
        } else {
          setRecords([]);
        }
      });
    } catch (error) {
      setError(`Setup error: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    const intervals = {};

    Object.entries(activeTasks).forEach(([taskName, taskData]) => {
      if (taskData.isRunning) {
        intervals[taskName] = setInterval(() => {
          const now = Date.now();
          const timeDiff = taskData.lastUpdate ? Math.floor((now - taskData.lastUpdate) / 1000) : 0;
          const newTimer = taskData.timer + timeDiff;

          setActiveTasks(prev => ({
            ...prev,
            [taskName]: {
              ...taskData,
              timer: newTimer,
              lastUpdate: now
            }
          }));

          // Update Firebase
          update(ref(database, 'activeTasks'), {
            [taskName]: {
              ...taskData,
              timer: newTimer,
              lastUpdate: now
            }
          });
        }, 1000);
      }
    });

    return () => {
      Object.values(intervals).forEach(interval => clearInterval(interval));
    };
  }, [activeTasks]);
  

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadRecords = () => {
    // Get all current records
    let allRecords = [...records];
    
    // Add all currently active tasks as records
    Object.entries(activeTasks).forEach(([taskName, taskData]) => {
      allRecords.push({
        task: taskName,
        duration: taskData.timer,
        endTime: new Date().toISOString(),
        workerCount: taskData.workerCount || 1
      });
    });

    // Sort records by end time
    allRecords.sort((a, b) => new Date(b.endTime) - new Date(a.endTime));

    // Create CSV content
    const csv = [
      ['Task', 'Duration (seconds)', 'Duration (formatted)', 'End Time', 'Workers', 'Units'],  // Modified header
      ...allRecords.map(record => [
        record.task,
        record.duration,
        formatTime(record.duration),
        record.endTime,
        record.workerCount,
        record.units || 0  // Add units to export
      ])
    ].map(row => row.join(',')).join('\n');

    // Create and download the file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `task-records-${new Date().toISOString()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleTaskStart = async (taskName) => {
    try {
      const taskData = activeTasks[taskName];
      if (taskData) {
        // Task is already active - toggle running state
        const newIsRunning = !taskData.isRunning;
        const newTaskData = {
          ...taskData,
          isRunning: newIsRunning,
          lastUpdate: Date.now()
        };

        if (!newIsRunning) {
          // If stopping the task, save it as a record
          const recordsRef = ref(database, 'records');
          await push(recordsRef, {
            task: taskName,
            duration: taskData.timer,
            endTime: new Date().toISOString(),
            workerCount: 1,
            units: 0  // Add this line
          });

          // Remove from active tasks
          const { [taskName]: removed, ...remainingTasks } = activeTasks;
          await set(ref(database, 'activeTasks'), remainingTasks);
          setActiveTasks(remainingTasks);
        } else {
          // Update the running state
          await update(ref(database, 'activeTasks'), {
            [taskName]: newTaskData
          });
          setActiveTasks(prev => ({
            ...prev,
            [taskName]: newTaskData
          }));
        }
      } else {
        // Start new task
        const newTaskData = {
          isRunning: true,
          timer: 0,
          lastUpdate: Date.now(),
          workerCount: 1
        };

        await update(ref(database, 'activeTasks'), {
          [taskName]: newTaskData
        });
        setActiveTasks(prev => ({
          ...prev,
          [taskName]: newTaskData
        }));
      }
    } catch (error) {
      setError(`Task operation error: ${error.message}`);
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

  const handleCompletedTaskUnitsChange = async (recordId, currentUnits, delta) => {
    const newUnits = Math.max(0, currentUnits + delta);
    try {
      const recordRef = ref(database, `records/${recordId}`);
      await update(recordRef, { units: newUnits });
    } catch (error) {
      setError(`Units update error: ${error.message}`);
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


  if (error) {
    return (
      <div className="max-w-md mx-auto p-4 bg-red-100 text-red-700 rounded-lg">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow">
      {/* Active Tasks Display */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {Object.entries(activeTasks).map(([taskName, taskData]) => (
          <div key={taskName} className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xl font-bold mb-2">
              {formatTime(taskData.timer)}
            </div>
            <div className="text-gray-600">
              {taskName}
            </div>
          </div>
        ))}
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-6">
        {tasks.map((task) => (
          <div key={task.id} className="flex gap-2">
            <button
              onClick={() => handleTaskStart(task.name)}
              className={`flex-1 p-3 rounded-lg flex items-center justify-between ${
                activeTasks[task.name]
                  ? activeTasks[task.name].isRunning 
                    ? 'bg-green-500 text-white'
                    : 'bg-yellow-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <span>{task.name}</span>
              {activeTasks[task.name] ? (
                activeTasks[task.name].isRunning ? (
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
                <div className="flex items-center gap-4"> {/* Increased gap for better spacing */}
                  {/* Units controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCompletedTaskUnitsChange(record.id, record.units, -1)}
                      className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                      disabled={record.units <= 0}
                    >
                      -
                    </button>
                    <div className="flex items-center gap-1 min-w-[60px] justify-center">
                      <span>{record.units}</span>
                      <span className="text-xs text-gray-500">units</span>
                    </div>
                    <button
                      onClick={() => handleCompletedTaskUnitsChange(record.id, record.units, 1)}
                      className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                    >
                      +
                    </button>
                  </div>
                  
                  {/* Existing workers controls */}
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Download Button at the bottom */}
      {(records.length > 0 || Object.keys(activeTasks).length > 0) && (
        <button
          onClick={downloadRecords}
          className="w-full p-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          <span>Download Records</span>
        </button>
      )}
    </div>
  );
};

export default TaskTimer;
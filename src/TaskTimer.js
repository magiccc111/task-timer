import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Download, Users, Trash2, Edit2, Check, X } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, update, remove } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

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
const auth = getAuth(app);


const TaskTimer = () => {
  // Auth states
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);

  // App states
  const [tasks, setTasks] = useState([]);
  const [activeTasks, setActiveTasks] = useState({});
  const [records, setRecords] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [error, setError] = useState(null);

  const [editingRecord, setEditingRecord] = useState(null);
  const [editValues, setEditValues] = useState({
    units: 0,
    duration: 0,
    workerCount: 1
  });

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthError(null);
    });
    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (!user) return;
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
      const recordsUnsubscribe = onValue(recordsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const recordsList = Object.entries(data).map(([id, record]) => ({
            id,
            ...record,
            workerCount: record.workerCount || 1,
            units: record.units || 0
          }));
          setRecords(recordsList);
        } else {
          setRecords([]);
        }
      });

      return () => {
        tasksUnsubscribe();
        activeTasksUnsubscribe();
        recordsUnsubscribe();
      };
    } catch (error) {
      setError(`Setup error: ${error.message}`);
    }
  }, [user]);

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

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError(error.message);
    }
  };
  
  // Show login screen if not authenticated
  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-6">Bejelentkezés</h2>
        {authError && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {authError}
          </div>
        )}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Email cím</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Jelszó</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-3 rounded hover:bg-blue-600"
          >
            Bejelentkezés
          </button>
        </form>
      </div>
    );
  }


  const startEditing = (record) => {
    setEditingRecord(record.id);
    setEditValues({
      units: record.units,
      duration: record.duration,
      workerCount: record.workerCount
    });
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    setEditValues({
      units: 0,
      duration: 0,
      workerCount: 1
    });
  };

  const handleEditSave = async (recordId) => {
    try {
      const recordRef = ref(database, `records/${recordId}`);
      await update(recordRef, {
        units: Number(parseFloat(editValues.units).toFixed(1)),
        duration: Number(editValues.duration),
        workerCount: Number(editValues.workerCount)
      });
      setEditingRecord(null);
    } catch (error) {
      setError(`Edit update error: ${error.message}`);
    }
  };

   // Helper function to parse duration string to seconds
  const parseDurationString = (durationStr) => {
    const [hours, minutes, seconds] = durationStr.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

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

    // Create CSV content with semicolon delimiter
    const csv = [
      ['Task', 'Duration (seconds)', 'Duration (formatted)', 'End Time', 'Workers', 'Units'],  // Header
      ...allRecords.map(record => [
        `"${record.task}"`, // Wrap task name in quotes to handle semicolons and commas
        record.duration,
        formatTime(record.duration),
        record.endTime,
        record.workerCount,
        record.units || 0
      ])
    ].map(row => row.join(';')).join('\n');  // Use semicolon as delimiter

    // Create and download the file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
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
      await update(recordRef, { units: parseFloat(newUnits.toFixed(1)) });
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

  const renderCompletedTasks = () => (
    <div className="mb-6">
      <h3 className="font-bold mb-2">Completed Tasks:</h3>
      <div className="space-y-2">
        {records.map((record) => (
          <div key={record.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <div className="flex-1">
              <div>{record.task}</div>
              {editingRecord === record.id ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={formatTime(editValues.duration)}
                    onChange={(e) => {
                      const seconds = parseDurationString(e.target.value);
                      setEditValues(prev => ({ ...prev, duration: seconds }));
                    }}
                    className="w-24 px-2 py-1 border rounded"
                    placeholder="HH:MM:SS"
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  {formatTime(record.duration)}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {editingRecord === record.id ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Units:</span>
                    <input
                      type="number"
                      value={editValues.units}
                      onChange={(e) => {
                        let value = e.target.value;
                        
                        // Allow empty input for typing purposes
                        if (value === '') {
                          setEditValues(prev => ({ ...prev, units: value }));
                          return;
                        }

                        // Handle decimal numbers
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          // Round to 1 decimal place
                          const roundedValue = Math.round(numValue * 10) / 10;
                          setEditValues(prev => ({ 
                            ...prev, 
                            units: roundedValue
                          }));
                        }
                      }}
                      onBlur={(e) => {
                        // On blur, ensure we have a valid number with 1 decimal place
                        let value = e.target.value;
                        if (value === '' || isNaN(parseFloat(value))) {
                          setEditValues(prev => ({ ...prev, units: 0.0 }));
                        }
                      }}
                      className="w-20 px-2 py-1 border rounded"
                      min="0"
                      step="0.1"
                      lang="en" // Forces dot as decimal separator
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const newValue = Math.round((parseFloat(editValues.units) + 0.1) * 10) / 10;
                        setEditValues(prev => ({ ...prev, units: newValue }));
                      }}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      +0.1
                    </button>
                    <button
                      onClick={() => {
                        const newValue = Math.max(0, Math.round((parseFloat(editValues.units) - 0.1) * 10) / 10);
                        setEditValues(prev => ({ ...prev, units: newValue }));
                      }}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      -0.1
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <input
                      type="number"
                      value={editValues.workerCount}
                      onChange={(e) => setEditValues(prev => ({ 
                        ...prev, 
                        workerCount: Math.max(1, parseInt(e.target.value) || 1)
                      }))}
                      className="w-16 px-2 py-1 border rounded"
                      min="1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSave(record.id)}
                      className="p-1 rounded bg-green-100 hover:bg-green-200 text-green-600"
                      title="Save changes"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1 rounded bg-red-100 hover:bg-red-200 text-red-600"
                      title="Cancel editing"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                // View mode
                <>
                  <div className="flex items-center gap-1">
                  <span>{parseFloat(record.units).toFixed(1)}</span>
                    <span className="text-xs text-gray-500">units</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{record.workerCount}</span>
                    </div>
                    <button
                      onClick={() => startEditing(record)}
                      className="p-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-600"
                      title="Edit task"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRecord(record.id)}
                      className="p-1 rounded bg-red-100 hover:bg-red-200 text-red-600"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

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
      {records.length > 0 && renderCompletedTasks()}
       

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
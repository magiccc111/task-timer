import React from 'react';
import TaskTimer from './TaskTimer';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow mb-8">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900">Task Timer</h1>
        </div>
      </header>
      <main>
        <TaskTimer />
      </main>
    </div>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import AlertSystem from './components/AlertSystem';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ControlPanel from './pages/ControlPanel';
import PlantManagement from './pages/PlantManagement';

function App() {
  return (
    <Router>
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navigation />
        <AlertSystem />
        <main style={{ flex: 1, padding: '2rem 0' }}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/control" element={<ControlPanel />} />
            <Route path="/plants" element={<PlantManagement />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

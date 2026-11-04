import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './auth';
import Layout from './Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Purchases from './pages/Purchases';
import Usage from './pages/Usage';
import Waste from './pages/Waste';
import Forecast from './pages/Forecast';
import Reports from './pages/Reports';

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><span className="spin" style={{ width: 28, height: 28, color: 'var(--brand)' }} /></div>;
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/usage" element={<Usage />} />
          <Route path="/waste" element={<Waste />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store/store';
import ProtectedRoute from './components/ProtectedRoute';
import { useAppSelector } from './hooks';
import { selectUser } from './store/slices/authSlice';
import Login            from './pages/Login';
import AdminDashboard   from './pages/AdminDashboard';
import HODDashboard     from './pages/HODDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';

function AppRoutes() {
  const user = useAppSelector(selectUser);
  const home = user ? `/${user.role}` : '/login';
  return (
    <Routes>
      <Route path="/login"   element={user ? <Navigate to={home} replace /> : <Login />} />
      <Route path="/admin"   element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/hod"     element={<ProtectedRoute roles={['hod','admin']}><HODDashboard /></ProtectedRoute>} />
      <Route path="/teacher" element={<ProtectedRoute roles={['teacher','hod','admin']}><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/student" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/*"       element={<Navigate to={home} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { fontFamily: 'system-ui', borderRadius: 10, fontSize: 14 } }} />
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
}
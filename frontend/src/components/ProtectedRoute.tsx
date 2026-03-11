import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../hooks';
import { selectUser } from '../store/slices/authSlice';
import type { UserRole } from '../types';

interface Props { children: React.ReactNode; roles: UserRole[] }

export default function ProtectedRoute({ children, roles }: Props) {
  const user = useAppSelector(selectUser);
  if (!user) return <Navigate to="/login" replace />;
  if (roles.length && !roles.includes(user.role)) return <Navigate to={`/${user.role}`} replace />;
  return <>{children}</>;
}
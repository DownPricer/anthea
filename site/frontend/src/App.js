import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { HomePage } from './pages/HomePage';
import { WorkoutsPage } from './pages/WorkoutsPage';
import { CreateWorkoutPage } from './pages/CreateWorkoutPage';
import { WorkoutPlayerPage } from './pages/WorkoutPlayerPage';
import { DuoPage } from './pages/DuoPage';
import { ProfilePage } from './pages/ProfilePage';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="workouts" element={<WorkoutsPage />} />
              <Route path="workouts/:workoutId" element={<CreateWorkoutPage />} />
              <Route path="create" element={<CreateWorkoutPage />} />
              <Route path="duo" element={<DuoPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Player route (outside main layout for fullscreen) */}
            <Route
              path="/player/:workoutId"
              element={
                <ProtectedRoute>
                  <WorkoutPlayerPage />
                </ProtectedRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

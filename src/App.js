import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';
import { useEffect } from 'react';
import Hub from './Hub';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './AuthContext';
import './App.css';
import './ios-fixes.css';
import PrivateRoute from './PrivateRoute';
import MyStocksPage from './pages/MyStocksPage';
import NewPositionPage from './pages/NewPositionPage';
import { PositionsProvider } from './PositionsContext';
import { OptionsProvider } from './OptionsContext';
import { ActivityFeedProvider } from './ActivityFeedContext';
import { NotificationProvider } from './NotificationContext';
import MyOptionsPage from './pages/MyOptionsPage';
import NewOptionPage from './pages/NewOptionPage';
import { initializeNotifications } from './utils/notifications';

function App() {
  // Initialize notifications when the app starts
  useEffect(() => {
    const setupNotifications = async () => {
      // We don't immediately request permission on load to avoid overwhelming users
      // Instead, we check if they already granted permission and initialize if so
      if ('Notification' in window && Notification.permission === 'granted') {
        await initializeNotifications();
      }
    };
    
    setupNotifications();
  }, []);

  return (
    <AuthProvider>
      <NotificationProvider>
        <ActivityFeedProvider>
          <PositionsProvider>
            <OptionsProvider>
              <Router>
                <Routes>
                  <Route path="/" element={<LoginPage />} />
                  <Route path="/hub" element={
                    <PrivateRoute>
                      <Hub />
                    </PrivateRoute>
                  } />
                  <Route path="/mystocks" element={
                    <PrivateRoute>
                      <MyStocksPage />
                    </PrivateRoute>
                  } />
                  <Route path="/new-position" element={
                    <PrivateRoute>
                      <NewPositionPage />
                    </PrivateRoute>
                  } />
                  <Route path="/myoptions" element={
                    <PrivateRoute>
                      <MyOptionsPage />
                    </PrivateRoute>
                  } />
                  <Route path="/new-option" element={
                    <PrivateRoute>
                      <NewOptionPage />
                    </PrivateRoute>
                  } />
                </Routes>
              </Router>
            </OptionsProvider>
          </PositionsProvider>
        </ActivityFeedProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;

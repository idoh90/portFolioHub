import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';
import Hub from './Hub';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './AuthContext';
import './App.css';
import PrivateRoute from './PrivateRoute';
import MyStocksPage from './pages/MyStocksPage';
import NewPositionPage from './pages/NewPositionPage';
import { PositionsProvider } from './PositionsContext';
import { ActivityFeedProvider } from './ActivityFeedContext';

function App() {
  return (
    <AuthProvider>
      <ActivityFeedProvider>
        <PositionsProvider>
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
            </Routes>
          </Router>
        </PositionsProvider>
      </ActivityFeedProvider>
    </AuthProvider>
  );
}

export default App;

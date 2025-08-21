import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Home from "./HomePage.js";
import BirdSearchApp from "./BirdSearchApp";
import UploadFile from "./Uploadfile";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm"; // Signup form component
import UserAccount from "./UserAccount";
import { AuthProvider, useAuth } from "./AuthContext";
import PrivateRoute from "./PrivateRoute.js";
import ConfirmSignUp from "./ConfirmSignUp";

function PublicRoute({ children }) {
  const { jwtToken } = useAuth();
  return jwtToken ? <Navigate to="/home" replace /> : children;
}

function RedirectUnknown() {
  const { jwtToken } = useAuth();
  return <Navigate to={jwtToken ? "/home" : "/login"} replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginForm />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignupForm />
              </PublicRoute>
            }
          />
          <Route
            path="/confirm"
            element={
              <PublicRoute>
                <ConfirmSignUp />
              </PublicRoute>
            }
          />

          {/* Private routes */}
          <Route
            path="/home"
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            }
          />
          <Route
            path="/search"
            element={
              <PrivateRoute>
                <BirdSearchApp />
              </PrivateRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <PrivateRoute>
                <UploadFile />
              </PrivateRoute>
            }
          />
          <Route
            path="/account"
            element={
              <PrivateRoute>
                <UserAccount />
              </PrivateRoute>
            }
          />

          {/* Catch all unknown routes */}
          <Route path="*" element={<RedirectUnknown />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

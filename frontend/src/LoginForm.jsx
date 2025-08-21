import React, { useState } from "react";
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";
import { COGNITO_CONFIG } from "./cognitoConfig";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { FaUser, FaLock } from "react-icons/fa";

const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_CONFIG.UserPoolId,
  ClientId: COGNITO_CONFIG.ClientId,
});

const LoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    const user = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    user.authenticateUser(authDetails, {
      onSuccess: (result) => {
        const jwtToken = result.getIdToken().getJwtToken();
        auth.login(jwtToken);
        navigate("/search");
      },
      onFailure: (err) => {
        setError(err.message || JSON.stringify(err));
        setLoading(false);
      },
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Sign In</h2>
        <form onSubmit={handleLogin} style={styles.form}>
          <label style={styles.label}>
            Username
            <div style={styles.inputWrapper}>
              <FaUser style={styles.icon} />
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
                disabled={loading}
              />
            </div>
          </label>

          <label style={styles.label}>
            Password
            <div style={styles.inputWrapper}>
              <FaLock style={styles.icon} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
                disabled={loading}
              />
            </div>
          </label>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading ? styles.buttonLoading : {}),
            }}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}

        <p style={styles.signupText}>
          Don’t have an account?{" "}
          <button
            onClick={() => navigate("/signup")}
            style={styles.signupButton}
            disabled={loading}
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

const pulseAnimation = {
  animation: "pulse 1s infinite ease-in-out",
};

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #a2caff, #f0f7ff)",
    padding: 20,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  card: {
    backgroundColor: "#fff",
    padding: 40,
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: 360,
  },
  title: {
    marginBottom: 32,
    color: "#0a3d62",
    fontWeight: "700",
    fontSize: 28,
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    fontWeight: "600",
    color: "#444",
    fontSize: 14,
  },
  inputWrapper: {
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    border: "1.5px solid #ccc",
    borderRadius: 8,
    padding: "10px 12px",
    backgroundColor: "#f9f9f9",
    transition: "border-color 0.3s ease",
  },
  icon: {
    marginRight: 12,
    color: "#888",
    minWidth: 20,
    fontSize: 18,
  },
  input: {
    flexGrow: 1,
    border: "none",
    outline: "none",
    fontSize: 16,
    backgroundColor: "transparent",
  },
  button: {
    backgroundColor: "#0a74da",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "14px 0",
    fontSize: 18,
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 5px 12px rgba(10, 116, 218, 0.4)",
    transition: "background-color 0.3s ease",
  },
  buttonLoading: {
    backgroundColor: "#0a74da",
    opacity: 0.7,
    cursor: "not-allowed",
    ...pulseAnimation,
  },
  error: {
    marginTop: 20,
    color: "#d9534f",
    textAlign: "center",
    fontWeight: "600",
  },
  signupText: {
    marginTop: 32,
    fontSize: 14,
    color: "#555",
    textAlign: "center",
  },
  signupButton: {
    background: "none",
    border: "none",
    color: "#0a74da",
    fontWeight: "700",
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
    marginLeft: 6,
  },
};

// Inject keyframes for pulse animation
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
}
`, styleSheet.cssRules.length);

export default LoginForm;

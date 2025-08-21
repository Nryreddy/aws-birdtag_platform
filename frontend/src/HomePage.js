import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext"; // adjust path if needed

function Home() {
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSignOut = () => {
    auth.logout(); // Clear JWT token from context + localStorage
    navigate("/login"); // Redirect to login page after logout
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🐦 Welcome to the Bird App 🐦</h1>
      <p style={styles.subtitle}>
        Explore bird media or upload your own files with ease.
      </p>

      <div style={styles.buttonGroup}>
        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={() => navigate("/search")}
          aria-label="Go to Bird Search"
        >
          🔍 Bird Search
        </button>
        <button
          style={{ ...styles.button, ...styles.secondaryButton }}
          onClick={() => navigate("/upload")}
          aria-label="Go to Upload Page"
        >
          ⬆️ Upload Media
        </button>
        <button
          style={{ ...styles.button, ...styles.accountButton }}
          onClick={() => navigate("/account")}
          aria-label="Go to Account Page"
        >
          👤 Account
        </button>
        <button
          style={{ ...styles.button, ...styles.logoutButton }}
          onClick={handleSignOut}
          aria-label="Sign Out"
        >
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    padding: "0 20px",
    gap: "24px",
    background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  title: {
    fontSize: "3rem",
    fontWeight: "800",
    color: "#2c3e50",
    textShadow: "1px 1px 4px rgba(0,0,0,0.1)",
  },
  subtitle: {
    fontSize: "1.25rem",
    color: "#34495e",
    maxWidth: 400,
    textAlign: "center",
  },
  buttonGroup: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "16px",
  },
  button: {
    padding: "14px 28px",
    fontSize: "1.125rem",
    fontWeight: "600",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.3s ease, box-shadow 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    userSelect: "none",
  },
  primaryButton: {
    backgroundColor: "#3498db",
    color: "white",
    boxShadow: "0 4px 10px rgba(52, 152, 219, 0.4)",
  },
  secondaryButton: {
    backgroundColor: "#2ecc71",
    color: "white",
    boxShadow: "0 4px 10px rgba(46, 204, 113, 0.4)",
  },
  accountButton: {
    backgroundColor: "#9b59b6",
    color: "white",
    boxShadow: "0 4px 10px rgba(155, 89, 182, 0.4)",
  },
  logoutButton: {
    backgroundColor: "#e74c3c",
    color: "white",
    boxShadow: "0 4px 10px rgba(231, 76, 60, 0.4)",
  },
};

export default Home;

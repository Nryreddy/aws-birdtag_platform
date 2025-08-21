// ConfirmSignUp.jsx
import React, { useState, useEffect } from "react";
import { CognitoUserPool, CognitoUser } from "amazon-cognito-identity-js";
import { COGNITO_CONFIG } from "./cognitoConfig";
import { useNavigate, useLocation } from "react-router-dom";
import { FaEnvelope, FaKey } from "react-icons/fa";

const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_CONFIG.UserPoolId,
  ClientId: COGNITO_CONFIG.ClientId,
});

const ConfirmSignUp = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  const handleConfirm = (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    const user = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    user.confirmRegistration(code, true, (err, result) => {
      setIsSubmitting(false);
      if (err) {
        setError(err.message || JSON.stringify(err));
      } else {
        setMessage("Account confirmed! You can now log in.");
        setTimeout(() => navigate("/login"), 3000);
      }
    });
  };

  const handleResendCode = () => {
    setError("");
    setMessage("");

    if (!email) {
      setError("Email is not provided , please create a account.");
      return;
    }

    const user = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    user.resendConfirmationCode((err, result) => {
      if (err) {
        setError(err.message || JSON.stringify(err));
      } else {
        setMessage("Confirmation code resent. Please check your email.");
      }
    });
  };

  return (
    <div style={styles.container}>
      {/* Inline CSS for button animation and spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg);}
          100% { transform: rotate(360deg);}
        }
        .btn {
          background-color: #0a74da;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 14px 0;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 5px 12px rgba(10, 116, 218, 0.4);
          transition: background-color 0.3s ease, transform 0.2s ease;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .btn:hover:not(:disabled) {
          background-color: #065bb5;
          transform: scale(1.05);
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #fff;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        }
      `}</style>

      <div style={styles.card}>
        <h2 style={styles.title}>Confirm Your Email</h2>
        <form onSubmit={handleConfirm} style={styles.form} noValidate>
          <label htmlFor="email" style={styles.label}>
            Email
            <div style={styles.inputWrapper}>
              <FaEnvelope style={styles.icon} />
              <input
                id="email"
                type="email"
                placeholder="e.g. john.doe@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
                autoComplete="email"
                disabled={isSubmitting}
                readOnly
              />
            </div>
          </label>

          <label htmlFor="code" style={styles.label}>
            Confirmation Code
            <div style={styles.inputWrapper}>
              <FaKey style={styles.icon} />
              <input
                id="code"
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={styles.input}
                required
                disabled={isSubmitting}
              />
            </div>
          </label>

          <button
            type="submit"
            className="btn"
            disabled={isSubmitting || !email || !code}
          >
            {isSubmitting ? <div className="spinner" /> : "Confirm Account"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResendCode}
          style={{ ...styles.button, backgroundColor: "#555", marginTop: 16 }}
          disabled={isSubmitting}
        >
          Resend Confirmation Code
        </button>

        {error && <p style={styles.error}>{error}</p>}
        {message && <p style={styles.status}>{message}</p>}
      </div>
    </div>
  );
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
    maxWidth: 400,
  },
  title: {
    marginBottom: 28,
    color: "#0a3d62",
    fontWeight: "700",
    fontSize: 26,
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
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
    width: "100%",
  },
  error: {
    marginTop: 16,
    color: "#d9534f",
    textAlign: "center",
    fontWeight: "600",
  },
  status: {
    marginTop: 16,
    color: "green",
    textAlign: "center",
    fontWeight: "600",
  },
};

export default ConfirmSignUp;

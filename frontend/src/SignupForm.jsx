// SignupForm.jsx
import React, { useState } from "react";
import {
  CognitoUserPool,
} from "amazon-cognito-identity-js";
import { COGNITO_CONFIG } from "./cognitoConfig";
import { useNavigate } from "react-router-dom";
import { FaUser, FaLock, FaEnvelope } from "react-icons/fa";

const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_CONFIG.UserPoolId,
  ClientId: COGNITO_CONFIG.ClientId,
});

const SignUpForm = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const isValidPassword = (pwd) => {
    return {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      specialChar: /[^A-Za-z0-9]/.test(pwd),
    };
  };

  const passwordValidations = isValidPassword(password);
  const allPasswordValid = Object.values(passwordValidations).every(Boolean);
  const passwordsMatch = password === confirmPassword;

  const handleSignUp = (e) => {
    e.preventDefault();

    setError("");
    setStatus("");

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    if (!allPasswordValid) {
      setError("Password does not meet all requirements.");
      return;
    }

    setIsSubmitting(true);

    userPool.signUp(
      email,
      password,
      [
        { Name: "email", Value: email },
        { Name: "given_name", Value: firstName },
        { Name: "family_name", Value: lastName },
      ],
      null,
      (err, result) => {
        setIsSubmitting(false);
        if (err) {
          if (err.code === "UsernameExistsException") {
            setError(
              "User already exists. Please confirm your email or login."
            );
          } else {
            setError(err.message || JSON.stringify(err));
          }
        } else {
          setStatus("Signup successful! Please check your email to confirm.");
          setTimeout(() => navigate("/confirm", { state: { email } }), 4000);
        }
      }
    );
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
        <h2 style={styles.title}>Create Account</h2>
        <form onSubmit={handleSignUp} style={styles.form} noValidate>
          <label htmlFor="firstName" style={styles.label}>
            First Name
            <div style={styles.inputWrapper}>
              <FaUser style={styles.icon} />
              <input
                id="firstName"
                type="text"
                placeholder="e.g. John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={styles.input}
                required
                autoComplete="given-name"
                disabled={isSubmitting}
              />
            </div>
          </label>

          <label htmlFor="lastName" style={styles.label}>
            Last Name
            <div style={styles.inputWrapper}>
              <FaUser style={styles.icon} />
              <input
                id="lastName"
                type="text"
                placeholder="e.g. Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={styles.input}
                required
                autoComplete="family-name"
                disabled={isSubmitting}
              />
            </div>
          </label>

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
              />
            </div>
          </label>

          <label htmlFor="password" style={styles.label}>
            Password
            <div style={styles.inputWrapper}>
              <FaLock style={styles.icon} />
              <input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>
            <div style={styles.passwordRules}>
              {Object.entries(passwordValidations).map(([rule, isValid]) => (
                <p
                  key={rule}
                  style={{
                    color: isValid ? "green" : "#999",
                    fontSize: 12,
                    margin: "4px 0",
                  }}
                >
                  {rule === "length" && "• At least 8 characters"}
                  {rule === "uppercase" && "• One uppercase letter"}
                  {rule === "lowercase" && "• One lowercase letter"}
                  {rule === "number" && "• One number"}
                  {rule === "specialChar" && "• One special character"}
                </p>
              ))}
            </div>
          </label>

          <label htmlFor="confirmPassword" style={styles.label}>
            Confirm Password
            <div style={styles.inputWrapper}>
              <FaLock style={styles.icon} />
              <input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>
          </label>

          <button
            type="submit"
            className="btn"
            disabled={
              !allPasswordValid || !passwordsMatch || isSubmitting
            }
          >
            {isSubmitting ? <div className="spinner" /> : "Sign Up"}
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}
        {status && <p style={styles.status}>{status}</p>}
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
  passwordRules: {
    marginTop: 8,
    paddingLeft: 6,
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

export default SignUpForm;

import React, { useEffect, useState } from "react";
import { CognitoUserPool } from "amazon-cognito-identity-js";
import { COGNITO_CONFIG } from "./cognitoConfig";
import { useAuth } from "./AuthContext";

const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_CONFIG.UserPoolId,
  ClientId: COGNITO_CONFIG.ClientId,
});

const API_BASE =
  "https://ypdtyh09eg.execute-api.us-east-1.amazonaws.com/Test/sns-alert";

const UserAccount = () => {
  const [userAttributes, setUserAttributes] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [errorUser, setErrorUser] = useState("");

  // For input & API submission
  const [inputValues, setInputValues] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // New state to store updated tags from API response
  const [updatedTags, setUpdatedTags] = useState(null);

  const auth = useAuth();
  const accessToken = auth.jwtToken;

  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      setErrorUser("No user is currently logged in.");
      setLoadingUser(false);
      return;
    }

    cognitoUser.getSession((err, session) => {
      if (err || !session.isValid()) {
        setErrorUser("User session is invalid. Please log in again.");
        setLoadingUser(false);
        return;
      }

      cognitoUser.getUserAttributes((err, attributes) => {
        if (err) {
          setErrorUser(err.message || JSON.stringify(err));
          setLoadingUser(false);
          return;
        }

        const attrs = {};
        attributes.forEach((attr) => {
          attrs[attr.getName()] = attr.getValue();
        });
        setUserAttributes(attrs);
        setLoadingUser(false);
      });
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitSuccess(null);
    setSubmitError(null);
    setUpdatedTags(null); // reset updated tags on new submit

    const valuesArray = inputValues
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    if (valuesArray.length === 0) {
      setSubmitError("Please enter at least one value.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: userAttributes.email,
          values: valuesArray,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit data");
      }

      const data = await response.json();

      setSubmitSuccess("Values submitted successfully!");
      setUpdatedTags(data.tags || []); // Set updated tags here
      setInputValues("");
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser)
    return (
      <div style={styles.container}>
        <div style={styles.card}>Loading your account info...</div>
      </div>
    );
  if (errorUser)
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, ...styles.error }}>{errorUser}</div>
      </div>
    );

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Your Account Information</h2>
        <div style={styles.infoRow}>
          <span style={styles.label}>First Name:</span>
          <span style={styles.value}>
            {userAttributes?.given_name || "N/A"}
          </span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.label}>Last Name:</span>
          <span style={styles.value}>
            {userAttributes?.family_name || "N/A"}
          </span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.label}>Email:</span>
          <span style={styles.value}>{userAttributes?.email || "N/A"}</span>
        </div>

        <hr style={{ margin: "32px 0" }} />

        <h3 style={styles.subtitle}>Enter comma-separated tags to receive notifications for them</h3>
        <form onSubmit={handleSubmit} style={styles.form}>
          <textarea
            placeholder="e.g. value1, value2, value3"
            value={inputValues}
            onChange={(e) => setInputValues(e.target.value)}
            rows={4}
            style={styles.textarea}
            disabled={submitting}
            required
          />
          <button type="submit" style={styles.button} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>

        {submitSuccess && (
          <p style={{ ...styles.message, color: "green" }}>{submitSuccess}</p>
        )}
        {submitError && (
          <p style={{ ...styles.message, color: "#d9534f" }}>{submitError}</p>
        )}

        {/* Display updated tags returned from backend */}
        {updatedTags && updatedTags.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h4 style={{ color: "#0a3d62" }}>You will be notified for the following tags:</h4>
            <ul>
              {updatedTags.map((tag, idx) => (
                <li key={idx} style={{ fontSize: 16, color: "#0a3d62" }}>
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #a2caff, #f0f7ff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  card: {
    backgroundColor: "#fff",
    padding: 40,
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: 480,
    textAlign: "left",
  },
  title: {
    fontSize: 28,
    color: "#0a3d62",
    fontWeight: "700",
    marginBottom: 32,
    textAlign: "center",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #eee",
    fontSize: 18,
  },
  label: {
    fontWeight: "600",
    color: "#555",
  },
  value: {
    fontWeight: "400",
    color: "#0a3d62",
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    color: "#0a3d62",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  textarea: {
    resize: "vertical",
    padding: 12,
    fontSize: 16,
    borderRadius: 10,
    border: "1.5px solid #ccc",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    minHeight: 80,
    outline: "none",
    transition: "border-color 0.3s ease",
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
    userSelect: "none",
  },
  message: {
    marginTop: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  error: {
    color: "#d9534f",
    fontWeight: "600",
    textAlign: "center",
  },
};

export default UserAccount;

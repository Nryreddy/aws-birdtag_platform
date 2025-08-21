import React from 'react';
import { useAuth } from 'react-oidc-context';

function Goodbye() {
  const auth = useAuth();

  const handleSignIn = () => {
    auth.signinRedirect(); // redirect to Cognito hosted login page
  };

  return (
    <div style={styles.container}>
      <h1>Thank you for using our product! 👋</h1>
      <p>If you want to sign in again, please click the button below.</p>
      <button style={styles.button} onClick={handleSignIn}>
        🔐 Sign In Again
      </button>
    </div>
  );
}

const styles = {
  container: {
    textAlign: 'center',
    marginTop: '20vh',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  button: {
    marginTop: 20,
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};

export default Goodbye;

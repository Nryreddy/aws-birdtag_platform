// PrivateRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const PrivateRoute = ({ children }) => {
  const { jwtToken } = useAuth();

  if (!jwtToken) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default PrivateRoute;

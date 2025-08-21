import React, { useState, useRef } from "react";
import { useAuth } from "./AuthContext";
import axios from "axios";
import "./FileUploader.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
} from "react-router-dom";

const FileUploader = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();

  const auth = useAuth();
  const accessToken = auth.jwtToken;

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    setFiles(droppedFiles);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleFileChange = (event) => {
    setFiles(Array.from(event.target.files));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert("Please select or drag some files first.");
      return;
    }

    setLoading(true);

    try {
      const API_ENDPOINT =
        "https://ypdtyh09eg.execute-api.us-east-1.amazonaws.com/Test/upload-files";

      for (const file of files) {
        const filename = encodeURIComponent(file.name);
        const presignUrl = `${API_ENDPOINT}?filename=${filename}`;

        // ✅ Add the Authorization header here
        const response = await axios.get(presignUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const { url, fields } = response.data;
        const formData = new FormData();
        Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
        formData.append("file", file);

        // ✅ S3 upload (no Authorization needed here)
        await axios.post(url, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          mode: "cors",
        });

        console.log(`✅ Uploaded: ${file.name}`);
      }

      alert(`All ${files.length} files uploaded successfully!`);
      setFiles([]); // Clear files after upload
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  // Navbar
  function Navbar() {
    return (
      <nav style={{ padding: 12, backgroundColor: "#3498db", color: "white" }}>
        <span style={{ fontWeight: "bold" }}>Bird Media Search</span>{" "}
        <NavLink
          to="/"
          style={({ isActive }) => ({
            marginLeft: 16,
            color: isActive ? "#f39c12" : "white",
            textDecoration: "none",
          })}
        >
          Home
        </NavLink>
        <NavLink
          to="/search"
          style={({ isActive }) => ({
            marginLeft: 16,
            color: isActive ? "#f39c12" : "white",
            textDecoration: "none",
          })}
        >
          Search
        </NavLink>
      </nav>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Upload Files</h2>

        <div
          className="drop-zone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current.click()}
        >
          <p>Drag & drop your files here or click to select</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            hidden
          />
        </div>

        {files.length > 0 && (
          <div className="filename">
            <strong>Selected files:</strong>
            <ul>
              {files.map((file, idx) => (
                <li key={idx}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={loading}
        >
          {loading ? (
            <div className="loader-container">
              <div className="ring-loader"></div>
              <span className="uploading-text">Uploading...</span>
            </div>
          ) : (
            "Upload All"
          )}
        </button>
      </div>
    </>
  );
};

export default FileUploader;

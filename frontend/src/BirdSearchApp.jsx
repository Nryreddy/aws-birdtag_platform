import React, { useState } from "react";
import styles from "./styles";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
} from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

const API_BASE = "https://ypdtyh09eg.execute-api.us-east-1.amazonaws.com/Test";

export default function BirdSearchApp() {
  const auth = useAuth();
  const accessToken = auth.jwtToken;

  const [queryType, setQueryType] = useState("tagCountSearch");
  const [postData, setPostData] = useState('{"crow": 2, "pigeon": 1}');
  const [getTags, setGetTags] = useState("crow,pigeon");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tagCountPairs, setTagCountPairs] = useState([{ tag: "", count: 1 }]);

  // Modify-tags mode states
  const [modifyUrls, setModifyUrls] = useState("");
  const [modifyOperation, setModifyOperation] = useState("0");
  const [modifyTags, setModifyTags] = useState("crow,20\npigeon,1");

  // Delete-files mode state
  const [deleteUrl, setDeleteUrl] = useState("");

  // Upload mode state
  const [uploadFile, setUploadFile] = useState(null);

  const parseJSON = (str) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  const isImageUrl = (url) => {
    try {
      const cleanUrl = new URL(url).pathname.toLowerCase();
      return /\.(jpg|jpeg|png|gif|bmp|webp)$/.test(cleanUrl);
    } catch {
      return false;
    }
  };

  function categorizeLinks(links) {
    if (!Array.isArray(links)) {
      // If links is null, undefined, or not an array, return empty groups
      return { audios: [], images: [], others: [] };
    }

    const audios = [];
    const images = [];
    const others = [];

    links.forEach((link) => {
      if (typeof link !== "string") return;

      if (link.match(/\.(mp3|wav|ogg)(\?.*)?$/i)) {
        audios.push(link);
      } else if (link.match(/\.(jpe?g|png|gif|bmp|webp)(\?.*)?$/i)) {
        images.push(link);
      } else {
        others.push(link);
      }
    });

    return { audios, images, others };
  }

  function handlePostSearch() {
    const body = parseJSON(postData);
    if (!body) {
      alert("Invalid JSON");
      return;
    }

    setLoading(true);
    setResult(null);

    fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      mode: "cors",
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.links && data.links.length > 0) {
          setResult(data.links);
        } else if (data.originalURL) {
          setResult([data.originalURL]);
        } else {
          setResult([]);
        }
      })
      .catch((err) => {
        console.error("POST error:", err);
        alert("Error during POST search: " + err.message);
      })
      .finally(() => setLoading(false));
  }

  function handleGetTagsOnlySearch() {
    if (!getTags.trim()) {
      alert("Enter at least one tag");
      return;
    }
    setLoading(true);
    setResult(null);

    if (!accessToken) {
      alert("Not authenticated");
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/search?tag=${encodeURIComponent(getTags.trim())}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      mode: "cors",
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then((data) => setResult(data.links || []))
      .catch((err) => {
        console.error("GET tags only error:", err);
        alert("Error during GET tags only search: " + err.message);
      })
      .finally(() => setLoading(false));
  }

  function handleGetTagsWithCountsSearch() {
    const filteredPairs = tagCountPairs.filter(
      (p) => p.tag.trim() && p.count > 0
    );
    if (filteredPairs.length === 0) {
      alert("Enter at least one tag with a positive count");
      return;
    }

    const params = new URLSearchParams();
    filteredPairs.forEach(({ tag, count }, i) => {
      params.append(`tag${i + 1}`, tag.trim());
      params.append(`count${i + 1}`, count.toString());
    });

    setLoading(true);
    setResult(null);

    fetch(`${API_BASE}/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      mode: "cors",
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then((data) => setResult(data.links || []))
      .catch((err) => {
        console.error("GET tags with counts error:", err);
        alert("Error during GET tags with counts search: " + err.message);
      })
      .finally(() => setLoading(false));
  }

  function handleThumbnailSearch() {
    if (!thumbnailUrl) {
      alert("Enter a thumbnail URL");
      return;
    }

    setLoading(true);
    setResult(null);

    fetch(
      `${API_BASE}/search?thumbnailURL=${encodeURIComponent(thumbnailUrl)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        mode: "cors",
      }
    )
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then((data) => {
        setResult(data.originalURL ? [data.originalURL] : []);
      })
      .catch((err) => {
        console.error("Thumbnail search error:", err);
        alert("Error during thumbnail search: " + err.message);
      })
      .finally(() => setLoading(false));
  }

  // Modify-tags handler
  function handleModifyTags() {
    const urlList = modifyUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u);

    if (urlList.length === 0) {
      alert("Enter at least one URL");
      return;
    }

    if (modifyOperation !== "0" && modifyOperation !== "1") {
      alert("Operation must be 0 or 1");
      return;
    }

    const tagsArr = modifyTags
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .map((line) => {
        if (!line.includes(",")) {
          alert(`Tag entry "${line}" is invalid, must be 'tag,count' format`);
          throw new Error("Invalid tag format");
        }
        const [tag, count] = line.split(",");
        if (!tag.trim() || isNaN(Number(count))) {
          alert(
            `Tag entry "${line}" is invalid, tag must be non-empty and count a number`
          );
          throw new Error("Invalid tag format");
        }
        return `${tag.trim()},${Number(count)}`;
      });

    const body = {
      url: urlList,
      operation: Number(modifyOperation),
      tags: tagsArr,
    };

    setLoading(true);
    setResult(null);

    fetch(`${API_BASE}/modify-tags`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      mode: "cors",
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.updated && data.updated.length > 0) {
          setResult(data.updated);
        } else {
          setResult([]);
        }
      })
      .catch((err) => {
        console.error("Modify tags error:", err);
        alert("Error during modify tags: " + err.message);
      })
      .finally(() => setLoading(false));
  }

  // Delete-files handler
  function handleDeleteFiles() {
    if (!deleteUrl.trim()) {
      alert("Enter at least one URL to delete");
      return;
    }

    const body = {
      urls: [deleteUrl.trim()],
    };

    setLoading(true);
    setResult(null);

    fetch(`${API_BASE}/delete-files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      mode: "cors",
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then((data) => {
        alert(data.message || "Deletion completed");
      })
      .catch((err) => {
        console.error("Delete files error:", err);
        alert("Error during delete files: " + err.message);
      })
      .finally(() => setLoading(false));
  }

  // New: Upload handler
  function handleUploadSearch() {
    if (!uploadFile) {
      alert("Please select a file to upload.");
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", uploadFile);

 

    fetch(`${API_BASE}/upload-search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
      mode: "cors",
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then((data) => {
        setResult(data.links || []); // Assuming backend returns { links: [...] }
      })
      .catch((err) => {
        console.error("Upload search error:", err);
        alert("Error during file upload search: " + err.message);
      })
      .finally(() => setLoading(false));
  }

  function updateTagCountPair(idx, field, value) {
    setTagCountPairs((pairs) =>
      pairs.map((p, i) =>
        i === idx
          ? { ...p, [field]: field === "count" ? Number(value) : value }
          : p
      )
    );
  }

  function removeTagCountPair(idx) {
    setTagCountPairs((pairs) => pairs.filter((_, i) => i !== idx));
  }

  function addTagCountPair() {
    setTagCountPairs((pairs) => [...pairs, { tag: "", count: 1 }]);
  }

  const grouped = categorizeLinks(result || []);
  console.log(grouped.audios); // Should now contain your mp3 URL
  const audios = grouped.audios; // Your array of audio URLs

  const images = result || [];
  const hasThumbnailsOrAnnotated = images.some(
    (url) => url.includes("thumbnail") || url.includes("annotated")
  );

  // If there is only one image and it's NOT a thumbnail or annotated, treat as originalURL
  const originalURL =
    images.length === 1 &&
    !images[0].includes("thumbnail") &&
    !images[0].includes("annotated")
      ? images[0]
      : null;

  // Navbar with links to Home and Upload pages
  // Navbar component
  function Navbar() {
    return (
      <nav style={{ padding: 12, backgroundColor: "#3498db", color: "white" }}>
        <span style={{ fontWeight: "bold" }}>Bird Media Search</span>{" "}
        <NavLink
          to="/home"
          style={({ isActive }) => ({
            marginLeft: 16,
            color: isActive ? "#f39c12" : "white",
            textDecoration: "none",
          })}
        >
          Home
        </NavLink>
        <NavLink
          to="/upload"
          style={({ isActive }) => ({
            marginLeft: 16,
            color: isActive ? "#f39c12" : "white",
            textDecoration: "none",
          })}
        >
          Upload
        </NavLink>
      </nav>
    );
  }

  return (
    <>
      <Navbar />
      <div style={styles.container}>
        <h2 style={styles.header}>Bird Media Search</h2>

        <div style={styles.radioGroup}>
          <label>
            <input
              type="radio"
              name="queryType"
              value="tagCountSearch"
              checked={queryType === "tagCountSearch"}
              onChange={() => setQueryType("tagCountSearch")}
              disabled={loading}
            />{" "}
            Search by tags with counts (POST JSON)
          </label>
          <label>
            <input
              type="radio"
              name="queryType"
              value="tagOnlySearch"
              checked={queryType === "tagOnlySearch"}
              onChange={() => setQueryType("tagOnlySearch")}
              disabled={loading}
            />{" "}
            Search by tags only (GET params)
          </label>
          <label>
            <input
              type="radio"
              name="queryType"
              value="thumbnailSearch"
              checked={queryType === "thumbnailSearch"}
              onChange={() => setQueryType("thumbnailSearch")}
              disabled={loading}
            />{" "}
            Search by thumbnail URL (GET param)
          </label>
          <label>
            <input
              type="radio"
              name="queryType"
              value="modifyTags"
              checked={queryType === "modifyTags"}
              onChange={() => setQueryType("modifyTags")}
              disabled={loading}
            />{" "}
            Modify Tags (POST JSON)
          </label>
          <label>
            <input
              type="radio"
              name="queryType"
              value="deleteFiles"
              checked={queryType === "deleteFiles"}
              onChange={() => setQueryType("deleteFiles")}
              disabled={loading}
            />{" "}
            Delete Files (POST JSON)
          </label>
          <label>
            <input
              type="radio"
              name="queryType"
              value="upload"
              checked={queryType === "upload"}
              onChange={() => {
                setQueryType("upload");
                setResult(null);
                setUploadFile(null);
              }}
              disabled={loading}
            />{" "}
            Upload File Search
          </label>
        </div>

        {queryType === "tagCountSearch" && (
          <>
            <textarea
              rows={5}
              style={styles.textarea}
              value={postData}
              onChange={(e) => setPostData(e.target.value)}
              placeholder='e.g. {"crow": 2, "pigeon": 1}'
              disabled={loading}
            />
            <button
              style={
                loading
                  ? { ...styles.button, ...styles.buttonDisabled }
                  : styles.button
              }
              onClick={handlePostSearch}
              disabled={loading}
            >
              Search
            </button>
          </>
        )}

        {queryType === "tagOnlySearch" && (
          <>
            <div
              style={{
                borderTop: "1px solid #ddd",
                paddingTop: 20,
              }}
            ></div>
            <h4 style={{ marginBottom: 12 }}>Search by Tag </h4>

            <input
              type="text"
              placeholder="Enter comma separated tags"
              value={getTags}
              onChange={(e) => setGetTags(e.target.value)}
              disabled={loading}
              style={{
                ...styles.input,
                marginBottom: 16,
                padding: "10px 14px",
                fontSize: 16,
                width: "100%",
                boxSizing: "border-box",
              }}
            />

            <button
              onClick={handleGetTagsOnlySearch}
              disabled={loading}
              style={
                loading
                  ? {
                      ...styles.button,
                      ...styles.buttonDisabled,
                      marginBottom: 24,
                    }
                  : { ...styles.button, marginBottom: 24 }
              }
            >
              Search Tags Only
            </button>

            <div
              style={{
                borderTop: "1px solid #ddd",
                paddingTop: 20,
              }}
            >
              <h4 style={{ marginBottom: 12 }}>Or Search by Tag + Counts</h4>
              {tagCountPairs.map((pair, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Tag"
                    value={pair.tag}
                    onChange={(e) =>
                      updateTagCountPair(idx, "tag", e.target.value)
                    }
                    disabled={loading}
                    style={{
                      flexGrow: 1,
                      minWidth: 120,
                      padding: "8px 12px",
                      fontSize: 15,
                      borderRadius: 4,
                      border: "1px solid #ccc",
                    }}
                  />
                  <input
                    type="number"
                    min={1}
                    value={pair.count}
                    onChange={(e) =>
                      updateTagCountPair(idx, "count", e.target.value)
                    }
                    disabled={loading}
                    style={{
                      width: 80,
                      padding: "8px 12px",
                      fontSize: 15,
                      borderRadius: 4,
                      border: "1px solid #ccc",
                    }}
                  />
                  <button
                    onClick={() => removeTagCountPair(idx)}
                    disabled={loading}
                    style={{
                      ...styles.smallButton,
                      backgroundColor: "#e74c3c",
                      color: "white",
                      padding: "6px 14px",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={addTagCountPair}
                disabled={loading}
                style={{
                  ...styles.smallButton,
                  backgroundColor: "#27ae60",
                  color: "white",
                  padding: "8px 18px",
                  borderRadius: 6,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  fontSize: 15,
                  marginBottom: 20,
                }}
              >
                + Add Tag + Count
              </button>

              <br />

              <button
                onClick={handleGetTagsWithCountsSearch}
                disabled={loading}
                style={
                  loading
                    ? { ...styles.button, ...styles.buttonDisabled }
                    : styles.button
                }
              >
                Search Tags with Counts
              </button>
            </div>
          </>
        )}

        {queryType === "thumbnailSearch" && (
          <>
            <input
              type="text"
              placeholder="Enter thumbnail URL"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              disabled={loading}
              style={styles.input}
            />
            <button
              onClick={handleThumbnailSearch}
              disabled={loading}
              style={
                loading
                  ? { ...styles.button, ...styles.buttonDisabled }
                  : styles.button
              }
            >
              Search Thumbnail
            </button>
          </>
        )}

        {queryType === "modifyTags" && (
          <>
            <textarea
              rows={3}
              placeholder="Enter URLs, one per line"
              value={modifyUrls}
              onChange={(e) => setModifyUrls(e.target.value)}
              disabled={loading}
              style={styles.textarea}
            />
            <select
              value={modifyOperation}
              onChange={(e) => setModifyOperation(e.target.value)}
              disabled={loading}
              style={styles.select}
            >
              <option value="1">1 (Add Tags)</option>
              <option value="0">0 (Remove Tags)</option>
            </select>
            <textarea
              rows={5}
              placeholder="Enter tags with counts (tag,count), one per line"
              value={modifyTags}
              onChange={(e) => setModifyTags(e.target.value)}
              disabled={loading}
              style={styles.textarea}
            />
            <button
              onClick={handleModifyTags}
              disabled={loading}
              style={
                loading
                  ? { ...styles.button, ...styles.buttonDisabled }
                  : styles.button
              }
            >
              Modify Tags
            </button>
          </>
        )}

        {queryType === "deleteFiles" && (
          <>
            <input
              type="text"
              placeholder="Enter file URL to delete"
              value={deleteUrl}
              onChange={(e) => setDeleteUrl(e.target.value)}
              disabled={loading}
              style={styles.input}
            />
            <button
              onClick={handleDeleteFiles}
              disabled={loading}
              style={
                loading
                  ? { ...styles.button, ...styles.buttonDisabled }
                  : styles.button
              }
            >
              Delete File
            </button>
          </>
        )}

        {queryType === "upload" && (
          <>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files[0])}
              disabled={loading}
              accept="*/*"
              style={styles.input}
            />
            <button
              onClick={handleUploadSearch}
              disabled={loading || !uploadFile}
              style={
                loading
                  ? { ...styles.button, ...styles.buttonDisabled }
                  : styles.button
              }
            >
              Upload and Search
            </button>
          </>
        )}

        <div style={styles.results}>
          {loading && <p>Loading...</p>}

          {!loading &&
            result &&
            Array.isArray(result) &&
            result.length === 0 && <p>No results found.</p>}

          {!loading && result && Array.isArray(result) && result.length > 0 && (
            <>
              {(() => {
                const grouped = {};

                result.forEach((url) => {
                  const filename = url.split("/").pop().split("?")[0];
                  const animalName = filename.split(/[-_]/)[0] || "Unknown";

                  if (!grouped[animalName]) {
                    grouped[animalName] = {
                      images: [],
                      videos: [],
                      audios: [],
                    };
                  }

                  const lower = filename.toLowerCase();

                  if (lower.match(/\.(mp4)$/)) {
                    // It's a video (exclude thumbnail videos if you want)
                    const isThumbnailVideo = lower.includes("thumbnail");
                    if (!isThumbnailVideo) {
                      grouped[animalName].videos.push(url);
                    }
                  } else if (lower.match(/\.(mp3|wav|ogg)$/)) {
                    // Audio file
                    grouped[animalName].audios.push(url);
                  } else {
                    // Assume image
                    grouped[animalName].images.push(url);
                  }
                });

                return Object.entries(grouped).map(
                  ([
                    animalName,
                    { images = [], videos = [], audios = [], originalURL },
                  ]) => (
                    <div key={animalName} style={{ marginBottom: 40 }}>
                      <h3 style={{ textTransform: "capitalize" }}>
                        {animalName}
                      </h3>

                      {/* Images row */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 20,
                          justifyContent: "flex-start",
                          marginBottom: 20,
                        }}
                      >
                        {images.length > 0 ? (
                          hasThumbnailsOrAnnotated ? (
                            // Show only thumbnails and annotated images
                            images
                              .filter(
                                (url) =>
                                  url.includes("thumbnail") ||
                                  url.includes("annotated")
                              )
                              .map((url, idx) => {
                                const filename = url
                                  .split("/")
                                  .pop()
                                  .split("?")[0];
                                const isThumbnail = url.includes("thumbnail");
                                const isAnnotated = url.includes("annotated");

                                // Find raw upload URL for this thumbnail (to redirect on click)
                                let rawUrl = null;
                                if (isThumbnail) {
                                  rawUrl = images.find(
                                    (link) =>
                                      link.includes("raw_uploads") &&
                                      link.split("/").pop().split("?")[0] ===
                                        filename
                                  );
                                }

                                return (
                                  <div
                                    key={idx}
                                    style={{
                                      width: 320,
                                      boxSizing: "border-box",
                                    }}
                                  >
                                    <a
                                      href={
                                        isThumbnail && rawUrl ? rawUrl : url
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <img
                                        src={url}
                                        alt={`${animalName || "animal"} image`}
                                        style={{
                                          width: "100%",
                                          height: "auto",
                                          maxHeight: 280,
                                          cursor: "pointer",
                                          display: "block",
                                          marginBottom: 8,
                                          objectFit: "contain",
                                        }}
                                      />
                                    </a>
                                    <div
                                      style={{
                                        fontSize: 14,
                                        color: "#333",
                                        textAlign: "center",
                                        fontWeight: "600",
                                      }}
                                    >
                                      {isThumbnail
                                        ? "Thumbnail"
                                        : isAnnotated
                                        ? "Annotated"
                                        : "Image"}
                                    </div>
                                  </div>
                                );
                              })
                          ) : (
                            // No thumbnails or annotated - show all images (usually raw uploads)
                            images.map((url, idx) => (
                              <div
                                key={idx}
                                style={{
                                  width: 320,
                                  boxSizing: "border-box",
                                }}
                              >
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={url}
                                    alt={`${animalName || "animal"} image`}
                                    style={{
                                      width: "100%",
                                      height: "auto",
                                      maxHeight: 280,
                                      cursor: "pointer",
                                      display: "block",
                                      marginBottom: 8,
                                      objectFit: "contain",
                                    }}
                                  />
                                </a>
                                <div
                                  style={{
                                    fontSize: 14,
                                    color: "#333",
                                    textAlign: "center",
                                    fontWeight: "600",
                                  }}
                                >
                                  Original Image
                                </div>
                              </div>
                            ))
                          )
                        ) : originalURL ? (
                          // If no images but have a single originalURL, show that
                          <div
                            key="originalURL"
                            style={{
                              width: 320,
                              boxSizing: "border-box",
                            }}
                          >
                            <a
                              href={originalURL}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={originalURL}
                                alt={`${animalName || "animal"} original image`}
                                style={{
                                  width: "100%",
                                  height: "auto",
                                  maxHeight: 280,
                                  cursor: "pointer",
                                  display: "block",
                                  marginBottom: 8,
                                  objectFit: "contain",
                                }}
                              />
                            </a>
                            <div
                              style={{
                                fontSize: 14,
                                color: "#333",
                                textAlign: "center",
                                fontWeight: "600",
                              }}
                            >
                              Original
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Videos row */}
                      {videos.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 20,
                            justifyContent: "flex-start",
                            marginBottom: 20,
                          }}
                        >
                          {videos.map((url, idx) => {
                            const filename = url.split("/").pop().split("?")[0];
                            const isAnnotatedVideo = url
                              .toLowerCase()
                              .includes("annotated");
                            const isRawVideo = url
                              .toLowerCase()
                              .includes("raw_uploads");
                            const showDownloadButton =
                              isAnnotatedVideo || isRawVideo;

                            return (
                              <div
                                key={idx}
                                style={{
                                  width: 320,
                                  boxSizing: "border-box",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                }}
                              >
                                {showDownloadButton && (
                                  <a
                                    href={url}
                                    download
                                    style={{
                                      display: "inline-block",
                                      width: "50%",
                                      padding: "12px 20px",
                                      textAlign: "center",
                                      backgroundColor: "#0056b3",
                                      color: "#fff",
                                      textDecoration: "none",
                                      borderRadius: 10,
                                      marginBottom: 10,
                                      fontWeight: "600",
                                      fontSize: 16,
                                      boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                                      transition:
                                        "background-color 0.3s ease, box-shadow 0.3s ease",
                                      cursor: "pointer",
                                      userSelect: "none",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "#003d80";
                                      e.currentTarget.style.boxShadow =
                                        "0 6px 12px rgba(0,0,0,0.25)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "#0056b3";
                                      e.currentTarget.style.boxShadow =
                                        "0 4px 8px rgba(0,0,0,0.15)";
                                    }}
                                  >
                                    Download{" "}
                                    {isAnnotatedVideo
                                      ? "Annotated"
                                      : "Original"}{" "}
                                    Video
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Audios row */}
                      {audios.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 20,
                            justifyContent: "flex-start",
                          }}
                        >
                          {audios.map((url, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: 320,
                                boxSizing: "border-box",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                              }}
                            >
                              <audio
                                controls
                                style={{ width: "100%", marginBottom: 10 }}
                              >
                                <source src={url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                              </audio>

                              <a
                                href={url}
                                download
                                style={{
                                  display: "inline-block",
                                  width: "50%",
                                  padding: "12px 20px",
                                  textAlign: "center",
                                  backgroundColor: "#0056b3",
                                  color: "#fff",
                                  textDecoration: "none",
                                  borderRadius: 10,
                                  fontWeight: "600",
                                  fontSize: 16,
                                  boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                                  cursor: "pointer",
                                  userSelect: "none",
                                  marginBottom: 10,
                                  transition:
                                    "background-color 0.3s ease, box-shadow 0.3s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#003d80";
                                  e.currentTarget.style.boxShadow =
                                    "0 6px 12px rgba(0,0,0,0.25)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#0056b3";
                                  e.currentTarget.style.boxShadow =
                                    "0 4px 8px rgba(0,0,0,0.15)";
                                }}
                                aria-label={`Download audio file ${idx + 1}`}
                              >
                                Download Audio
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                );
              })()}
            </>
          )}
        </div>
      </div>
    </>
  );
}

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { ref, get, onValue, remove } from "firebase/database";
import { db } from "../Firebase/Firebase";
import { Upload } from "lucide-react";
import img from "../Images/purviewlogo.png";

const FileUpload = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files);
    setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert("Please select files to upload.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("file", file);
    });

    try {
      const response = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      

      if (response.ok) {
        alert("Files uploaded successfully!");
        setSelectedFiles([]);
      } else {
        alert("Failed to upload files. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("An error occurred while uploading files.");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleProfileDialog = () => {
    setIsDialogOpen(!isDialogOpen);
  };

  useEffect(() => {
    const fetchEmail = async () => {
        const isLoggedIn = localStorage.getItem("isLoggedIn");
        if (!isLoggedIn) {
            navigate("/signin");
            return;
        }
        
        const email = localStorage.getItem("userEmail");
        console.log("User Email" + email);
        if (email) {
            setUserEmail(email);
            const initials = email.slice(0, 2).toUpperCase();
            setUserInitials(initials);
        }
    };      

    fetchEmail();
  }, [navigate]);

  const handleSignOut = () => {
    const auth = getAuth();
    signOut(auth)
      .then(() => {
        navigate("/signin");
      })
      .catch((error) => {
        console.error("Sign-out error:", error);
      });
  };

  const removeFile = (index) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-black flex flex-col bg-gradient-to-t from-gray-900 to-black"
         style={{
           background: `
             radial-gradient(circle at bottom right, rgb(12,25,97) 20%, rgba(0, 0, 0, 1) 70%),
             radial-gradient(circle at top right, rgba(150, 75, 0, 1) 10%, rgba(0, 0, 0, 1) 80%)
           `
         }}>
      {/* Navbar */}
      <nav className="bg-gradient-to-t from-[rgb(12,25,97)] to-[rgb(12,25,97)]/5 backdrop-blur-md border-b border-white/20 shadow-lg">
        <div className="container flex items-center justify-between px-6 py-3 mx-auto">
          <div className="flex items-center">
            <img className="h-12 filter invert brightness-0" src={img} alt="JPMC Logo" />
          </div>

          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold text-white">
            File Upload
          </h1>

          <div className="flex items-center space-x-6">
            <a href="/AdminDashboardPage" className="text-white hover:text-[rgb(12,25,97)] transition-colors">
              Home
            </a>
            <a href="/FileUpload" className="text-white hover:text-[rgb(12,25,97)] transition-colors">
              Files
            </a>
            <div
              className="flex items-center justify-center w-10 h-10 bg-white rounded-full cursor-pointer transform hover:scale-105 transition-transform"
              onClick={toggleProfileDialog}
            >
              <span className="text-black font-bold">{userInitials}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Profile Dialog */}
      {isDialogOpen && (
        <div className="absolute top-16 right-6 bg-black rounded-lg shadow-lg p-4 w-80 z-50">
          <p className="text-white font-medium mb-4 break-words">Email: {userEmail}</p>
          <button
            className="w-full px-4 py-2 text-white bg-[rgb(12,25,97)] rounded-lg hover:bg-[rgb(12,25,97)]"
            onClick={() => setIsSignOutDialogOpen(true)}
          >
            Sign Out
          </button>
        </div>
      )}
      {isSignOutDialogOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Are you sure you want to sign out?
            </h2>
            <div className="flex justify-between">
              <button
                className="px-6 py-2 text-white bg-[rgb(12,25,97)] rounded-lg hover:bg-[rgb(12,25,97)]"
                onClick={() => setIsSignOutDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div
          className={`w-full max-w-2xl bg-[rgb(8,16,60)]/90 backdrop-blur-md border-2 ${
            dragActive ? 'border-white' : 'border-gray-700'
          } rounded-lg p-8 text-center transition-all transform ${
            dragActive ? 'scale-102 shadow-2xl' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="w-16 h-16 mx-auto mb-4 text-white/80" />
          <p className="text-white text-xl mb-4">
            Drag and drop files here, or click to select files
          </p>
          <input
            type="file"
            multiple
            className="hidden"
            id="file-input"
            onChange={handleFileSelect}
          />
          <label
            htmlFor="file-input"
            className="px-6 py-3 bg-[rgb(12,25,97)] text-white rounded-lg cursor-pointer hover:bg-[rgb(8,16,60)] transition-colors inline-block"
          >
            Select Files
          </label>
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="mt-6 w-full max-w-2xl bg-black/50 backdrop-blur-md p-6 rounded-lg border border-white/20">
            <h3 className="text-white text-lg mb-4 font-semibold">Selected Files:</h3>
            <ul className="space-y-2">
              {selectedFiles.map((file, index) => (
                <li key={index} className="flex items-center justify-between bg-[rgb(8,16,60)]/50 p-3 rounded-lg">
                  <span className="text-white truncate">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upload Button */}
        <button
          className={`mt-6 px-8 py-3 bg-[rgb(12,25,97)] text-white rounded-lg transition-all transform hover:bg-[rgb(8,16,60)] disabled:opacity-50 ${
            isUploading ? 'cursor-not-allowed' : 'hover:scale-105'
          }`}
          onClick={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </span>
          ) : (
            "Upload Files"
          )}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
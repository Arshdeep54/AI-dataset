import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

// Create axios instance with default config
const api = axios.create({
  // baseURL: import.meta.env.VITE_APP_API_URL || 'http://backend:5000',
  baseURL:  'http://localhost:5000',
  withCredentials: true
});

// Add token to all requests
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const Survey = () => {
  const [currentImage, setCurrentImage] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [currentArtifactIndex, setCurrentArtifactIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [surveyCount, setSurveyCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (!decoded.enrollmentNumber) {
        console.error('Invalid token format:', decoded);
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      setUserData(decoded);
      fetchNewImage();
    } catch (error) {
      console.error('Token error:', error);
      localStorage.removeItem('token');
      navigate('/login');
    }
  }, [navigate]);

  const fetchNewImage = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/random-image');
      
      if (response.data.completed) {
        // User has seen all images
        setError(response.data.message);
        setSurveyCount(response.data.imagesAnalyzed);
        setTimeout(() => {
          fetchNewImage(); // Try again after showing the message
        }, 2000);
        return;
      }

      const { imageUrl, filename, artifacts, remainingImages, imagesAnalyzed } = response.data;
      setCurrentImage({ url: imageUrl, filename });
      setArtifacts(artifacts);
      setResponses({});
      setCurrentArtifactIndex(0);
      setSurveyCount(imagesAnalyzed);
    } catch (error) {
      console.error('Error fetching image:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token'); // Clear invalid token
        navigate('/login');
      } else {
        setError('Failed to load image. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = (value) => {
    const currentArtifact = artifacts[currentArtifactIndex];
    setResponses(prev => ({
      ...prev,
      [currentArtifact.id]: value
    }));
    
    if (currentArtifactIndex < artifacts.length - 1) {
      setCurrentArtifactIndex(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await api.post('/api/submit', {
        filename: currentImage.filename,
        responses
      });
      setSurveyCount(response.data.imagesAnalyzed);
      fetchNewImage();
    } catch (error) {
      console.error('Error submitting responses:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError('Failed to submit responses. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading && !currentImage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading survey...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    );
  }

  const currentArtifact = artifacts[currentArtifactIndex];
  const isLastQuestion = currentArtifactIndex === artifacts.length - 1;
  const hasAnsweredCurrent = responses[currentArtifact?.id] !== undefined;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Image Survey</h1>
            {userData && (
              <p className="text-gray-600">
                Welcome, {userData.name} ({userData.enrollmentNumber})
              </p>
            )}
            <p className="text-sm text-gray-500">Images analyzed: {surveyCount}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Main Content - Responsive Layout */}
        <div className="flex flex-col md:flex-row md:space-x-8 space-y-8 md:space-y-0 items-center justify-center">
          {/* Image Section - Full width on mobile, left side on desktop */}
          {currentImage && (
            <div className="md:w-1/2 w-full flex justify-center">
              <div className="aspect-w-16 aspect-h-9 bg-gray-200 rounded-lg overflow-hidden w-full max-w-2xl">
                <img
                  src={currentImage.url}
                  alt="Survey"
                  className="object-contain w-full h-full"
                />
              </div>
            </div>
          )}

          {/* Questions Section - Full width on mobile, right side on desktop */}
          <div className="md:w-1/2 w-full max-w-2xl">
            {/* Main Question Text */}
            <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              Is this artifact identified in the image shown?
            </h2>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Question {currentArtifactIndex + 1} of {artifacts.length}</span>
                <span>{Math.round((currentArtifactIndex / artifacts.length) * 100)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 rounded-full h-2 transition-all duration-300"
                  style={{ width: `${(currentArtifactIndex / artifacts.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Current Question */}
            {currentArtifact && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {currentArtifact.name}
                  </h3>
                  <p className="text-gray-600">
                    {currentArtifact.description}
                  </p>
                </div>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => handleResponse(true)}
                    className={`px-6 py-3 rounded-lg text-lg font-medium ${
                      responses[currentArtifact.id] === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleResponse(false)}
                    className={`px-6 py-3 rounded-lg text-lg font-medium ${
                      responses[currentArtifact.id] === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            {isLastQuestion && hasAnsweredCurrent && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-8 py-3 rounded-lg text-white text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit & Next Image'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Survey;

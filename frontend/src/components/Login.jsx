import React, { useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL || "http://localhost:5000",
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const Login = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 > Date.now()) {
          navigate('/survey');
        } else {
          localStorage.removeItem('token');
        }
      } catch (err) {
        localStorage.removeItem('token');
      }
    }
  }, [navigate]);

  const handleChanneliLogin = () => {
    window.location.href = 'http://localhost:5000/oauth/channeli';
  };

  const handleTest = async () => {
    try {
      const response = await api.get('/oauth/test');
      console.log('Backend test response:', response.data);
      alert('Backend is accessible! Check console for details.');
    } catch (error) {
      console.error('Backend test error:', error);
      alert('Error connecting to backend. Check console for details.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-xl w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
      <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            AI Image Analysis Survey
          </h1>
          <div className="space-y-4 text-gray-600">
            <p className="text-lg">
              Help us improve AI image generation by participating in our survey!
            </p>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">What to expect:</h3>
              <ul className="text-left text-blue-800 space-y-2">
                <li>• 10-15 minutes of your time</li>
                <li>• Simple yes/no questions about AI-generated images</li>
                <li>• Help improve image generation technology</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={handleChanneliLogin}
            className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transform hover:scale-105 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg"
          >
            <span className="mr-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
              </svg>
            </span>
            Sign in with Channeli
          </button>
          <p className="mt-4 text-center text-sm text-gray-500">
            Available exclusively for IITR students and faculty
          </p>
        </div>

        <div className="text-center text-xs text-gray-400">
          By participating, you're contributing to project in AI image generation at IIT Roorkee
        </div>
      </div>
    </div>
  );
};

export default Login;

// src/api/axiosInstance.js
import axios from 'axios';
import BASE_URL from '../config';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'multipart/form-data', // Set default headers if needed
  },
});

export default axiosInstance;

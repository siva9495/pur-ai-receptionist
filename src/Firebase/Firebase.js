import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyAhxKwAwXkMh680lhOcTw3YAHc6bkI6pVc",
    authDomain: "purviewaireceptionist.firebaseapp.com",
    projectId: "purviewaireceptionist",
    storageBucket: "purviewaireceptionist.firebasestorage.app",
    messagingSenderId: "688641724081",
    appId: "1:688641724081:web:a346e1a8ca71307cb49c90",
    measurementId: "G-4CV1K2RLE9"
};

// Initialize Firebase only once
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const analytics = getAnalytics(app);

export { app, db, analytics };
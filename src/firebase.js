// Import the tools we need from Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase project's unique configuration
// Replace each value below with YOUR values from the config you saved
const firebaseConfig = {
  apiKey: "AIzaSyCZaYEyCETKnCtGlVlujV5QCnv4z_vPCMM",
  authDomain: "krishisetu-d5278.firebaseapp.com",
  projectId: "krishisetu-d5278",
  storageBucket: "krishisetu-d5278.firebasestorage.app",
  messagingSenderId: "340746027277",
  appId: "1:340746027277:web:ffadd5ad2ed84af97c3044"
};

// Start Firebase
const app = initializeApp(firebaseConfig);

// Set up Authentication
export const auth = getAuth(app);

// Set up Database
export const db = getFirestore(app);
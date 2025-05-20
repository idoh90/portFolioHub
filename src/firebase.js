// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB9-...",
  authDomain: "portfoliohub-9ecai.firebaseapp.com",
  databaseURL: "https://portfoliohub-9cea1-default-rtdb.firebaseio.com",
  projectId: "portfoliohub-9ecai",
  storageBucket: "portfoliohub-9ecai.appspot.com",
  messagingSenderId: "662261165655",
  appId: "1:662261165655:web:ab9ae1be1e674b786fd08"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
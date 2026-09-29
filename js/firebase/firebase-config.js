import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCOsJDGbwdAw-rk2ADWzyFblyy59k8j4-k",
  authDomain: "kazakh-studio.firebaseapp.com",
  projectId: "kazakh-studio",
  storageBucket: "kazakh-studio.firebasestorage.app",
  messagingSenderId: "13745643297",
  appId: "1:13745643297:web:f2cef6a72292ec6f446860",
  measurementId: "G-CZ92C1FE2Z"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
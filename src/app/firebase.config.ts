import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCZrdBXsio0gKHqzfcTiIBvKxEMiRxtUvU",
  authDomain: "juego31-70d36.firebaseapp.com",
  projectId: "juego31-70d36",
  storageBucket: "juego31-70d36.firebasestorage.app",
  messagingSenderId: "317104701473",
  appId: "1:317104701473:web:6ab0aee8fe353663fc2360",
  databaseURL: "https://juego31-70d36-default-rtdb.firebaseio.com/"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
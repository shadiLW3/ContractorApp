import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBM7mQmadNcnk3CrPVMJoT2LgD7wEQo7FU",
  authDomain: "contractor-a5eb4.firebaseapp.com",
  projectId: "contractor-a5eb4",
  storageBucket: "contractor-a5eb4.firebasestorage.app",
  messagingSenderId: "673545675750",
  appId: "1:673545675750:web:05fab01b8b4c700da1ec27",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage for persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);
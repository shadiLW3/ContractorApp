import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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
export const storage = getStorage(app);

// Initialize Auth with AsyncStorage for persistence (keeping your existing setup)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Initialize Firestore with enhanced offline capabilities
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true, // Helps with connection issues
  useFetchStreams: false // Helps with CORS issues in development
});

// Optional: Enable network state logging for debugging
if (__DEV__) {
  console.log('Firebase initialized in development mode');
}
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Request permissions
export const requestMediaPermissions = async () => {
  const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
  const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
    Alert.alert(
      'Permissions Required',
      'Please enable camera and photo library access to share photos.'
    );
    return false;
  }
  return true;
};

// Pick image from library
export const pickImage = async () => {
  const hasPermission = await requestMediaPermissions();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled) {
    return result.assets[0];
  }
  return null;
};

// Take photo with camera
export const takePhoto = async () => {
  const hasPermission = await requestMediaPermissions();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled) {
    return result.assets[0];
  }
  return null;
};

// Upload file to Firebase Storage
export const uploadImage = async (uri, projectId) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const storageRef = ref(storage, `projects/${projectId}/images/${fileName}`);
    
    const snapshot = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
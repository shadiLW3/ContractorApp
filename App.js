import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

// Import all screens
import LoginScreen from './screens/auth/LoginScreen';
import RoleSelectionScreen from './screens/auth/RoleSelectionScreen';
import ProfileSetupScreen from './screens/auth/ProfileSetupScreen';
import GCDashboard from './screens/dashboards/GCDashboard';
import CreateProjectScreen from './screens/projects/CreateProjectScreen';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('');

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Check if user has a profile/role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        } else {
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#FF6B35',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {user === null ? (
          // Not logged in - show login screen
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : userProfile === null ? (
          // Logged in but needs to complete profile
          <>
            <Stack.Screen 
              name="RoleSelection"
              options={{ 
                title: 'Choose Your Role',
                headerLeft: null // Prevent going back
              }}
            >
              {(props) => (
                <RoleSelectionScreen 
                  {...props} 
                  setSelectedRole={setSelectedRole}
                  setSelectedSpecialization={setSelectedSpecialization}
                />
              )}
            </Stack.Screen>
            <Stack.Screen 
              name="ProfileSetup"
              options={{ 
                title: 'Complete Your Profile',
                headerLeft: null // Prevent going back
              }}
            >
              {(props) => (
                <ProfileSetupScreen 
                  {...props}
                  selectedRole={selectedRole}
                  selectedSpecialization={selectedSpecialization}
                />
              )}
            </Stack.Screen>
          </>
        ) : (
          // Logged in with complete profile - show role-based dashboards
          <>
            {userProfile?.role === 'GC' && (
              <>
                <Stack.Screen 
                  name="GCDashboard" 
                  component={GCDashboard}
                  options={{ 
                    title: 'GC Dashboard',
                    headerLeft: null // Prevent going back to auth
                  }}
                />
                <Stack.Screen 
                  name="CreateProject" 
                  component={CreateProjectScreen}
                  options={{ 
                    title: 'New Project',
                  }}
                />
                <Stack.Screen 
                  name="ProjectList" 
                  component={ProjectListPlaceholder}
                  options={{ 
                    title: 'My Projects',
                  }}
                />
              </>
            )}
            
            {userProfile?.role === 'Sub' && (
              <Stack.Screen 
                name="SubDashboard" 
                component={SubDashboardPlaceholder}
                options={{ 
                  title: 'Subcontractor Dashboard',
                  headerLeft: null
                }}
              />
            )}
            
            {userProfile?.role === 'Tech' && (
              <Stack.Screen 
                name="TechDashboard" 
                component={TechDashboardPlaceholder}
                options={{ 
                  title: 'Technician Dashboard',
                  headerLeft: null
                }}
              />
            )}
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

// Temporary placeholder components - replace with actual screens later
function ProjectListPlaceholder({ navigation }) {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderText}>Project List Screen</Text>
      <Text style={styles.placeholderSubtext}>Coming Soon</Text>
    </View>
  );
}

function SubDashboardPlaceholder({ navigation }) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderText}>Subcontractor Dashboard</Text>
      <Text style={styles.placeholderSubtext}>Coming Soon</Text>
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function TechDashboardPlaceholder({ navigation }) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderText}>Technician Dashboard</Text>
      <Text style={styles.placeholderSubtext}>Coming Soon</Text>
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  signOutButton: {
    marginTop: 20,
    padding: 10,
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 16,
  },
});
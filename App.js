import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { onSnapshot } from 'firebase/firestore';

// Import all screens
import LoginScreen from './screens/auth/LoginScreen';
import RoleSelectionScreen from './screens/auth/RoleSelectionScreen';
import ProfileSetupScreen from './screens/auth/ProfileSetupScreen';
import GCDashboard from './screens/dashboards/GCDashboard';
import CreateProjectScreen from './screens/projects/CreateProjectScreen';
import SubDashboard from './screens/dashboards/SubDashboard';
import TechDashboard from './screens/dashboards/TechDashboard';
import ProjectListScreen from './screens/projects/ProjectListScreen';
import ProjectDetailsScreen from './screens/projects/ProjectDetailsScreen';
import TeamManagementScreen from './screens/dashboards/TeamManagementScreen';
import NetworkScreen from './screens/dashboards/NetworkScreen';
import InvitationsScreen from './screens/InvitationsScreen';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('');

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        
        // This listens for CHANGES to the profile in real-time
        const profileUnsubscribe = onSnapshot(
          doc(db, 'users', user.uid),
          (doc) => {
            if (doc.exists()) {
              setUserProfile(doc.data());
            } else {
              setUserProfile(null);
            }
            setLoading(false);
          }
        );
        
        return () => profileUnsubscribe();
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
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
                headerLeft: null
              }}
            />
            <Stack.Screen 
              name="CreateProject" 
              component={CreateProjectScreen}
              options={{ title: 'New Project' }}
            />
            <Stack.Screen 
              name="ProjectList" 
              component={ProjectListScreen}
              options={{ title: 'My Projects' }}
            />
            <Stack.Screen 
              name="ProjectDetails" 
              component={ProjectDetailsScreen}
              options={{ title: 'Project' }}
            />
            <Stack.Screen 
              name="Network" 
              component={NetworkScreen}
              options={{ title: 'My Network' }}
            />
          </>
        )}
        
        {userProfile?.role === 'Sub' && (
          <>
            <Stack.Screen 
              name="SubDashboard" 
              component={SubDashboard}
              options={{ 
                title: 'Subcontractor Dashboard',
                headerLeft: null
              }}
            />
            <Stack.Screen
              name="ProjectList"
              component={ProjectListScreen}
              options={{ title: 'My Projects' }}
            />
            <Stack.Screen 
              name="ProjectDetails" 
              component={ProjectDetailsScreen}
              options={{ title: 'Project' }}
            />
            <Stack.Screen 
              name="TeamManagement" 
              component={TeamManagementScreen}
              options={{ title: 'Team Management' }}
            />
          </>
        )}
        
        {userProfile?.role === 'Tech' && (
          <>
            <Stack.Screen 
              name="TechDashboard" 
              component={TechDashboard}
              options={{ 
                title: 'Technician Dashboard', 
                headerLeft: null 
              }}
            />
            <Stack.Screen 
              name="ProjectList" 
              component={ProjectListScreen}
              options={{ title: 'My Projects' }}
            />
            <Stack.Screen 
              name="ProjectDetails" 
              component={ProjectDetailsScreen}
              options={{ title: 'Project' }}
            />
          </>
        )}
        
        {/* Universal screen for ALL roles */}
        <Stack.Screen 
          name="Invitations" 
          component={InvitationsScreen}
          options={{ title: 'Invitations' }}
        />
      </>
    )}
  </Stack.Navigator>
  <StatusBar style="auto" />
</NavigationContainer>
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
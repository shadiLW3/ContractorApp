import React, { useState, useEffect } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function GCDashboard({ navigation }) {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user profile
    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
      setLoading(false);
    };

    fetchUserProfile();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Navigation will be handled by auth state listener in App.js
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome back, {userProfile?.firstName}!
        </Text>
        <Text style={styles.roleText}>General Contractor</Text>
        {userProfile?.companyName && (
          <Text style={styles.companyText}>{userProfile.companyName}</Text>
        )}
      </View>

      <View style={styles.dashboardContainer}>
        <Text style={styles.sectionTitle}>Project Management</Text>
        
        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => navigation.navigate('CreateProject')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>🏗️</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Create New Project</Text>
              <Text style={styles.buttonSubtitle}>Start a new construction project</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => navigation.navigate('ProjectList')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>📋</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>View My Projects</Text>
              <Text style={styles.buttonSubtitle}>Manage active and completed projects</Text>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Team Management</Text>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>👥</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Invite Subcontractors</Text>
              <Text style={styles.buttonSubtitle}>Add subs to your network</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>📊</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Reports & Analytics</Text>
              <Text style={styles.buttonSubtitle}>View project metrics and timelines</Text>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Communication</Text>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>💬</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Messages</Text>
              <Text style={styles.buttonSubtitle}>Chat with your team</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>🔔</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Notifications</Text>
              <Text style={styles.buttonSubtitle}>View recent updates</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF6B35',
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  roleText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  companyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontStyle: 'italic',
  },
  dashboardContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  dashboardButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  buttonSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  signOutButton: {
    alignSelf: 'center',
    marginTop: 20,
    padding: 10,
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});
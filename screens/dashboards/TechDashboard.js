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
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import Toast from 'react-native-toast-message';

export default function TechDashboard({ navigation }) {
  const [userProfile, setUserProfile] = useState(null);
  const [invitationCount, setInvitationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
    
    // Real-time listener for invitation count
    const invitesQuery = query(
      collection(db, 'invitations'),
      where('recipientId', '==', auth.currentUser.uid),
      where('status', '==', 'pending')
    );
    
    const unsubscribe = onSnapshot(invitesQuery, (snapshot) => {
      setInvitationCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  const fetchUserData = async () => {
    try {
      // Get user profile
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to sign out',
        position: 'top',
        visibilityTime: 3000
      });
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
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.welcomeText}>
              Welcome back, {userProfile?.firstName}!
            </Text>
            <Text style={styles.roleText}>
              {userProfile?.specialization || 'Technician'}
            </Text>
          </View>
          
          {/* Invitation Badge */}
          <TouchableOpacity 
            style={styles.invitationBadgeButton}
            onPress={() => navigation.navigate('Invitations')}
          >
            <Text style={styles.invitationIcon}>📮</Text>
            {invitationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {invitationCount > 9 ? '9+' : invitationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dashboardContainer}>
        <Text style={styles.sectionTitle}>My Work</Text>
        
        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => navigation.navigate('Calendar')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>📅</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>My Schedule</Text>
              <Text style={styles.buttonSubtitle}>View assigned tasks and timeline</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => navigation.navigate('ProjectList')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>🏗️</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Active Projects</Text>
              <Text style={styles.buttonSubtitle}>Projects you're working on</Text>
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
            <Text style={styles.buttonIcon}>📢</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Announcements</Text>
              <Text style={styles.buttonSubtitle}>Important updates from supervisors</Text>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Tools</Text>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>📸</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Submit Photos</Text>
              <Text style={styles.buttonSubtitle}>Upload work progress photos</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>⏰</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Time Tracking</Text>
              <Text style={styles.buttonSubtitle}>Clock in/out and track hours</Text>
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
    backgroundColor: '#45B7D1',
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  roleText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  invitationBadgeButton: {
    position: 'relative',
    padding: 8,
  },
  invitationIcon: {
    fontSize: 28,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#45B7D1',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 4,
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
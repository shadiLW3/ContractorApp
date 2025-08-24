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
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function TechDashboard({ navigation }) {
  const [userProfile, setUserProfile] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // Get user profile
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }

      // Check for project invitations (we'll use this later)
      const invitesQuery = query(
        collection(db, 'invitations'),
        where('toUserId', '==', auth.currentUser.uid),
        where('status', '==', 'pending')
      );
      const invitesSnapshot = await getDocs(invitesQuery);
      const invites = [];
      invitesSnapshot.forEach((doc) => {
        invites.push({ id: doc.id, ...doc.data() });
      });
      setInvitations(invites);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
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
        <Text style={styles.roleText}>
          {userProfile?.specialization || 'Technician'}
        </Text>
      </View>

      {/* Invitations Section */}
      {invitations.length > 0 && (
        <View style={styles.invitationBanner}>
          <Text style={styles.invitationText}>
            You have {invitations.length} pending project invitation(s)
          </Text>
        </View>
      )}

      <View style={styles.dashboardContainer}>
        <Text style={styles.sectionTitle}>My Work</Text>
        
        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
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
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
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
  invitationBanner: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  invitationText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
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
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

export default function SubDashboard({ navigation }) {
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

      // Check for project invitations
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

  const handleInvitation = (invite, accept) => {
    Alert.alert(
      accept ? 'Accept Invitation' : 'Decline Invitation',
      `${accept ? 'Accept' : 'Decline'} invitation to ${invite.projectName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm',
          onPress: () => {
            // TODO: Update invitation status in database
            Alert.alert('Success', `Invitation ${accept ? 'accepted' : 'declined'}`);
            fetchUserData(); // Refresh
          }
        }
      ]
    );
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
        <Text style={styles.roleText}>Subcontractor</Text>
        {userProfile?.companyName && (
          <Text style={styles.companyText}>{userProfile.companyName}</Text>
        )}
      </View>

      {/* Invitations Section */}
      {invitations.length > 0 && (
        <View style={styles.invitationsSection}>
          <Text style={styles.sectionTitle}>Pending Invitations</Text>
          {invitations.map((invite) => (
            <View key={invite.id} style={styles.invitationCard}>
              <View style={styles.inviteInfo}>
                <Text style={styles.inviteProject}>{invite.projectName}</Text>
                <Text style={styles.inviteFrom}>
                  From: {invite.fromUserName} {invite.fromCompany && `(${invite.fromCompany})`}
                </Text>
              </View>
              <View style={styles.inviteActions}>
                <TouchableOpacity 
                  style={[styles.inviteButton, styles.acceptButton]}
                  onPress={() => handleInvitation(invite, true)}
                >
                  <Text style={styles.acceptText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.inviteButton, styles.declineButton]}
                  onPress={() => handleInvitation(invite, false)}
                >
                  <Text style={styles.declineText}>✗</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.dashboardContainer}>
        <Text style={styles.sectionTitle}>Project Management</Text>
        
        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>🏗️</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>My Projects</Text>
              <Text style={styles.buttonSubtitle}>View active and completed projects</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>📅</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Schedule View</Text>
              <Text style={styles.buttonSubtitle}>Manage project timelines</Text>
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
              <Text style={styles.buttonTitle}>Manage Team</Text>
              <Text style={styles.buttonSubtitle}>Add and manage technicians</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.dashboardButton}
          onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>✅</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Assign Tasks</Text>
              <Text style={styles.buttonSubtitle}>Delegate work to technicians</Text>
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
              <Text style={styles.buttonSubtitle}>Chat with GCs and team</Text>
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
              <Text style={styles.buttonTitle}>Reports</Text>
              <Text style={styles.buttonSubtitle}>View progress and metrics</Text>
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
    backgroundColor: '#4ECDC4',
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
  invitationsSection: {
    padding: 20,
    paddingBottom: 0,
  },
  invitationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  inviteInfo: {
    flex: 1,
  },
  inviteProject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  inviteFrom: {
    fontSize: 13,
    color: '#666',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  inviteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#F44336',
  },
  acceptText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  declineText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
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
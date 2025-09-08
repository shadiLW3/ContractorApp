import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  getDoc,      // ADD THIS
  addDoc       // ADD THIS
} from 'firebase/firestore';

export default function InvitationsScreen({ navigation }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadInvitations();
    
    // Set up real-time listener for invitations
    const q = query(
      collection(db, 'invitations'),
      where('recipientId', '==', auth.currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invites = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvitations(invites);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadInvitations = async () => {
    try {
      const q = query(
        collection(db, 'invitations'),
        where('recipientId', '==', auth.currentUser.uid),
        where('status', '==', 'pending')
      );
      
      const querySnapshot = await getDocs(q);
      const invites = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setInvitations(invites);
    } catch (error) {
      console.error('Error loading invitations:', error);
      Alert.alert('Error', 'Failed to load invitations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (invitation) => {
    Alert.alert(
      'Accept Invitation',
      `Join "${invitation.projectName}" as ${invitation.role}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              // Update invitation status
              await updateDoc(doc(db, 'invitations', invitation.id), {
                status: 'accepted',
                respondedAt: Timestamp.now()
              });

              // Get the project document
              const projectRef = doc(db, 'projects', invitation.projectId);
const projectDoc = await getDoc(projectRef);

if (projectDoc.exists()) {
  // Check existing structure and update accordingly
  const projectData = projectDoc.data();
  let updatedSubs = projectData.invitedSubs || [];
  
  // Remove any existing entry for this user (to avoid duplicates)
  updatedSubs = updatedSubs.filter(sub => {
    // Handle both string IDs and object structures
    if (typeof sub === 'string') {
      return sub !== auth.currentUser.uid;
    }
    return sub.id !== auth.currentUser.uid;
  });
  
  // Add the user with consistent structure
  updatedSubs.push({
    id: auth.currentUser.uid,
    name: invitation.recipientName,
    email: invitation.recipientEmail || auth.currentUser.email,
    companyName: invitation.recipientCompany || '',
    status: 'accepted',
    acceptedAt: Timestamp.now()
  });

  await updateDoc(projectRef, {
    invitedSubs: updatedSubs
  });
                
                // Add a system message to the project chat
                await addDoc(collection(db, 'projects', invitation.projectId, 'messages'), {
                  text: `${invitation.recipientName} has joined the project`,
                  userId: 'system',
                  userName: 'System',
                  timestamp: new Date().toISOString(),
                  type: 'system'
                });
              }

              Alert.alert('Success', 'You have joined the project!');
              loadInvitations();
            } catch (error) {
              console.error('Error accepting invitation:', error);
              Alert.alert('Error', 'Failed to accept invitation');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const handleDecline = async (invitation) => {
    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              // Update invitation status
              await updateDoc(doc(db, 'invitations', invitation.id), {
                status: 'declined',
                respondedAt: Timestamp.now()
              });
              
              // Get the project document
              const projectRef = doc(db, 'projects', invitation.projectId);
              const projectDoc = await getDoc(projectRef);
              
              if (projectDoc.exists()) {
                const projectData = projectDoc.data();
                
                // Update the invitedSubs array to change status from pending to declined
                const updatedSubs = projectData.invitedSubs.map(sub => {
                  if (sub.id === auth.currentUser.uid) {
                    return { ...sub, status: 'declined' };
                  }
                  return sub;
                });
                
                // Update the project with the new status
                await updateDoc(projectRef, {
                  invitedSubs: updatedSubs
                });
              }
              
              Alert.alert('Invitation Declined');
              loadInvitations();
            } catch (error) {
              console.error('Error declining invitation:', error);
              Alert.alert('Error', 'Failed to decline invitation');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const renderInvitation = ({ item }) => {
    const isProcessing = processingId === item.id;
    
    return (
      <View style={styles.invitationCard}>
        <View style={styles.invitationHeader}>
          <Text style={styles.projectName}>{item.projectName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{item.role}</Text>
          </View>
        </View>
        
        <Text style={styles.invitedBy}>
          Invited by: {item.inviterName}
        </Text>
        
        {item.message && (
          <Text style={styles.message}>{item.message}</Text>
        )}
        
        <Text style={styles.invitedDate}>
          {new Date(item.createdAt?.toDate()).toLocaleDateString()}
        </Text>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.acceptButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleAccept(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.acceptText}>Accept</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.declineButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleDecline(item)}
            disabled={isProcessing}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading invitations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {invitations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No Invitations</Text>
          <Text style={styles.emptyText}>
            You don't have any pending invitations at the moment
          </Text>
        </View>
      ) : (
        <FlatList
          data={invitations}
          renderItem={renderInvitation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadInvitations();
              }}
              colors={['#007AFF']}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  listContainer: {
    padding: 15,
  },
  invitationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  projectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  roleBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  invitedBy: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  invitedDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#444',
    marginVertical: 8,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptText: {
    color: 'white',
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  declineText: {
    color: '#666',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
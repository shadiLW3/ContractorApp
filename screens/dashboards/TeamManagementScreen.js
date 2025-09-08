import React, { useState, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { hasPermission } from '../../utils/permissions';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  getDoc,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';

export default function TeamManagementScreen({ navigation }) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Technician');
  const [userProfile, setUserProfile] = useState(null);
  
  // Search-related states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    checkAccess();
    loadTeamMembers();
  }, []);
  
  const checkAccess = async () => {
    try {
      // Fix: Query by document ID instead of uid field
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role !== 'Sub') {  // Now this will work correctly
          Alert.alert('Access Denied', 'Only subcontractors can manage teams');
          navigation.goBack();
          return; // Add return to stop execution
        }
        setUserProfile(userData);
      } else {
        Alert.alert('Error', 'User profile not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error checking access:', error);
      Alert.alert('Error', 'Failed to verify access');
      navigation.goBack();
    }
  };

  const loadTeamMembers = async () => {
    try {
      // Query for technicians managed by this Sub
      const q = query(
        collection(db, 'users'),
        where('managedBy', '==', auth.currentUser.uid),
        where('role', '==', 'Tech')
      );
      
      const querySnapshot = await getDocs(q);
      const members = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        members.push({ 
          id: doc.id, 
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email,
          role: data.role || 'Technician',
          email: data.email || '',
          phone: data.phone || '(555) 000-0000',
          status: data.status || 'active',
          ...data 
        });
      });
      
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team:', error);
      Alert.alert('Error', 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (searchText) => {
    setSearchQuery(searchText);
    
    if (searchText.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      // Get ALL users from the database - no limit
      const usersRef = collection(db, 'users');
      const q = query(usersRef);
      
      const querySnapshot = await getDocs(q);
      const results = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        const lowerQuery = searchText.toLowerCase();
        
        // Check if name or email matches the search
        if (
          fullName.toLowerCase().includes(lowerQuery) ||
          data.email.toLowerCase().includes(lowerQuery)
        ) {
          // Don't show users already in the team or the current user
          if (!teamMembers.some(member => member.email === data.email) && 
              data.uid !== auth.currentUser.uid) {
            results.push({
              id: doc.id,
              name: fullName || data.email,
              email: data.email,
              role: data.role || 'User',
              companyName: data.companyName || ''
            });
          }
        }
      });
      
      // Sort results by relevance (exact email match first, then alphabetical)
      results.sort((a, b) => {
        const aExact = a.email.toLowerCase() === lowerQuery;
        const bExact = b.email.toLowerCase() === lowerQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.email.localeCompare(b.email);
      });
      
      // Limit to top 10 results AFTER filtering and sorting
      const topResults = results.slice(0, 10);
      
      setSearchResults(topResults);
      setShowSearchDropdown(topResults.length > 0);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectUser = (user) => {
    setNewMemberName(user.name);
    setNewMemberEmail(user.email);
    setSearchQuery(user.email);
    setShowSearchDropdown(false);
    setSearchResults([]);
  };

  const handleAddMember = async () => {
    if (!newMemberName || !newMemberEmail) {
      Alert.alert('Missing Info', 'Please fill in all fields');
      return;
    }
  
    try {
      // Create invitation for tech
      await addDoc(collection(db, 'invitations'), {
        inviterId: auth.currentUser.uid,
        inviterName: userProfile?.firstName || '',
        inviterCompany: userProfile?.companyName || '',
        recipientEmail: newMemberEmail,
        recipientName: newMemberName,
        role: 'Tech', // Always 'Tech' for team members
        type: 'team_invite',
        status: 'pending',
        createdAt: new Date()
      });
  
      Toast.show({
        type: 'success',
        text1: 'Invitation Sent',
        text2: `Invited ${newMemberName} to join your team`,
        visibilityTime: 2000
      });
      
      setShowAddModal(false);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberRole('Technician');
      setSearchQuery('');
      setSearchResults([]);
      
      // Reload team members to show pending invitation
      loadTeamMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'Failed to send invitation');
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    Alert.alert(
      'Remove Team Member',
      `Remove ${memberName} from your team? They will remain in your professional network for future collaboration.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from Team',
          style: 'destructive',
          onPress: async () => {
            try {
              // Update to remove managedBy but maintain connection history
              await updateDoc(doc(db, 'users', memberId), {
                managedBy: null,
                previousManager: auth.currentUser.uid // Keep history
              });
              
              // Add to connections collection for future reference
              await addDoc(collection(db, 'connections'), {
                userId: auth.currentUser.uid,
                connectedUserId: memberId,
                connectedUserName: memberName,
                connectionType: 'previous_team_member',
                establishedAt: new Date(),
                removedAt: new Date(),
                status: 'inactive',
                notes: 'Removed from active team but remains in network'
              });
              
              // Remove from local state
              setTeamMembers(teamMembers.filter(m => m.id !== memberId));
              
              Toast.show({
                type: 'info',
                text1: 'Team Member Removed',
                text2: 'They remain in your professional network',
                visibilityTime: 3000
              });
            } catch (error) {
              console.error('Error removing team member:', error);
              Alert.alert('Error', 'Failed to remove team member');
            }
          }
        }
      ]
    );
  };

  const renderMember = ({ item }) => (
    <TouchableOpacity style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <View>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberRole}>{item.role}</Text>
        </View>
        <View style={[styles.statusBadge, item.status === 'active' ? styles.statusActive : styles.statusPending]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.memberDetails}>
        <Text style={styles.detailText}>📧 {item.email}</Text>
        <Text style={styles.detailText}>📱 {item.phone}</Text>
      </View>
      
      <View style={styles.memberActions}>
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => handleRemoveMember(item.id, item.name)}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading team...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Team</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add Member</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{teamMembers.length}</Text>
          <Text style={styles.statLabel}>Total Members</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{teamMembers.filter(m => m.status === 'active').length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{teamMembers.filter(m => m.role === 'Technician').length}</Text>
          <Text style={styles.statLabel}>Technicians</Text>
        </View>
      </View>

      {teamMembers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No Team Members Yet</Text>
          <Text style={styles.emptyText}>
            Add your first team member to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={teamMembers}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Member Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAddModal(false);
          setSearchQuery('');
          setSearchResults([]);
          setShowSearchDropdown(false);
        }}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Team Member</Text>
            
            <Text style={styles.inputLabel}>Search for User:</Text>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.modalInput}
                placeholder="Type name or email to search..."
                value={searchQuery}
                onChangeText={searchUsers}
                autoCapitalize="none"
              />
              
              {isSearching && (
                <View style={styles.searchingIndicator}>
                  <ActivityIndicator size="small" color="#007AFF" />
                </View>
              )}
            </View>

            {showSearchDropdown && (
              <ScrollView style={styles.searchDropdown} nestedScrollEnabled={true}>
                {searchResults.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.searchResult}
                    onPress={() => selectUser(user)}
                  >
                    <View>
                      <Text style={styles.searchResultName}>{user.name}</Text>
                      <Text style={styles.searchResultEmail}>{user.email}</Text>
                      {user.companyName ? (
                        <Text style={styles.searchResultCompany}>{user.companyName} • {user.role}</Text>
                      ) : (
                        <Text style={styles.searchResultCompany}>{user.role}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            <TextInput
              style={styles.modalInput}
              placeholder="Full Name"
              value={newMemberName}
              onChangeText={setNewMemberName}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Email Address"
              value={newMemberEmail}
              onChangeText={setNewMemberEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <View style={styles.roleSelector}>
              <Text style={styles.inputLabel}>Role:</Text>
              <View style={styles.roleOptions}>
                {['Lead Technician', 'Technician', 'Apprentice'].map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      newMemberRole === role && styles.roleOptionSelected
                    ]}
                    onPress={() => setNewMemberRole(role)}
                  >
                    <Text style={[
                      styles.roleOptionText,
                      newMemberRole === role && styles.roleOptionTextSelected
                    ]}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchDropdown(false);
                  setNewMemberName('');
                  setNewMemberEmail('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddMember}
              >
                <Text style={styles.confirmButtonText}>Add Member</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: 'white',
    marginTop: 1,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 15,
  },
  memberCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  memberRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  memberDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  memberActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  editButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
  },
  removeButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  searchContainer: {
    position: 'relative',
  },
  searchingIndicator: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  searchDropdown: {
    maxHeight: 150,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: -10,
    marginBottom: 16,
  },
  searchResult: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  searchResultCompany: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  roleSelector: {
    marginBottom: 20,
  },
  roleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  roleOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roleOptionText: {
    fontSize: 14,
    color: '#666',
  },
  roleOptionTextSelected: {
    color: 'white',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
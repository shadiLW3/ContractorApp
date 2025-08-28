import React, { useState, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auth, db } from '../../firebaseConfig';
import { collection, addDoc, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export default function CreateProjectScreen({ navigation }) {
  // Project details
  const [projectName, setProjectName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  // Invite subcontractors
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableSubs, setAvailableSubs] = useState([]);
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Current user info
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Get current user's profile
    const fetchUserProfile = async () => {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setCurrentUser(userDoc.data());
      }
    };
    fetchUserProfile();
  }, []);

  // Search for subcontractors
  const searchSubcontractors = async () => {
    if (searchQuery.length < 2) {
      Alert.alert('Search', 'Please enter at least 2 characters to search');
      return;
    }

    setLoading(true);
    try {
      // Search for users with role 'Sub' by company name or first name
      const subsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'Sub')
      );
      
      const querySnapshot = await getDocs(subsQuery);
      const subs = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter by search query (case insensitive)
        if (
          data.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          data.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          subs.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      setAvailableSubs(subs);
      
      if (subs.length === 0) {
        Alert.alert('No Results', 'No subcontractors found matching your search');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search subcontractors');
      console.error(error);
    }
    setLoading(false);
  };

  // Toggle subcontractor selection
  const toggleSubSelection = (sub) => {
    if (selectedSubs.find(s => s.id === sub.id)) {
      setSelectedSubs(selectedSubs.filter(s => s.id !== sub.id));
    } else {
      setSelectedSubs([...selectedSubs, sub]);
    }
  };

  // Create the project
  const handleCreateProject = async () => {
    // Validation
    if (!projectName || !address || !city || !state || !zipCode) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Create project document
      const projectData = {
        // Basic info
        name: projectName,
        address: address,
        city: city,
        state: state,
        zipCode: zipCode,
        fullAddress: `${address}, ${city}, ${state} ${zipCode}`,
        description: description,
        
        // Dates
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdAt: new Date().toISOString(),
        
        // Users
        createdBy: auth.currentUser.uid,
        gcInfo: {
          id: auth.currentUser.uid,
          name: currentUser?.firstName || '',
          company: currentUser?.companyName || '',
          email: currentUser?.email || ''
        },
        
        // Invited subcontractors
        invitedSubs: selectedSubs.map(sub => ({
          id: sub.id,
          name: sub.firstName,
          company: sub.companyName || '',
          email: sub.email,
          status: 'pending', // pending, accepted, declined
          invitedAt: new Date().toISOString()
        })),
        
        // Project status
        status: 'active', // active, completed, paused
        
        // Chat/Updates (will be subcollection)
        lastActivity: new Date().toISOString(),
        memberCount: selectedSubs.length + 1 // GC + invited subs
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      
      // Create initial message in project chat
      await addDoc(collection(db, 'projects', docRef.id, 'messages'), {
        text: `Project "${projectName}" created`,
        userId: auth.currentUser.uid,
        userName: currentUser?.firstName || 'User',
        timestamp: new Date().toISOString(),
        type: 'system' // system, text, image, etc.
      });

 // In CreateProjectScreen.js, find this section (around line 140-155):
// Look for the comment "// Send invitations"
// REPLACE the entire for loop with this:

// Send invitations (in production, you'd send push notifications or emails here)
// For now, we'll create invitation documents
for (const sub of selectedSubs) {
    await addDoc(collection(db, 'invitations'), {
      // Project info
      projectId: docRef.id,
      projectName: projectName,
      
      // FROM user (GC who is inviting)
      inviterId: auth.currentUser.uid,
      inviterName: currentUser?.firstName || '',
      inviterCompany: currentUser?.companyName || '',
      
      // TO user (Sub being invited) - THESE ARE THE KEY CHANGES
      recipientId: sub.id,  // CHANGED from toUserId to recipientId
      recipientName: sub.firstName,  // CHANGED from toUserName to recipientName
      recipientEmail: sub.email,
      
      // Role and status
      role: 'Subcontractor',  // ADDED THIS FIELD
      status: 'pending',
      createdAt: new Date(),  // Changed to Date object instead of string
      
      // Optional message
      message: `You're invited to join ${projectName} project`  // ADDED THIS
    });
  }

  Toast.show({
    type: 'success',
    text1: `Project ${projectName} Created! 🎉`,
    text2: `${selectedSubs.length} subcontractor(s) invited`,
    visibilityTime: 3000
  });
  navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create project. Please try again.');
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Create New Project</Text>
        
        {/* Project Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Details</Text>
          
          <Text style={styles.label}>Project Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Smith Residence Renovation"
            value={projectName}
            onChangeText={setProjectName}
          />
        </View>

        {/* Address Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          
          <Text style={styles.label}>Street Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Main Street"
            value={address}
            onChangeText={setAddress}
          />
          
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={styles.input}
                placeholder="Miami"
                value={city}
                onChangeText={setCity}
              />
            </View>
            
            <View style={styles.quarterInput}>
              <Text style={styles.label}>State *</Text>
              <TextInput
                style={styles.input}
                placeholder="FL"
                value={state}
                onChangeText={setState}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
            
            <View style={styles.quarterInput}>
              <Text style={styles.label}>ZIP *</Text>
              <TextInput
                style={styles.input}
                placeholder="33139"
                value={zipCode}
                onChangeText={setZipCode}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Project Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the scope of work..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Start Date</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.dateText}>
                  {startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.halfInput}>
              <Text style={styles.label}>End Date (Est.)</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={styles.dateText}>
                  {endDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Invite Subcontractors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team</Text>
          
          <TouchableOpacity 
            style={styles.inviteButton}
            onPress={() => setShowInviteModal(true)}
          >
            <Text style={styles.inviteButtonText}>
              + Invite Subcontractors
            </Text>
            {selectedSubs.length > 0 && (
              <Text style={styles.selectedCount}>
                {selectedSubs.length} selected
              </Text>
            )}
          </TouchableOpacity>
          
          {/* Show selected subs */}
          {selectedSubs.length > 0 && (
            <View style={styles.selectedSubsContainer}>
              {selectedSubs.map((sub) => (
                <View key={sub.id} style={styles.selectedSubChip}>
                  <Text style={styles.chipText}>
                    {sub.firstName} {sub.companyName && `(${sub.companyName})`}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => toggleSubSelection(sub)}
                    style={styles.removeChip}
                  >
                    <Text style={styles.removeChipText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Create Button */}
        <TouchableOpacity 
          style={[styles.createButton, loading && styles.buttonDisabled]}
          onPress={handleCreateProject}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create Project'}
          </Text>
        </TouchableOpacity>

        {/* Date Pickers */}
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            onChange={(event, selectedDate) => {
              setShowStartPicker(false);
              if (selectedDate) {
                setStartDate(selectedDate);
                // Auto-set end date to 30 days later if not already set
                if (endDate <= selectedDate) {
                  const newEndDate = new Date(selectedDate);
                  newEndDate.setDate(newEndDate.getDate() + 30);
                  setEndDate(newEndDate);
                }
              }
            }}
          />
        )}
        
        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            minimumDate={startDate}
            onChange={(event, selectedDate) => {
              setShowEndPicker(false);
              if (selectedDate) setEndDate(selectedDate);
            }}
          />
        )}
      </ScrollView>

      {/* Invite Subcontractors Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Subcontractors</Text>
              <TouchableOpacity 
                onPress={() => setShowInviteModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or company..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchSubcontractors}
              />
              <TouchableOpacity 
                style={styles.searchButton}
                onPress={searchSubcontractors}
              >
                <Text style={styles.searchButtonText}>Search</Text>
              </TouchableOpacity>
            </View>
            
            {/* Results */}
            <FlatList
              data={availableSubs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedSubs.find(s => s.id === item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.subItem,
                      isSelected && styles.subItemSelected
                    ]}
                    onPress={() => toggleSubSelection(item)}
                  >
                    <View style={styles.subInfo}>
                      <Text style={styles.subName}>{item.firstName}</Text>
                      {item.companyName && (
                        <Text style={styles.subCompany}>{item.companyName}</Text>
                      )}
                      <Text style={styles.subEmail}>{item.email}</Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No subcontractors found' : 'Search for subcontractors to invite'}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  quarterInput: {
    flex: 0.5,
  },
  dateButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  inviteButton: {
    backgroundColor: '#4ECDC4',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedCount: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    color: 'white',
    fontSize: 14,
  },
  selectedSubsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  selectedSubChip: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#4ECDC4',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  removeChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeChipText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  subItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  subItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  subInfo: {
    flex: 1,
  },
  subName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  subCompany: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  subEmail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  checkmark: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 14,
  },
});
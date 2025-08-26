import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';

export default function NetworkScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [myNetwork, setMyNetwork] = useState([]);
  const [availableSubs, setAvailableSubs] = useState([]);
  const [recentCollaborators, setRecentCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSubDetailsModal, setShowSubDetailsModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('myNetwork'); // 'myNetwork', 'discover', 'recent'

  useEffect(() => {
    fetchUserDataAndNetwork();
  }, []);

  const fetchUserDataAndNetwork = async () => {
    try {
      // Get current user data
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setCurrentUser(userData);
        
        // Only allow GCs to access this screen
        if (userData.role !== 'GC') {
          Alert.alert('Access Denied', 'Only General Contractors can manage networks');
          navigation.goBack();
          return;
        }
        
        // Fetch network data
        await fetchMyNetwork(userData.managedSubs || []);
        await fetchRecentCollaborators();
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load network data');
    }
    setLoading(false);
  };

  const fetchMyNetwork = async (subIds) => {
    if (subIds.length === 0) {
      setMyNetwork([]);
      return;
    }

    try {
      const subs = [];
      for (const subId of subIds) {
        const subDoc = await getDoc(doc(db, 'users', subId));
        if (subDoc.exists()) {
          const subData = subDoc.data();
          
          // Get statistics for this sub
          const stats = await getSubStatistics(subId);
          
          subs.push({
            id: subDoc.id,
            ...subData,
            ...stats
          });
        }
      }
      setMyNetwork(subs);
    } catch (error) {
      console.error('Error fetching network:', error);
    }
  };

  const getSubStatistics = async (subId) => {
    try {
      // Count active projects
      const projectsQuery = query(
        collection(db, 'projects'),
        where('createdBy', '==', auth.currentUser.uid)
      );
      
      const projectsSnapshot = await getDocs(projectsQuery);
      let activeProjects = 0;
      let completedProjects = 0;
      
      projectsSnapshot.forEach((doc) => {
        const project = doc.data();
        const subInProject = project.teams?.some(
          team => team.subId === subId && team.status === 'accepted'
        );
        
        if (subInProject) {
          if (project.status === 'completed') {
            completedProjects++;
          } else {
            activeProjects++;
          }
        }
      });
      
      // Count team size
      const subDoc = await getDoc(doc(db, 'users', subId));
      const teamSize = subDoc.data()?.managedTechs?.length || 0;
      
      return {
        activeProjects,
        completedProjects,
        teamSize
      };
    } catch (error) {
      console.error('Error getting sub statistics:', error);
      return {
        activeProjects: 0,
        completedProjects: 0,
        teamSize: 0
      };
    }
  };

  const fetchRecentCollaborators = async () => {
    try {
      // Get relationships where GC worked with Subs
      const relationshipsQuery = query(
        collection(db, 'relationships'),
        where('primaryUserId', '==', auth.currentUser.uid),
        where('type', '==', 'gc-sub'),
        orderBy('lastCollaboration', 'desc')
      );
      
      const snapshot = await getDocs(relationshipsQuery);
      const collaborators = [];
      
      for (const doc of snapshot.docs) {
        const relationship = doc.data();
        const subDoc = await getDoc(doc(db, 'users', relationship.secondaryUserId));
        
        if (subDoc.exists()) {
          collaborators.push({
            id: subDoc.id,
            ...subDoc.data(),
            lastCollaboration: relationship.lastCollaboration,
            projectsCount: relationship.projectsWorkedTogether?.length || 0
          });
        }
      }
      
      setRecentCollaborators(collaborators.slice(0, 10)); // Top 10 recent
    } catch (error) {
      console.error('Error fetching recent collaborators:', error);
    }
  };

  const searchSubcontractors = async () => {
    if (searchQuery.length < 2) {
      Alert.alert('Search', 'Please enter at least 2 characters');
      return;
    }

    setLoading(true);
    try {
      const subsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'Sub')
      );
      
      const querySnapshot = await getDocs(subsQuery);
      const subs = [];
      const managedSubIds = currentUser?.managedSubs || [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter by search and exclude already managed subs
        if (!managedSubIds.includes(doc.id) &&
            (data.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             data.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             data.companyName?.toLowerCase().includes(searchQuery.toLowerCase()))) {
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
      console.error('Error searching subs:', error);
      Alert.alert('Error', 'Failed to search subcontractors');
    }
    setLoading(false);
  };

  const addToNetwork = async (sub) => {
    try {
      // Update GC's managedSubs
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        managedSubs: arrayUnion(sub.id)
      });

      // Update Sub's associatedGCs
      await updateDoc(doc(db, 'users', sub.id), {
        associatedGCs: arrayUnion(auth.currentUser.uid)
      });

      // Create relationship record
      await addDoc(collection(db, 'relationships'), {
        type: 'gc-sub',
        primaryUserId: auth.currentUser.uid,
        secondaryUserId: sub.id,
        status: 'active',
        establishedAt: serverTimestamp(),
        projectsWorkedTogether: []
      });

      Alert.alert(
        'Success!',
        `${sub.firstName} ${sub.lastName} has been added to your network.`
      );
      
      setShowAddModal(false);
      fetchUserDataAndNetwork(); // Refresh
    } catch (error) {
      console.error('Error adding to network:', error);
      Alert.alert('Error', 'Failed to add subcontractor to network');
    }
  };

  const inviteToProject = (sub) => {
    // Navigate to project selection screen
    navigation.navigate('SelectProject', {
      subId: sub.id,
      subName: `${sub.firstName} ${sub.lastName}`,
      subCompany: sub.companyName
    });
  };

  const renderSubItem = ({ item }) => {
    const isInNetwork = myNetwork.some(s => s.id === item.id);
    
    return (
      <TouchableOpacity
        style={styles.subCard}
        onPress={() => {
          setSelectedSub(item);
          setShowSubDetailsModal(true);
        }}
      >
        <View style={styles.subHeader}>
          <View style={styles.subAvatar}>
            <Text style={styles.avatarText}>
              {item.firstName?.[0]}{item.lastName?.[0]}
            </Text>
          </View>
          <View style={styles.subInfo}>
            <Text style={styles.subName}>
              {item.firstName} {item.lastName}
            </Text>
            <Text style={styles.subCompany}>{item.companyName || 'Independent'}</Text>
            <Text style={styles.subEmail}>{item.email}</Text>
          </View>
        </View>
        
        {/* Statistics for network members */}
        {isInNetwork && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.activeProjects || 0}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.completedProjects || 0}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.teamSize || 0}</Text>
              <Text style={styles.statLabel}>Team Size</Text>
            </View>
          </View>
        )}
        
        {/* Recent collaborator info */}
        {item.lastCollaboration && (
          <View style={styles.recentInfo}>
            <Text style={styles.recentText}>
              Last worked: {new Date(item.lastCollaboration?.toDate ? 
                item.lastCollaboration.toDate() : 
                item.lastCollaboration).toLocaleDateString()}
            </Text>
            <Text style={styles.recentText}>
              {item.projectsCount} project(s) together
            </Text>
          </View>
        )}
        
        {/* Actions */}
        <View style={styles.subActions}>
          {isInNetwork ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => inviteToProject(item)}
            >
              <Text style={styles.actionButtonText}>Invite to Project</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.addButton]}
              onPress={() => addToNetwork(item)}
            >
              <Text style={styles.addButtonText}>Add to Network</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading network...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Network</Text>
        <Text style={styles.headerSubtitle}>
          Manage your subcontractor network
        </Text>
        <View style={styles.headerStats}>
          <View style={styles.headerStatItem}>
            <Text style={styles.headerStatValue}>{myNetwork.length}</Text>
            <Text style={styles.headerStatLabel}>Subs in Network</Text>
          </View>
          <View style={styles.headerStatItem}>
            <Text style={styles.headerStatValue}>
              {myNetwork.reduce((sum, sub) => sum + (sub.activeProjects || 0), 0)}
            </Text>
            <Text style={styles.headerStatLabel}>Active Projects</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myNetwork' && styles.activeTab]}
          onPress={() => setActiveTab('myNetwork')}
        >
          <Text style={[styles.tabText, activeTab === 'myNetwork' && styles.activeTabText]}>
            My Network
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recent' && styles.activeTab]}
          onPress={() => setActiveTab('recent')}
        >
          <Text style={[styles.tabText, activeTab === 'recent' && styles.activeTabText]}>
            Recent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.activeTab]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content based on active tab */}
      {activeTab === 'myNetwork' && (
        <FlatList
          data={myNetwork}
          renderItem={renderSubItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No subcontractors in your network yet</Text>
              <TouchableOpacity
                style={styles.discoverButton}
                onPress={() => setActiveTab('discover')}
              >
                <Text style={styles.discoverButtonText}>Discover Subcontractors</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {activeTab === 'recent' && (
        <FlatList
          data={recentCollaborators}
          renderItem={renderSubItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recent collaborations</Text>
            </View>
          }
        />
      )}

      {activeTab === 'discover' && (
        <View style={styles.searchSection}>
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
          
          <FlatList
            data={availableSubs}
            renderItem={renderSubItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              searchQuery.length > 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Search for subcontractors to add to your network
                  </Text>
                </View>
              )
            }
          />
        </View>
      )}

      {/* Sub Details Modal */}
      <Modal
        visible={showSubDetailsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSubDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedSub && (
              <>
                <Text style={styles.modalTitle}>Subcontractor Details</Text>
                <ScrollView style={styles.detailsScroll}>
                  <View style={styles.detailsContainer}>
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Name:</Text>
                      <Text style={styles.detailValue}>
                        {selectedSub.firstName} {selectedSub.lastName}
                      </Text>
                    </View>
                    
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Company:</Text>
                      <Text style={styles.detailValue}>
                        {selectedSub.companyName || 'Independent Contractor'}
                      </Text>
                    </View>
                    
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Email:</Text>
                      <Text style={styles.detailValue}>{selectedSub.email}</Text>
                    </View>
                    
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Phone:</Text>
                      <Text style={styles.detailValue}>
                        {selectedSub.phone || 'Not provided'}
                      </Text>
                    </View>
                    
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Team Size:</Text>
                      <Text style={styles.detailValue}>
                        {selectedSub.teamSize || 0} technicians
                      </Text>
                    </View>
                    
                    {selectedSub.activeProjects !== undefined && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Projects:</Text>
                        <Text style={styles.detailValue}>
                          {selectedSub.activeProjects} active, {selectedSub.completedProjects} completed
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowSubDetailsModal(false)}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                  {myNetwork.some(s => s.id === selectedSub.id) && (
                    <TouchableOpacity
                      style={styles.inviteProjectButton}
                      onPress={() => {
                        setShowSubDetailsModal(false);
                        inviteToProject(selectedSub);
                      }}
                    >
                      <Text style={styles.inviteProjectButtonText}>
                        Invite to Project
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
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
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#FF6B35',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  headerStats: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 30,
  },
  headerStatItem: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#FF6B35',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  searchSection: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: 'white',
  },
  searchButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  listContent: {
    padding: 15,
  },
  subCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  subAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subInfo: {
    flex: 1,
  },
  subName: {
    fontSize: 18,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  recentInfo: {
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  recentText: {
    fontSize: 12,
    color: '#666',
  },
  subActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#4CAF50',
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  discoverButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  discoverButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
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
  detailsScroll: {
    maxHeight: 300,
  },
  detailsContainer: {
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteProjectButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteProjectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
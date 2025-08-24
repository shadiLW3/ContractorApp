import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';

export default function ProjectListScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getUserRoleAndFetchProjects();
  }, []);

  const getUserRoleAndFetchProjects = async () => {
    try {
      // First get user's role
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserRole(userData.role);
        await fetchProjects(userData.role);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to load projects');
    }
    setLoading(false);
  };

  const fetchProjects = async (role) => {
    try {
      let projectsQuery;
      const projectList = [];

      if (role === 'GC') {
        // GC sees projects they created
        projectsQuery = query(
          collection(db, 'projects'),
          where('createdBy', '==', auth.currentUser.uid)
        );
      } else if (role === 'Sub') {
        // Sub sees projects they're invited to
        // First get all projects where they're in the invitedSubs array
        const allProjectsQuery = query(collection(db, 'projects'));
        const querySnapshot = await getDocs(allProjectsQuery);
        
        querySnapshot.forEach((doc) => {
          const projectData = doc.data();
          // Check if this sub is in the invitedSubs array
          const isInvited = projectData.invitedSubs?.some(
            sub => sub.id === auth.currentUser.uid
          );
          if (isInvited) {
            projectList.push({
              id: doc.id,
              ...projectData,
              myStatus: projectData.invitedSubs.find(
                sub => sub.id === auth.currentUser.uid
              )?.status || 'pending'
            });
          }
        });
        
        setProjects(projectList);
        return; // Exit early for subs
      } else if (role === 'Tech') {
        // Tech sees projects they're assigned to
        // For now, techs would be added to projects by their subcontractor
        // This is a placeholder - you'll need to implement assignment logic
        projectsQuery = query(
          collection(db, 'projects'),
          where('assignedTechs', 'array-contains', auth.currentUser.uid)
        );
      }

      // Execute query for GC and Tech
      if (projectsQuery) {
        const querySnapshot = await getDocs(projectsQuery);
        querySnapshot.forEach((doc) => {
          projectList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setProjects(projectList);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      // If index error, try without orderBy
      if (error.code === 'failed-precondition') {
        Alert.alert('Note', 'Setting up database indexes. Some features may be limited.');
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProjects(userRole);
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'completed': return '#9E9E9E';
      case 'paused': return '#FF9800';
      case 'pending': return '#FFC107';
      case 'accepted': return '#4CAF50';
      case 'declined': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const renderProjectCard = ({ item }) => (
    <TouchableOpacity
      style={styles.projectCard}
      onPress={() => navigation.navigate('ProjectDetails', { projectId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.projectName}>{item.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.myStatus || item.status) }]}>
          <Text style={styles.statusText}>
            {item.myStatus || item.status || 'Active'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.projectAddress}>{item.fullAddress}</Text>
      
      <View style={styles.cardFooter}>
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>Start:</Text>
          <Text style={styles.dateText}>{formatDate(item.startDate)}</Text>
        </View>
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>End:</Text>
          <Text style={styles.dateText}>{formatDate(item.endDate)}</Text>
        </View>
      </View>

      {userRole === 'GC' && (
        <View style={styles.teamInfo}>
          <Text style={styles.teamText}>
            👥 {item.invitedSubs?.length || 0} Subcontractors
          </Text>
        </View>
      )}

      {userRole === 'Sub' && item.myStatus === 'pending' && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>⏳ Invitation Pending</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No Projects Yet</Text>
      <Text style={styles.emptySubtitle}>
        {userRole === 'GC' 
          ? "Create your first project to get started"
          : userRole === 'Sub'
          ? "You'll see projects here when you're invited"
          : "Your assigned projects will appear here"}
      </Text>
      {userRole === 'GC' && (
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateProject')}
        >
          <Text style={styles.createButtonText}>Create New Project</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading projects...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {userRole === 'GC' ? 'My Projects' : 
           userRole === 'Sub' ? 'Project Invitations' : 
           'Assigned Projects'}
        </Text>
        <Text style={styles.projectCount}>
          {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
        </Text>
      </View>

      <FlatList
        data={projects}
        renderItem={renderProjectCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B35']}
          />
        }
        ListEmptyComponent={EmptyComponent}
      />

      {userRole === 'GC' && projects.length > 0 && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('CreateProject')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
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
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  projectCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContainer: {
    padding: 15,
    flexGrow: 1,
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  projectAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginRight: 4,
  },
  dateText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  teamInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  teamText: {
    fontSize: 14,
    color: '#666',
  },
  pendingBanner: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFC107',
  },
  pendingText: {
    color: '#F57C00',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 40,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: 'white',
    fontWeight: '300',
  },
});
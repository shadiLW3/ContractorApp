import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_CATEGORIES,
  getStatusColor,
  getPriorityColor,
  formatTaskDueDate,
  isTaskOverdue
} from '../../utils/taskHelpers';

export default function TaskListScreen({ route, navigation }) {
  const { projectId, projectName } = route.params;
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // New task states
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState(TASK_CATEGORIES.GENERAL);
  const [newTaskPriority, setNewTaskPriority] = useState(TASK_PRIORITY.MEDIUM);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    fetchUserRole();
    fetchTasks();
    fetchTeamMembers();
  }, [projectId]);

  const fetchUserRole = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserRole(userDoc.data().role);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const fetchTasks = () => {
    const tasksQuery = query(
      collection(db, 'projects', projectId, 'tasks'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const taskList = [];
      snapshot.forEach((doc) => {
        taskList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setTasks(taskList);
      setLoading(false);
    });

    return unsubscribe;
  };

  const fetchTeamMembers = async () => {
    try {
      const projectDoc = await getDoc(doc(db, 'projects', projectId));
      if (projectDoc.exists()) {
        const projectData = projectDoc.data();
        const members = [];
        
        // Add GC
        const gcDoc = await getDoc(doc(db, 'users', projectData.createdBy));
        if (gcDoc.exists()) {
          members.push({
            id: projectData.createdBy,
            name: gcDoc.data().firstName,
            role: 'GC'
          });
        }
        
        // Add accepted subs
        for (const sub of projectData.invitedSubs || []) {
          if (sub.status === 'accepted') {
            members.push({
              id: sub.id,
              name: sub.name,
              role: 'Sub'
            });
          }
        }
        
        setTeamMembers(members);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    try {
      const taskData = {
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        category: newTaskCategory,
        priority: newTaskPriority,
        status: TASK_STATUS.NOT_STARTED,
        projectId: projectId,
        createdBy: auth.currentUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      if (newTaskDueDate) {
        taskData.dueDate = Timestamp.fromDate(new Date(newTaskDueDate));
      }

      if (selectedAssignee) {
        taskData.assignedTo = selectedAssignee.id;
        taskData.assignedToName = selectedAssignee.name;
      }

      await addDoc(collection(db, 'projects', projectId, 'tasks'), taskData);
      
      // Reset form
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskCategory(TASK_CATEGORIES.GENERAL);
      setNewTaskPriority(TASK_PRIORITY.MEDIUM);
      setNewTaskDueDate('');
      setSelectedAssignee(null);
      setShowCreateModal(false);
      
      Alert.alert('Success', 'Task created successfully');
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task');
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update task status');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterAssignee !== 'all' && task.assignedTo !== filterAssignee) return false;
    return true;
  });

  const renderTask = ({ item }) => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => navigation.navigate('TaskDetails', { 
        projectId, 
        taskId: item.id,
        taskData: item 
      })}
    >
      <View style={styles.taskHeader}>
        <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(item.priority) }]} />
        <View style={styles.taskContent}>
          <Text style={styles.taskTitle}>{item.title}</Text>
          <View style={styles.taskMeta}>
            <View style={[styles.categoryBadge, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            {item.assignedToName && (
              <Text style={styles.assigneeText}>👤 {item.assignedToName}</Text>
            )}
          </View>
          {item.dueDate && (
            <Text style={[
              styles.dueDateText,
              isTaskOverdue(item) && styles.overdueText
            ]}>
              📅 {formatTaskDueDate(item.dueDate)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.statusButton, { backgroundColor: getStatusColor(item.status) }]}
          onPress={() => {
            // Show status options
            Alert.alert(
              'Update Status',
              'Select new status:',
              Object.values(TASK_STATUS).map(status => ({
                text: status.replace('_', ' ').toUpperCase(),
                onPress: () => updateTaskStatus(item.id, status)
              }))
            );
          }}
        >
          <Text style={styles.statusButtonText}>
            {item.status.replace('_', ' ')}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with filters */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
        <Text style={styles.projectName}>{projectName}</Text>
      </View>

      {/* Filter bar */}
      <ScrollView 
        horizontal 
        style={styles.filterBar}
        showsHorizontalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
          onPress={() => setFilterStatus('all')}
        >
          <Text style={[styles.filterText, filterStatus === 'all' && styles.filterTextActive]}>
            All Tasks
          </Text>
        </TouchableOpacity>
        {Object.values(TASK_STATUS).map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.filterChip, filterStatus === status && styles.filterChipActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterText, filterStatus === status && styles.filterTextActive]}>
              {status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Task list */}
      <FlatList
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTasks();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks yet</Text>
            <Text style={styles.emptySubtext}>Create your first task to get started</Text>
          </View>
        )}
      />

      {/* FAB for creating tasks (GC and Sub only) */}
      {(userRole === 'GC' || userRole === 'Sub') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Create Task Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Task</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                placeholder="Task Title"
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                value={newTaskDescription}
                onChangeText={setNewTaskDescription}
                multiline
                numberOfLines={3}
              />

              {/* Category Selector */}
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {Object.values(TASK_CATEGORIES).map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.optionChip,
                      newTaskCategory === category && styles.optionChipActive
                    ]}
                    onPress={() => setNewTaskCategory(category)}
                  >
                    <Text style={[
                      styles.optionText,
                      newTaskCategory === category && styles.optionTextActive
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Priority Selector */}
              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityContainer}>
                {Object.values(TASK_PRIORITY).map(priority => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityOption,
                      { borderColor: getPriorityColor(priority) },
                      newTaskPriority === priority && { backgroundColor: getPriorityColor(priority) }
                    ]}
                    onPress={() => setNewTaskPriority(priority)}
                  >
                    <Text style={[
                      styles.priorityText,
                      newTaskPriority === priority && { color: 'white' }
                    ]}>
                      {priority}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Assignee Selector */}
              <Text style={styles.label}>Assign To</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[
                    styles.optionChip,
                    !selectedAssignee && styles.optionChipActive
                  ]}
                  onPress={() => setSelectedAssignee(null)}
                >
                  <Text style={[
                    styles.optionText,
                    !selectedAssignee && styles.optionTextActive
                  ]}>
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {teamMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.optionChip,
                      selectedAssignee?.id === member.id && styles.optionChipActive
                    ]}
                    onPress={() => setSelectedAssignee(member)}
                  >
                    <Text style={[
                      styles.optionText,
                      selectedAssignee?.id === member.id && styles.optionTextActive
                    ]}>
                      {member.name} ({member.role})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Due Date */}
              <Text style={styles.label}>Due Date (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={newTaskDueDate}
                onChangeText={setNewTaskDueDate}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={createTask}
              >
                <Text style={styles.createButtonText}>Create Task</Text>
              </TouchableOpacity>
            </View>
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
  projectName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  filterBar: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    maxHeight: 50,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: '#FF6B35',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  listContainer: {
    padding: 15,
  },
  taskCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  priorityIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
    minHeight: 60,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  categoryText: {
    fontSize: 12,
    color: '#1976D2',
  },
  assigneeText: {
    fontSize: 12,
    color: '#666',
  },
  dueDateText: {
    fontSize: 12,
    color: '#666',
  },
  overdueText: {
    color: '#F44336',
    fontWeight: '600',
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginLeft: 10,
  },
  statusButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: 'white',
    fontWeight: '300',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  optionChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    marginBottom: 10,
  },
  optionChipActive: {
    backgroundColor: '#FF6B35',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#FF6B35',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
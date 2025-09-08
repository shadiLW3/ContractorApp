import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  getDoc
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

export default function TaskDetailsScreen({ route, navigation }) {
  const { projectId, taskId, taskData: initialTaskData } = route.params;
  const [task, setTask] = useState(initialTaskData);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  
  // Edit states
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editCategory, setEditCategory] = useState(task.category);
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(
    task.dueDate ? new Date(task.dueDate.toDate()).toISOString().split('T')[0] : ''
  );

  useEffect(() => {
    fetchUserProfile();
    subscribeToTask();
    subscribeToComments();
  }, [taskId]);

  const fetchUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const subscribeToTask = () => {
    const unsubscribe = onSnapshot(
      doc(db, 'projects', projectId, 'tasks', taskId),
      (doc) => {
        if (doc.exists()) {
          setTask({ id: doc.id, ...doc.data() });
        }
      }
    );
    return unsubscribe;
  };

  const subscribeToComments = () => {
    const commentsQuery = query(
      collection(db, 'projects', projectId, 'tasks', taskId, 'comments'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentList = [];
      snapshot.forEach((doc) => {
        commentList.push({ id: doc.id, ...doc.data() });
      });
      setComments(commentList);
    });

    return unsubscribe;
  };

  const updateTask = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Error', 'Task title is required');
      return;
    }

    setLoading(true);
    try {
      const updates = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        priority: editPriority,
        updatedAt: Timestamp.now()
      };

      if (editDueDate) {
        updates.dueDate = Timestamp.fromDate(new Date(editDueDate));
      } else {
        updates.dueDate = null;
      }

      await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), updates);
      
      setIsEditing(false);
      Alert.alert('Success', 'Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
    setLoading(false);
  };

  const updateStatus = async (newStatus) => {
    try {
      await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      
      // Add a comment about status change
      await addComment(`Status changed to ${newStatus.replace('_', ' ')}`, 'status_change');
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const addComment = async (text = newComment, type = 'comment') => {
    if (!text.trim() && type === 'comment') {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      await addDoc(
        collection(db, 'projects', projectId, 'tasks', taskId, 'comments'),
        {
          text: text.trim(),
          type: type,
          userId: auth.currentUser.uid,
          userName: userProfile?.firstName || 'User',
          userRole: userProfile?.role || 'Unknown',
          createdAt: Timestamp.now()
        }
      );
      
      if (type === 'comment') {
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const deleteTask = async () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId));
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete task');
            }
          }
        }
      ]
    );
  };

  const canEdit = userProfile?.role === 'GC' || 
                  (userProfile?.role === 'Sub' && task.createdBy === auth.currentUser.uid);

  const canDelete = userProfile?.role === 'GC' || 
                    task.createdBy === auth.currentUser.uid;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        {/* Task Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              {isEditing ? (
                <TextInput
                  style={styles.titleInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Task title"
                />
              ) : (
                <Text style={styles.title}>{task.title}</Text>
              )}
              
              <View style={styles.metaRow}>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
                  <Text style={styles.priorityText}>{task.priority}</Text>
                </View>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{task.category}</Text>
                </View>
              </View>
            </View>
            
            {canEdit && !isEditing && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.editButtonText}>✏️</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Status Bar */}
          <View style={styles.statusBar}>
            <Text style={styles.statusLabel}>Status:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Object.values(TASK_STATUS).map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusChip,
                    task.status === status && { backgroundColor: getStatusColor(status) }
                  ]}
                  onPress={() => updateStatus(status)}
                  disabled={!canEdit}
                >
                  <Text style={[
                    styles.statusChipText,
                    task.status === status && { color: 'white' }
                  ]}>
                    {status.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Task Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          {isEditing ? (
            <>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Add description..."
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {Object.values(TASK_CATEGORIES).map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.optionChip,
                      editCategory === category && styles.optionChipActive
                    ]}
                    onPress={() => setEditCategory(category)}
                  >
                    <Text style={[
                      styles.optionText,
                      editCategory === category && styles.optionTextActive
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityContainer}>
                {Object.values(TASK_PRIORITY).map(priority => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityOption,
                      { borderColor: getPriorityColor(priority) },
                      editPriority === priority && { backgroundColor: getPriorityColor(priority) }
                    ]}
                    onPress={() => setEditPriority(priority)}
                  >
                    <Text style={[
                      styles.priorityOptionText,
                      editPriority === priority && { color: 'white' }
                    ]}>
                      {priority}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Due Date</Text>
              <TextInput
                style={styles.input}
                value={editDueDate}
                onChangeText={setEditDueDate}
                placeholder="YYYY-MM-DD"
              />

              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setIsEditing(false);
                    setEditTitle(task.title);
                    setEditDescription(task.description || '');
                    setEditCategory(task.category);
                    setEditPriority(task.priority);
                    setEditDueDate(task.dueDate ? new Date(task.dueDate.toDate()).toISOString().split('T')[0] : '');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={updateTask}
                  disabled={loading}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {task.description ? (
                <Text style={styles.description}>{task.description}</Text>
              ) : (
                <Text style={styles.noDescription}>No description provided</Text>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Assigned to:</Text>
                <Text style={styles.detailValue}>
                  {task.assignedToName || 'Unassigned'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Due Date:</Text>
                <Text style={[
                  styles.detailValue,
                  isTaskOverdue(task) && styles.overdueText
                ]}>
                  {formatTaskDueDate(task.dueDate)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created by:</Text>
                <Text style={styles.detailValue}>
                  {task.createdBy === auth.currentUser.uid ? 'You' : 'Team member'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created:</Text>
                <Text style={styles.detailValue}>
                  {task.createdAt?.toDate().toLocaleDateString()}
                </Text>
              </View>

              {task.updatedAt && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last updated:</Text>
                  <Text style={styles.detailValue}>
                    {task.updatedAt?.toDate().toLocaleDateString()}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>
            Comments & Updates ({comments.length})
          </Text>

          {/* Add Comment */}
          <View style={styles.addCommentContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={() => addComment()}
              disabled={!newComment.trim()}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {comments.map(comment => (
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>
                  {comment.userName} ({comment.userRole})
                </Text>
                <Text style={styles.commentDate}>
                  {comment.createdAt?.toDate().toLocaleDateString()}
                </Text>
              </View>
              <Text style={[
                styles.commentText,
                comment.type === 'status_change' && styles.statusChangeText
              ]}>
                {comment.type === 'status_change' ? `📝 ${comment.text}` : comment.text}
              </Text>
            </View>
          ))}

          {comments.length === 0 && (
            <Text style={styles.noComments}>No comments yet</Text>
          )}
        </View>

        {/* Delete Button */}
        {canDelete && !isEditing && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={deleteTask}
          >
            <Text style={styles.deleteButtonText}>Delete Task</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B35',
    marginBottom: 10,
    paddingBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  priorityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
  },
  categoryText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    fontSize: 20,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginRight: 10,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'capitalize',
  },
  detailsSection: {
    backgroundColor: 'white',
    marginTop: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  noDescription: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  overdueText: {
    color: '#F44336',
    fontWeight: '600',
  },
  // Edit mode styles
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  priorityOptionText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#666',
  },
  editButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
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
  saveButton: {
    backgroundColor: '#FF6B35',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Comments section
  commentsSection: {
    backgroundColor: 'white',
    marginTop: 10,
    padding: 20,
  },
  addCommentContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  commentCard: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  commentDate: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statusChangeText: {
    fontStyle: 'italic',
    color: '#1976D2',
  },
  noComments: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    marginTop: 20,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
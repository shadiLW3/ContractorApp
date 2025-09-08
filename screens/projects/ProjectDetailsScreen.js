import React, { useState, useEffect, useRef } from 'react';
import { canInviteToProject } from '../../utils/permissions';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  addDoc,
  updateDoc,
  where,
  getDocs
} from 'firebase/firestore';

export default function ProjectDetailsScreen({ route, navigation }) {
  const { projectId } = route.params;
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userStatus, setUserStatus] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [canInvite, setCanInvite] = useState(false);
  const flatListRef = useRef(null);

  // Broadcast templates
  const broadcastTemplates = {
    'Weather': [
      { icon: '🌧️', text: 'Site closed due to weather' },
      { icon: '☀️', text: 'Site reopened - work resumes' },
      { icon: '⚠️', text: 'Unsafe conditions - site temporarily closed' },
      { icon: '🌡️', text: 'Heat advisory - extra breaks required' }
    ],
    'Schedule': [
      { icon: '📅', text: 'Schedule updated - check new times' },
      { icon: '⏰', text: 'Working late today until [TIME]' },
      { icon: '🚫', text: 'Work cancelled for [DATE]' },
      { icon: '⏱️', text: 'Start time changed to [TIME]' }
    ],
    'Safety': [
      { icon: '🚨', text: 'EMERGENCY: Everyone evacuate site' },
      { icon: '🏥', text: 'Incident on site - safety meeting required' },
      { icon: '👷', text: 'Safety inspection today at [TIME]' },
      { icon: '⚠️', text: 'New safety requirements - mandatory read' }
    ],
    'General': [
      { icon: '📢', text: 'All hands meeting at [TIME]' },
      { icon: '✅', text: 'Milestone completed! Great work team' },
      { icon: '🍕', text: 'Lunch provided today' },
      { icon: '📝', text: 'Inspector on site' }
    ]
  };

  useEffect(() => {
    let unsubscribeMessages = null;
    let mounted = true; // Track if component is mounted
    
    const setup = async () => {
      if (!mounted) return;
      await fetchInitialData();
      
      if (mounted && projectId) {
        unsubscribeMessages = subscribeToMessages();
      }
    };
    
    setup();
    
    // Cleanup function
    return () => {
      mounted = false; // Prevent state updates after unmount
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
    };
  }, [projectId]);

  const fetchInitialData = async () => {
    let mounted = true; // Add this flag at the beginning
    
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!mounted) return; // Check if still mounted
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (!mounted) return; // Check again
        setCurrentUser(userData);
        
        const projectDoc = await getDoc(doc(db, 'projects', projectId));
        if (!mounted) return; // Check again
        
        if (projectDoc.exists()) {
          const projectData = projectDoc.data();
          if (!mounted) return; // Check before setting state
          
          setProject(projectData);
          navigation.setOptions({ title: projectData.name });
          
          // Check user status and permissions
          if (userData.role === 'GC' && projectData.createdBy === auth.currentUser.uid) {
            if (!mounted) return;
            setUserStatus('accepted');
            setCanInvite(true);
          } else if (userData.role === 'Sub') {
            const subInfo = projectData.invitedSubs?.find(
              sub => sub.id === auth.currentUser.uid
            );
            if (!mounted) return;
            setUserStatus(subInfo?.status || 'pending');
            
            // Check if Sub can invite techs
            if (subInfo?.status === 'accepted' && projectData.allowSubInvites !== false) {
              setCanInvite(true);
            }
          } else if (userData.role === 'Tech') {
            const isAssigned = projectData.assignedTechs?.includes(auth.currentUser.uid);
            if (!mounted) return;
            setUserStatus(isAssigned ? 'accepted' : 'pending');
          }
        }
      }
    } catch (error) {
      if (!mounted) return; // Don't show error if component unmounted
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load project details');
    }
    
    if (mounted) {
      setLoading(false);
    }
    
    // Return cleanup function
    return () => { mounted = false; };
  };

  const subscribeToMessages = () => {
    const messagesQuery = query(
      collection(db, 'projects', projectId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(messagesQuery, (snapshot) => {
      const messageList = [];
      let pinnedMsg = null;
      
      snapshot.forEach((doc) => {
        const messageData = { id: doc.id, ...doc.data() };
        if (messageData.isPinned) {
          pinnedMsg = messageData;
        }
        messageList.push(messageData);
      });
      
      setMessages(messageList);
      setPinnedMessage(pinnedMsg);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
  };

  const sendMessage = async (text = newMessage, type = 'text', isBroadcast = false) => {
    if (!text.trim() && type === 'text') return;
    
    setSending(true);
    try {
      await addDoc(collection(db, 'projects', projectId, 'messages'), {
        text: text.trim(),
        userId: auth.currentUser.uid,
        userName: currentUser?.firstName || 'User',
        userRole: currentUser?.role || 'Unknown',
        timestamp: new Date().toISOString(),
        type: type,
        isBroadcast: isBroadcast,
        isPinned: false
      });
      
      setNewMessage('');
      
      if (isBroadcast) {
        Alert.alert('Broadcast Sent', 'Your message has been sent to all team members');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    }
    setSending(false);
  };

  const handleBroadcast = (template) => {
    Alert.prompt(
      'Broadcast Message',
      'Customize your message:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send', 
          onPress: (customText) => {
            const finalText = `${template.icon} ${customText || template.text}`;
            sendMessage(finalText, 'broadcast', true);
            setShowBroadcastModal(false);
          }
        }
      ],
      'plain-text',
      template.text
    );
  };

  const handleInvitation = async (accept) => {
    try {
      const projectRef = doc(db, 'projects', projectId);
      const projectDoc = await getDoc(projectRef);
      const projectData = projectDoc.data();
      
      const updatedSubs = projectData.invitedSubs.map(sub => {
        if (sub.id === auth.currentUser.uid) {
          return { ...sub, status: accept ? 'accepted' : 'declined' };
        }
        return sub;
      });
      
      await updateDoc(projectRef, { invitedSubs: updatedSubs });
      
      await addDoc(collection(db, 'projects', projectId, 'messages'), {
        text: `${currentUser?.firstName} ${currentUser?.companyName ? `(${currentUser.companyName})` : ''} ${accept ? 'joined' : 'declined'} the project`,
        userId: 'system',
        userName: 'System',
        timestamp: new Date().toISOString(),
        type: 'system'
      });
      
      setUserStatus(accept ? 'accepted' : 'declined');
      Alert.alert('Success', accept ? 'Welcome to the project!' : 'Invitation declined');
      
      // Refresh data to update permissions
      fetchInitialData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update invitation');
    }
  };

  const togglePinMessage = async (messageId, currentPinStatus) => {
    if (currentUser?.role !== 'GC' && currentUser?.role !== 'Sub') {
      Alert.alert('Permission Denied', 'Only GCs and Subs can pin messages');
      return;
    }

    try {
      const messagesSnapshot = await getDocs(
        collection(db, 'projects', projectId, 'messages')
      );
      
      const updates = [];
      messagesSnapshot.forEach((doc) => {
        if (doc.data().isPinned) {
          updates.push(updateDoc(doc.ref, { isPinned: false }));
        }
      });
      await Promise.all(updates);
      
      if (!currentPinStatus) {
        await updateDoc(
          doc(db, 'projects', projectId, 'messages', messageId),
          { isPinned: true }
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pin message');
    }
  };

  const searchForInvites = async () => {
    if (searchQuery.length < 2) {
      Alert.alert('Search', 'Please enter at least 2 characters to search');
      return;
    }
  
    setSearchLoading(true);
    try {
      let roleToSearch = 'Sub'; // Default for GCs
      let searchResults = [];
      
      if (currentUser?.role === 'Sub') {
        // Subs can only invite their own techs
        const techsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'Tech'),
          where('managedBy', '==', auth.currentUser.uid)
        );
        
        const querySnapshot = await getDocs(techsQuery);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              data.email?.toLowerCase().includes(searchQuery.toLowerCase())) {
            searchResults.push({
              id: doc.id,
              ...data
            });
          }
        });
        
        if (searchResults.length === 0) {
          Alert.alert('No Results', 'No technicians found in your team matching the search');
        }
      } else {
        // GCs can search all Subs
        const alreadyInvited = project?.invitedSubs?.map(sub => sub.id) || [];
        const subsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'Sub')
        );
        
        const querySnapshot = await getDocs(subsQuery);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (!alreadyInvited.includes(doc.id) &&
              (data.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               data.companyName?.toLowerCase().includes(searchQuery.toLowerCase()))) {
            searchResults.push({
              id: doc.id,
              ...data
            });
          }
        });
        
        if (searchResults.length === 0) {
          Alert.alert('No Results', 'No new subcontractors found matching your search');
        }
      }
      
      setAvailableUsers(searchResults);
    } catch (error) {
      Alert.alert('Error', 'Failed to search');
      console.error(error);
    }
    setSearchLoading(false);
  };
  
  const toggleUserSelection = (user) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };
  
  const handleInviteUsers = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('No Selection', 'Please select at least one person to invite');
      return;
    }
  
    try {
      const projectRef = doc(db, 'projects', projectId);
      
      if (currentUser?.role === 'Sub') {
        // Sub inviting techs - add to assignedTechs
        const techIds = selectedUsers.map(u => u.id);
        const currentTechs = project.assignedTechs || [];
        
        await updateDoc(projectRef, {
          assignedTechs: [...currentTechs, ...techIds]
        });
        
        // Send invitations to techs
        for (const tech of selectedUsers) {
          await addDoc(collection(db, 'invitations'), {
            projectId: projectId,
            projectName: project.name,
            inviterId: auth.currentUser.uid,
            inviterName: currentUser?.firstName || '',
            inviterCompany: currentUser?.companyName || '',
            recipientId: tech.id,
            recipientName: tech.firstName,
            recipientEmail: tech.email,
            role: 'Tech',
            type: 'project_invite',
            status: 'pending',
            createdAt: new Date()
          });
        }
        
        await addDoc(collection(db, 'projects', projectId, 'messages'), {
          text: `${selectedUsers.length} technician(s) have been invited to the project`,
          userId: 'system',
          userName: 'System',
          timestamp: new Date().toISOString(),
          type: 'system'
        });
      } else {
        // GC inviting subs
        const newInvites = selectedUsers.map(sub => ({
          id: sub.id,
          name: sub.firstName,
          company: sub.companyName || '',
          email: sub.email,
          status: 'pending',
          invitedAt: new Date().toISOString(),
          canInviteTechs: project.allowSubInvites !== false
        }));
        
        const updatedInvitedSubs = [...(project.invitedSubs || []), ...newInvites];
        
        await updateDoc(projectRef, {
          invitedSubs: updatedInvitedSubs,
          memberCount: updatedInvitedSubs.length + 1
        });
        
        for (const sub of selectedUsers) {
          await addDoc(collection(db, 'invitations'), {
            projectId: projectId,
            projectName: project.name,
            inviterId: auth.currentUser.uid,
            inviterName: currentUser?.firstName || '',
            inviterCompany: currentUser?.companyName || '',
            recipientId: sub.id,
            recipientName: sub.firstName,
            recipientEmail: sub.email,
            role: 'Sub',
            type: 'project_invite',
            status: 'pending',
            createdAt: new Date()
          });
        }
        
        await addDoc(collection(db, 'projects', projectId, 'messages'), {
          text: `${selectedUsers.length} subcontractor(s) have been invited to the project`,
          userId: 'system',
          userName: 'System',
          timestamp: new Date().toISOString(),
          type: 'system'
        });
      }
      
      Alert.alert(
        'Success!',
        `${selectedUsers.length} ${currentUser?.role === 'Sub' ? 'technician(s)' : 'subcontractor(s)'} invited successfully!`,
        [{ text: 'OK', onPress: () => {
          setShowInviteModal(false);
          setSelectedUsers([]);
          setAvailableUsers([]);
          setSearchQuery('');
          fetchInitialData();
        }}]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send invitations');
      console.error(error);
    }
  };

  const updateProjectSettings = async (setting, value) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        [setting]: value
      });
      
      // Update local state
      setProject({ ...project, [setting]: value });
      
      // Update Sub permissions if needed
      if (setting === 'allowSubInvites') {
        const updatedSubs = project.invitedSubs?.map(sub => ({
          ...sub,
          canInviteTechs: value
        }));
        
        await updateDoc(doc(db, 'projects', projectId), {
          invitedSubs: updatedSubs
        });
      }
      
      fetchInitialData(); // Refresh all data
    } catch (error) {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'GC': return '#FF6B35';
      case 'Sub': return '#4ECDC4';
      case 'Tech': return '#45B7D1';
      default: return '#999';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  };

  const renderMessage = ({ item, index }) => {
    const isSystem = item.type === 'system';
    const isBroadcast = item.type === 'broadcast';
    const isOwnMessage = item.userId === auth.currentUser.uid;
    
    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        onLongPress={() => {
          if (currentUser?.role === 'GC' || currentUser?.role === 'Sub') {
            Alert.alert(
              'Message Options',
              'What would you like to do?',
              [
                { 
                  text: item.isPinned ? 'Unpin Message' : 'Pin Message', 
                  onPress: () => togglePinMessage(item.id, item.isPinned)
                },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          }
        }}
        style={[
          styles.messageContainer,
          isOwnMessage && styles.ownMessageContainer
        ]}
      >
        <View style={[
          styles.messageBubble,
          isOwnMessage && styles.ownMessageBubble,
          isBroadcast && styles.broadcastBubble
        ]}>
          {!isOwnMessage && (
            <View style={styles.messageHeader}>
              <Text style={styles.userName}>{item.userName}</Text>
              <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.userRole) }]}>
                <Text style={styles.roleBadgeText}>{item.userRole}</Text>
              </View>
            </View>
          )}
          <Text style={[
            styles.messageText,
            isOwnMessage && styles.ownMessageText,
            isBroadcast && styles.broadcastText
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.messageTime,
            isOwnMessage && styles.ownMessageTime
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading project...</Text>
      </View>
    );
  }

  if (userStatus === 'pending' && currentUser?.role === 'Sub') {
    return (
      <View style={styles.invitationContainer}>
        <Text style={styles.invitationTitle}>Project Invitation</Text>
        <Text style={styles.projectName}>{project?.name}</Text>
        <Text style={styles.projectAddress}>{project?.fullAddress}</Text>
        
        <View style={styles.invitationInfo}>
          <Text style={styles.invitationLabel}>From:</Text>
          <Text style={styles.invitationValue}>
            {project?.gcInfo?.name} {project?.gcInfo?.company && `(${project.gcInfo.company})`}
          </Text>
        </View>
        
        <View style={styles.invitationInfo}>
          <Text style={styles.invitationLabel}>Start Date:</Text>
          <Text style={styles.invitationValue}>
            {new Date(project?.startDate).toLocaleDateString()}
          </Text>
        </View>
        
        {project?.allowSubInvites && (
          <View style={styles.permissionNote}>
            <Text style={styles.permissionNoteText}>
              ✓ You'll be able to invite your technicians to this project
            </Text>
          </View>
        )}
        
        <View style={styles.invitationActions}>
          <TouchableOpacity 
            style={[styles.invitationButton, styles.acceptButton]}
            onPress={() => handleInvitation(true)}
          >
            <Text style={styles.acceptButtonText}>Accept & Join</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.invitationButton, styles.declineButton]}
            onPress={() => handleInvitation(false)}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (userStatus === 'declined') {
    return (
      <View style={styles.invitationContainer}>
        <Text style={styles.declinedTitle}>Invitation Declined</Text>
        <Text style={styles.declinedText}>
          You have declined the invitation to join this project.
        </Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerInfo}>
            <Text style={styles.projectTitle}>{project?.name}</Text>
            <Text style={styles.projectLocation}>{project?.city}, {project?.state}</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Invite button for GC or authorized Subs */}
            {canInvite && (
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => setShowInviteModal(true)}
              >
                <Text style={styles.headerButtonIcon}>➕</Text>
              </TouchableOpacity>
            )}
            
            {/* Broadcast for GC only */}
            {currentUser?.role === 'GC' && project?.createdBy === auth.currentUser.uid && (
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => setShowBroadcastModal(false)}
              >
                <Text style={styles.headerButtonIcon}>📢</Text>
              </TouchableOpacity>
            )}
            
            {/* Settings for GC only */}
            {currentUser?.role === 'GC' && project?.createdBy === auth.currentUser.uid && (
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => setShowSettingsModal(true)}
              >
                <Text style={styles.headerButtonIcon}>⚙️</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowMembersModal(true)}
            >
              <Text style={styles.headerButtonIcon}>👥</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowInfoModal(true)}
            >
              <Text style={styles.headerButtonIcon}>ℹ️</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {pinnedMessage && (
          <View style={styles.pinnedMessageContainer}>
            <Text style={styles.pinnedIcon}>📌</Text>
            <Text style={styles.pinnedText} numberOfLines={2}>
              {pinnedMessage.text}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          multiline
          maxHeight={100}
        />
        <TouchableOpacity 
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={() => sendMessage()}
          disabled={sending || !newMessage.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Settings Modal (NEW) */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Project Settings</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Allow Subs to invite their teams</Text>
                <Text style={styles.settingDescription}>
                  Subcontractors can add their technicians to this project
                </Text>
              </View>
              <Switch
                value={project?.allowSubInvites !== false}
                onValueChange={(value) => updateProjectSettings('allowSubInvites', value)}
                trackColor={{ false: '#ddd', true: '#4ECDC4' }}
              />
            </View>
            
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Allow Subs to create events</Text>
                <Text style={styles.settingDescription}>
                  Subcontractors can schedule team events on the calendar
                </Text>
              </View>
              <Switch
                value={project?.allowSubEvents !== false}
                onValueChange={(value) => updateProjectSettings('allowSubEvents', value)}
                trackColor={{ false: '#ddd', true: '#4ECDC4' }}
              />
            </View>
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Broadcast Modal */}
      <Modal
        visible={showBroadcastModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBroadcastModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Broadcast</Text>
            <ScrollView style={styles.broadcastScroll}>
              {Object.entries(broadcastTemplates).map(([category, templates]) => (
                <View key={category}>
                  <Text style={styles.broadcastCategory}>{category}</Text>
                  {templates.map((template, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.broadcastOption}
                      onPress={() => handleBroadcast(template)}
                    >
                      <Text style={styles.broadcastIcon}>{template.icon}</Text>
                      <Text style={styles.broadcastText}>{template.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowBroadcastModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Team Members</Text>
            <ScrollView style={styles.membersList}>
              <View style={styles.memberItem}>
                <View style={[styles.memberBadge, { backgroundColor: '#FF6B35' }]}>
                  <Text style={styles.memberBadgeText}>GC</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {project?.gcInfo?.name} {project?.gcInfo?.company && `(${project.gcInfo.company})`}
                  </Text>
                  <Text style={styles.memberRole}>General Contractor</Text>
                </View>
              </View>
              
              {project?.invitedSubs?.map((sub) => (
                <View key={sub.id} style={styles.memberItem}>
                  <View style={[styles.memberBadge, { backgroundColor: '#4ECDC4' }]}>
                    <Text style={styles.memberBadgeText}>SUB</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {sub.name} {sub.company && `(${sub.company})`}
                    </Text>
                    <Text style={styles.memberRole}>
                      Subcontractor - {sub.status}
                      {sub.canInviteTechs && ' (Can invite techs)'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowMembersModal(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Project Info Modal */}
      <Modal
        visible={showInfoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Project Information</Text>
            <ScrollView style={styles.infoScroll}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Project Name:</Text>
                <Text style={styles.infoValue}>{project?.name}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Address:</Text>
                <Text style={styles.infoValue}>{project?.fullAddress}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Start Date:</Text>
                <Text style={styles.infoValue}>
                  {project?.startDate && new Date(project.startDate).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>End Date:</Text>
                <Text style={styles.infoValue}>
                  {project?.endDate && new Date(project.endDate).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Description:</Text>
                <Text style={styles.infoValue}>{project?.description || 'No description provided'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Status:</Text>
                <Text style={styles.infoValue}>{project?.status || 'Active'}</Text>
              </View>
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Invite Modal (Updated) */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {currentUser?.role === 'Sub' ? 'Invite Technicians' : 'Invite Subcontractors'}
            </Text>
            
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder={currentUser?.role === 'Sub' ? 
                  "Search your technicians..." : 
                  "Search by name or company..."}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchForInvites}
              />
              <TouchableOpacity 
                style={styles.searchButton}
                onPress={searchForInvites}
                disabled={searchLoading}
              >
                <Text style={styles.searchButtonText}>
                  {searchLoading ? '...' : 'Search'}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedUsers.length > 0 && (
              <Text style={styles.selectedCount}>
                {selectedUsers.length} selected
              </Text>
            )}
            
            <ScrollView style={styles.searchResults}>
              {availableUsers.map((user) => {
                const isSelected = selectedUsers.find(u => u.id === user.id);
                return (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      styles.subItem,
                      isSelected && styles.subItemSelected
                    ]}
                    onPress={() => toggleUserSelection(user)}
                  >
                    <View style={styles.subInfo}>
                      <Text style={styles.subName}>{user.firstName}</Text>
                      {user.companyName && (
                        <Text style={styles.subCompany}>{user.companyName}</Text>
                      )}
                      <Text style={styles.subEmail}>{user.email}</Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
              
              {availableUsers.length === 0 && searchQuery.length > 0 && (
                <Text style={styles.noResults}>
                  {currentUser?.role === 'Sub' ? 
                    'No technicians found in your team' : 
                    'Search for subcontractors to invite'}
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowInviteModal(false);
                  setSelectedUsers([]);
                  setAvailableUsers([]);
                  setSearchQuery('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.inviteButton, selectedUsers.length === 0 && styles.inviteButtonDisabled]}
                onPress={handleInviteUsers}
                disabled={selectedUsers.length === 0}
              >
                <Text style={styles.inviteButtonText}>
                  Invite ({selectedUsers.length})
                </Text>
              </TouchableOpacity>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  headerInfo: {
    flex: 1,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  projectLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonIcon: {
    fontSize: 20,
  },
  pinnedMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginTop: 10,
  },
  pinnedIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  pinnedText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  permissionNote: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  permissionNoteText: {
    color: '#2E7D32',
    fontSize: 14,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingText: {
    flex: 1,
    marginRight: 10,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
  messagesList: {
    padding: 15,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
  },
  broadcastBubble: {
    backgroundColor: '#FFE0B2',
    maxWidth: '95%',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 6,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  ownMessageText: {
    color: 'white',
  },
  broadcastText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E65100',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.8)',
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 10,
  },
  systemText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    marginRight: 10,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 16,
    lineHeight: Platform.OS === 'ios' ? 20 : 18,
    textAlignVertical: 'center',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  invitationContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invitationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  projectName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF6B35',
    marginBottom: 8,
  },
  projectAddress: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  invitationInfo: {
    width: '100%',
    marginBottom: 15,
  },
  invitationLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  invitationValue: {
    fontSize: 16,
    color: '#333',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 30,
  },
  invitationButton: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#F44336',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  declineButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  declinedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  declinedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalCloseButton: {
    marginTop: 20,
    alignSelf: 'center',
    paddingHorizontal: 30,
    paddingVertical: 10,
  },
  modalCloseText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  broadcastScroll: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  broadcastCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
    marginBottom: 10,
  },
  broadcastOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
  },
  broadcastIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  membersList: {
    paddingHorizontal: 20,
    maxHeight: 400,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  infoScroll: {
    paddingHorizontal: 20,
    maxHeight: 400,
  },
  infoItem: {
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    minHeight: Platform.OS === 'ios' ? 40 : 36,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  selectedCount: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 10,
  },
  searchResults: {
    maxHeight: 300,
    paddingHorizontal: 20,
  },
  subItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
  },
  subItemSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
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
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: 'white',
    fontWeight: 'bold',
  },
  noResults: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteButtonDisabled: {
    backgroundColor: '#ccc',
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
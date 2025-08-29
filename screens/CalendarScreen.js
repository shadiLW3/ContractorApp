import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { auth, db } from '../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import Toast from 'react-native-toast-message';

export default function CalendarScreen({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState({});
  const [markedDates, setMarkedDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  
  // Event creation states
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventProject, setEventProject] = useState('');
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('17:00');
  
  // Absence reporting states
  const [absenceReason, setAbsenceReason] = useState('sick');
  const [absenceMessage, setAbsenceMessage] = useState('');

  // Project colors
  const projectColors = ['#FF6B35', '#4ECDC4', '#45B7D1', '#95E77E', '#FFD93D', '#FF6B9D'];
  const getProjectColor = (projectId) => {
    const index = projectId ? projectId.charCodeAt(0) % projectColors.length : 0;
    return projectColors[index];
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
    // Query events based on user role
    const eventsQuery = query(
      collection(db, 'calendarEvents'),
      where('participants', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsByDate = {};
      const marks = {};
      
      snapshot.forEach((doc) => {
        const event = { id: doc.id, ...doc.data() };
        const dateStr = new Date(event.date.toDate()).toISOString().split('T')[0];
        
        // Group events by date
        if (!eventsByDate[dateStr]) {
          eventsByDate[dateStr] = [];
        }
        eventsByDate[dateStr].push(event);
        
        // Mark dates with events - simplified without dots
        marks[dateStr] = {
          marked: true,
          dotColor: getProjectColor(event.projectId)
        };
      });
      
      setEvents(eventsByDate);
      setMarkedDates(marks);
      setLoading(false);
    }, (error) => {
      console.log('No events yet');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const createEvent = async () => {
    if (!eventTitle) {
      Alert.alert('Missing Info', 'Please add an event title');
      return;
    }

    try {
      const eventData = {
        title: eventTitle,
        description: eventDescription,
        projectId: eventProject || 'general',
        date: Timestamp.fromDate(new Date(selectedDate)),
        startTime: eventStartTime,
        endTime: eventEndTime,
        createdBy: auth.currentUser.uid,
        createdByRole: userProfile?.role,
        participants: [auth.currentUser.uid],
        type: 'task',
        color: getProjectColor(eventProject),
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'calendarEvents'), eventData);
      
      Toast.show({
        type: 'success',
        text1: 'Event Created',
        visibilityTime: 2000
      });
      
      setShowEventModal(false);
      resetEventForm();
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event');
    }
  };

  const reportAbsence = async () => {
    if (!absenceMessage) {
      Alert.alert('Missing Info', 'Please provide a reason for your absence');
      return;
    }

    try {
      const absenceData = {
        techId: auth.currentUser.uid,
        techName: userProfile?.firstName,
        subId: userProfile?.managedBy || null,
        date: Timestamp.fromDate(new Date(selectedDate)),
        reason: absenceReason,
        message: absenceMessage,
        status: 'pending',
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'timeOffRequests'), absenceData);
      
      // Also create a calendar event for the absence
      await addDoc(collection(db, 'calendarEvents'), {
        title: `${userProfile?.firstName} - ${absenceReason}`,
        description: absenceMessage,
        date: Timestamp.fromDate(new Date(selectedDate)),
        createdBy: auth.currentUser.uid,
        participants: [auth.currentUser.uid],
        type: 'absence',
        color: '#9E9E9E',
        createdAt: Timestamp.now()
      });
      
      Toast.show({
        type: 'success',
        text1: 'Absence Reported',
        text2: 'Your supervisor has been notified',
        visibilityTime: 3000
      });
      
      setShowAbsenceModal(false);
      setAbsenceMessage('');
    } catch (error) {
      console.error('Error reporting absence:', error);
      Alert.alert('Error', 'Failed to report absence');
    }
  };

  const resetEventForm = () => {
    setEventTitle('');
    setEventDescription('');
    setEventProject('');
    setEventStartTime('09:00');
    setEventEndTime('17:00');
  };

  const renderEvent = (event) => (
    <TouchableOpacity 
      key={event.id} 
      style={[styles.eventCard, { borderLeftColor: event.color || '#007AFF' }]}
    >
      <View style={styles.eventTime}>
        <Text style={styles.eventTimeText}>
          {event.startTime || 'All Day'}
        </Text>
      </View>
      <View style={styles.eventDetails}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        {event.projectName && (
          <Text style={styles.eventProject}>{event.projectName}</Text>
        )}
      </View>
      {event.type === 'absence' && (
        <View style={styles.absenceBadge}>
          <Text style={styles.absenceText}>Absence</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const selectedEvents = events[selectedDate] || [];
  const calendarMarkedDates = {
    ...markedDates,
    [selectedDate]: {
      ...markedDates[selectedDate],
      selected: true,
      selectedColor: '#007AFF'
    }
  };

  return (
    <View style={styles.container}>
      {/* Calendar */}
      <Calendar
        current={selectedDate}
        onDayPress={handleDayPress}
        markedDates={calendarMarkedDates}
        theme={{
          backgroundColor: '#ffffff',
          calendarBackground: '#ffffff',
          textSectionTitleColor: '#666',
          selectedDayBackgroundColor: '#007AFF',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#007AFF',
          dayTextColor: '#333',
          textDisabledColor: '#d9d9d9',
          dotColor: '#007AFF',
          selectedDotColor: '#ffffff',
          arrowColor: '#007AFF',
          monthTextColor: '#333',
          textDayFontWeight: '300',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14
        }}
      />

      {/* Events List for Selected Date */}
      <ScrollView style={styles.eventsList}>
        <Text style={styles.selectedDateText}>
          {new Date(selectedDate).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          })}
        </Text>
        {selectedEvents.map(renderEvent)}
        {selectedEvents.length === 0 && (
          <Text style={styles.noEventsText}>No events scheduled</Text>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {userProfile?.role !== 'Tech' ? (
          <TouchableOpacity 
            style={styles.fab}
            onPress={() => setShowEventModal(true)}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.fab, styles.absenceFab]}
            onPress={() => setShowAbsenceModal(true)}
          >
            <Text style={styles.fabText}>🤒</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Event Creation Modal */}
      <Modal
        visible={showEventModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEventModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Event</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Event Title *"
              value={eventTitle}
              onChangeText={setEventTitle}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Description"
              value={eventDescription}
              onChangeText={setEventDescription}
              multiline
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Project Name"
              value={eventProject}
              onChangeText={setEventProject}
            />
            
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.modalInput, styles.timeInput]}
                placeholder="Start"
                value={eventStartTime}
                onChangeText={setEventStartTime}
              />
              <TextInput
                style={[styles.modalInput, styles.timeInput]}
                placeholder="End"
                value={eventEndTime}
                onChangeText={setEventEndTime}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEventModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={createEvent}
              >
                <Text style={styles.confirmButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Absence Modal */}
      <Modal
        visible={showAbsenceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAbsenceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report Absence</Text>
            
            <View style={styles.reasonSelector}>
              {['sick', 'personal', 'emergency'].map(reason => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonButton, absenceReason === reason && styles.reasonButtonActive]}
                  onPress={() => setAbsenceReason(reason)}
                >
                  <Text style={[styles.reasonText, absenceReason === reason && styles.reasonTextActive]}>
                    {reason.charAt(0).toUpperCase() + reason.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={[styles.modalInput, styles.messageInput]}
              placeholder="Message to supervisor *"
              value={absenceMessage}
              onChangeText={setAbsenceMessage}
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAbsenceModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={reportAbsence}
              >
                <Text style={styles.confirmButtonText}>Submit</Text>
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
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventsList: {
    flex: 1,
    padding: 20,
  },
  selectedDateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  eventCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTime: {
    marginRight: 15,
    minWidth: 50,
  },
  eventTimeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  eventProject: {
    fontSize: 14,
    color: '#666',
  },
  absenceBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  absenceText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '600',
  },
  noEventsText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  absenceFab: {
    backgroundColor: '#FF9800',
  },
  fabText: {
    fontSize: 24,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
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
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeInput: {
    flex: 1,
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  reasonSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  reasonButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  reasonButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  reasonText: {
    color: '#666',
    fontWeight: '600',
  },
  reasonTextActive: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
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
    color: '#fff',
    fontWeight: '600',
  },
});
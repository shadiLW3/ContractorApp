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
  ActivityIndicator,
  Switch
} from 'react-native';
import { Calendar, CalendarList, Agenda, WeekCalendar } from 'react-native-calendars';
import { auth, db } from '../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc,
  doc,
  getDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import Toast from 'react-native-toast-message';

export default function CalendarScreen({ navigation }) {
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState({});
  const [markedDates, setMarkedDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [scheduleMode, setScheduleMode] = useState('quick'); // quick, bulk, template
  const [selectedDates, setSelectedDates] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Schedule form states
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleProject, setScheduleProject] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('08:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('17:00');
  const [scheduleDescription, setScheduleDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState('daily'); // daily, weekly, weekdays
  const [recurringEnd, setRecurringEnd] = useState('');
  
  // Common schedule templates
  const scheduleTemplates = [
    { 
      name: 'Standard Work Day', 
      startTime: '08:00', 
      endTime: '17:00',
      title: 'On Site Work'
    },
    { 
      name: 'Morning Shift', 
      startTime: '06:00', 
      endTime: '14:00',
      title: 'Morning Crew'
    },
    { 
      name: 'Afternoon Shift', 
      startTime: '14:00', 
      endTime: '22:00',
      title: 'Afternoon Crew'
    },
    { 
      name: 'Inspection', 
      startTime: '10:00', 
      endTime: '12:00',
      title: 'Site Inspection'
    }
  ];

  // Project colors
  const projectColors = ['#FF6B35', '#4ECDC4', '#45B7D1', '#95E77E', '#FFD93D', '#FF6B9D'];
  const getProjectColor = (projectId) => {
    const index = projectId ? projectId.charCodeAt(0) % projectColors.length : 0;
    return projectColors[index];
  };

  // Time slots for day view
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
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
        
        if (!eventsByDate[dateStr]) {
          eventsByDate[dateStr] = [];
        }
        eventsByDate[dateStr].push(event);
        
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
    if (scheduleMode === 'bulk') {
      // In bulk mode, toggle selection
      if (selectedDates.includes(day.dateString)) {
        setSelectedDates(selectedDates.filter(d => d !== day.dateString));
      } else {
        setSelectedDates([...selectedDates, day.dateString]);
      }
    } else {
      setSelectedDate(day.dateString);
    }
  };

  const handleDayLongPress = (day) => {
    // Long press to start bulk selection
    setScheduleMode('bulk');
    setSelectedDates([day.dateString]);
    Toast.show({
      type: 'info',
      text1: 'Bulk Selection Mode',
      text2: 'Tap more days to select',
      visibilityTime: 2000
    });
  };

  const applyTemplate = (template) => {
    setScheduleTitle(template.title);
    setScheduleStartTime(template.startTime);
    setScheduleEndTime(template.endTime);
    Toast.show({
      type: 'success',
      text1: `Applied ${template.name}`,
      visibilityTime: 1500
    });
  };

  const createSchedule = async () => {
    if (!scheduleTitle) {
      Alert.alert('Missing Info', 'Please add a title');
      return;
    }

    const batch = writeBatch(db);
    const datesToSchedule = scheduleMode === 'bulk' ? selectedDates : [selectedDate];

    // Handle recurring events
    if (isRecurring) {
      const endDate = recurringEnd ? new Date(recurringEnd) : new Date(selectedDate);
      endDate.setMonth(endDate.getMonth() + 1); // Default 1 month if not specified
      
      let currentDate = new Date(selectedDate);
      while (currentDate <= endDate) {
        const shouldAdd = 
          recurringType === 'daily' || 
          (recurringType === 'weekly' && currentDate.getDay() === new Date(selectedDate).getDay()) ||
          (recurringType === 'weekdays' && currentDate.getDay() > 0 && currentDate.getDay() < 6);
        
        if (shouldAdd) {
          datesToSchedule.push(currentDate.toISOString().split('T')[0]);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    try {
      // Create events for all selected dates
      for (const dateStr of datesToSchedule) {
        const eventData = {
          title: scheduleTitle,
          description: scheduleDescription,
          projectId: scheduleProject || 'general',
          projectName: scheduleProject || 'General',
          date: Timestamp.fromDate(new Date(dateStr)),
          startTime: scheduleStartTime,
          endTime: scheduleEndTime,
          createdBy: auth.currentUser.uid,
          createdByRole: userProfile?.role,
          participants: [auth.currentUser.uid],
          type: 'scheduled',
          color: getProjectColor(scheduleProject),
          createdAt: Timestamp.now()
        };

        await addDoc(collection(db, 'calendarEvents'), eventData);
      }
      
      Toast.show({
        type: 'success',
        text1: 'Schedule Created',
        text2: `Added ${datesToSchedule.length} event(s)`,
        visibilityTime: 2000
      });
      
      setShowScheduleModal(false);
      resetScheduleForm();
      setScheduleMode('quick');
      setSelectedDates([]);
    } catch (error) {
      console.error('Error creating schedule:', error);
      Alert.alert('Error', 'Failed to create schedule');
    }
  };

  const resetScheduleForm = () => {
    setScheduleTitle('');
    setScheduleDescription('');
    setScheduleProject('');
    setScheduleStartTime('08:00');
    setScheduleEndTime('17:00');
    setIsRecurring(false);
    setRecurringType('daily');
    setRecurringEnd('');
  };

  const renderDayView = () => {
    const dayEvents = events[selectedDate] || [];
    const currentHour = new Date().getHours();
    
    return (
      <ScrollView style={styles.dayViewContainer}>
        <Text style={styles.dayViewDate}>
          {new Date(selectedDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
        
        {timeSlots.map((time, index) => {
          const hour = parseInt(time.split(':')[0]);
          const isCurrentHour = hour === currentHour && selectedDate === new Date().toISOString().split('T')[0];
          const slotEvents = dayEvents.filter(e => {
            const startHour = parseInt(e.startTime?.split(':')[0] || 0);
            return startHour === hour;
          });
          
          return (
            <View key={time} style={styles.timeSlot}>
              <Text style={[styles.timeLabel, isCurrentHour && styles.currentTimeLabel]}>
                {time}
              </Text>
              <View style={[styles.timeSlotContent, isCurrentHour && styles.currentTimeSlot]}>
                {slotEvents.map(event => (
                  <TouchableOpacity 
                    key={event.id}
                    style={[styles.dayViewEvent, { backgroundColor: event.color + '20', borderLeftColor: event.color }]}
                  >
                    <Text style={styles.dayViewEventTitle}>{event.title}</Text>
                    <Text style={styles.dayViewEventTime}>
                      {event.startTime} - {event.endTime}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);
    
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date.toISOString().split('T')[0];
    });
    
    return (
      <ScrollView style={styles.weekViewContainer}>
        <View style={styles.weekHeader}>
          {weekDays.map(date => (
            <TouchableOpacity 
              key={date}
              style={styles.weekDayHeader}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={styles.weekDayName}>
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={[styles.weekDayNumber, date === selectedDate && styles.selectedWeekDay]}>
                {new Date(date).getDate()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.weekContent}>
            {weekDays.map(date => (
              <View key={date} style={styles.weekDayColumn}>
                {(events[date] || []).map(event => (
                  <TouchableOpacity 
                    key={event.id}
                    style={[styles.weekEvent, { backgroundColor: event.color + '30' }]}
                  >
                    <Text style={styles.weekEventTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.weekEventTime}>
                      {event.startTime}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const getBulkMarkedDates = () => {
    const marks = { ...markedDates };
    selectedDates.forEach(date => {
      marks[date] = {
        ...marks[date],
        selected: true,
        selectedColor: '#FFD93D'
      };
    });
    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: '#007AFF'
    };
    return marks;
  };

  return (
    <View style={styles.container}>
      {/* View Mode Selector */}
      <View style={styles.viewSelector}>
        {['month', 'week', 'day'].map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.viewButton, viewMode === mode && styles.viewButtonActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.viewButtonText, viewMode === mode && styles.viewButtonTextActive]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Schedule Mode Buttons (for GC/Sub only) */}
      {userProfile?.role !== 'Tech' && (
        <View style={styles.scheduleModeBar}>
          <TouchableOpacity
            style={[styles.scheduleModeButton, scheduleMode === 'quick' && styles.scheduleModeActive]}
            onPress={() => {
              setScheduleMode('quick');
              setSelectedDates([]);
            }}
          >
            <Text style={styles.scheduleModeText}>Quick Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scheduleModeButton, scheduleMode === 'bulk' && styles.scheduleModeActive]}
            onPress={() => setScheduleMode('bulk')}
          >
            <Text style={styles.scheduleModeText}>
              Bulk Schedule {selectedDates.length > 0 && `(${selectedDates.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scheduleModeButton, scheduleMode === 'template' && styles.scheduleModeActive]}
            onPress={() => setScheduleMode('template')}
          >
            <Text style={styles.scheduleModeText}>Templates</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Calendar View */}
      {viewMode === 'month' ? (
        <Calendar
          current={selectedDate}
          onDayPress={handleDayPress}
          onDayLongPress={handleDayLongPress}
          markedDates={getBulkMarkedDates()}
          minDate={new Date().toISOString().split('T')[0]}  // ADD THIS LINE
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            selectedDayBackgroundColor: '#007AFF',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#007AFF',
            dayTextColor: '#333',
            textDisabledColor: '#d9d9d9',
            dotColor: '#007AFF',
            arrowColor: '#007AFF',
          }}
        />
      ) : viewMode === 'week' ? (
        renderWeekView()
      ) : (
        renderDayView()
      )}

      {/* Templates Section */}
      {scheduleMode === 'template' && (
        <ScrollView style={styles.templatesContainer}>
          <Text style={styles.templatesTitle}>Quick Templates</Text>
          {scheduleTemplates.map((template, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.templateCard}
              onPress={() => {
                applyTemplate(template);
                setShowScheduleModal(true);
              }}
            >
              <Text style={styles.templateName}>{template.name}</Text>
              <Text style={styles.templateTime}>
                {template.startTime} - {template.endTime}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Action Button */}
      {userProfile?.role !== 'Tech' && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => setShowScheduleModal(true)}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {scheduleMode === 'bulk' 
                  ? `Schedule ${selectedDates.length} Days` 
                  : 'Create Event'}
              </Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="Title *"
                value={scheduleTitle}
                onChangeText={setScheduleTitle}
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Project Name"
                value={scheduleProject}
                onChangeText={setScheduleProject}
              />
              
              <View style={styles.timeRow}>
                <TextInput
                  style={[styles.modalInput, styles.timeInput]}
                  placeholder="Start"
                  value={scheduleStartTime}
                  onChangeText={setScheduleStartTime}
                />
                <TextInput
                  style={[styles.modalInput, styles.timeInput]}
                  placeholder="End"
                  value={scheduleEndTime}
                  onChangeText={setScheduleEndTime}
                />
              </View>
              
              <TextInput
                style={[styles.modalInput, styles.descriptionInput]}
                placeholder="Description"
                value={scheduleDescription}
                onChangeText={setScheduleDescription}
                multiline
              />
              
              {/* Recurring Options */}
              <View style={styles.recurringSection}>
                <View style={styles.recurringRow}>
                  <Text style={styles.recurringLabel}>Repeat</Text>
                  <Switch
                    value={isRecurring}
                    onValueChange={setIsRecurring}
                    trackColor={{ false: '#ddd', true: '#007AFF' }}
                  />
                </View>
                
                {isRecurring && (
                  <>
                    <View style={styles.recurringTypes}>
                      {['daily', 'weekly', 'weekdays'].map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[styles.recurringType, recurringType === type && styles.recurringTypeActive]}
                          onPress={() => setRecurringType(type)}
                        >
                          <Text style={[styles.recurringTypeText, recurringType === type && styles.recurringTypeTextActive]}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    <TextInput
                      style={styles.modalInput}
                      placeholder="End Date (YYYY-MM-DD)"
                      value={recurringEnd}
                      onChangeText={setRecurringEnd}
                    />
                  </>
                )}
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowScheduleModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={createSchedule}
                >
                  <Text style={styles.confirmButtonText}>
                    {scheduleMode === 'bulk' ? 'Schedule All' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  viewSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  viewButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 5,
  },
  viewButtonActive: {
    backgroundColor: '#007AFF',
  },
  viewButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  viewButtonTextActive: {
    color: '#fff',
  },
  scheduleModeBar: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
  },
  scheduleModeButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 15,
  },
  scheduleModeActive: {
    backgroundColor: '#FFD93D',
  },
  scheduleModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  dayViewContainer: {
    flex: 1,
  },
  dayViewDate: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    padding: 15,
    backgroundColor: '#f8f9fa',
  },
  timeSlot: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 60,
  },
  timeLabel: {
    width: 60,
    padding: 10,
    fontSize: 12,
    color: '#666',
  },
  currentTimeLabel: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  timeSlotContent: {
    flex: 1,
    padding: 5,
  },
  currentTimeSlot: {
    backgroundColor: '#E3F2FD',
  },
  dayViewEvent: {
    padding: 8,
    marginVertical: 2,
    borderLeftWidth: 3,
    borderRadius: 4,
  },
  dayViewEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  dayViewEventTime: {
    fontSize: 12,
    color: '#666',
  },
  weekViewContainer: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedWeekDay: {
    color: '#007AFF',
  },
  weekContent: {
    flexDirection: 'row',
    minHeight: 400,
  },
  weekDayColumn: {
    width: 100,
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
    padding: 5,
  },
  weekEvent: {
    padding: 6,
    marginBottom: 4,
    borderRadius: 4,
  },
  weekEventTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  weekEventTime: {
    fontSize: 10,
    color: '#666',
  },
  templatesContainer: {
    flex: 1,
    padding: 15,
  },
  templatesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  templateCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  templateTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
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
  fabText: {
    fontSize: 24,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
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
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeInput: {
    flex: 1,
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  recurringSection: {
    marginBottom: 16,
  },
  recurringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recurringLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  recurringTypes: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8,
  },
  recurringType: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  recurringTypeActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  recurringTypeText: {
    color: '#666',
    fontSize: 14,
  },
  recurringTypeTextActive: {
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
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { Picker } from '@react-native-picker/picker';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showSpecializationPicker, setShowSpecializationPicker] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [selectedSpecialization, setSelectedSpecialization] = useState('Electrician');
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Profile setup states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // Trade specializations for technicians
  const tradeSpecializations = [
    'Electrician',
    'Plumber',
    'HVAC Technician',
    'Carpenter',
    'Drywall Installer',
    'Painter',
    'Flooring Specialist',
    'Roofer',
    'Mason/Concrete',
    'Insulation Installer',
    'Tile Setter',
    'Welder',
    'Other'
  ];

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Check if user has a profile/role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
          setShowRoleSelection(false);
          setShowProfileSetup(false);
        } else {
          setShowRoleSelection(true);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setShowRoleSelection(false);
        setShowProfileSetup(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAuth = async () => {
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        // After signup, role selection will show automatically
      }
      setEmail('');
      setPassword('');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleRoleSelection = async (role) => {
    setSelectedRole(role);
    
    if (role === 'Tech') {
      // Show specialization picker for technicians
      setShowSpecializationPicker(true);
    } else {
      // Move to profile setup for GC and Sub
      setShowProfileSetup(true);
    }
  };

  const handleSpecializationConfirm = async () => {
    setShowSpecializationPicker(false);
    setShowProfileSetup(true);
  };

  const sendVerificationCode = async () => {
    // Format phone number
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    if (formattedPhone.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return;
    }

    // In production, you'd integrate with a service like Twilio or Firebase Phone Auth
    // For now, we'll simulate sending a code
    setCodeSent(true);
    setShowVerification(true);
    
    // Simulate sending code (in production, call your SMS API here)
    Alert.alert('Code Sent', 'A verification code has been sent to ' + formatPhoneDisplay(phoneNumber));
    
    // For testing, we'll use a dummy code "123456"
    console.log('Test verification code: 123456');
  };

  const verifyCode = async () => {
    // In production, verify with your backend
    // For testing, accept "123456"
    if (verificationCode === '123456') {
      completeProfileSetup();
    } else {
      Alert.alert('Invalid Code', 'Please enter the correct verification code');
    }
  };

  const formatPhoneDisplay = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return phone;
  };

  const completeProfileSetup = async () => {
    try {
      const userProfile = {
        email: user.email,
        role: selectedRole,
        firstName: firstName,
        lastName: lastName,
        publicName: firstName, // Only first name is public
        phoneNumber: formatPhoneDisplay(phoneNumber),
        phoneVerified: false, // False for right now testing
        companyName: companyName || null,
        createdAt: new Date(),
        displayName: selectedRole === 'GC' ? 'General Contractor' : 
                   selectedRole === 'Sub' ? 'Subcontractor' : 
                   `${selectedSpecialization} Technician`,
        ...(selectedRole === 'Tech' && { specialization: selectedSpecialization })
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);
      setUserProfile(userProfile);
      setShowRoleSelection(false);
      setShowProfileSetup(false);
      
      Alert.alert('Welcome!', `Welcome ${firstName}! Your account has been set up successfully.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile: ' + error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      Alert.alert('Signed Out', 'You have been signed out successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // Show profile setup screen
  if (showProfileSetup) {
    return (
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView 
          contentContainerStyle={styles.setupContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.setupTitle}>Complete Your Profile</Text>
          <Text style={styles.setupSubtitle}>
            We need a few details to set up your account
          </Text>

          <View style={styles.privacyNotice}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>
              Only your first name will be visible to others
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name *</Text>
            <TextInput
              style={styles.setupInput}
              placeholder="John"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <Text style={styles.publicBadge}>PUBLIC</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Last Name *</Text>
            <TextInput
              style={styles.setupInput}
              placeholder="Doe"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            <Text style={styles.privateBadge}>PRIVATE</Text>
          </View>

          {(selectedRole === 'GC' || selectedRole === 'Sub') && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Company Name (Optional)</Text>
              <TextInput
                style={styles.setupInput}
                placeholder="ABC Construction"
                value={companyName}
                onChangeText={setCompanyName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.setupInput}
              placeholder="(555) 123-4567"
              value={phoneNumber}
              onChangeText={(text) => {
                // Auto-format phone number as user types
                const cleaned = text.replace(/\D/g, '');
                let formatted = cleaned;
                if (cleaned.length >= 6) {
                  formatted = `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6,10)}`;
                } else if (cleaned.length >= 3) {
                  formatted = `(${cleaned.slice(0,3)}) ${cleaned.slice(3)}`;
                }
                setPhoneNumber(formatted);
              }}
              keyboardType="phone-pad"
              maxLength={14}
            />
          </View>

          {!showVerification ? (
            <TouchableOpacity 
              style={[styles.button, (!firstName || !lastName || !phoneNumber) && styles.buttonDisabled]}
              onPress={completeProfileSetup}// Need to change before production
              disabled={!firstName || !lastName || !phoneNumber}
            >
              <Text style={styles.buttonText}>Complete Setup</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Enter Verification Code</Text>
                <TextInput
                  style={styles.setupInput}
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
              
              <TouchableOpacity 
                style={[styles.button, styles.verifyButton]}
                onPress={verifyCode}
              >
                <Text style={styles.buttonText}>Verify & Complete Setup</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={sendVerificationCode}>
                <Text style={styles.resendText}>Resend Code</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity 
            onPress={() => {
              setShowProfileSetup(false);
              setShowRoleSelection(true);
              setShowVerification(false);
              setCodeSent(false);
            }}
            style={styles.backButton}
          >
            <Text style={styles.backText}>← Back to Role Selection</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Show role selection screen
  if (user && showRoleSelection) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Choose Your Role</Text>
        <Text style={styles.subtitle}>Select your role to get started</Text>

        <TouchableOpacity 
          style={[styles.roleButton, styles.gcButton]} 
          onPress={() => handleRoleSelection('GC')}
        >
          <Text style={styles.roleTitle}>General Contractor</Text>
          <Text style={styles.roleDescription}>
            Create projects, invite subcontractors, manage schedules
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.roleButton, styles.subButton]} 
          onPress={() => handleRoleSelection('Sub')}
        >
          <Text style={styles.roleTitle}>Subcontractor</Text>
          <Text style={styles.roleDescription}>
            Manage your team of technicians, coordinate with GCs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.roleButton, styles.techButton]} 
          onPress={() => handleRoleSelection('Tech')}
        >
          <Text style={styles.roleTitle}>Technician</Text>
          <Text style={styles.roleDescription}>
            Join projects, receive schedules, communicate with team
          </Text>
        </TouchableOpacity>

        {/* Specialization Picker Modal */}
        <Modal
          visible={showSpecializationPicker}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity 
                  onPress={() => setShowSpecializationPicker(false)}
                  style={styles.pickerHeaderButton}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Select Your Trade</Text>
                <TouchableOpacity 
                  onPress={handleSpecializationConfirm}
                  style={styles.pickerHeaderButton}
                >
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
              
              <Picker
                selectedValue={selectedSpecialization}
                onValueChange={(itemValue) => setSelectedSpecialization(itemValue)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {tradeSpecializations.map((trade) => (
                  <Picker.Item 
                    key={trade} 
                    label={trade} 
                    value={trade}
                    color="#FFFFFF"
                  />
                ))}
              </Picker>
            </View>
          </View>
        </Modal>

        <StatusBar style="auto" />
      </View>
    );
  }

  // Show main dashboard if user is logged in with profile
  if (user && userProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome back, {userProfile.firstName}!</Text>
        <Text style={styles.subtitle}>
          {userProfile.displayName}
        </Text>
        {userProfile.companyName && (
          <Text style={styles.companyName}>{userProfile.companyName}</Text>
        )}
        {userProfile.specialization && (
          <Text style={styles.specializationBadge}>
            {userProfile.specialization}
          </Text>
        )}

        <View style={styles.dashboardContainer}>
          {userProfile.role === 'GC' && (
            <>
              <TouchableOpacity style={styles.dashboardButton}>
                <Text style={styles.dashboardButtonText}>Create New Project</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dashboardButton}>
                <Text style={styles.dashboardButtonText}>View My Projects</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dashboardButton}>
                <Text style={styles.dashboardButtonText}>Invite Subcontractors</Text>
              </TouchableOpacity>
            </>
          )}
          
          {userProfile.role === 'Sub' && (
            <>
              <TouchableOpacity style={styles.dashboardButton}>
                <Text style={styles.dashboardButtonText}>My Projects</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dashboardButton}>
                <Text style={styles.dashboardButtonText}>Manage Team</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dashboardButton}>
                <Text style={styles.dashboardButtonText}>Schedule View</Text>
              </TouchableOpacity>
            </>
          )}
          
          {userProfile.role === 'Tech' && (
            <>
              <TouchableOpacity style={styles.dashboardButton}>
                <Text style={styles.dashboardButtonText}>My Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dashboardButton}>
                <Text style={styles.dashboardButtonText}>Active Projects</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dashboardButton}>
                <Text style={styles.dashboardButtonText}>Messages</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <StatusBar style="auto" />
      </View>
    );
  }

  // Show login screen
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contractor App</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TouchableOpacity style={styles.button} onPress={handleAuth}>
        <Text style={styles.buttonText}>
          {isLogin ? 'Login' : 'Sign Up'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
        <Text style={styles.switchText}>
          {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
        </Text>
      </TouchableOpacity>
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchText: {
    color: '#007AFF',
    fontSize: 14,
  },
  // Role selection styles
  roleButton: {
    width: '100%',
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gcButton: {
    backgroundColor: '#FF6B35',
  },
  subButton: {
    backgroundColor: '#4ECDC4',
  },
  techButton: {
    backgroundColor: '#45B7D1',
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  roleDescription: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
    opacity: 0.9,
  },
  // Profile Setup styles
  setupContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  setupTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  setupSubtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 25,
    textAlign: 'center',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 25,
    width: '100%',
  },
  privacyIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  privacyText: {
    color: '#1A73E8',
    fontSize: 14,
    flex: 1,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
    position: 'relative',
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    fontWeight: '600',
  },
  setupInput: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  publicBadge: {
    position: 'absolute',
    right: 10,
    top: 42,
    backgroundColor: '#4CAF50',
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  privateBadge: {
    position: 'absolute',
    right: 10,
    top: 42,
    backgroundColor: '#9E9E9E',
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
  },
  resendText: {
    color: '#007AFF',
    fontSize: 14,
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  backButton: {
    marginTop: 20,
    padding: 10,
  },
  backText: {
    color: '#666',
    fontSize: 14,
  },
  // Specialization Picker styles (Apple-style dark theme)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#2C2C2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#48484A',
  },
  pickerHeaderButton: {
    padding: 5,
  },
  cancelText: {
    color: '#FF453A',
    fontSize: 17,
    fontWeight: '400',
  },
  doneText: {
    color: '#32D74B',
    fontSize: 17,
    fontWeight: '600',
  },
  pickerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  picker: {
    height: 220,
    backgroundColor: '#2C2C2E',
  },
  pickerItem: {
    fontSize: 20,
    height: 220,
    color: '#FFFFFF',
  },
  // Dashboard styles
  companyName: {
    fontSize: 14,
    color: '#888',
    marginTop: -25,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  specializationBadge: {
    backgroundColor: '#45B7D1',
    color: 'white',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 14,
    fontWeight: '600',
    marginTop: -20,
    marginBottom: 20,
  },
  dashboardContainer: {
    width: '100%',
    marginVertical: 20,
  },
  dashboardButton: {
    width: '100%',
    height: 50,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dashboardButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  signOutButton: {
    marginTop: 20,
    padding: 10,
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 16,
  },
});
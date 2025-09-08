import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import { validateEmail, validatePhone, formatPhone } from '../../utils/validation';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

export default function ProfileSetupScreen({ navigation, selectedRole, selectedSpecialization }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhoneDisplay = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return phone;
  };

  const completeProfileSetup = async () => {
    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing Information', 'Please enter your first and last name');
      return;
    }
    
    if (!phoneNumber || !validatePhone(phoneNumber)) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return;
    }
    
    if (selectedRole === 'Sub' && !companyName.trim()) {
      Alert.alert('Missing Company', 'Subcontractors must enter a company name');
      return;
    }

    setLoading(true);
    try {
      const userProfile = {
        uid: auth.currentUser.uid, // CRITICAL: Add this line!
        email: auth.currentUser.email,
        role: selectedRole,
        firstName: firstName,
        lastName: lastName,
        publicName: firstName, // Only first name is public
        phoneNumber: formatPhone(phoneNumber),
        phoneVerified: false, // Set to false since we're not verifying yet
        companyName: companyName || null,
        createdAt: new Date(),
        updatedAt: new Date(), // Also adding this for tracking
        displayName: selectedRole === 'GC' ? 'General Contractor' : 
                     selectedRole === 'Sub' ? 'Subcontractor' : 
                     `${selectedSpecialization} Technician`,
        ...(selectedRole === 'Tech' && { specialization: selectedSpecialization })
      };
      
      await setDoc(doc(db, 'users', auth.currentUser.uid), userProfile);
      
      console.log('Profile saved successfully');
      
      // Navigate to the appropriate dashboard based on role
      // The navigation stack will be replaced once profile is detected
      // But we help it along by navigating directly
      if (selectedRole === 'GC') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'GCDashboard' }],
        });
      } else if (selectedRole === 'Sub') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'SubDashboard' }],
        });
      } else if (selectedRole === 'Tech') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'TechDashboard' }],
        });
      }
      
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile: ' + error.message);
      setLoading(false);
    }
  };

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
            editable={!loading}
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
            editable={!loading}
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
              editable={!loading}
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
            editable={!loading}
          />
          <Text style={styles.phoneNote}>
            Phone verification coming soon
          </Text>
        </View>

        {selectedRole === 'Tech' && selectedSpecialization && (
          <View style={styles.specializationDisplay}>
            <Text style={styles.specializationLabel}>Your Trade Specialization:</Text>
            <Text style={styles.specializationValue}>{selectedSpecialization}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={completeProfileSetup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Setting up...' : 'Complete Setup'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          disabled={loading}
        >
          <Text style={styles.backText}>← Back to Role Selection</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  setupContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
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
  phoneNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  specializationDisplay: {
    width: '100%',
    backgroundColor: '#45B7D1',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  specializationLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginBottom: 4,
  },
  specializationValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
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
  backButton: {
    marginTop: 10,
    padding: 10,
  },
  backText: {
    color: '#666',
    fontSize: 14,
  },
});
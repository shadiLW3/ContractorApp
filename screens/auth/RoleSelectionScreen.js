import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';

export default function RoleSelectionScreen({ navigation, setSelectedRole, setSelectedSpecialization }) {
  const [showSpecializationPicker, setShowSpecializationPicker] = useState(false);
  const [tempSpecialization, setTempSpecialization] = useState('Electrician');

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

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    
    if (role === 'Tech') {
      // Show specialization picker for technicians
      setShowSpecializationPicker(true);
    } else {
      // Move to profile setup for GC and Sub
      navigation.navigate('ProfileSetup');
    }
  };

  const handleSpecializationConfirm = () => {
    setSelectedSpecialization(tempSpecialization);
    setShowSpecializationPicker(false);
    navigation.navigate('ProfileSetup');
  };

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
              selectedValue={tempSpecialization}
              onValueChange={(itemValue) => setTempSpecialization(itemValue)}
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
});
// Phone number validation (10 digits, formats: (555) 555-5555, 555-555-5555, 5555555555)
export const validatePhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };
  
  export const formatPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };
  
  // Email validation
  export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  // Time validation (HH:MM format, 24-hour)
  export const validateTime = (time) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };
  
  // Date validation (YYYY-MM-DD)
  export const validateDate = (date) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
  };
  
  // Format time input as user types
  export const formatTimeInput = (text) => {
    // Remove non-digits
    let cleaned = text.replace(/\D/g, '');
    
    // Add colon after 2 digits
    if (cleaned.length >= 3) {
      cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2, 4);
    }
    
    return cleaned;
  };
  
  // Format date input as user types
  export const formatDateInput = (text) => {
    // Remove non-digits
    let cleaned = text.replace(/\D/g, '');
    
    // Add dashes: YYYY-MM-DD
    if (cleaned.length >= 5) {
      cleaned = cleaned.slice(0, 4) + '-' + cleaned.slice(4, 6);
      if (cleaned.length >= 8) {
        cleaned = cleaned.slice(0, 7) + '-' + cleaned.slice(7, 9);
      }
    }
    
    return cleaned;
  };
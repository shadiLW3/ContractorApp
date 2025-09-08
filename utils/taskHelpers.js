// Task status options
export const TASK_STATUS = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    BLOCKED: 'blocked',
    COMPLETED: 'completed',
    VERIFIED: 'verified'
  };
  
  // Task priority levels
  export const TASK_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  };
  
  // Task categories for construction
  export const TASK_CATEGORIES = {
    GENERAL: 'General',
    ELECTRICAL: 'Electrical',
    PLUMBING: 'Plumbing',
    HVAC: 'HVAC',
    FRAMING: 'Framing',
    DRYWALL: 'Drywall',
    PAINTING: 'Painting',
    FLOORING: 'Flooring',
    ROOFING: 'Roofing',
    LANDSCAPING: 'Landscaping',
    INSPECTION: 'Inspection',
    PERMITS: 'Permits',
    CLEANUP: 'Cleanup',
    DELIVERY: 'Delivery',
    OTHER: 'Other'
  };
  
  // Get color for status
  export const getStatusColor = (status) => {
    switch (status) {
      case TASK_STATUS.NOT_STARTED:
        return '#9E9E9E';
      case TASK_STATUS.IN_PROGRESS:
        return '#2196F3';
      case TASK_STATUS.BLOCKED:
        return '#FF9800';
      case TASK_STATUS.COMPLETED:
        return '#4CAF50';
      case TASK_STATUS.VERIFIED:
        return '#00C853';
      default:
        return '#9E9E9E';
    }
  };
  
  // Get color for priority
  export const getPriorityColor = (priority) => {
    switch (priority) {
      case TASK_PRIORITY.LOW:
        return '#4CAF50';
      case TASK_PRIORITY.MEDIUM:
        return '#FFC107';
      case TASK_PRIORITY.HIGH:
        return '#FF9800';
      case TASK_PRIORITY.URGENT:
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };
  
  // Calculate task progress percentage
  export const calculateTaskProgress = (tasks) => {
    if (!tasks || tasks.length === 0) return 0;
    
    const completed = tasks.filter(t => 
      t.status === TASK_STATUS.COMPLETED || 
      t.status === TASK_STATUS.VERIFIED
    ).length;
    
    return Math.round((completed / tasks.length) * 100);
  };
  
  // Check if task is overdue
  export const isTaskOverdue = (task) => {
    if (!task.dueDate) return false;
    if (task.status === TASK_STATUS.COMPLETED || 
        task.status === TASK_STATUS.VERIFIED) return false;
    
    const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    return dueDate < new Date();
  };
  
  // Format task due date
  export const formatTaskDueDate = (dueDate) => {
    if (!dueDate) return 'No due date';
    
    const date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Reset times for comparison
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    if (compareDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (compareDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else if (compareDate < today) {
      const daysOverdue = Math.floor((today - compareDate) / (1000 * 60 * 60 * 24));
      return `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };
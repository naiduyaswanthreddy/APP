import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, writeBatch, getDoc } from 'firebase/firestore';
import { logEventActivity } from '../../utils/activityLogger';
import { db, auth } from '../../firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar as CalendarIcon, Clock, MapPin, Briefcase, Plus, X, Download, Share2, AlertTriangle } from 'react-feather';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Select from 'react-select';
import { createAnnouncementNotification, createEventNotification, createSystemAlertNotification, createReminderNotification } from '../../utils/notificationHelpers';
import { collection as col, getDocs as gDocs, orderBy as oBy, query as qy } from 'firebase/firestore';

const localizer = momentLocalizer(moment);

const AdminCalendar = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    start: new Date(),
    end: new Date(),
    location: '',
    notes: '',
    type: 'company-visit',
    attachments: [],
    isRecurring: false,
    recurringDays: [],
    jobId: '',
    targetAudience: 'all',
    eligibleDepartments: [],
    eligibleBatch: [],
    selectedJobs: [],
    notifyStudents: true,
    notifyChanges: true
  });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());
  const [filter, setFilter] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [newAttachment, setNewAttachment] = useState({ name: '', link: '' });
  const [conflicts, setConflicts] = useState([]);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [departments] = useState(['CSE', 'ECE', 'ME', 'CE', 'EE']); // Example departments
  const [batches] = useState(['2023', '2024', '2025', '2026']); // Example batches

  // Fetch events and jobs from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all jobs
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const jobsData = jobsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setJobs(jobsData);
        setAvailableJobs(jobsData.map(job => ({
          value: job.id,
          label: `${job.id} - ${job.company} (${job.position})`
        })));

        // Fetch custom events
        const eventsSnapshot = await getDocs(collection(db, 'events'));
        const customEvents = eventsSnapshot.docs.map(doc => {
          const event = doc.data();
          return {
            id: doc.id,
            title: event.title,
            start: event.start.toDate ? event.start.toDate() : new Date(event.start),
            end: event.end.toDate ? event.end.toDate() : new Date(event.end),
            location: event.location || '',
            notes: event.notes || '',
            type: event.type || 'custom',
            attachments: event.attachments || [],
            color: event.color || '#4CAF50',
            targetAudience: event.targetAudience || 'all',
            eligibleDepartments: event.eligibleDepartments || [],
            eligibleBatch: event.eligibleBatch || [],
            selectedJobs: event.selectedJobs || [],
            notifyStudents: event.notifyStudents !== undefined ? event.notifyStudents : true
          };
        });

        // Create events from job dates
        const jobEvents = [];
        jobsData.forEach(job => {
          if (job.deadline) {
            const deadlineDate = job.deadline.toDate ? job.deadline.toDate() : new Date(job.deadline);
            jobEvents.push({
              id: `deadline-${job.id}`,
              title: `Deadline: ${job.position} at ${job.company}`,
              start: deadlineDate,
              end: deadlineDate,
              type: 'deadline',
              jobId: job.id,
              allDay: true,
              color: '#FF5722',
              targetAudience: 'job',
              selectedJobs: [job.id]
            });
          }
          if (job.dateOfVisit) {
            const visitDate = job.dateOfVisit.toDate ? job.dateOfVisit.toDate() : new Date(job.dateOfVisit);
            jobEvents.push({
              id: `visit-${job.id}`,
              title: `${job.company} - ${job.position} (${job.modeOfVisit || 'Visit'})`,
              start: visitDate,
              end: visitDate,
              type: 'company-visit',
              jobId: job.id,
              allDay: false,
              color: '#2196F3',
              location: job.location || 'Not specified',
              targetAudience: 'job',
              selectedJobs: [job.id]
            });
          }
          if (job.prePlacementTalkDate) {
            const talkDate = job.prePlacementTalkDate.toDate ? job.prePlacementTalkDate.toDate() : new Date(job.prePlacementTalkDate);
            jobEvents.push({
              id: `talk-${job.id}`,
              title: `Pre-Placement Talk: ${job.company}`,
              start: talkDate,
              end: talkDate,
              type: 'pre-placement-talk',
              jobId: job.id,
              allDay: false,
              color: '#9C27B0',
              location: job.prePlacementTalkLocation || 'Not specified',
              targetAudience: 'job',
              selectedJobs: [job.id]
            });
          }
        });

        // Combine all events
        const allEvents = [...jobEvents, ...customEvents];
        setEvents(allEvents);

        // Check for conflicts
        checkForConflicts(allEvents);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load calendar data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Check for scheduling conflicts
  const checkForConflicts = (events) => {
    const conflicts = [];
    const eventsByDate = {};

    events.forEach(event => {
      const dateKey = moment(event.start).format('YYYY-MM-DD');
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    });

    Object.keys(eventsByDate).forEach(dateKey => {
      const dateEvents = eventsByDate[dateKey];
      if (dateEvents.length > 1) {
        for (let i = 0; i < dateEvents.length; i++) {
          for (let j = i + 1; j < dateEvents.length; j++) {
            const event1 = dateEvents[i];
            const event2 = dateEvents[j];

            if (!event1.allDay && !event2.allDay) {
              const start1 = new Date(event1.start);
              const end1 = new Date(event1.end);
              const start2 = new Date(event2.start);
              const end2 = new Date(event2.end);
              if (end1 <= start2 || end2 <= start1) continue;
            }

            const isOverlap = (event1.targetAudience === 'all' || event2.targetAudience === 'all') ||
              (event1.targetAudience === 'specific' && event2.targetAudience === 'specific' &&
                (event1.eligibleDepartments.some(dept => event2.eligibleDepartments.includes(dept)) ||
                 event1.eligibleBatch.some(batch => event2.eligibleBatch.includes(batch)))) ||
              (event1.targetAudience === 'job' && event2.targetAudience === 'job' &&
                event1.selectedJobs.some(job => event2.selectedJobs.includes(job)));

            if (isOverlap) {
              conflicts.push({
                date: dateKey,
                events: [event1, event2],
                message: `Conflict: "${event1.title}" and "${event2.title}" overlap on ${moment(dateKey).format('MMM D, YYYY')}`
              });
            }
          }
        }
      }
    });

    setConflicts(conflicts);
    if (conflicts.length > 0) {
      toast.warning(`Found ${conflicts.length} scheduling conflicts`);
    }
  };

  // Handle event selection
  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  // Handle initiating event edit
  const handleEditEvent = () => {
    setEditEvent({ ...selectedEvent });
    setShowEditEventModal(true);
    setShowEventModal(false);
  };

  // Handle adding a new event
  const handleAddEvent = async () => {
    try {
      if (!newEvent.title) {
        toast.error('Please enter a title for the event');
        return;
      }
      if (newEvent.end < newEvent.start) {
        toast.error('End date cannot be before start date');
        return;
      }

      const eventData = {
        title: newEvent.title,
        start: newEvent.start,
        end: newEvent.end,
        location: newEvent.location,
        notes: newEvent.notes,
        type: newEvent.type,
        attachments: newEvent.attachments,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'anonymous',
        color: getColorForEventType(newEvent.type),
        targetAudience: newEvent.targetAudience,
        eligibleDepartments: newEvent.targetAudience === 'specific' ? newEvent.eligibleDepartments : [],
        eligibleBatch: newEvent.targetAudience === 'specific' ? newEvent.eligibleBatch : [],
        selectedJobs: newEvent.targetAudience === 'job' ? newEvent.selectedJobs : [],
        notifyStudents: newEvent.notifyStudents
      };

      if (newEvent.notifyStudents) {
        await sendEventNotifications(eventData);
      }

      if (newEvent.isRecurring && newEvent.recurringDays.length > 0) {
        const recurringEvents = [];
        newEvent.recurringDays.forEach((day, index) => {
          const startDate = new Date(newEvent.start);
          startDate.setDate(startDate.getDate() + day);
          const endDate = new Date(newEvent.end);
          endDate.setDate(endDate.getDate() + day);
          recurringEvents.push({
            ...eventData,
            title: `${newEvent.title} (Day ${index + 1})`,
            start: startDate,
            end: endDate,
            recurringGroupId: Date.now().toString()
          });
        });

        for (const event of recurringEvents) {
          const ref = await addDoc(collection(db, 'events'), event);
          await logEventActivity(ref.id, 'create', { title: event.title, type: event.type });
        }

        const newEvents = recurringEvents.map((event, index) => ({
          ...event,
          id: `temp-${Date.now()}-${index}`
        }));
        setEvents([...events, ...newEvents]);
        toast.success('Recurring events added successfully');
      } else {
        const docRef = await addDoc(collection(db, 'events'), eventData);
        await logEventActivity(docRef.id, 'create', { title: eventData.title, type: eventData.type });
        setEvents([...events, { id: docRef.id, ...eventData }]);
        toast.success('Event added successfully');
      }

      setNewEvent({
        title: '',
        start: new Date(),
        end: new Date(),
        location: '',
        notes: '',
        type: 'company-visit',
        attachments: [],
        isRecurring: false,
        recurringDays: [],
        jobId: '',
        targetAudience: 'all',
        eligibleDepartments: [],
        eligibleBatch: [],
        selectedJobs: [],
        notifyStudents: true,
        notifyChanges: true
      });
      setShowAddEventModal(false);
      checkForConflicts([...events]);
    } catch (error) {
      console.error('Error adding event:', error);
      toast.error('Failed to add event');
    }
  };

  // Handle updating an event
  const handleUpdateEvent = async () => {
    try {
      if (!editEvent || !editEvent.id) return;
      if (editEvent.end < editEvent.start) {
        toast.error('End date cannot be before start date');
        return;
      }

      if (editEvent.id.startsWith('deadline-') || editEvent.id.startsWith('visit-') || editEvent.id.startsWith('talk-')) {
        toast.info('Job-related events must be updated from the job posting page');
        setShowEditEventModal(false);
        return;
      }

      const eventRef = doc(db, 'events', editEvent.id);
      const updateData = {
        title: editEvent.title,
        start: editEvent.start,
        end: editEvent.end,
        location: editEvent.location,
        notes: editEvent.notes,
        type: editEvent.type,
        attachments: editEvent.attachments,
        targetAudience: editEvent.targetAudience,
        eligibleDepartments: editEvent.targetAudience === 'specific' ? editEvent.eligibleDepartments : [],
        eligibleBatch: editEvent.targetAudience === 'specific' ? editEvent.eligibleBatch : [],
        selectedJobs: editEvent.targetAudience === 'job' ? editEvent.selectedJobs : [],
        notifyStudents: editEvent.notifyStudents,
        updatedAt: serverTimestamp()
      };

      await updateDoc(eventRef, updateData);
      await logEventActivity(editEvent.id, 'update', { title: updateData.title, type: updateData.type });
      if (editEvent.notifyChanges && editEvent.notifyStudents) {
        await sendEventNotifications({ ...updateData, id: editEvent.id });
      }

      setEvents(events.map(event => event.id === editEvent.id ? { ...editEvent, ...updateData } : event));
      toast.success('Event updated successfully');
      setShowEditEventModal(false);
      checkForConflicts([...events]);
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
    }
  };

  // Handle deleting an event
  const handleDeleteEvent = async () => {
    try {
      if (!selectedEvent || !selectedEvent.id) return;
      if (selectedEvent.id.startsWith('deadline-') || selectedEvent.id.startsWith('visit-') || selectedEvent.id.startsWith('talk-')) {
        toast.info('Job-related events must be deleted from the job posting page');
        setShowEventModal(false);
        return;
      }

      await deleteDoc(doc(db, 'events', selectedEvent.id));
      await logEventActivity(selectedEvent.id, 'delete', { title: selectedEvent.title, type: selectedEvent.type });
      setEvents(events.filter(event => event.id !== selectedEvent.id));
      toast.success('Event deleted successfully');
      setShowEventModal(false);
      checkForConflicts([...events.filter(event => event.id !== selectedEvent.id)]);
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  // Handle adding attachment
  const handleAddAttachment = (isEdit = false) => {
    if (!newAttachment.name || !newAttachment.link) {
      toast.error('Please provide both name and link for the attachment');
      return;
    }

    const updatedAttachments = isEdit
      ? [...(editEvent.attachments || []), newAttachment]
      : [...(newEvent.attachments || []), newAttachment];

    if (isEdit) {
      setEditEvent({ ...editEvent, attachments: updatedAttachments });
    } else {
      setNewEvent({ ...newEvent, attachments: updatedAttachments });
    }
    setNewAttachment({ name: '', link: '' });
  };

  // Handle removing attachment
  const handleRemoveAttachment = (index, isEdit = false) => {
    const updatedAttachments = isEdit ? [...editEvent.attachments] : [...newEvent.attachments];
    updatedAttachments.splice(index, 1);
    if (isEdit) {
      setEditEvent({ ...editEvent, attachments: updatedAttachments });
    } else {
      setNewEvent({ ...newEvent, attachments: updatedAttachments });
    }
  };

  // Get color for event type
  const getColorForEventType = (type) => {
    switch (type) {
      case 'company-visit': return '#2196F3';
      case 'pre-placement-talk': return '#9C27B0';
      case 'deadline': return '#FF5722';
      case 'test': return '#FFC107';
      case 'result': return '#4CAF50';
      default: return '#607D8B';
    }
  };

  const EventLogs = ({ eventId }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
      const run = async () => {
        try {
          setLoading(true);
          const ref = col(db, 'events', eventId, 'logs');
          const qq = qy(ref, oBy('timestamp', 'desc'));
          const snap = await gDocs(qq);
          setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          // ignore
        } finally {
          setLoading(false);
        }
      };
      if (eventId) run();
    }, [eventId]);
    if (!eventId) return null;
    return (
      <div className="mt-4">
        <p className="text-sm text-gray-500 mb-1">Activity Logs</p>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-gray-400">No logs found.</p>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {logs.map(l => (
              <li key={l.id} className="text-xs text-gray-700">
                <span className="font-medium">{l.action}</span> by {l.actorEmail || l.actorId} at {l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString() : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // Filter events based on selected filter
  const filteredEvents = filter === 'all'
    ? events
    : events.filter(event => event.type === filter);

  // Export calendar to PDF
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Placement Calendar', 14, 22);
      doc.setFontSize(12);
      doc.text(`Generated on ${moment().format('MMMM D, YYYY')}`, 14, 30);

      const tableColumn = ['Date', 'Time', 'Event', 'Type', 'Location'];
      const tableRows = [];

      const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
      sortedEvents.forEach(event => {
        const dateStr = moment(event.start).format('MMM D, YYYY');
        const timeStr = event.allDay ? 'All Day' : `${moment(event.start).format('h:mm A')} - ${moment(event.end).format('h:mm A')}`;
        tableRows.push([
          dateStr,
          timeStr,
          event.title,
          event.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          event.location || 'N/A'
        ]);
      });

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 30 }, 2: { cellWidth: 60 } }
      });

      if (conflicts.length > 0) {
        const finalY = doc.lastAutoTable.finalY || 40;
        doc.setFontSize(14);
        doc.text('Scheduling Conflicts', 14, finalY + 15);
        doc.setFontSize(10);
        conflicts.forEach((conflict, index) => {
          doc.text(conflict.message, 14, finalY + 25 + (index * 10));
        });
      }

      doc.save('placement_calendar.pdf');
      toast.success('Calendar exported to PDF');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error('Failed to export calendar');
    }
  };

  // Generate shareable link
  const generateShareableLink = () => {
    try {
      toast.info('Shareable link feature would be implemented here');
    } catch (error) {
      console.error('Error generating link:', error);
      toast.error('Failed to generate shareable link');
    }
  };

  // Send event notifications
  const sendEventNotifications = async (eventData) => {
    try {
      let title = `New Event: ${eventData.title}`;
      let message = `Event: ${eventData.title}`;
      
      if (eventData.notes) {
        message += `\n${eventData.notes}`;
      }
      
      if (eventData.location) {
        message += `\nLocation: ${eventData.location}`;
      }

      // Read admin preference for emailing on event updates
      let sendEmail = false;
      try {
        const adminPrefsDoc = await getDoc(doc(db, 'adminPreferences', auth.currentUser?.uid || 'global'));
        sendEmail = !!adminPrefsDoc.data()?.emailOnEventNotifications;
      } catch {}

      if (eventData.targetAudience === 'all') {
        // Notify all students
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        for (const s of studentsSnapshot.docs) {
          await createEventNotification(s.id, title, message, '/student/calendar', sendEmail);
        }
      } else if (eventData.targetAudience === 'job' && eventData.selectedJobs.length > 0) {
        const applicationsSnapshot = await getDocs(
          query(collection(db, 'applications'), where('jobId', 'in', eventData.selectedJobs))
        );
        const processedStudents = new Set();
        applicationsSnapshot.docs.forEach(doc => {
          const studentId = doc.data().studentId;
          if (!processedStudents.has(studentId)) {
            createEventNotification(studentId, title, message, '/student/calendar', sendEmail);
            processedStudents.add(studentId);
          }
        });
      } else if (eventData.targetAudience === 'specific') {
        let studentsQuery = query(collection(db, 'students'));
        if (eventData.eligibleBatch.length > 0) {
          studentsQuery = query(studentsQuery, where('batch', 'in', eventData.eligibleBatch));
        }
        const studentsSnapshot = await getDocs(studentsQuery);
        const eligibleStudents = studentsSnapshot.docs.filter(doc => {
          const studentData = doc.data();
          return eventData.eligibleDepartments.length === 0 || eventData.eligibleDepartments.includes(studentData.department);
        });
        eligibleStudents.forEach(doc => {
          createEventNotification(doc.id, title, message, '/student/calendar', sendEmail);
        });
      }

      // Send admin notification about the event creation
      try {
        await createSystemAlertNotification(
          'Event Created',
          `New event "${eventData.title}" has been created and notifications sent to eligible students.`,
          '/admin/calendar'
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Event notifications sent to eligible students');
    } catch (error) {
      console.error('Error sending notifications:', error);
      toast.error('Failed to send notifications');
    }
  };

  // Check for approaching deadlines and send reminders
  const checkDeadlinesAndSendReminders = async () => {
    try {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Check job deadlines
      const jobsSnapshot = await getDocs(collection(db, 'jobs'));
      jobsSnapshot.docs.forEach(jobDoc => {
        const job = jobDoc.data();
        if (job.deadline) {
          const deadline = job.deadline.toDate ? job.deadline.toDate() : new Date(job.deadline);
          const timeUntilDeadline = deadline - now;
          
          // Send reminder 1 day before deadline
          if (timeUntilDeadline > 0 && timeUntilDeadline <= 24 * 60 * 60 * 1000) {
            // Send to all students
            createReminderNotification(
              'all', // This will be handled by the helper to send to all students
              'Deadline Approaching',
              `Application deadline for ${job.position} at ${job.company} is tomorrow! Don't miss this opportunity.`,
              `/student/jobpost`
            );
          }
          
          // Send reminder 3 days before deadline
          if (timeUntilDeadline > 24 * 60 * 60 * 1000 && timeUntilDeadline <= 3 * 24 * 60 * 60 * 1000) {
            createReminderNotification(
              'all',
              'Deadline Reminder',
              `Application deadline for ${job.position} at ${job.company} is in 3 days. Apply now!`,
              `/student/jobpost`
            );
          }
        }
      });

      // Check event deadlines
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      eventsSnapshot.docs.forEach(eventDoc => {
        const event = eventDoc.data();
        if (event.start) {
          const eventStart = event.start.toDate ? event.start.toDate() : new Date(event.start);
          const timeUntilEvent = eventStart - now;
          
          // Send reminder 1 day before event
          if (timeUntilEvent > 0 && timeUntilEvent <= 24 * 60 * 60 * 1000) {
            createReminderNotification(
              'all',
              'Event Tomorrow',
              `Event "${event.title}" is tomorrow! Don't forget to attend.`,
              '/student/calendar'
            );
          }
        }
      });

    } catch (error) {
      console.error('Error checking deadlines:', error);
    }
  };

  // Set up deadline checking interval
  useEffect(() => {
    // Check deadlines every hour
    const interval = setInterval(checkDeadlinesAndSendReminders, 60 * 60 * 1000);
    
    // Initial check
    checkDeadlinesAndSendReminders();
    
    return () => clearInterval(interval);
  }, []);

  // Handle event drag and drop
  const onEventDrop = ({ event, start, end }) => {
    if (event.id.startsWith('deadline-') || event.id.startsWith('visit-') || event.id.startsWith('talk-')) {
      toast.info('Job-related events must be rescheduled from the job posting page');
      return;
    }

    setEditEvent({ ...event, start, end });
    setShowEditEventModal(true);
  };

  // Custom event styling
  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: event.color || '#3174ad',
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  // Enable dragging for non-job-related events
  const draggableAccessor = (event) => {
    return !event.id.startsWith('deadline-') && !event.id.startsWith('visit-') && !event.id.startsWith('talk-');
  };

  // Render Target Audience section
  const renderTargetAudienceSection = (isEdit = false, state, setState) => {
    const targetAudience = isEdit ? state.targetAudience : state.targetAudience;
    const eligibleDepartments = isEdit ? state.eligibleDepartments : state.eligibleDepartments;
    const eligibleBatch = isEdit ? state.eligibleBatch : state.eligibleBatch;
    const selectedJobs = isEdit ? state.selectedJobs : state.selectedJobs;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
          <select
            value={targetAudience}
            onChange={(e) => setState({ ...state, targetAudience: e.target.value, eligibleDepartments: [], eligibleBatch: [], selectedJobs: [] })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Students</option>
            <option value="specific">Specific Branches/Batches</option>
            <option value="job">Specific Job Posting</option>
          </select>
        </div>
        {targetAudience === 'specific' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Eligible Departments</label>
              <Select
                isMulti
                options={departments.map(dept => ({ value: dept, label: dept }))}
                value={eligibleDepartments.map(dept => ({ value: dept, label: dept }))}
                onChange={(selected) => setState({ ...state, eligibleDepartments: selected.map(opt => opt.value) })}
                placeholder="Select departments..."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Eligible Batches</label>
              <Select
                isMulti
                options={batches.map(batch => ({ value: batch, label: batch }))}
                value={eligibleBatch.map(batch => ({ value: batch, label: batch }))}
                onChange={(selected) => setState({ ...state, eligibleBatch: selected.map(opt => opt.value) })}
                placeholder="Select batches..."
                className="w-full"
              />
            </div>
          </>
        )}
        {targetAudience === 'job' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Jobs</label>
            <Select
              isMulti
              options={[{ value: 'all', label: 'All Jobs' }, ...availableJobs]}
              value={selectedJobs.map(jobId => availableJobs.find(job => job.value === jobId) || { value: jobId, label: jobId })}
              onChange={(selected) => setState({ ...state, selectedJobs: selected.map(opt => opt.value) })}
              placeholder="Search and select jobs..."
              className="w-full"
            />
          </div>
        )}
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isEdit ? state.notifyStudents : state.notifyStudents}
            onChange={(e) => setState({ ...state, notifyStudents: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 text-sm text-gray-700">Notify Students</label>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isEdit ? state.notifyChanges : state.notifyChanges}
            onChange={(e) => setState({ ...state, notifyChanges: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 text-sm text-gray-700">Notify Students of Changes</label>
        </div>
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto px-4 py-8">
        <ToastContainer />
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Placement Calendar Management</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAddEventModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <Plus size={16} className="mr-2" />
              Add Event
            </button>
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <Download size={16} className="mr-2" />
              Export PDF
            </button>
            {/* <button
              onClick={generateShareableLink}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center"
            >
              <Share2 size={16} className="mr-2" />
              Share View
            </button> */}
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
            <div className="flex items-start">
              <AlertTriangle size={20} className="text-yellow-600 mr-3 mt-0.5" />
              <div>
                <h3 className="text-lg font-medium text-yellow-800">Scheduling Conflicts Detected</h3>
                <div className="mt-2 text-sm text-yellow-700 max-h-40 overflow-y-auto">
                  <ul className="list-disc pl-5 space-y-1">
                    {conflicts.map((conflict, index) => (
                      <li key={index}>{conflict.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-sm ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilter('company-visit')}
            className={`px-3 py-1 rounded-full text-sm ${filter === 'company-visit' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}
          >
            Company Visits
          </button>
          <button
            onClick={() => setFilter('pre-placement-talk')}
            className={`px-3 py-1 rounded-full text-sm ${filter === 'pre-placement-talk' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'}`}
          >
            Pre-Placement Talks
          </button>
          <button
            onClick={() => setFilter('deadline')}
            className={`px-3 py-1 rounded-full text-sm ${filter === 'deadline' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'}`}
          >
            Deadlines
          </button>
          <button
            onClick={() => setFilter('test')}
            className={`px-3 py-1 rounded-full text-sm ${filter === 'test' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`}
          >
            Tests
          </button>
          <button
            onClick={() => setFilter('result')}
            className={`px-3 py-1 rounded-full text-sm ${filter === 'result' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'}`}
          >
            Results
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-4 flex justify-between items-center">
            <div className="flex space-x-2">
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1 rounded-md text-sm ${view === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                Month
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1 rounded-md text-sm ${view === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                Week
              </button>
              <button
                onClick={() => setView('day')}
                className={`px-3 py-1 rounded-md text-sm ${view === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                Day
              </button>
              <button
                onClick={() => setView('agenda')}
                className={`px-3 py-1 rounded-md text-sm ${view === 'agenda' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                Agenda
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setDate(new Date())}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md text-sm hover:bg-gray-300 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const newDate = new Date(date);
                  newDate.setMonth(newDate.getMonth() - 1);
                  setDate(newDate);
                }}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                &lt;
              </button>
              <button
                onClick={() => {
                  const newDate = new Date(date);
                  newDate.setMonth(newDate.getMonth() + 1);
                  setDate(newDate);
                }}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                &gt;
              </button>
              <span className="text-lg font-medium">
                {moment(date).format('MMMM YYYY')}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="h-[600px]">
              <Calendar
                localizer={localizer}
                events={filteredEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                popup
                selectable
                onEventDrop={onEventDrop}
                draggableAccessor={draggableAccessor}
                resizable
              />
            </div>
          )}
        </div>

        {selectedEvent && showEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">{selectedEvent.title}</h3>
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <Clock size={18} className="mr-3 text-gray-500 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500">Date & Time</p>
                      <p>
                        {moment(selectedEvent.start).format('MMM D, YYYY')}
                        {!selectedEvent.allDay && (
                          <> • {moment(selectedEvent.start).format('h:mm A')} - {moment(selectedEvent.end).format('h:mm A')}</>
                        )}
                      </p>
                    </div>
                  </div>
                  {selectedEvent.location && (
                    <div className="flex items-start">
                      <MapPin size={18} className="mr-3 text-gray-500 mt-1" />
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <p>{selectedEvent.location}</p>
                      </div>
                    </div>
                  )}
                  {selectedEvent.notes && (
                    <div className="flex items-start">
                      <div className="mr-3 text-gray-500 mt-1">📝</div>
                      <div>
                        <p className="text-sm text-gray-500">Notes</p>
                        <p>{selectedEvent.notes}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start">
                    <Briefcase size={18} className="mr-3 text-gray-500 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500">Event Type</p>
                      <p className="capitalize">{selectedEvent.type.replace(/-/g, ' ')}</p>
                    </div>
                  </div>
                  {/* Event Logs */}
                  <EventLogs eventId={selectedEvent.id} />
                  {selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
                    <div className="flex items-start">
                      <div className="mr-3 text-gray-500 mt-1">📎</div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500">Attachments</p>
                        <div className="space-y-2 mt-2">
                          {selectedEvent.attachments.map((attachment, index) => (
                            <a
                              key={index}
                              href={attachment.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            >
                              <Download size={16} className="mr-2" />
                              {attachment.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Target Audience</p>
                    <p>{selectedEvent.targetAudience === 'all' ? 'All Students' :
                         selectedEvent.targetAudience === 'specific' ? `Specific: ${selectedEvent.eligibleDepartments.join(', ')} (${selectedEvent.eligibleBatch.join(', ')})` :
                         `Job-Specific: ${selectedEvent.selectedJobs.join(', ')}`}</p>
                  </div>
                </div>
                <div className="mt-6 flex justify-between">
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                  <div className="flex space-x-2">
                    {!selectedEvent.id.startsWith('deadline-') && !selectedEvent.id.startsWith('visit-') && !selectedEvent.id.startsWith('talk-') && (
                      <>
                        <button
                          onClick={handleEditEvent}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={handleDeleteEvent}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAddEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Add New Event</h2>
                  <button
                    onClick={() => setShowAddEventModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
                    <input
                      type="text"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter event title"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                      <DatePicker
                        selected={newEvent.start}
                        onChange={(date) => setNewEvent({ ...newEvent, start: date })}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MMMM d, yyyy h:mm aa"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                      <DatePicker
                        selected={newEvent.end}
                        onChange={(date) => setNewEvent({ ...newEvent, end: date })}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MMMM d, yyyy h:mm aa"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter event location"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                    <select
                      value={newEvent.type}
                      onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="company-visit">Company Visit</option>
                      <option value="pre-placement-talk">Pre-Placement Talk</option>
                      <option value="deadline">Application Deadline</option>
                      <option value="workshop">Workshop</option>
                      <option value="seminar">Seminar</option>
                      <option value="training">Training</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={newEvent.notes}
                      onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                      placeholder="Enter any additional notes"
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                    <div className="space-y-2">
                      {newEvent.attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center">
                          <input
                            type="text"
                            value={attachment.name}
                            onChange={(e) => {
                              const updatedAttachments = [...newEvent.attachments];
                              updatedAttachments[index].name = e.target.value;
                              setNewEvent({ ...newEvent, attachments: updatedAttachments });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Attachment name"
                          />
                          <input
                            type="text"
                            value={attachment.link}
                            onChange={(e) => {
                              const updatedAttachments = [...newEvent.attachments];
                              updatedAttachments[index].link = e.target.value;
                              setNewEvent({ ...newEvent, attachments: updatedAttachments });
                            }}
                            className="flex-1 px-3 py-2 border-t border-b border-r border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="URL link"
                          />
                          <button
                            onClick={() => handleRemoveAttachment(index)}
                            className="px-3 py-2 bg-red-600 text-white rounded-r-md hover:bg-red-700 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={newAttachment.name}
                          onChange={(e) => setNewAttachment({ ...newAttachment, name: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Attachment name"
                        />
                        <input
                          type="text"
                          value={newAttachment.link}
                          onChange={(e) => setNewAttachment({ ...newAttachment, link: e.target.value })}
                          className="flex-1 px-3 py-2 border-t border-b border-r border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="URL link"
                        />
                        <button
                          onClick={() => handleAddAttachment()}
                          className="px-3 py-2 bg-green-600 text-white rounded-r-md hover:bg-green-700 transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {renderTargetAudienceSection(false, newEvent, setNewEvent)}
                  <div className="mt-6 flex justify-end space-x-2">
                    <button
                      onClick={() => setShowAddEventModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddEvent}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Add Event
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showEditEventModal && editEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Edit Event</h2>
                  <button
                    onClick={() => setShowEditEventModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
                    <input
                      type="text"
                      value={editEvent.title}
                      onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter event title"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                      <DatePicker
                        selected={editEvent.start}
                        onChange={(date) => setEditEvent({ ...editEvent, start: date })}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MMMM d, yyyy h:mm aa"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                      <DatePicker
                        selected={editEvent.end}
                        onChange={(date) => setEditEvent({ ...editEvent, end: date })}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MMMM d, yyyy h:mm aa"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={editEvent.location}
                      onChange={(e) => setEditEvent({ ...editEvent, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter event location"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                    <select
                      value={editEvent.type}
                      onChange={(e) => setEditEvent({ ...editEvent, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="company-visit">Company Visit</option>
                      <option value="pre-placement-talk">Pre-Placement Talk</option>
                      <option value="deadline">Application Deadline</option>
                      <option value="workshop">Workshop</option>
                      <option value="seminar">Seminar</option>
                      <option value="training">Training</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={editEvent.notes}
                      onChange={(e) => setEditEvent({ ...editEvent, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                      placeholder="Enter any additional notes"
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                    <div className="space-y-2">
                      {editEvent.attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center">
                          <input
                            type="text"
                            value={attachment.name}
                            onChange={(e) => {
                              const updatedAttachments = [...editEvent.attachments];
                              updatedAttachments[index].name = e.target.value;
                              setEditEvent({ ...editEvent, attachments: updatedAttachments });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Attachment name"
                          />
                          <input
                            type="text"
                            value={attachment.link}
                            onChange={(e) => {
                              const updatedAttachments = [...editEvent.attachments];
                              updatedAttachments[index].link = e.target.value;
                              setEditEvent({ ...editEvent, attachments: updatedAttachments });
                            }}
                            className="flex-1 px-3 py-2 border-t border-b border-r border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="URL link"
                          />
                          <button
                            onClick={() => handleRemoveAttachment(index, true)}
                            className="px-3 py-2 bg-red-600 text-white rounded-r-md hover:bg-red-700 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={newAttachment.name}
                          onChange={(e) => setNewAttachment({ ...newAttachment, name: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Attachment name"
                        />
                        <input
                          type="text"
                          value={newAttachment.link}
                          onChange={(e) => setNewAttachment({ ...newAttachment, link: e.target.value })}
                          className="flex-1 px-3 py-2 border-t border-b border-r border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="URL link"
                        />
                        <button
                          onClick={() => handleAddAttachment(true)}
                          className="px-3 py-2 bg-green-600 text-white rounded-r-md hover:bg-green-700 transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {renderTargetAudienceSection(true, editEvent, setEditEvent)}
                  <div className="mt-6 flex justify-end space-x-2">
                    <button
                      onClick={() => setShowEditEventModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateEvent}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Update Event
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl w-80 z-40">
            <div className="p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold flex items-center">
                  <AlertTriangle size={18} className="text-amber-500 mr-2" />
                  Scheduling Conflicts
                </h3>
                <button
                  onClick={() => setConflicts([])}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="p-2 text-sm border-b border-gray-200 last:border-b-0">
                    {conflict.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
};

export default AdminCalendar;
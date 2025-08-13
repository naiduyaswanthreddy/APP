import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, doc, onSnapshot, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { toast } from "react-toastify";
import { Send, X, Bell, BellOff } from 'lucide-react';
import { createJobPostingNotification, createChatMessageNotification } from '../../utils/notificationHelpers';
import LoadingSpinner from '../ui/LoadingSpinner';

const JobChat = ({ selectedJob, onClose }) => {
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const messagesEndRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Load messages on component mount
  useEffect(() => {
    const loadMessagesAndSetStatus = async () => {
      if (!selectedJob || !auth.currentUser) {
        setLoading(false);
        return;
      }
      
      try {
        // Mark as joined in the database if not already
        await ensureJoinedStatus();
        
        // Load messages
        await loadChatMessages();
        setLoading(false);
      } catch (error) {
        console.error("Error loading chat:", error);
        setLoading(false);
      }
    };
    
    loadMessagesAndSetStatus();
    
    // Cleanup function to unsubscribe from listeners when component unmounts
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [selectedJob]);

  // Ensure the user is marked as joined in the database
  const ensureJoinedStatus = async () => {
    if (!selectedJob || !auth.currentUser) return;
    
    try {
      const applicationsRef = collection(db, "applications");
      const q = query(
        applicationsRef, 
        where("student_id", "==", auth.currentUser.uid),
        where("jobId", "==", selectedJob.id)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Update the application to mark that the student has joined the chat
        const applicationDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "applications", applicationDoc.id), {
          hasJoinedChat: true,
          lastChatActivity: serverTimestamp()
        });

        // Send notification to other students that someone joined the chat
        try {
          const otherApplicantsQuery = query(
            collection(db, 'applications'),
            where("jobId", "==", selectedJob.id),
            where("student_id", "!=", auth.currentUser.uid)
          );
          
          const otherApplicantsSnapshot = await getDocs(otherApplicantsQuery);
          otherApplicantsSnapshot.forEach(async (applicantDoc) => {
            const applicantData = applicantDoc.data();
            try {
              await createChatMessageNotification(
                applicantData.student_id,
                selectedJob,
                'System',
                `${auth.currentUser.displayName || 'A student'} has joined the chat for ${selectedJob.position}`
              );
            } catch (error) {
              console.error('Error sending join notification:', error);
            }
          });
        } catch (error) {
          console.error('Error sending join notifications:', error);
        }
      }
    } catch (error) {
      console.error("Error ensuring joined status:", error);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);
  
  // Function to load chat messages
  // Function to load chat messages
  const loadChatMessages = async () => {
    if (!selectedJob || !auth.currentUser) return;
    
    try {
      // Clean up any existing listener
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
  
      const messagesRef = collection(db, "jobChats");
      // Only filter by jobId to get ALL messages for this job
      const q = query(
        messagesRef,
        where("jobId", "==", selectedJob.id),
        orderBy("timestamp", "asc")
      );
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
          const messageData = doc.data();
          // Remove the filtering condition to include ALL messages
          messages.push({ id: doc.id, ...messageData });
        });
        setChatMessages(messages);
        console.log("Chat messages loaded:", messages); // For debugging
      });
      
      // Store the unsubscribe function for cleanup
      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error("Error loading chat messages:", error);
      toast.error("Failed to load messages");
    }
  };
  
  // Function to send a new message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedJob || !auth.currentUser) return;

    try {
      const messageData = {
        message: newMessage.trim(),
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Student',
        senderRole: 'student',
        timestamp: serverTimestamp(),
        jobId: selectedJob.id,
        studentId: auth.currentUser.uid
      };

      await addDoc(collection(db, 'jobChats'), messageData);
      
      // Send notifications to other students who have joined this chat
      // Only if they have notifications enabled
      if (notificationsEnabled) {
        // Get all students who have applied to this job
        const allApplicantsQuery = query(
          collection(db, 'applications'),
          where("jobId", "==", selectedJob.id)
        );
        
        const allApplicantsSnapshot = await getDocs(allApplicantsQuery);
        
        // For each applicant (except the sender)
        allApplicantsSnapshot.forEach(async (applicantDoc) => {
          const applicantData = applicantDoc.data();
          const recipientId = applicantData.studentId || applicantData.student_id;
          
          // Don't send notification to the sender
          if (recipientId !== auth.currentUser.uid) {
            try {
              await createChatMessageNotification(
                recipientId,
                selectedJob,
                auth.currentUser.displayName || "Student",
                newMessage.trim()
              );
            } catch (error) {
              console.error('Error sending chat notification:', error);
            }
          }
        });
      }
      
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  // Toggle notifications
  // Toggle notifications
  const toggleNotifications = async () => {
    try {
      const newNotificationState = !notificationsEnabled;
      setNotificationsEnabled(newNotificationState);
      
      // Store the user's preference in the database
      const userPrefsRef = doc(db, "userPreferences", auth.currentUser.uid);
      
      // Check if the document exists first
      const docSnap = await getDoc(userPrefsRef);
      
      if (docSnap.exists()) {
        // Update existing document
        await updateDoc(userPrefsRef, {
          [`chatNotifications.${selectedJob.id}`]: newNotificationState
        });
      } else {
        // Create new document
        await setDoc(userPrefsRef, {
          chatNotifications: {
            [selectedJob.id]: newNotificationState
          }
        });
      }
      
      toast.success(newNotificationState ? "Notifications enabled" : "Notifications disabled");
    } catch (error) {
      console.error("Error toggling notifications:", error);
      toast.error("Failed to update notification preferences");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="large" text="Loading chat..." /></div>;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] sm:max-h-[85vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Chat: {selectedJob?.position} at {selectedJob?.company}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleNotifications}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
              title={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
            >
              {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            chatMessages.map(msg => (
              <div 
                key={msg.id}
                className={`flex ${msg.senderRole === 'student' && msg.studentId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.senderRole === 'student' && msg.studentId === auth.currentUser?.uid
                      ? 'bg-blue-500 text-white rounded-tr-none' 
                      : 'bg-gray-200 text-gray-800 rounded-tl-none'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">{msg.senderRole === 'admin' ? '👨‍💼 T&P' : msg.senderName}</div>
                  <div>{msg.message}</div>
                  <div className="text-xs mt-1 opacity-70">
                    {msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleString() : 'Sending...'}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 border-t">
          <div className="flex">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="bg-blue-600 text-white p-2 rounded-r-lg hover:bg-blue-700"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobChat;

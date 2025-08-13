import React, { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, Edit2, Check, Shield, Target, 
  Briefcase, Calendar, FileText, Award, 
  Book, Code, Clipboard, DollarSign, 
  MessageSquare, Star, Tool, Layers,
  MapPin, Mail, Phone, Linkedin, Info,
  Users, Home, Tag, AlertTriangle
} from "lucide-react";

const ProfileBasic = ({ userData: propUserData, isAdminView, onUserDataChange }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [activeSection, setActiveSection] = useState("about");
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({});

  console.log("ProfileBasic rendered", { userData: propUserData, propUserData: propUserData });

  useEffect(() => {
    if (isAdminView && propUserData) {
      fetchApplicationStats();
    } else if (!isAdminView) {
      fetchUserProfile();
      fetchApplicationStats();
    }
    // eslint-disable-next-line
  }, [isAdminView, propUserData?.id]);

  // Initialize editData when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditData({
        // About
        name: propUserData.name || '',
        gender: propUserData.gender || '',
        birthday: propUserData.birthday || '',
        rfid: propUserData.rfid || '',
        // Contact
        email: propUserData.email || '',
        mobile: propUserData.mobile || '',
        linkedinProfile: propUserData.linkedinProfile || '',
        // Parent Info
        fatherName: propUserData.fatherName || '',
        fatherEmail: propUserData.fatherEmail || '',
        fatherContact: propUserData.fatherContact || '',
        fatherOccupation: propUserData.fatherOccupation || '',
        fatherOfficeAddress: propUserData.fatherOfficeAddress || '',
        motherName: propUserData.motherName || '',
        motherEmail: propUserData.motherEmail || '',
        motherContact: propUserData.motherContact || '',
        motherOccupation: propUserData.motherOccupation || '',
        motherOfficeAddress: propUserData.motherOfficeAddress || '',
        // Address
        city: propUserData.city || '',
        district: propUserData.district || '',
        state: propUserData.state || '',
        pinCode: propUserData.pinCode || '',
        country: propUserData.country || '',
        address: propUserData.address || '',
        // More Info
        nationality: propUserData.nationality || '',
        aadhaarNumber: propUserData.aadhaarNumber || '',
        drivingLicense: propUserData.drivingLicense || '',
        passportNumber: propUserData.passportNumber || '',
        passportIssueDate: propUserData.passportIssueDate || '',
        passportExpiry: propUserData.passportExpiry || '',
        isDayScholar: !!propUserData.isDayScholar,
        // Tags & Gaps
        tags: Array.isArray(propUserData.tags) ? propUserData.tags.join(', ') : '',
        gapInStudies: !!propUserData.gapInStudies,
        gapReason: propUserData.gapReason || '',
        // Freeze
        freezed: !!propUserData.freezed,
        // Point of Contact
        mentor: propUserData.mentor || '',
        advisor: propUserData.advisor || '',
        coordinator: propUserData.coordinator || '',
      });
    }
  }, [isEditing, propUserData]);

  

  const fetchUserProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const studentRef = doc(db, "students", user.uid);
      const studentSnap = await getDoc(studentRef);
      
      if (studentSnap.exists()) {
        const data = studentSnap.data();
        onUserDataChange({
          ...data,
          name: user.displayName || "User",
          email: user.email,
          mobile: localStorage.getItem("mobile") || "",
          rollNumber: localStorage.getItem("rollNumber") || data.rollNumber || "",
          batch: localStorage.getItem("batch") || "",
          program: localStorage.getItem("program") || "",
          department: data.department || "",
          passoutYear: data.passoutYear || "",
          firstName: data.firstName || "",
          middleName: data.middleName || "",
          lastName: data.lastName || "",
          college: data.college || "",
          minor: data.minor || "N/A",
          gender: data.gender || "",
          birthday: data.birthday || "",
          careerPath: data.careerPath || "Placement",
          placementCycle: data.placementCycle || "",
          academicAttendance: data.academicAttendance || "0",
          tpAttendance: data.tpAttendance || "0",
          rfid: data.rfid || "-",
          registered: data.registered !== false,
          registeredOn: data.registeredOn || "",
          verifiedOn: data.verifiedOn || null,
          verifiedBy: data.verifiedBy || null,
          isEligible: data.isEligible !== false,
          enrolled: data.enrolled !== false,
          
          // Contact Info
          communicationEmail: data.communicationEmail || user.email,
          instituteEmail: data.instituteEmail || "",
          personalEmail: data.personalEmail || user.email,
          alternateEmail: data.alternateEmail || "",
          phoneNumber: data.phoneNumber || localStorage.getItem("mobile") || "",
          altPhoneNumber: data.altPhoneNumber || "",
          linkedinProfile: data.linkedinProfile || "",
          
          // More Info
          isDayScholar: data.isDayScholar || false,
          nationality: data.nationality || "India",
          aadhaarNumber: data.aadhaarNumber || "",
          drivingLicense: data.drivingLicense || "-",
          passportNumber: data.passportNumber || "-",
          passportIssueDate: data.passportIssueDate || "-",
          passportExpiry: data.passportExpiry || "-",
          
          // Parent Info
          fatherName: data.fatherName || "",
          fatherEmail: data.fatherEmail || "",
          fatherContact: data.fatherContact || "",
          fatherOccupation: data.fatherOccupation || "",
          fatherOfficeAddress: data.fatherOfficeAddress || "",
          motherName: data.motherName || "",
          motherEmail: data.motherEmail || "",
          motherContact: data.motherContact || "",
          motherOccupation: data.motherOccupation || "",
          motherOfficeAddress: data.motherOfficeAddress || "",
          
          // Address
          city: data.city || "",
          district: data.district || "",
          state: data.state || "",
          pinCode: data.pinCode || "",
          country: data.country || "India",
          address: data.address || "",
          
          // Point of Contact
          mentor: data.mentor || null,
          advisor: data.advisor || null,
          coordinator: data.coordinator || null,
          
          // Tags and Freeze
          tags: data.tags || [],
          freezed: data.freezed || null,
          freezeHistory: data.freezeHistory || [],
          gapInStudies: data.gapInStudies || false,
          gapReason: data.gapReason || "",
        });
        
        // Set profile photo if available
        setProfilePhoto(data.profilePhoto || null);
      }
    }
  };

  const fetchApplicationStats = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        // Get all jobs to calculate eligible jobs
        const jobsRef = collection(db, "jobs");
        const jobsSnapshot = await getDocs(jobsRef);
        const allJobs = [];
        jobsSnapshot.forEach((doc) => {
          allJobs.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Get student profile to check eligibility criteria
        const studentRef = doc(db, "students", user.uid);
        const studentSnap = await getDoc(studentRef);
        const studentData = studentSnap.exists() ? studentSnap.data() : {};
        
        // Get applications data
        const applicationsRef = collection(db, "applications");
        const q = query(applicationsRef, where("studentId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        // Process application data
        const applications = [];
        querySnapshot.forEach((doc) => {
          applications.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Calculate eligible jobs based on student profile criteria
        const eligibleJobs = allJobs.filter(job => {
          // Check if student meets job criteria (CGPA, etc.)
          const meetsMinCGPA = !job.minCGPA || (studentData.cgpa && parseFloat(studentData.cgpa) >= parseFloat(job.minCGPA));
          const meetsArrearCriteria = !job.maxArrears || (studentData.currentArrears && parseInt(studentData.currentArrears) <= parseInt(job.maxArrears));
          // Add more criteria as needed
          return meetsMinCGPA && meetsArrearCriteria;
        });
        
        // Calculate not applied jobs
        const appliedJobIds = applications.map(app => app.jobId);
        const notAppliedJobs = eligibleJobs.filter(job => !appliedJobIds.includes(job.id));
        
        // Update state with calculated data
        onUserDataChange({
          ...propUserData,
          eligibleJobs: eligibleJobs.length,
          appliedJobs: applications.length,
          notAppliedEligible: notAppliedJobs.length,
          offersReceived: applications.filter(app => app.status === "offered").length,
        });
        
      } catch (error) {
        console.error("Error fetching application stats:", error);
      }
    }
  };

  // Helper to remove undefined fields
  function removeUndefinedFields(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
  }

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Determine which user ID to use based on whether we're in admin view
      let userIdToUpdate;
      if (isAdminView && propUserData && propUserData.id) {
        userIdToUpdate = propUserData.id;
      } else {
        const user = auth.currentUser;
        if (!user) {
          toast.error("User not authenticated. Please log in.");
          setIsSaving(false);
          return;
        }
        userIdToUpdate = user.uid;
      }
      // Remove undefined fields before saving
      const dataToSave = removeUndefinedFields({
        ...propUserData,
        ...editData,
        tags: typeof editData.tags === 'string' ? editData.tags.split(',').map(t => t.trim()).filter(Boolean) : (Array.isArray(editData.tags) ? editData.tags : []),
        freezeHistory: typeof editData.freezeHistory === 'string' ? editData.freezeHistory.split(',').map(t => t.trim()).filter(Boolean) : (Array.isArray(editData.freezeHistory) ? editData.freezeHistory : []),
      });
      const studentRef = doc(db, "students", userIdToUpdate);
      await updateDoc(studentRef, {
        ...dataToSave,
        profilePhoto: profilePhoto,
        updatedAt: serverTimestamp(),
      });
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadProfilePhoto = () => {
    // In a real implementation, this would handle file upload to storage
    // For now, we'll just use a placeholder
    const photoUrl = prompt("Please enter the URL for your profile photo:");
    if (photoUrl) {
      setProfilePhoto(photoUrl);
      toast.success("Profile photo updated!");
    }
  };

  // Render the status badge with appropriate color
  const StatusBadge = ({ label, isActive, icon }) => (
    <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
      {icon}
      {label}
    </div>
  );

  // Render a stat card
  const StatCard = ({ icon, label, value, bgColor }) => (
    <div className={`${bgColor} rounded-lg shadow-md p-4 flex flex-col items-center justify-center text-center`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );

  // Navigation between profile pages
 

  // Accordion component for sections
  const Accordion = ({ title, icon, isOpen, onClick, children }) => (
    <div className="mb-4 bg-white rounded-lg shadow-md overflow-hidden">
      <button 
        className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-gray-50"
        onClick={onClick}
      >
        <div className="flex items-center">
          {icon}
          <span className="ml-2 font-semibold">{title}</span>
        </div>
        <svg 
          className={`w-5 h-5 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`px-6 py-4 ${isOpen ? 'block' : 'hidden'}`}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="pb-12">
      <ToastContainer position="top-right" autoClose={3000} />
      
      
      {/* Student Snapshot Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard 
          icon={<Target />} 
          label="Eligible Jobs" 
          value={propUserData.eligibleJobs} 
          bgColor="bg-blue-50" 
        />
        <StatCard 
          icon={<FileText />} 
          label="Applied Jobs" 
          value={propUserData.appliedJobs} 
          bgColor="bg-green-50" 
        />
        <StatCard 
          icon={<AlertTriangle />} 
          label="Not Applied" 
          value={propUserData.notAppliedEligible} 
          bgColor="bg-yellow-50" 
        />
        <StatCard 
          icon={<Award />} 
          label="Offers" 
          value={propUserData.offersReceived} 
          bgColor="bg-purple-50" 
        />
        <StatCard 
          icon={<Calendar />} 
          label="Placement Cycle" 
          value={propUserData.placementCycle || "N/A"} 
          bgColor="bg-indigo-50" 
        />
        <StatCard 
          icon={<Briefcase />} 
          label="Career Path" 
          value={propUserData.careerPath} 
          bgColor="bg-pink-50" 
        />
      </div>
      
      {/* Profile Header Card */}
      <div className="bg-white rounded-xl  p-0 flex flex-col md:flex-row items-center gap-6 mb-8">
   
        
        <div className="flex flex-col gap-2 items-center md:items-end">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-2 rounded-md font-medium ${isEditing ? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          {isEditing && (
            <button
              onClick={handleSaveProfile}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Save
            </button>
          )}
        </div>
      </div>
      
      {/* Main Content - Sectioned Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">





{/* About Card */}
<div className="rounded-xl shadow p-6 bg-green-50 border border-gray-200 mb-6">
  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 border-b pb-2">
    <User size={18} /> About
  </h3>
  <div className="grid grid-cols-2 gap-5">
    <div>
      <div className="text-sm font-semibold text-emerald-700">Name</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.name || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Gender</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.gender} onChange={e => setEditData({ ...editData, gender: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.gender || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Date of Birth</div>
      {isEditing ? (
        <input type="date" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.birthday} onChange={e => setEditData({ ...editData, birthday: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.birthday || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">RFID</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.rfid} onChange={e => setEditData({ ...editData, rfid: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.rfid || '-'}</div>
      )}
    </div>
  </div>
</div>

{/* Contact Card */}
<div className="rounded-xl shadow p-6 bg-green-50 border border-gray-200 mb-6">
  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 border-b pb-2">
    <Mail size={18} /> Contact
  </h3>
  <div className="grid sm:grid-cols-2 gap-5">
    <div>
      <div className="text-sm font-semibold text-emerald-700">Email</div>
      {isEditing ? (
        <input type="email" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800 break-words">{propUserData.email || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Mobile</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.mobile} onChange={e => setEditData({ ...editData, mobile: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800 break-words">{propUserData.mobile || '-'}</div>
      )}
    </div>
    <div className="col-span-2">
      <div className="text-sm font-semibold text-emerald-700">LinkedIn</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.linkedinProfile} onChange={e => setEditData({ ...editData, linkedinProfile: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800 break-words">{propUserData.linkedinProfile ? (<a href={propUserData.linkedinProfile} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">Visit Profile</a>) : '-'}</div>
      )}
    </div>
  </div>
</div>

{/* Parent Information Card */}
<div className="rounded-xl shadow p-6 bg-green-50 border border-gray-200 mb-6">
  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 border-b pb-2">
    <Users size={18} /> Parent Information
  </h3>
  <div className="grid grid-cols-2 gap-5">
    <div>
      <div className="text-sm font-semibold text-emerald-700">Father's Name</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.fatherName} onChange={e => setEditData({ ...editData, fatherName: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.fatherName || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Father's Email</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.fatherEmail} onChange={e => setEditData({ ...editData, fatherEmail: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.fatherEmail || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Father's Contact</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.fatherContact} onChange={e => setEditData({ ...editData, fatherContact: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.fatherContact || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Father's Occupation</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.fatherOccupation} onChange={e => setEditData({ ...editData, fatherOccupation: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.fatherOccupation || '-'}</div>
      )}
    </div>
    <div className="col-span-2">
      <div className="text-sm font-semibold text-emerald-700">Father's Office Address</div>
      {isEditing ? (
        <textarea className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.fatherOfficeAddress} onChange={e => setEditData({ ...editData, fatherOfficeAddress: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.fatherOfficeAddress || 'Empty'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Mother's Name</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.motherName} onChange={e => setEditData({ ...editData, motherName: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.motherName || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Mother's Email</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.motherEmail} onChange={e => setEditData({ ...editData, motherEmail: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.motherEmail || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Mother's Contact</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.motherContact} onChange={e => setEditData({ ...editData, motherContact: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.motherContact || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Mother's Occupation</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.motherOccupation} onChange={e => setEditData({ ...editData, motherOccupation: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.motherOccupation || '-'}</div>
      )}
    </div>
    <div className="col-span-2">
      <div className="text-sm font-semibold text-emerald-700">Mother's Office Address</div>
      {isEditing ? (
        <textarea className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.motherOfficeAddress} onChange={e => setEditData({ ...editData, motherOfficeAddress: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.motherOfficeAddress || 'Empty'}</div>
      )}
    </div>
  </div>
</div>

{/* Address Card */}
<div className="rounded-xl shadow p-6 bg-green-50 border border-gray-200 mb-6">
  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 border-b pb-2">
    <Home size={18} /> Address
  </h3>
  <div className="grid grid-cols-2 gap-5">
    <div>
      <div className="text-sm font-semibold text-emerald-700">City</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.city} onChange={e => setEditData({ ...editData, city: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.city || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">District</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.district} onChange={e => setEditData({ ...editData, district: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.district || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">State</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.state} onChange={e => setEditData({ ...editData, state: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.state || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Pin Code</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.pinCode} onChange={e => setEditData({ ...editData, pinCode: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.pinCode || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Country</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.country} onChange={e => setEditData({ ...editData, country: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.country || '-'}</div>
      )}
    </div>
    <div className="col-span-2">
      <div className="text-sm font-semibold text-emerald-700">Address</div>
      {isEditing ? (
        <textarea className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.address || '-'}</div>
      )}
    </div>
  </div>
</div>

{/* More Info Card */}
<div className="rounded-xl shadow p-6 bg-green-50 border border-gray-200 mb-6">
  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 border-b pb-2">
    <Info size={18} /> More Info
  </h3>
  <div className="grid grid-cols-2 gap-5">
    <div>
      <div className="text-sm font-semibold text-emerald-700">Nationality</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.nationality} onChange={e => setEditData({ ...editData, nationality: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.nationality || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Aadhaar Number</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.aadhaarNumber} onChange={e => setEditData({ ...editData, aadhaarNumber: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.aadhaarNumber || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Driving License</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.drivingLicense} onChange={e => setEditData({ ...editData, drivingLicense: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.drivingLicense || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Passport Number</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.passportNumber} onChange={e => setEditData({ ...editData, passportNumber: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.passportNumber || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Passport Issue Date</div>
      {isEditing ? (
        <input type="date" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.passportIssueDate} onChange={e => setEditData({ ...editData, passportIssueDate: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.passportIssueDate || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Passport Expiry</div>
      {isEditing ? (
        <input type="date" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.passportExpiry} onChange={e => setEditData({ ...editData, passportExpiry: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.passportExpiry || '-'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Day Scholar</div>
      {isEditing ? (
        <input type="checkbox" checked={editData.isDayScholar} onChange={e => setEditData({ ...editData, isDayScholar: e.target.checked })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.isDayScholar ? 'Yes' : 'No'}</div>
      )}
    </div>
  </div>
</div>

{/* Tags & Education Gaps Card */}
<div className="rounded-xl shadow p-6 bg-green-50 border border-gray-200 mb-6">
  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 border-b pb-2">
    <Tag size={18} /> Tags & Education Gaps
  </h3>
  <div className="flex flex-wrap gap-2 mb-4">
    {(() => {
      let tags = propUserData.tags;
      if (!Array.isArray(tags)) {
        if (typeof tags === 'string') {
          tags = tags.split(',').map(t => t.trim()).filter(Boolean);
        } else {
          tags = [];
        }
      }
      return tags.length > 0 ? (
        tags.map((tag, idx) => (
          <span key={idx} className="bg-blue-200 text-blue-900 px-3 py-1 rounded-full text-sm font-semibold">{tag}</span>
        ))
      ) : (
        <span className="text-gray-400">No tags added</span>
      );
    })()}
  </div>
  <div className="grid grid-cols-2 gap-5">
    <div>
      <div className="text-sm font-semibold text-emerald-700">Gap in Studies</div>
      {isEditing ? (
        <input type="checkbox" checked={editData.gapInStudies} onChange={e => setEditData({ ...editData, gapInStudies: e.target.checked })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.gapInStudies ? 'Yes' : 'No'}</div>
      )}
    </div>
    {propUserData.gapInStudies && (
      <div className="col-span-2">
        <div className="text-sm font-semibold text-emerald-700">Reason for Gap</div>
        {isEditing ? (
          <textarea className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.gapReason} onChange={e => setEditData({ ...editData, gapReason: e.target.value })} />
        ) : (
          <div className="text-lg text-gray-800">{propUserData.gapReason || 'No reason provided'}</div>
        )}
      </div>
    )}
  </div>
</div>

{/* Freeze Information Card */}
<div className="rounded-xl shadow p-6 bg-green-50 border border-gray-200 mb-6">
  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 border-b pb-2">
    <AlertTriangle size={18} /> Freeze Information
  </h3>
  <div className="grid grid-cols-2 gap-5">
    <div>
      <div className="text-sm font-semibold text-emerald-700">Freezed</div>
      <div className="text-lg text-gray-800">{propUserData.freezed ? 'Yes' : 'No'}</div>
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Freeze History</div>
      {propUserData.freezeHistory && propUserData.freezeHistory.length > 0 ? (
        <button className="text-blue-500 hover:underline">Download Log</button>
      ) : (
        <div className="text-lg text-gray-800">No history</div>
      )}
    </div>
  </div>
</div>

{/* Student Point of Contact Card */}
<div className="rounded-xl shadow p-6 bg-green-50 border border-gray-200 mb-6">
  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-800 border-b pb-2">
    <Users size={18} /> Student Point of Contact
  </h3>
  <div className="grid grid-cols-3 gap-5">
    <div>
      <div className="text-sm font-semibold text-emerald-700">Mentor</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.mentor} onChange={e => setEditData({ ...editData, mentor: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.mentor || 'Not Assigned'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Advisor</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.advisor} onChange={e => setEditData({ ...editData, advisor: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.advisor || 'Not Assigned'}</div>
      )}
    </div>
    <div>
      <div className="text-sm font-semibold text-emerald-700">Coordinator</div>
      {isEditing ? (
        <input type="text" className="text-lg text-gray-800 border rounded px-2 py-1 w-full" value={editData.coordinator} onChange={e => setEditData({ ...editData, coordinator: e.target.value })} />
      ) : (
        <div className="text-lg text-gray-800">{propUserData.coordinator || 'Not Assigned'}</div>
      )}
    </div>
  </div>
</div>
      </div>







      

      {/* Spinner overlay when saving */}
      {isSaving && <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50 pointer-events-none"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>}
    </div>
  );
};

export default ProfileBasic; 
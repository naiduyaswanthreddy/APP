import React, { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, Edit2, Check, Shield, Target, 
  Briefcase, Calendar, FileText, Award, 
  Book, Code, Clipboard, DollarSign, 
  MessageSquare, Star, Tool, Layers,
  ChevronLeft, ChevronRight, Download, Eye, Upload, Trash2, PlusCircle,
  CreditCard, MessageCircle
} from "lucide-react";

const ProfileCareer = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("offers");
  const [userData, setUserData] = useState({
    // Offers
    offers: [
      // Sample data structure for offers
      {
        id: 1,
        companyName: "",
        roleOffered: "",
        ctc: "",
        offerLetterLink: "",
        tpRemarks: ""
      }
    ],
    
    // Payments
    payments: [
      // Sample data structure for payments
      {
        id: 1,
        type: "", // e.g., "Registration Fee", "Placement Training"
        amount: "",
        status: "", // "Paid", "Pending", "Overdue"
        dueDate: "",
        paidDate: "",
        receiptLink: ""
      }
    ],
    
    // Feedbacks
    feedbacks: [
      // Sample data structure for feedbacks
      {
        id: 1,
        type: "", // e.g., "Resume Review", "Interview Feedback", "Training Feedback"
        from: "", // e.g., "Mentor", "Company", "Admin"
        date: "",
        content: "",
        rating: 0 // 1-5 scale if applicable
      }
    ],
    
    // Work Experience
    workExperience: [
      // Sample data structure for work experience
      {
        id: 1,
        company: "",
        role: "",
        type: "", // "Internship", "Freelance", "Part-time", "Full-time"
        startDate: "",
        endDate: "",
        description: "",
        proofLink: ""
      }
    ]
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const studentRef = doc(db, "students", user.uid);
      const studentSnap = await getDoc(studentRef);
      
      if (studentSnap.exists()) {
        const data = studentSnap.data();
        
        // Update userData with data from Firestore
        setUserData(prev => ({
          ...prev,
          offers: data.offers || [],
          payments: data.payments || [],
          feedbacks: data.feedbacks || [],
          workExperience: data.workExperience || []
        }));
      }
    }
  };

  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const studentRef = doc(db, "students", user.uid);
        await updateDoc(studentRef, {
          offers: userData.offers,
          payments: userData.payments,
          feedbacks: userData.feedbacks,
          workExperience: userData.workExperience,
          updatedAt: serverTimestamp(),
        });
        toast.success("Career profile updated successfully!");
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating profile:", error);
        toast.error("Failed to update profile. Please try again.");
      }
    } else {
      toast.error("User not authenticated. Please log in.");
    }
  };

  // Add Offer
  const handleAddOffer = () => {
    const newOffer = {
      id: Date.now(),
      companyName: "",
      roleOffered: "",
      ctc: "",
      offerLetterLink: "",
      tpRemarks: ""
    };
    
    setUserData(prevData => ({
      ...prevData,
      offers: [...prevData.offers, newOffer]
    }));
  };

  // Delete Offer
  const handleDeleteOffer = (id) => {
    if (window.confirm("Are you sure you want to delete this offer?")) {
      setUserData(prevData => ({
        ...prevData,
        offers: prevData.offers.filter(offer => offer.id !== id)
      }));
    }
  };

  // Update Offer
  const handleUpdateOffer = (id, field, value) => {
    setUserData(prevData => ({
      ...prevData,
      offers: prevData.offers.map(offer => 
        offer.id === id ? { ...offer, [field]: value } : offer
      )
    }));
  };

  // Add Payment
  const handleAddPayment = () => {
    const newPayment = {
      id: Date.now(),
      type: "",
      amount: "",
      status: "Pending",
      dueDate: "",
      paidDate: "",
      receiptLink: ""
    };
    
    setUserData(prevData => ({
      ...prevData,
      payments: [...prevData.payments, newPayment]
    }));
  };

  // Delete Payment
  const handleDeletePayment = (id) => {
    if (window.confirm("Are you sure you want to delete this payment record?")) {
      setUserData(prevData => ({
        ...prevData,
        payments: prevData.payments.filter(payment => payment.id !== id)
      }));
    }
  };

  // Update Payment
  const handleUpdatePayment = (id, field, value) => {
    setUserData(prevData => ({
      ...prevData,
      payments: prevData.payments.map(payment => 
        payment.id === id ? { ...payment, [field]: value } : payment
      )
    }));
  };

  // Add Work Experience
  const handleAddWorkExperience = () => {
    const newExperience = {
      id: Date.now(),
      company: "",
      role: "",
      type: "Internship",
      startDate: "",
      endDate: "",
      description: "",
      proofLink: ""
    };
    
    setUserData({
      ...userData,
      workExperience: [...userData.workExperience, newExperience]
    });
  };

  // Delete Work Experience
  const handleDeleteWorkExperience = (id) => {
    if (window.confirm("Are you sure you want to delete this work experience?")) {
      setUserData({
        ...userData,
        workExperience: userData.workExperience.filter(exp => exp.id !== id)
      });
    }
  };

  // Update Work Experience
  const handleUpdateWorkExperience = (id, field, value) => {
    setUserData({
      ...userData,
      workExperience: userData.workExperience.map(exp => 
        exp.id === id ? { ...exp, [field]: value } : exp
      )
    });
  };

  // Tabs for the profile page
  const profileTabs = [
    { id: "offers", label: "Offers", icon: <Briefcase size={16} /> },
    { id: "payments", label: "Payments", icon: <CreditCard size={16} /> },
    { id: "feedbacks", label: "Feedbacks", icon: <MessageCircle size={16} /> },
    { id: "workExperience", label: "Work Experience", icon: <Briefcase size={16} /> },
  ];

  // Render the offers tab content
  const renderOffersTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">My Offers</h3>
            {isEditing && (
              <button 
                onClick={handleAddOffer}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
              >
                <PlusCircle size={16} />
                Add Offer
              </button>
            )}
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Edit
              </button>
            ) : (
              <button 
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Save
              </button>
            )}
          </div>
          
          {userData.offers.length > 0 ? (
            <div className="space-y-4">
              {userData.offers.map((offer) => (
                <div key={offer.id} className="border rounded-lg p-4">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <input
                          type="text"
                          value={offer.companyName}
                          onChange={(e) => handleUpdateOffer(offer.id, "companyName", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role Offered</label>
                        <input
                          type="text"
                          value={offer.roleOffered}
                          onChange={(e) => handleUpdateOffer(offer.id, "roleOffered", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CTC / Stipend</label>
                        <input
                          type="text"
                          value={offer.ctc}
                          onChange={(e) => handleUpdateOffer(offer.id, "ctc", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Offer Letter Link</label>
                        <input
                          type="text"
                          value={offer.offerLetterLink}
                          onChange={(e) => handleUpdateOffer(offer.id, "offerLetterLink", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">T&P Remarks</label>
                        <textarea
                          value={offer.tpRemarks}
                          onChange={(e) => handleUpdateOffer(offer.id, "tpRemarks", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                          rows="2"
                        ></textarea>
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          onClick={() => handleDeleteOffer(offer.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between">
                        <h4 className="font-medium text-lg">{offer.companyName || "Company Name"}</h4>
                        <span className="text-blue-600 font-medium">{offer.ctc || "CTC not specified"}</span>
                      </div>
                      <p className="text-gray-600 mt-1">{offer.roleOffered || "Role not specified"}</p>
                      {offer.offerLetterLink && (
                        <div className="mt-2">
                          <a 
                            href={offer.offerLetterLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 flex items-center gap-1 text-sm"
                          >
                            <Eye size={14} />
                            View Offer Letter
                          </a>
                        </div>
                      )}
                      {offer.tpRemarks && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">T&P Remarks:</span> {offer.tpRemarks}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No offers added yet. {isEditing && "Click 'Add Offer' to get started."}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the payments tab content
  const renderPaymentsTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Payment History</h3>
            {isEditing && (
              <button 
                onClick={handleAddPayment}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
              >
                <PlusCircle size={16} />
                Add Payment
              </button>
            )}
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Edit
              </button>
            ) : (
              <button 
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Save
              </button>
            )}
          </div>
          
          {userData.payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                    {isEditing && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userData.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={payment.type}
                            onChange={(e) => handleUpdatePayment(payment.id, "type", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          />
                        ) : (
                          <div className="text-sm font-medium text-gray-900">{payment.type || "Not specified"}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={payment.amount}
                            onChange={(e) => handleUpdatePayment(payment.id, "amount", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          />
                        ) : (
                          <div className="text-sm text-gray-900">₹{payment.amount || "0"}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={payment.status}
                            onChange={(e) => handleUpdatePayment(payment.id, "status", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          >
                            <option value="Paid">Paid</option>
                            <option value="Pending">Pending</option>
                            <option value="Overdue">Overdue</option>
                          </select>
                        ) : (
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            payment.status === "Paid" ? "bg-green-100 text-green-800" :
                            payment.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {payment.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={payment.dueDate}
                            onChange={(e) => handleUpdatePayment(payment.id, "dueDate", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          />
                        ) : (
                          <div className="text-sm text-gray-900">{payment.dueDate || "Not specified"}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={payment.paidDate}
                            onChange={(e) => handleUpdatePayment(payment.id, "paidDate", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          />
                        ) : (
                          <div className="text-sm text-gray-900">{payment.paidDate || "Not paid yet"}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={payment.receiptLink}
                            onChange={(e) => handleUpdatePayment(payment.id, "receiptLink", e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                            placeholder="Receipt URL"
                          />
                        ) : (
                          payment.receiptLink ? (
                            <div className="flex space-x-2">
                              <a 
                                href={payment.receiptLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <Eye size={16} />
                              </a>
                              <a 
                                href={payment.receiptLink} 
                                download
                                className="text-green-500 hover:text-green-700"
                              >
                                <Download size={16} />
                              </a>
                            </div>
                          ) : (
                            <span className="text-gray-400">No receipt</span>
                          )
                        )}
                      </td>
                      {isEditing && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDeletePayment(payment.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No payment records found. {isEditing && "Click 'Add Payment' to add a record."}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the feedbacks tab content
  const renderFeedbacksTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Feedback & Reviews</h3>
          </div>
          
          {userData.feedbacks.length > 0 ? (
            <div className="space-y-4">
              {userData.feedbacks.map((feedback) => (
                <div key={feedback.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{feedback.type || "Feedback"}</h4>
                      <p className="text-sm text-gray-500">From: {feedback.from || "Not specified"} • {feedback.date || "No date"}</p>
                    </div>
                    {feedback.rating > 0 && (
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            size={16} 
                            className={i < feedback.rating ? "text-yellow-400 fill-current" : "text-gray-300"} 
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-gray-700">{feedback.content || "No feedback content provided."}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No feedback records found. Feedback can only be added by mentors, companies, or administrators.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the work experience tab content
  const renderWorkExperienceTab = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Work Experience</h3>
            {isEditing && (
              <button 
                onClick={handleAddWorkExperience}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
              >
                <PlusCircle size={16} />
                Add Experience
              </button>
            )}
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Edit
              </button>
            ) : (
              <button 
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Save
              </button>
            )}
          </div>
          
          {userData.workExperience.length > 0 ? (
            <div className="space-y-6">
              {userData.workExperience.map((exp) => (
                <div key={exp.id} className="border rounded-lg p-4">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "company", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <input
                          type="text"
                          value={exp.role}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "role", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                          value={exp.type}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "type", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="Internship">Internship</option>
                          <option value="Freelance">Freelance</option>
                          <option value="Part-time">Part-time</option>
                          <option value="Full-time">Full-time</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={exp.startDate}
                            onChange={(e) => handleUpdateWorkExperience(exp.id, "startDate", e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                          <input
                            type="date"
                            value={exp.endDate}
                            onChange={(e) => handleUpdateWorkExperience(exp.id, "endDate", e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={exp.description}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "description", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                          rows="3"
                        ></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Proof/Reference Letter Link</label>
                        <input
                          type="text"
                          value={exp.proofLink}
                          onChange={(e) => handleUpdateWorkExperience(exp.id, "proofLink", e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          onClick={() => handleDeleteWorkExperience(exp.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between">
                        <h4 className="font-medium text-lg">{exp.company || "Company Name"}</h4>
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{exp.type || "Experience"}</span>
                      </div>
                      <p className="text-gray-600 font-medium">{exp.role || "Role not specified"}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {exp.startDate ? new Date(exp.startDate).toLocaleDateString() : "Start date"} - 
                        {exp.endDate ? new Date(exp.endDate).toLocaleDateString() : "Present"}
                      </p>
                      <p className="mt-2 text-gray-700">{exp.description || "No description provided."}</p>
                      {exp.proofLink && (
                        <div className="mt-2">
                          <a 
                            href={exp.proofLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 flex items-center gap-1 text-sm"
                          >
                            <Eye size={14} />
                            View Reference Letter
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No work experience added yet. {isEditing && "Click 'Add Experience' to get started."}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4">
      <ToastContainer position="top-right" autoClose={3000} />
      
   
      
      <h2 className="text-2xl font-bold mb-6">Career Profile</h2>
      
      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 border-b overflow-x-auto">
        {profileTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 flex items-center gap-2 ${activeTab === tab.id
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="mb-8">
        {activeTab === "offers" && renderOffersTab()}
        {activeTab === "payments" && renderPaymentsTab()}
        {activeTab === "feedbacks" && renderFeedbacksTab()}
        {activeTab === "workExperience" && renderWorkExperienceTab()}
      </div>
    </div>
  );
};

export default ProfileCareer;
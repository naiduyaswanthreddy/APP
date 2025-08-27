import React, { useEffect, useState } from "react";
import { auth, db } from "../../../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, Edit2, Check, 
  MessageSquare,  Eye, Trash2, PlusCircle,
  Github, Globe, Monitor, FileCode, Cpu, Languages, Trophy, Award as Certificate, Flag, Medal, 
  BarChart2, Zap, X
} from "lucide-react";

const ProfileExcellence = ({ userData: propUserData, isAdminView }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("projects");
  const [userData, setUserData] = useState({
    // Projects
    projects: [
      {
        id: 1,
        title: "",
        description: "",
        techStack: [],
        teamType: "Individual", // "Individual" or "Team"
        teamMembers: "",
        githubLink: "",
        demoLink: "",
        slideDeckLink: "",
        screenshots: [],
        createdAt: null,
        updatedAt: null
      }
    ],
    
    // Skills
    technicalSkills: [],
    softSkills: [],
    languages: [],
    skillSource: "Manual", // "Manual", "Resume", "GitHub"
    
    // Awards
    awards: [
      {
        id: 1,
        name: "",
        issuer: "",
        date: "",
        description: "",
        proofLink: ""
      }
    ],
    
    // Certifications
    certifications: [
      {
        id: 1,
        courseName: "",
        platform: "",
        completionDate: "",
        certificateLink: "",
        certificateFile: ""
      }
    ],
    
    // Competitions
    competitions: [
      {
        id: 1,
        name: "",
        type: "", // "Hackathon", "Olympiad", "Ideathon", "Coding Battle"
        ranking: "",
        teamInfo: "",
        date: "",
        proofLink: ""
      }
    ],
    
    // Points & Badges
    leaderboardStatus: "",
    points: 0,
    badges: [
      {
        id: 1,
        name: "",
        description: "",
        earnedOn: "",
        icon: ""
      }
    ]
  });

  useEffect(() => {
    if (isAdminView && propUserData) {
      // Use the provided userData directly
      setUserData(prev => ({
        ...prev,
        projects: propUserData.projects || [],
        technicalSkills: propUserData.technicalSkills || [],
        softSkills: propUserData.softSkills || [],
        languages: propUserData.languages || [],
        skillSource: propUserData.skillSource || "Manual",
        awards: propUserData.awards || [],
        certifications: propUserData.certifications || [],
        competitions: propUserData.competitions || [],
        leaderboardStatus: propUserData.leaderboardStatus || "",
        points: propUserData.points || 0,
        badges: propUserData.badges || []
      }));
    } else {
      // Fetch user profile for non-admin view
      fetchUserProfile();
    }
  }, [isAdminView, propUserData]);

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
          projects: data.projects || [],
          technicalSkills: data.technicalSkills || [],
          softSkills: data.softSkills || [],
          languages: data.languages || [],
          skillSource: data.skillSource || "Manual",
          awards: data.awards || [],
          certifications: data.certifications || [],
          competitions: data.competitions || [],
          leaderboardStatus: data.leaderboardStatus || "",
          points: data.points || 0,
          badges: data.badges || []
        }));
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      // Determine which user ID to use based on whether we're in admin view
      let userIdToUpdate;
      
      if (isAdminView && propUserData && propUserData.id) {
        // In admin view, use the student's ID from props
        userIdToUpdate = propUserData.id;
      } else {
        // In regular view, use the current user's ID
        const user = auth.currentUser;
        if (!user) {
          toast.error("User not authenticated. Please log in.");
          return;
        }
        userIdToUpdate = user.uid;
      }
      
      // Now use the correct ID to update the document
      const studentRef = doc(db, "students", userIdToUpdate);
      
      // Update only the fields related to excellence
      await updateDoc(studentRef, {
        projects: userData.projects,
        technicalSkills: userData.technicalSkills,
        softSkills: userData.softSkills,
        languages: userData.languages,
        skillSource: userData.skillSource,
        awards: userData.awards,
        certifications: userData.certifications,
        competitions: userData.competitions,
        leaderboardStatus: userData.leaderboardStatus,
        points: userData.points,
        badges: userData.badges,
        lastUpdated: serverTimestamp()
      });
      
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    }
  };

  // Projects Section
  const handleAddProject = () => {
    const newProject = {
      id: Date.now(),
      title: "",
      description: "",
      techStack: [],
      teamType: "Individual",
      teamMembers: "",
      githubLink: "",
      demoLink: "",
      slideDeckLink: "",
      screenshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setUserData(prevData => ({
      ...prevData,
      projects: [...prevData.projects, newProject]
    }));
  };

  const handleProjectChange = (id, field, value) => {
    setUserData(prevData => ({
      ...prevData,
      projects: prevData.projects.map(project => 
        project.id === id ? { ...project, [field]: value, updatedAt: new Date().toISOString() } : project
      )
    }));
  };

  const handleRemoveProject = (id) => {
    setUserData(prevData => ({
      ...prevData,
      projects: prevData.projects.filter(project => project.id !== id)
    }));
  };

  // Skills Section
  const handleAddSkill = (skillType, skill) => {
    if (!skill.trim()) return;
    
    setUserData(prev => {
      const updatedSkills = [...prev[skillType]];
      if (!updatedSkills.includes(skill)) {
        updatedSkills.push(skill);
      }
      return {
        ...prev,
        [skillType]: updatedSkills
      };
    });
  };

  const handleRemoveSkill = (skillType, skill) => {
    setUserData(prev => ({
      ...prev,
      [skillType]: prev[skillType].filter(s => s !== skill)
    }));
  };

  // Awards Section
  const handleAddAward = () => {
    const newAward = {
      id: Date.now(),
      name: "",
      issuer: "",
      date: "",
      description: "",
      proofLink: ""
    };
    
    setUserData(prev => ({
      ...prev,
      awards: [...prev.awards, newAward]
    }));
  };

  const handleAwardChange = (id, field, value) => {
    setUserData(prev => ({
      ...prev,
      awards: prev.awards.map(award => 
        award.id === id ? { ...award, [field]: value } : award
      )
    }));
  };

  const handleRemoveAward = (id) => {
    setUserData(prev => ({
      ...prev,
      awards: prev.awards.filter(award => award.id !== id)
    }));
  };

  // Certifications Section
  const handleAddCertification = () => {
    const newCertification = {
      id: Date.now(),
      courseName: "",
      platform: "",
      completionDate: "",
      certificateLink: "",
      certificateFile: ""
    };
    
    setUserData(prev => ({
      ...prev,
      certifications: [...prev.certifications, newCertification]
    }));
  };

  const handleCertificationChange = (id, field, value) => {
    setUserData(prev => ({
      ...prev,
      certifications: prev.certifications.map(cert => 
        cert.id === id ? { ...cert, [field]: value } : cert
      )
    }));
  };

  const handleRemoveCertification = (id) => {
    setUserData(prev => ({
      ...prev,
      certifications: prev.certifications.filter(cert => cert.id !== id)
    }));
  };

  // Competitions Section
  const handleAddCompetition = () => {
    const newCompetition = {
      id: Date.now(),
      name: "",
      type: "",
      ranking: "",
      teamInfo: "",
      date: "",
      proofLink: ""
    };
    
    setUserData(prev => ({
      ...prev,
      competitions: [...prev.competitions, newCompetition]
    }));
  };

  const handleCompetitionChange = (id, field, value) => {
    setUserData(prev => ({
      ...prev,
      competitions: prev.competitions.map(comp => 
        comp.id === id ? { ...comp, [field]: value } : comp
      )
    }));
  };

  const handleRemoveCompetition = (id) => {
    setUserData(prev => ({
      ...prev,
      competitions: prev.competitions.filter(comp => comp.id !== id)
    }));
  };

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Trophy size={24} className="text-yellow-500" />
          Excellence Profile
        </h2>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveProfile}
                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                <Check size={16} />
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                <X size={16} />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Edit2 size={16} />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto whitespace-nowrap scroll-smooth">
          <button
            onClick={() => setActiveTab("projects")}
            className={`py-2 px-3 border-b-2 font-medium text-sm flex-shrink-0 ${activeTab === "projects" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >

            <div className="flex items-center gap-1">
              <FileCode size={16} />
              Projects
            </div>
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            className={`py-2 px-3 border-b-2 font-medium text-sm flex-shrink-0 ${activeTab === "skills" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >

            <div className="flex items-center gap-1">
              <Cpu size={16} />
              Skills & Languages
            </div>
          </button>
          <button
            onClick={() => setActiveTab("awards")}
            className={`py-2 px-3 border-b-2 font-medium text-sm flex-shrink-0 ${activeTab === "awards" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >

            <div className="flex items-center gap-1">
              <Trophy size={16} />
              Awards
            </div>
          </button>
          <button
            onClick={() => setActiveTab("certifications")}
            className={`py-2 px-3 border-b-2 font-medium text-sm flex-shrink-0 ${activeTab === "certifications" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >

            <div className="flex items-center gap-1">
              <Certificate size={16} />
              Certifications
            </div>
          </button>
          <button
            onClick={() => setActiveTab("competitions")}
            className={`py-2 px-3 border-b-2 font-medium text-sm flex-shrink-0 ${activeTab === "competitions" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >

            <div className="flex items-center gap-1">
              <Flag size={16} />
              Competitions
            </div>
          </button>
          <button
            onClick={() => setActiveTab("badges")}
            className={`py-2 px-3 border-b-2 font-medium text-sm flex-shrink-0 ${activeTab === "badges" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >

            <div className="flex items-center gap-1">
              <Medal size={16} />
              Points & Badges
            </div>
          </button>
        </nav>
      </div>

      {/* Content based on active tab */}
      <div className="mt-6">
        {/* Projects Tab */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">My Projects</h3>
              {isEditing && (
                <button
                  onClick={handleAddProject}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  <PlusCircle size={16} />
                  Add Project
                </button>
              )}
            </div>
            
            {userData.projects.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <FileCode size={48} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No projects added yet.</p>
                {isEditing && (
                  <button
                    onClick={handleAddProject}
                    className="mt-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Add your first project
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {userData.projects.map((project) => (
                  <div key={project.id} className="bg-white p-4 rounded-lg shadow">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                          <input
                            type="text"
                            value={project.title}
                            onChange={(e) => handleProjectChange(project.id, "title", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Project Title"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            value={project.description}
                            onChange={(e) => handleProjectChange(project.id, "description", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Project Description"
                            rows="3"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tech Stack (comma separated)</label>
                          <input
                            type="text"
                            value={project.techStack.join(", ")}
                            onChange={(e) => handleProjectChange(project.id, "techStack", e.target.value.split(",").map(tech => tech.trim()))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="React, Node.js, MongoDB"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                          <select
                            value={project.teamType}
                            onChange={(e) => handleProjectChange(project.id, "teamType", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Individual">Individual</option>
                            <option value="Team">Team</option>
                          </select>
                        </div>
                        
                        {project.teamType === "Team" && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Team Members</label>
                            <input
                              type="text"
                              value={project.teamMembers}
                              onChange={(e) => handleProjectChange(project.id, "teamMembers", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="John Doe, Jane Smith"
                            />
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Link</label>
                          <input
                            type="url"
                            value={project.githubLink}
                            onChange={(e) => handleProjectChange(project.id, "githubLink", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="https://github.com/username/project"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Demo Link</label>
                          <input
                            type="url"
                            value={project.demoLink}
                            onChange={(e) => handleProjectChange(project.id, "demoLink", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="https://project-demo.com"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Slide Deck Link</label>
                          <input
                            type="url"
                            value={project.slideDeckLink}
                            onChange={(e) => handleProjectChange(project.id, "slideDeckLink", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="https://slides.com/presentation"
                          />
                        </div>
                        
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleRemoveProject(project.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                          >
                            <Trash2 size={16} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className="text-lg font-semibold">{project.title || "Untitled Project"}</h4>
                        <p className="text-gray-600 mt-1">{project.description || "No description provided."}</p>
                        
                        {project.techStack.length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-sm font-medium text-gray-700">Tech Stack:</h5>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {project.techStack.map((tech, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-3">
                          <h5 className="text-sm font-medium text-gray-700">Project Type:</h5>
                          <p className="text-gray-600">{project.teamType}</p>
                          {project.teamType === "Team" && project.teamMembers && (
                            <>
                              <h5 className="text-sm font-medium text-gray-700 mt-2">Team Members:</h5>
                              <p className="text-gray-600">{project.teamMembers}</p>
                            </>
                          )}
                        </div>
                        
                        <div className="mt-4 flex flex-wrap gap-2">
                          {project.githubLink && (
                            <a
                              href={project.githubLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors text-sm"
                            >
                              <Github size={14} />
                              GitHub
                            </a>
                          )}
                          
                          {project.demoLink && (
                            <a
                              href={project.demoLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                            >
                              <Globe size={14} />
                              Demo
                            </a>
                          )}
                          
                          {project.slideDeckLink && (
                            <a
                              href={project.slideDeckLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm"
                            >
                              <Monitor size={14} />
                              Slides
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skills Tab */}
        {activeTab === "skills" && (
          <div className="space-y-6">
            {/* Technical Skills */}
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Cpu size={20} className="text-blue-500" />
                  Technical Skills
                </h3>
              </div>
              
              {isEditing && (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="technicalSkill"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Add a technical skill (e.g., React, Python, AWS)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddSkill('technicalSkills', e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('technicalSkill');
                        handleAddSkill('technicalSkills', input.value);
                        input.value = '';
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                {userData.technicalSkills.length === 0 ? (
                  <p className="text-gray-500">No technical skills added yet.</p>
                ) : (
                  userData.technicalSkills.map((skill, index) => (
                    <div key={index} className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                      {skill}
                      {isEditing && (
                        <button
                          onClick={() => handleRemoveSkill('technicalSkills', skill)}
                          className="ml-1 text-blue-800 hover:text-blue-900"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Soft Skills */}
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <MessageSquare size={20} className="text-purple-500" />
                  Soft Skills
                </h3>
              </div>
              
              {isEditing && (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="softSkill"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Add a soft skill (e.g., Leadership, Communication)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddSkill('softSkills', e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('softSkill');
                        handleAddSkill('softSkills', input.value);
                        input.value = '';
                      }}
                      className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                {userData.softSkills.length === 0 ? (
                  <p className="text-gray-500">No soft skills added yet.</p>
                ) : (
                  userData.softSkills.map((skill, index) => (
                    <div key={index} className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                      {skill}
                      {isEditing && (
                        <button
                          onClick={() => handleRemoveSkill('softSkills', skill)}
                          className="ml-1 text-purple-800 hover:text-purple-900"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Languages */}
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Languages size={20} className="text-green-500" />
                  Spoken Languages
                </h3>
              </div>
              
              {isEditing && (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="language"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Add a language (e.g., English - Fluent)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddSkill('languages', e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('language');
                        handleAddSkill('languages', input.value);
                        input.value = '';
                      }}
                      className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                {userData.languages.length === 0 ? (
                  <p className="text-gray-500">No languages added yet.</p>
                ) : (
                  userData.languages.map((language, index) => (
                    <div key={index} className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
                      {language}
                      {isEditing && (
                        <button
                          onClick={() => handleRemoveSkill('languages', language)}
                          className="ml-1 text-green-800 hover:text-green-900"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Skill Source */}
            {isEditing && (
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium mb-4">Skill Source</h3>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="skillSource"
                      value="Manual"
                      checked={userData.skillSource === "Manual"}
                      onChange={() => setUserData(prev => ({ ...prev, skillSource: "Manual" }))}
                      className="h-4 w-4 text-blue-600"
                    />
                    Manual Entry
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="skillSource"
                      value="Resume"
                      checked={userData.skillSource === "Resume"}
                      onChange={() => setUserData(prev => ({ ...prev, skillSource: "Resume" }))}
                      className="h-4 w-4 text-blue-600"
                    />
                    Resume Parsing
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="skillSource"
                      value="GitHub"
                      checked={userData.skillSource === "GitHub"}
                      onChange={() => setUserData(prev => ({ ...prev, skillSource: "GitHub" }))}
                      className="h-4 w-4 text-blue-600"
                    />
                    GitHub Import
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

  

        {/* Certifications Tab */}
        {activeTab === "certifications" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">My Certifications</h3>
              {isEditing && (
                <button
                  onClick={handleAddCertification}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  <PlusCircle size={16} />
                  Add Certification
                </button>
              )}
            </div>
            
            {userData.certifications.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Certificate size={48} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No certifications added yet.</p>
                {isEditing && (
                  <button
                    onClick={handleAddCertification}
                    className="mt-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Add your first certification
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {userData.certifications.map((cert) => (
                  <div key={cert.id} className="bg-white p-4 rounded-lg shadow">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
                          <input
                            type="text"
                            value={cert.courseName}
                            onChange={(e) => handleCertificationChange(cert.id, "courseName", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Course Name"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                          <input
                            type="text"
                            value={cert.platform}
                            onChange={(e) => handleCertificationChange(cert.id, "platform", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="NPTEL, Coursera, etc."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Completion Date</label>
                          <input
                            type="date"
                            value={cert.completionDate}
                            onChange={(e) => handleCertificationChange(cert.id, "completionDate", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Link</label>
                          <input
                            type="url"
                            value={cert.certificateLink}
                            onChange={(e) => handleCertificationChange(cert.id, "certificateLink", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="https://example.com/certificate"
                          />
                        </div>
                        
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleRemoveCertification(cert.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                          >
                            <Trash2 size={16} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className="text-lg font-semibold">{cert.courseName || "Untitled Course"}</h4>
                        <p className="text-gray-600">{cert.platform || "Unknown Platform"}</p>
                        
                        {cert.completionDate && (
                          <p className="text-gray-500 text-sm mt-1">
                            Completed on: {new Date(cert.completionDate).toLocaleDateString()}
                          </p>
                        )}
                        
                        {cert.certificateLink && (
                          <div className="mt-3">
                            <a
                              href={cert.certificateLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <Eye size={16} />
                              View Certificate
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Competitions Tab */}
        {activeTab === "competitions" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">My Competitions</h3>
              {isEditing && (
                <button
                  onClick={handleAddCompetition}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  <PlusCircle size={16} />
                  Add Competition
                </button>
              )}
            </div>
            
            {userData.competitions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Flag size={48} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No competitions added yet.</p>
                {isEditing && (
                  <button
                    onClick={handleAddCompetition}
                    className="mt-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Add your first competition
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {userData.competitions.map((comp) => (
                  <div key={comp.id} className="bg-white p-4 rounded-lg shadow">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Competition Name</label>
                          <input
                            type="text"
                            value={comp.name}
                            onChange={(e) => handleCompetitionChange(comp.id, "name", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Competition Name"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                          <select
                            value={comp.type}
                            onChange={(e) => handleCompetitionChange(comp.id, "type", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select Type</option>
                            <option value="Hackathon">Hackathon</option>
                            <option value="Olympiad">Olympiad</option>
                            <option value="Ideathon">Ideathon</option>
                            <option value="Coding Battle">Coding Battle</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ranking/Position</label>
                          <input
                            type="text"
                            value={comp.ranking}
                            onChange={(e) => handleCompetitionChange(comp.id, "ranking", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="1st Place, Top 10, etc."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Team Information</label>
                          <input
                            type="text"
                            value={comp.teamInfo}
                            onChange={(e) => handleCompetitionChange(comp.id, "teamInfo", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Team name, members, etc."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                          <input
                            type="date"
                            value={comp.date}
                            onChange={(e) => handleCompetitionChange(comp.id, "date", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Proof Link</label>
                          <input
                            type="url"
                            value={comp.proofLink}
                            onChange={(e) => handleCompetitionChange(comp.id, "proofLink", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="https://example.com/competition-proof"
                          />
                        </div>
                        
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleRemoveCompetition(comp.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                          >
                            <Trash2 size={16} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between">
                          <h4 className="text-lg font-semibold">{comp.name || "Untitled Competition"}</h4>
                          {comp.type && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {comp.type}
                            </span>
                          )}
                        </div>
                        
                        {comp.ranking && (
                          <p className="text-green-600 font-medium mt-1">{comp.ranking}</p>
                        )}
                        
                        {comp.teamInfo && (
                          <p className="text-gray-600 mt-1">{comp.teamInfo}</p>
                        )}
                        
                        {comp.date && (
                          <p className="text-gray-500 text-sm mt-1">
                            Date: {new Date(comp.date).toLocaleDateString()}
                          </p>
                        )}
                        
                        {comp.proofLink && (
                          <div className="mt-3">
                            <a
                              href={comp.proofLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <Eye size={16} />
                              View Proof
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Points & Badges Tab */}
        {activeTab === "badges" && (
          <div className="space-y-6">
            {/* Leaderboard Status */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-4">Leaderboard Status</h3>
              
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={userData.leaderboardStatus}
                    onChange={(e) => setUserData(prev => ({ ...prev, leaderboardStatus: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="5-star, Top-10, etc."
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <BarChart2 size={20} className="text-blue-500" />
                  <span className="text-lg font-semibold">
                    {userData.leaderboardStatus || "Not ranked yet"}
                  </span>
                </div>
              )}
            </div>
            
            {/* Points */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-4">Achievement Points</h3>
              
              {isEditing ? (
                <div>
                  <input
                    type="number"
                    value={userData.points}
                    onChange={(e) => setUserData(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap size={20} className="text-yellow-500" />
                  <span className="text-lg font-semibold">{userData.points} points</span>
                </div>
              )}
              
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  Points are earned through participation in events, completing challenges, and other activities.
                </p>
              </div>
            </div>
            
            {/* Badges */}
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Badges</h3>
                {isEditing && (
                  <button
                    onClick={() => {
                      const newBadge = {
                        id: Date.now(),
                        name: "",
                        description: "",
                        earnedOn: new Date().toISOString().split('T')[0],
                        icon: ""
                      };
                      setUserData(prev => ({
                        ...prev,
                        badges: [...prev.badges, newBadge]
                      }));
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    <PlusCircle size={16} />
                    Add Badge
                  </button>
                )}
              </div>
              
              {userData.badges.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Medal size={48} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500">No badges earned yet.</p>
                  {isEditing && (
                    <button
                      onClick={() => {
                        const newBadge = {
                          id: Date.now(),
                          name: "",
                          description: "",
                          earnedOn: new Date().toISOString().split('T')[0],
                          icon: ""
                        };
                        setUserData(prev => ({
                          ...prev,
                          badges: [...prev.badges, newBadge]
                        }));
                      }}
                      className="mt-2 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Add your first badge
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {userData.badges.map((badge) => (
                    <div key={badge.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Badge Name</label>
                            <input
                              type="text"
                              value={badge.name}
                              onChange={(e) => {
                                setUserData(prev => ({
                                  ...prev,
                                  badges: prev.badges.map(b => 
                                    b.id === badge.id ? { ...b, name: e.target.value } : b
                                  )
                                }));
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Badge Name"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                              value={badge.description}
                              onChange={(e) => {
                                setUserData(prev => ({
                                  ...prev,
                                  badges: prev.badges.map(b => 
                                    b.id === badge.id ? { ...b, description: e.target.value } : b
                                  )
                                }));
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Badge Description"
                              rows="2"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Earned On</label>
                            <input
                              type="date"
                              value={badge.earnedOn}
                              onChange={(e) => {
                                setUserData(prev => ({
                                  ...prev,
                                  badges: prev.badges.map(b => 
                                    b.id === badge.id ? { ...b, earnedOn: e.target.value } : b
                                  )
                                }));
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji or URL)</label>
                            <input
                              type="text"
                              value={badge.icon}
                              onChange={(e) => {
                                setUserData(prev => ({
                                  ...prev,
                                  badges: prev.badges.map(b => 
                                    b.id === badge.id ? { ...b, icon: e.target.value } : b
                                  )
                                }));
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="🏆 or https://example.com/icon.png"
                            />
                          </div>
                          
                          <div className="flex justify-end">
                            <button
                              onClick={() => {
                                setUserData(prev => ({
                                  ...prev,
                                  badges: prev.badges.filter(b => b.id !== badge.id)
                                }));
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                            >
                              <Trash2 size={16} />
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <div className="text-3xl mb-2">{badge.icon || "🏆"}</div>
                          <h4 className="font-semibold">{badge.name || "Unnamed Badge"}</h4>
                          <p className="text-sm text-gray-600 mt-1">{badge.description || "No description provided."}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            Earned on: {badge.earnedOn ? new Date(badge.earnedOn).toLocaleDateString() : "Unknown date"}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileExcellence;
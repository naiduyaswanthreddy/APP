import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaPlus, FaBars, FaArrowLeft, FaDownload, FaTrashAlt, FaPlusCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ResumePDF from './pdfGenerator';

export default function LeftNavbar({ onMenuClick, onEdit, onDelete }) {
  const [isOpen, setIsOpen] = useState(true);
  const [editDeleteVisible, setEditDeleteVisible] = useState({});
  const navigate = useNavigate();
  const [customSectionName, setCustomSectionName] = useState('');
  const [showCustomSectionInput, setShowCustomSectionInput] = useState(false);
  const [menuItems, setMenuItems] = useState([
    'About Me', 'Experience', 'Education', 'Skills', 'Projects', 'Certifications'
  ]);

  // Load custom sections from localStorage on component mount
  useEffect(() => {
    const savedVisibility = JSON.parse(localStorage.getItem('editDeleteVisible'));
    if (savedVisibility) {
      setEditDeleteVisible(savedVisibility);
    }
    
    // Get custom sections from localStorage
    const savedComponents = JSON.parse(localStorage.getItem('selectedComponents')) || [];
    const customSections = savedComponents.filter(comp => 
      !['About Me', 'Experience', 'Education', 'Skills', 'Projects', 'Certifications'].includes(comp)
    );
    
    if (customSections.length > 0) {
      setMenuItems([...menuItems, ...customSections]);
    }
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const toggleEditDelete = (name) => {
    setEditDeleteVisible(prevState => {
      const newState = {
        ...prevState,
        [name]: !prevState[name]
      };
      localStorage.setItem('editDeleteVisible', JSON.stringify(newState));
      return newState;
    });
  };

  const clearCache = () => {
    // Clear resume-specific data only, preserve auth data
    const keysToKeep = ['userRole', 'companyId', 'authToken'];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });
    // Reset component state instead of full reload
    setEditDeleteVisible({});
    setMenuItems(['About Me', 'Experience', 'Education', 'Skills', 'Projects', 'Certifications']);
    window.location.reload(); // Temporary - will be replaced with proper state reset
  };

  const getResumeData = () => {
    const data = {};
    const menuItems = [
      'About Me', 'Experience', 'Education', 'Skills', 'Projects', 'Certifications',
      // Include any custom sections from localStorage
      ...Object.keys(localStorage)
        .filter(key => 
          !['selectedComponents', 'editDeleteVisible', 'edit', 'userRole', 'companyId'].includes(key) &&
          !['About Me', 'Experience', 'Education', 'Skills', 'Projects', 'Certifications'].includes(key)
        )
    ];
    
    menuItems.forEach(item => {
      try {
        const savedData = localStorage.getItem(item);
        if (savedData) {
          data[item] = JSON.parse(savedData);
        }
      } catch (error) {
        console.error(`Error parsing data for ${item}:`, error);
        // Skip this item if it can't be parsed
      }
    });
    
    return data;
  };

  const handleBack = () => {
    navigate('/student/profile');
  };

  const handleAddCustomSection = () => {
    if (customSectionName.trim() === '') return;
    
    // Add to menu items
    const newMenuItems = [...menuItems, customSectionName];
    setMenuItems(newMenuItems);
    
    // Initialize localStorage for this section
    localStorage.setItem(customSectionName, JSON.stringify({
      title: customSectionName,
      content: 'Add your content here'
    }));
    
    // Reset input
    setCustomSectionName('');
    setShowCustomSectionInput(false);
  };

  // In the return statement, add a button to add custom sections
  return (
    <div>
      <div className="h-16 w-full fixed top-0 left-0 bg-gradient-to-r from-indigo-900 to-teal-600 text-white flex justify-between items-center px-4 lg:hidden z-10">
        <button onClick={handleBack} className="text-white flex items-center">
          <FaArrowLeft className="h-5 w-5 mr-2" /> Back to Profile
        </button>
        <button onClick={toggleMenu} className="text-white">
          <FaBars className="h-6 w-6" />
        </button>
      </div>
      
      <div className={`h-full fixed top-0 left-0 bg-gradient-to-b from-indigo-900 to-teal-600 text-white flex flex-col p-4 space-y-6 transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-20'}`}>
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-white flex items-center hover:bg-white/10 rounded p-2"
          >
            <FaArrowLeft className="h-5 w-5 mr-2" />
            {isOpen && <span>Back</span>}
          </button>
          <button
            onClick={toggleMenu}
            className="bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors duration-200"
          >
            {isOpen ? <FaBars className="h-4 w-4 text-indigo-900" /> : <FaBars className="h-4 w-4 text-indigo-900" />}
          </button>
        </div>
        
        <div className="space-y-2 mt-8">
          {menuItems.map((name) => (
            <div key={name} className="w-full flex justify-between items-center py-2 px-3 rounded hover:bg-white/10 transition-colors">
              <span className="text-gray-300">{isOpen ? name : name.charAt(0)}</span>
              {editDeleteVisible[name] ? (
                <div className={`flex ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                  <button onClick={() => onEdit(name)} className="text-blue-400 hover:text-blue-300 mr-2">
                    <FaEdit />
                  </button>
                  <button onClick={() => {
                    onDelete(name);
                    toggleEditDelete(name);
                  }} className="text-red-400 hover:text-red-300">
                    <FaTrash />
                  </button>
                </div>
              ) : (
                <button onClick={() => {
                  onMenuClick(name);
                  toggleEditDelete(name);
                }} className="text-green-400 hover:text-green-300">
                  <FaPlus />
                </button>
              )}
            </div>
          ))}
          
          {/* Add custom section button */}
          {showCustomSectionInput ? (
            <div className="w-full flex items-center py-2 px-3 rounded bg-white/10">
              <input
                type="text"
                value={customSectionName}
                onChange={(e) => setCustomSectionName(e.target.value)}
                placeholder="Section name"
                className="flex-grow bg-transparent border-b border-white/30 outline-none text-white"
              />
              <button 
                onClick={handleAddCustomSection}
                className="ml-2 text-green-400 hover:text-green-300"
              >
                <FaPlus />
              </button>
              <button 
                onClick={() => {
                  setShowCustomSectionInput(false);
                  setCustomSectionName('');
                }}
                className="ml-2 text-red-400 hover:text-red-300"
              >
                <FaTrash />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomSectionInput(true)}
              className="w-full flex justify-between items-center py-2 px-3 rounded hover:bg-white/10 transition-colors"
            >
              <span className="text-gray-300">{isOpen ? "Add Custom Section" : "+"}</span>
              <FaPlusCircle className="text-blue-400" />
            </button>
          )}
        </div>
        
        <div className="mt-auto space-y-4">
          <PDFDownloadLink
            document={<ResumePDF resumeData={getResumeData()} />}
            fileName="resume.pdf"
            className="w-full flex justify-center items-center py-3 px-4 bg-white/20 hover:bg-white/30 rounded text-white transition-colors"
          >
            {({ blob, url, loading, error }) => (
              <>
                <FaDownload className="mr-2" />
                {isOpen && (loading ? "Preparing PDF..." : "Download Resume")}
              </>
            )}
          </PDFDownloadLink>
          
          <button
            onClick={clearCache}
            className="w-full flex justify-center items-center py-3 px-4 bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
          >
            <FaTrashAlt className="mr-2" />
            {isOpen && "Clear Cache"}
          </button>
        </div>
        
        <div className="text-center text-sm text-gray-300">
          <span>APP Resume Maker</span>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy, where, doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../../firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Loader from '../../loading'; // Add this import at the top
import { createCompanyActionNotification, createSystemAlertNotification } from '../../utils/notificationHelpers';

import { User, ThumbsUp, MessageSquare, Share2, Award, Briefcase, Code, BookOpen, Gift, Calendar, Filter, Trash2, Edit, Eye, Shield } from 'lucide-react';

const Gallery = () => {
  // State for posts, filters, and form
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [userData, setUserData] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  
  // Post form state
  const [postForm, setPostForm] = useState({
    title: '',
    category: '',
    description: '',
    tags: [],
    visibility: 'public',
    anonymous: false,
    files: [],
    fileUrls: [],
    featured: false,
    approvalStatus: 'approved' // Admin posts are auto-approved
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    categories: [],
    batches: [],
    approvalStatus: [],
    searchTerm: '',
    sortBy: 'newest'
  });
  
  const [showFilters, setShowFilters] = useState(false);
  
  // Categories with icons
  const categories = [
    { value: 'internship', label: 'Internship', icon: <Briefcase size={16} /> },
    { value: 'hackathon', label: 'Hackathon', icon: <Code size={16} /> },
    { value: 'certification', label: 'Certification', icon: <Award size={16} /> },
    { value: 'project', label: 'Project', icon: <Code size={16} /> },
    { value: 'placement', label: 'Placement', icon: <Briefcase size={16} /> },
    { value: 'award', label: 'Award', icon: <Gift size={16} /> },
    { value: 'other', label: 'Other', icon: <Calendar size={16} /> },
  ];
  
  // Approval status options
  const approvalStatuses = [
    { value: 'pending', label: 'Pending Approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
  ];
  
  useEffect(() => {
    fetchUserProfile();
    fetchPosts();
  }, []);
  
  const fetchUserProfile = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const adminRef = doc(db, 'admins', user.uid);
        const adminSnap = await getDoc(adminRef);
        
        if (adminSnap.exists()) {
          setUserData(adminSnap.data());
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };
  
  const fetchPosts = async () => {
    try {
      setLoading(true);
      const postsRef = collection(db, 'achievement_posts');
      const q = query(postsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const postsData = [];
      for (const docSnapshot of querySnapshot.docs) {
        const postData = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
          createdAt: docSnapshot.data().createdAt?.toDate() || new Date(),
        };
        
        // Fetch author data if not anonymous
        if (!postData.anonymous) {
          const authorRef = doc(db, 'students', postData.authorId);
          const authorSnap = await getDoc(authorRef);
          if (authorSnap.exists()) {
            postData.author = authorSnap.data();
          }
        }
        
        postsData.push(postData);
      }
      
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePostSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const user = auth.currentUser;
      
      if (!user) {
        toast.error('You must be logged in to post');
        return;
      }
      
      // Upload files if any
      const fileUrls = [...postForm.fileUrls]; // Keep existing files for editing
      for (const file of postForm.files) {
        if (file instanceof File) { // Only upload new files
          const fileRef = ref(storage, `achievement_posts/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          fileUrls.push({
            name: file.name,
            url: url,
            type: file.type
          });
        }
      }
      
      const postData = {
        title: postForm.title,
        category: postForm.category,
        description: postForm.description,
        tags: postForm.tags,
        visibility: postForm.visibility,
        anonymous: postForm.anonymous,
        fileUrls: fileUrls,
        featured: postForm.featured,
        approvalStatus: 'approved', // Admin posts are auto-approved
        updatedAt: serverTimestamp()
      };
      
      if (editingPost) {
        // Update existing post
        await updateDoc(doc(db, 'achievement_posts', editingPost.id), postData);
        toast.success('Post updated successfully!');
      } else {
        // Create new post
        await addDoc(collection(db, 'achievement_posts'), {
          ...postData,
          authorId: user.uid,
          authorType: 'admin',
          createdAt: serverTimestamp(),
          likes: 0,
          comments: [],
          views: 0
        });
        toast.success('Post created successfully!');
      }
      
      setShowPostForm(false);
      setEditingPost(null);
      resetPostForm();
      fetchPosts(); // Refresh posts
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error('Failed to save post');
    } finally {
      setLoading(false);
    }
  };
  
  const resetPostForm = () => {
    setPostForm({
      title: '',
      category: '',
      description: '',
      tags: [],
      visibility: 'public',
      anonymous: false,
      files: [],
      fileUrls: [],
      featured: false,
      approvalStatus: 'approved'
    });
  };
  
  const handleEditPost = (post) => {
    setEditingPost(post);
    setPostForm({
      title: post.title,
      category: post.category,
      description: post.description,
      tags: post.tags || [],
      visibility: post.visibility || 'public',
      anonymous: post.anonymous || false,
      files: [],
      fileUrls: post.fileUrls || [],
      featured: post.featured || false,
      approvalStatus: post.approvalStatus || 'approved'
    });
    setShowPostForm(true);
  };
  
  const handleDeletePost = async () => {
    if (!postToDelete) return;
    
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'achievement_posts', postToDelete.id));
      toast.success('Post deleted successfully!');
      fetchPosts(); // Refresh posts
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setPostToDelete(null);
    }
  };
  
  const handleApprovePost = async (post) => {
    try {
      await updateDoc(doc(db, 'achievement_posts', post.id), {
        approvalStatus: 'approved',
        updatedAt: serverTimestamp()
      });
      
      // Send notification to student
      try {
        await createCompanyActionNotification(
          'Post Approved',
          `Your achievement post "${post.title}" has been approved and is now visible in the gallery.`,
          `/student/gallery`
        );
      } catch (error) {
        console.error('Error sending approval notification:', error);
      }

      // Send admin notification
      try {
        await createSystemAlertNotification(
          'Post Approved',
          `Achievement post "${post.title}" by ${post.studentName || 'Student'} has been approved.`,
          '/admin/gallery'
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Post approved successfully!');
      fetchPosts(); // Refresh posts
    } catch (error) {
      console.error('Error approving post:', error);
      toast.error('Failed to approve post');
    }
  };
  
  const handleRejectPost = async (post) => {
    try {
      await updateDoc(doc(db, 'achievement_posts', post.id), {
        approvalStatus: 'rejected',
        updatedAt: serverTimestamp()
      });

      // Send notification to student
      try {
        await createCompanyActionNotification(
          'Post Rejected',
          `Your achievement post "${post.title}" has been rejected. Please review the guidelines and submit again.`,
          `/student/gallery`
        );
      } catch (error) {
        console.error('Error sending rejection notification:', error);
      }

      // Send admin notification
      try {
        await createSystemAlertNotification(
          'Post Rejected',
          `Achievement post "${post.title}" by ${post.studentName || 'Student'} has been rejected.`,
          '/admin/gallery'
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success('Post rejected successfully!');
      fetchPosts(); // Refresh posts
    } catch (error) {
      console.error('Error rejecting post:', error);
      toast.error('Failed to reject post');
    }
  };
  
  const handleFeatureToggle = async (post) => {
    try {
      await updateDoc(doc(db, 'achievement_posts', post.id), {
        featured: !post.featured,
        updatedAt: serverTimestamp()
      });

      // Send admin notification
      try {
        await createSystemAlertNotification(
          'Post Featured Status Updated',
          `Achievement post "${post.title}" by ${post.studentName || 'Student'} has been ${!post.featured ? 'featured' : 'unfeatured'}.`,
          '/admin/gallery'
        );
      } catch (error) {
        console.error('Error sending admin notification:', error);
      }

      toast.success(`Post ${post.featured ? 'unfeatured' : 'featured'} successfully!`);
      fetchPosts(); // Refresh posts
    } catch (error) {
      console.error('Error updating featured status:', error);
      toast.error('Failed to update featured status');
    }
  };
  
  const getCategoryIcon = (category) => {
    const found = categories.find(c => c.value === category);
    return found ? found.icon : <Calendar size={16} />;
  };
  
  const getApprovalStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Approved</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Rejected</span>;
      case 'pending':
      default:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending</span>;
    }
  };
  
  const filteredPosts = posts.filter(post => {
    // Apply category filter
    if (filters.categories.length > 0 && !filters.categories.includes(post.category)) {
      return false;
    }
    
    // Apply batch filter
    if (filters.batches.length > 0 && post.author && 
        !filters.batches.includes(post.author.batch)) {
      return false;
    }
    
    // Apply approval status filter
    if (filters.approvalStatus.length > 0 && 
        !filters.approvalStatus.includes(post.approvalStatus || 'pending')) {
      return false;
    }
    
    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        post.title.toLowerCase().includes(searchLower) ||
        post.description.toLowerCase().includes(searchLower) ||
        (post.tags && post.tags.some(tag => tag.toLowerCase().includes(searchLower))) ||
        (!post.anonymous && post.author && post.author.name.toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });
  
  // Sort posts based on filter
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (filters.sortBy === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else if (filters.sortBy === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    } else if (filters.sortBy === 'mostLiked') {
      return (b.likes || 0) - (a.likes || 0);
    } else if (filters.sortBy === 'mostCommented') {
      return ((b.comments?.length || 0) - (a.comments?.length || 0));
    } else if (filters.sortBy === 'featured') {
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    }
    return 0;
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header with Create Post Button */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Achievements & Experience Wall</h2>
          <p className="text-gray-600">Manage and moderate student achievements</p>
        </div>
        <button
          onClick={() => {
            setEditingPost(null);
            resetPostForm();
            setShowPostForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Create Post
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search achievements..."
              className="w-full p-2 pl-10 border border-gray-300 rounded-lg"
              value={filters.searchTerm}
              onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter size={16} />
            <span>Filters</span>
          </button>
          
          <select
            className="p-2 border border-gray-300 rounded-lg"
            value={filters.sortBy}
            onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="mostLiked">Most Liked</option>
            <option value="mostCommented">Most Commented</option>
            <option value="featured">Featured First</option>
          </select>
        </div>
        
        {showFilters && (
          <div className="mt-4 p-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium mb-2">Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => (
                    <label key={category.value} className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.categories.includes(category.value)}
                        onChange={() => {
                          const newCategories = filters.categories.includes(category.value)
                            ? filters.categories.filter(c => c !== category.value)
                            : [...filters.categories, category.value];
                          setFilters({...filters, categories: newCategories});
                        }}
                        className="mr-2"
                      />
                      <span className="flex items-center">
                        {category.icon}
                        <span className="ml-1">{category.label}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Batches</h4>
                <div className="flex flex-wrap gap-2">
                  {['2022', '2023', '2024', '2025'].map(batch => (
                    <label key={batch} className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.batches.includes(batch)}
                        onChange={() => {
                          const newBatches = filters.batches.includes(batch)
                            ? filters.batches.filter(b => b !== batch)
                            : [...filters.batches, batch];
                          setFilters({...filters, batches: newBatches});
                        }}
                        className="mr-2"
                      />
                      <span>Batch {batch}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Approval Status</h4>
                <div className="flex flex-wrap gap-2">
                  {approvalStatuses.map(status => (
                    <label key={status.value} className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.approvalStatus.includes(status.value)}
                        onChange={() => {
                          const newStatuses = filters.approvalStatus.includes(status.value)
                            ? filters.approvalStatus.filter(s => s !== status.value)
                            : [...filters.approvalStatus, status.value];
                          setFilters({...filters, approvalStatus: newStatuses});
                        }}
                        className="mr-2"
                      />
                      <span>{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setFilters({
                  categories: [],
                  batches: [],
                  approvalStatus: [],
                  searchTerm: '',
                  sortBy: 'newest'
                })}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg mr-2"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Post Creation/Edit Modal */}
      {showPostForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">{editingPost ? 'Edit Post' : 'Create New Post'}</h3>
                <button
                  onClick={() => {
                    setShowPostForm(false);
                    setEditingPost(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handlePostSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="E.g., Important announcement about placements"
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      value={postForm.title}
                      onChange={(e) => setPostForm({...postForm, title: e.target.value})}
                      required
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-500 mt-1">{postForm.title.length}/100 characters</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      value={postForm.category}
                      onChange={(e) => setPostForm({...postForm, category: e.target.value})}
                      required
                    >
                      <option value="">Select a category</option>
                      {categories.map(category => (
                        <option key={category.value} value={category.value}>{category.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      placeholder="Provide details about the achievement or announcement..."
                      className="w-full p-2 border border-gray-300 rounded-lg min-h-[150px]"
                      value={postForm.description}
                      onChange={(e) => setPostForm({...postForm, description: e.target.value})}
                      required
                      maxLength={2000}
                    />
                    <p className="text-xs text-gray-500 mt-1">{postForm.description.length}/2000 characters</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <input
                      type="text"
                      placeholder="Add tags separated by commas (e.g., Important, Announcement, Deadline)"
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      value={postForm.tags.join(', ')}
                      onChange={(e) => {
                        const tagsArray = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                        setPostForm({...postForm, tags: tagsArray.slice(0, 5)});
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">Up to 5 tags, separated by commas</p>
                  </div>
                  









                  
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                      <select
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        value={postForm.visibility}
                        onChange={(e) => setPostForm({...postForm, visibility: e.target.value})}
                      >
                        <option value="public">Public (All Students)</option>
                        <option value="batch">Batch Only</option>
                        <option value="faculty">Faculty Only</option>
                        <option value="private">Private (Admin Only)</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center mt-6 mr-4">
                      <input
                        type="checkbox"
                        id="anonymous"
                        checked={postForm.anonymous}
                        onChange={(e) => setPostForm({...postForm, anonymous: e.target.checked})}
                        className="mr-2"
                      />
                      <label htmlFor="anonymous" className="text-sm text-gray-700">Post Anonymously</label>
                    </div>
                    
                    <div className="flex items-center mt-6">
                      <input
                        type="checkbox"
                        id="featured"
                        checked={postForm.featured}
                        onChange={(e) => setPostForm({...postForm, featured: e.target.checked})}
                        className="mr-2"
                      />
                      <label htmlFor="featured" className="text-sm text-gray-700">Feature this post</label>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPostForm(false);
                      setEditingPost(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (editingPost ? 'Update Post' : 'Create Post')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-6">Are you sure you want to delete this post? This action cannot be undone.</p>
            
            <div className="flex justify-end space-x-3">
              <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Post'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Posts Grid */}
      {loading ? (
              <div className="fixed top-0 left-[20%] right-0 bottom-0 bg-gray-200 bg-opacity-10 flex items-center justify-center z-50">
              <Loader />
              </div>
      ) : sortedPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedPosts.map(post => (
            <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
              {/* Admin Actions */}
              <div className="p-2 bg-gray-50 border-b flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  {getApprovalStatusBadge(post.approvalStatus || 'pending')}
                  
                  {post.featured && (
                    <span className="flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      <Award size={12} className="mr-1" />
                      Featured
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Approval Actions */}
                  {(post.approvalStatus === 'pending' || post.approvalStatus === 'rejected') && (
                    <button
                      onClick={() => handleApprovePost(post)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                      title="Approve"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  
                  {(post.approvalStatus === 'pending' || post.approvalStatus === 'approved') && (
                    <button
                      onClick={() => handleRejectPost(post)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Reject"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Feature Toggle */}
                  <button
                    onClick={() => handleFeatureToggle(post)}
                    className={`p-1 ${post.featured ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-600 hover:bg-gray-100'} rounded`}
                    title={post.featured ? 'Unfeature' : 'Feature'}
                  >
                    <Award size={18} />
                  </button>
                  
                  {/* Edit Button */}
                  <button
                    onClick={() => handleEditPost(post)}
                    className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                  
                  <button
                    onClick={() => {
                      setPostToDelete(post);
                      setShowDeleteConfirm(true);
                    }}
                    className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {/* Post Header */}
              <div className="p-4 border-b">
                <div className="flex items-start gap-3">
                  {post.anonymous ? (
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <User size={20} className="text-gray-500" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      {post.authorType === 'admin' ? (
                        <Shield size={20} className="text-blue-600" />
                      ) : (
                        post.author?.name?.charAt(0) || <User size={20} />
                      )}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {post.anonymous ? 'Anonymous' : 
                         post.authorType === 'admin' ? 'Admin' : 
                         post.author?.name || 'Unknown'}
                      </h3>
                      {!post.anonymous && post.author?.batch && (
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                          Batch {post.author.batch}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {post.createdAt.toLocaleDateString()} • 
                      <span className="inline-flex items-center">
                        {getCategoryIcon(post.category)}
                        <span className="ml-1">
                          {categories.find(c => c.value === post.category)?.label || 'Other'}
                        </span>
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Post Content */}
              <div className="p-4">
                <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
                <p className="text-gray-700 mb-4 line-clamp-3">{post.description}</p>
                
                {/* Attachments */}
                {/* {post.fileUrls && post.fileUrls.length > 0 && (
                  <div className="mb-4">
                    <div className="grid grid-cols-2 gap-2">
                      {post.fileUrls.map((file, index) => (
                        <div key={index} className="relative">
                          {file.type && file.type.startsWith('image/') ? (
                            <img 
                              src={file.url} 
                              alt={file.name} 
                              className="w-full h-40 object-cover rounded-lg"
                            />
                          ) : (
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-center h-40 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                            >
                              <div className="text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-sm text-gray-700 mt-2 block truncate px-2">
                                  {file.name}
                                </span>
                              </div>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )} */}
                
                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Engagement */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-gray-500">
                      <ThumbsUp size={18} />
                      <span>{post.likes || 0}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-gray-500">
                      <MessageSquare size={18} />
                      <span>{post.comments?.length || 0}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-gray-500">
                      <Eye size={18} />
                      <span>{post.views || 0}</span>
                    </div>
                  </div>
                  
                  <button className="text-gray-500 hover:text-blue-600">
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <Award size={48} className="text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">
              No achievements found
            </h3>
            <p className="text-gray-500 mb-6">
              {filters.categories.length > 0 || filters.batches.length > 0 || filters.approvalStatus.length > 0 || filters.searchTerm
                ? 'No posts match your current filters. Try adjusting your search criteria.'
                : 'Create the first post to showcase student achievements!'}
            </p>
            <button
              onClick={() => setShowPostForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Create Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
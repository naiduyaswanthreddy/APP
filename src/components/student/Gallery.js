import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy, where, doc, getDoc, updateDoc, serverTimestamp, increment, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../../firebase';
import { toast } from "react-toastify";
import { User, ThumbsUp, MessageSquare, Share2, Award, Briefcase, Code, BookOpen, Gift, Calendar, Filter, Trophy, Bell, Star, Medal } from 'lucide-react';

const Gallery = () => {
  // State for posts, filters, and form
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [userData, setUserData] = useState(null);
  
  // Post form state
  const [postForm, setPostForm] = useState({
    title: '',
    category: '',
    description: '',
    tags: [],
    visibility: 'public',
    anonymous: false,
    files: [],
    fileUrls: []
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    categories: [],
    batches: [],
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
  
  useEffect(() => {
    fetchUserProfile();
    fetchPosts();
  }, []);
  
  const fetchUserProfile = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const studentRef = doc(db, "students", user.uid);
        const studentSnap = await getDoc(studentRef);
        
        if (studentSnap.exists()) {
          setUserData(studentSnap.data());
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
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
          const authorRef = doc(db, "students", postData.authorId);
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
      const fileUrls = [];
      for (const file of postForm.files) {
        const fileRef = ref(storage, `achievement_posts/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        fileUrls.push({
          name: file.name,
          url: url,
          type: file.type
        });
      }
      
      // Create post document
      await addDoc(collection(db, 'achievement_posts'), {
        title: postForm.title,
        category: postForm.category,
        description: postForm.description,
        tags: postForm.tags,
        visibility: postForm.visibility,
        anonymous: postForm.anonymous,
        fileUrls: fileUrls,
        authorId: user.uid,
        createdAt: serverTimestamp(),
        likes: 0,
        comments: [],
        views: 0
      });
      
      toast.success('Post created successfully!');
      setShowPostForm(false);
      setPostForm({
        title: '',
        category: '',
        description: '',
        tags: [],
        visibility: 'public',
        anonymous: false,
        files: [],
        fileUrls: []
      });
      fetchPosts(); // Refresh posts
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLike = async (postId) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      // Check if user already liked
      const likesRef = collection(db, 'post_likes');
      const q = query(likesRef, where('postId', '==', postId), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Add like
        await addDoc(collection(db, 'post_likes'), {
          postId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        
        // Update post like count
        const postRef = doc(db, 'achievement_posts', postId);
        await updateDoc(postRef, {
          likes: posts.find(p => p.id === postId).likes + 1
        });
        
        // Update local state
        setPosts(posts.map(post => 
          post.id === postId ? {...post, likes: post.likes + 1, userLiked: true} : post
        ));
      } else {
        toast.info('You already liked this post');
      }
    } catch (error) {
      console.error('Error liking post:', error);
      toast.error('Failed to like post');
    }
  };
  
  const getCategoryIcon = (category) => {
    const found = categories.find(c => c.value === category);
    return found ? found.icon : <Calendar size={16} />;
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
    
    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        post.title.toLowerCase().includes(searchLower) ||
        post.description.toLowerCase().includes(searchLower) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        (post.author && post.author.name.toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });
  
  // Sort posts based on filter
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (filters.sortBy === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else if (filters.sortBy === 'mostLiked') {
      return b.likes - a.likes;
    } else if (filters.sortBy === 'mostCommented') {
      return (b.comments?.length || 0) - (a.comments?.length || 0);
    }
    return 0;
  });

  return (
    <div className="container mx-auto px-0 py-6">
      
      {/* Header with Create Post Button */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Achievements & Experience Wall</h2>
          <p className="text-gray-600">Share and celebrate achievements with your peers</p>
        </div>
        <button
          onClick={() => setShowPostForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Share Achievement
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
            <option value="mostLiked">Most Liked</option>
            <option value="mostCommented">Most Commented</option>
          </select>
        </div>
        
        {showFilters && (
          <div className="mt-4 p-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setFilters({
                  categories: [],
                  batches: [],
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
      
      {/* Post Creation Modal */}
      {showPostForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Share Your Achievement</h3>
                <button
                  onClick={() => setShowPostForm(false)}
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
                      placeholder="E.g., Secured internship at Google"
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
                      placeholder="Share your experience, learnings, or advice..."
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
                      placeholder="Add tags separated by commas (e.g., Python, AI, Remote)"
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      value={postForm.tags.join(', ')}
                      onChange={(e) => {
                        const tagsArray = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                        setPostForm({...postForm, tags: tagsArray.slice(0, 5)});
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">Up to 5 tags, separated by commas</p>
                  </div>
                  


{/*                   
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          const fileList = Array.from(e.target.files);
                          setPostForm({...postForm, files: fileList});
                        }}
                        className="hidden"
                        id="file-upload"
                        accept="image/*,.pdf"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="text-sm text-gray-500">Click to upload or drag and drop</span>
                          <span className="text-xs text-gray-500">Images (JPEG, PNG) or PDFs (max 5MB)</span>
                        </div>
                      </label>
                    </div>
                    
                    {postForm.files.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {Array.from(postForm.files).map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newFiles = [...postForm.files];
                                newFiles.splice(index, 1);
                                setPostForm({...postForm, files: newFiles});
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div> */}



                  
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
                    
                    <div className="flex items-center mt-6">
                      <input
                        type="checkbox"
                        id="anonymous"
                        checked={postForm.anonymous}
                        onChange={(e) => setPostForm({...postForm, anonymous: e.target.checked})}
                        className="mr-2"
                      />
                      <label htmlFor="anonymous" className="text-sm text-gray-700">Post Anonymously</label>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowPostForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Posting...' : 'Post Achievement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Posts Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : sortedPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedPosts.map(post => (
            <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
              {/* Post Header */}
              <div className="p-4 border-b">
                <div className="flex items-start gap-3">
                  {post.anonymous ? (
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <User size={20} className="text-gray-500" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      {post.author?.name?.charAt(0) || <User size={20} />}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {post.anonymous ? 'Anonymous' : post.author?.name || 'Unknown'}
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
                          {file.type.startsWith('image/') ? (
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
                    <button 
                      onClick={() => handleLike(post.id)}
                      className="flex items-center gap-1 text-gray-500 hover:text-blue-600"
                    >
                      <ThumbsUp size={18} className={post.userLiked ? 'text-blue-600' : ''} />
                      <span>{post.likes || 0}</span>
                    </button>
                    
                    <button className="flex items-center gap-1 text-gray-500 hover:text-blue-600">
                      <MessageSquare size={18} />
                      <span>{post.comments?.length || 0}</span>
                    </button>
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
              {filters.categories.length > 0 || filters.batches.length > 0 || filters.searchTerm
                ? 'No posts match your current filters. Try adjusting your search criteria.'
                : 'Be the first to share your achievement or experience!'}
            </p>
            <button
              onClick={() => setShowPostForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Share Your Achievement
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
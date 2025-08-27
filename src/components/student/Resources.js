// Remove the hardcoded categories array at the top
import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase";
import { collection, getDocs, query, where, setDoc, doc } from "firebase/firestore";
import { FaRegBookmark, FaBookmark, FaBook } from "react-icons/fa";
import { toast } from "react-toastify"; // Import toast



const Resources = () => {
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredResources, setFilteredResources] = useState([]);
  const [latestResources, setLatestResources] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [bookmarked, setBookmarked] = useState([]);
  const [showBookmarked, setShowBookmarked] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchResources();
    fetchBookmarks();
  }, []);

  const fetchCategories = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "resource_categories"));
      const fetchedCategories = querySnapshot.docs.map(doc => doc.data().name);
      setCategories(["All", ...fetchedCategories]);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to fetch categories");
    }
  };

  const fetchResources = async () => {
    const querySnapshot = await getDocs(collection(db, "resources"));
    let fetchedResources = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // ✅ Handle missing `createdAt` by sorting manually
    fetchedResources = fetchedResources.sort((a, b) => 
      (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0))
    );
  
    setResources(fetchedResources);
    setFilteredResources(fetchedResources);
    setLatestResources(fetchedResources.slice(0, 4)); // ✅ Get latest 3
  };
  

  const fetchBookmarks = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const bookmarksRef = collection(db, "bookmarks");
      const q = query(bookmarksRef, where("student_id", "==", user.uid));
      const querySnapshot = await getDocs(q);

      const bookmarksData = querySnapshot.docs.map((doc) => doc.data().resource_id);
      setBookmarked(bookmarksData);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      toast.error("Failed to fetch bookmarks");
    }
  };

  const toggleBookmark = async (resourceId) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const bookmarkRef = doc(db, "bookmarks", `${user.uid}_${resourceId}`);
      if (bookmarked.includes(resourceId)) {
        await setDoc(bookmarkRef, { student_id: user.uid, resource_id: resourceId });
        setBookmarked(bookmarked.filter((id) => id !== resourceId));
      } else {
        await setDoc(bookmarkRef, { student_id: user.uid, resource_id: resourceId });
        setBookmarked([...bookmarked, resourceId]);
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      toast.error("Failed to update bookmark");
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    filterResources(selectedCategory, query);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    filterResources(category, searchQuery);
  };

  const filterResources = (category, query) => {
    let filtered = resources.filter((resource) =>
      resource.title.toLowerCase().includes(query) ||
      resource.description?.toLowerCase().includes(query) ||
      resource.type.toLowerCase().includes(query) ||
      (Array.isArray(resource.category) 
        ? resource.category.join(", ").toLowerCase() 
        : String(resource.category || "").toLowerCase()
      ).includes(query) // ✅ Fix applied
    );
  
    if (category !== "All") {
      filtered = filtered.filter((resource) =>
        Array.isArray(resource.category) ? resource.category.includes(category) : resource.category === category
      );
    }
  
    setFilteredResources(filtered);
  };

  return (
    <div className="px-3 sm:px-6 py-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header with Search and Bookmarked Button */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-2xl font-semibold">Learning Resources</h2>
        <div className="flex gap-3 sm:gap-4 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search for anything..."
            value={searchQuery}
            onChange={handleSearch}
            className="border p-2 rounded-md shadow-sm w-full sm:w-80 outline-none"
          />
          <button
            onClick={() => setShowBookmarked(!showBookmarked)}
            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition flex items-center gap-2"
          >
            {showBookmarked ? <FaBook className="text-lg" /> : <FaRegBookmark className="text-lg" />}
          </button>
        </div>
      </div>

      {/* Latest Resources */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Latest Uploads</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {latestResources.map((resource) => (
            <div
              key={resource.id}
              className="p-4 bg-white rounded-2xl shadow-md flex flex-col items-center justify-between"
            >
              <h4 className="font-semibold text-center">{resource.title}</h4>
              <p className="text-gray-600 text-sm">{Array.isArray(resource.category) ? resource.category.join(", ") : resource.category}</p>
              <a href={resource.link} target="_blank" rel="noopener noreferrer">
                <button className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition">
                  View
                </button>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="flex space-x-3 overflow-x-auto">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryChange(category)}
            className={`px-4 py-2 rounded-lg ${
              selectedCategory === category
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Resources List */}
      <div>
        <h3 className="text-xl font-semibold">
          {showBookmarked ? "Bookmarked Resources" : "All Resources"}
        </h3>
        <div className="grid gap-4">
          {filteredResources.length > 0 ? (
            (showBookmarked
              ? filteredResources.filter((res) => bookmarked.includes(res.id))
              : filteredResources
            ).map((resource) => (
              <div
                key={resource.id}
                className="p-6 bg-white rounded-lg shadow-md flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3"
              >
                <div>
                  <h3 className="font-semibold text-lg">{resource.title}</h3>
                  <p className="text-gray-600">{resource.description}</p>
                  <p className="text-gray-500 text-sm">
                   Type: {resource.type} | Categories: {Array.isArray(resource.category) ? resource.category.join(", ") : resource.category}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <a href={resource.link} target="_blank" rel="noopener noreferrer">
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
                      Access
                    </button>
                  </a>
                  <button onClick={() => toggleBookmark(resource.id)}>
                    {bookmarked.includes(resource.id) ? (
                      <FaBookmark className="text-yellow-500" />
                    ) : (
                      <FaRegBookmark />
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500">
              <p>No resources available.</p>
              <button className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition">
                Request Resources
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Resources;

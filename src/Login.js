import React, { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { doc, getDoc, query, where, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { User, Building2 } from "lucide-react";
import { isValidRollNumber } from './utils/studentIdentity';
import { ThemeContext } from './context/ThemeContext';
import ThemeToggle from './components/ui/ThemeToggle';

const Login = () => {
  const { isDarkMode } = useContext(ThemeContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const storedRole = localStorage.getItem("userRole");
        if (storedRole) {
          navigate(`/${storedRole}`, { replace: true });
        }
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
  
    try {
      // First attempt login without setting role
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Verify if the user has the selected role by checking Firestore
      if (selectedRole === "admin") {
        // Check if user exists in admins collection
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        
        if (adminDoc.exists()) {
          // User is an admin, set role and navigate
          localStorage.setItem("userRole", "admin");
          navigate("/admin", { replace: true });
        } else {
          // User is not an admin
          setError("You don't have admin privileges. Please select the correct role.");
          await signOut(auth); // Sign out the user
          localStorage.removeItem("userRole");
          setLoading(false);
        }
      } else if (selectedRole === "student") {
        // Check if user exists in students collection (by uid or rollNumber fallback)
        const studentDoc = await getDoc(doc(db, 'students', user.uid));
        let exists = studentDoc.exists();
        if (!exists) {
          // Legacy path: try by email to find a student document to map
          try {
            const q = query(collection(db, 'students'), where('email', '==', user.email));
            const snap = await getDocs(q);
            exists = !snap.empty;
            if (exists) {
              const roll = snap.docs[0].data()?.rollNumber;
              if (roll && isValidRollNumber(roll)) {
                localStorage.setItem('rollNumber', roll);
              }
            }
          } catch (_e) {}
        } else {
          const roll = studentDoc.data()?.rollNumber;
          if (roll && isValidRollNumber(roll)) {
            localStorage.setItem('rollNumber', roll);
          } else {
            console.warn('Login: student has no rollNumber set. Please update profile.');
          }
        }

        if (exists) {
          localStorage.setItem("userRole", "student");
          navigate("/student", { replace: true });
        } else {
          // User is not a student
          setError("You don't have student access. Please select the correct role.");
          await signOut(auth); // Sign out the user
          localStorage.removeItem("userRole");
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === 'auth/network-request-failed') {
        setError("Network error. Please check your connection and refresh the page.");
      } else {
        setError("Invalid credentials. Please try again.");
      }
      setLoading(false);
      // Clear role from storage if login fails
      localStorage.removeItem("userRole");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md p-6 relative">
        {/* Theme Toggle */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        {/* Header */}
        <div className="text-center mb-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Welcome Back</h2>
          <p className="text-gray-600 dark:text-gray-300">Please select your role and login</p>
        </div>
        
        {/* Role Selection */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              onClick={() => setSelectedRole("student")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ease-in-out ${
                selectedRole === "student"
                  ? "bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400 transform scale-100"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transform scale-100"
              }`}
            >
              <User size={18} />
              <span>Student</span>
            </button>
            <button
              onClick={() => setSelectedRole("admin")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ease-in-out ${
                selectedRole === "admin"
                  ? "bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400 transform scale-100"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transform scale-100"
              }`}
            >
              <Building2 size={18} />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 p-3 rounded-lg text-sm mb-4 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
        
        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-700 dark:hover:bg-blue-800 dark:disabled:bg-blue-500 text-white font-medium p-3 rounded-lg transition-all duration-200 ease-in-out flex justify-center items-center min-h-[48px]"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
                <span>Logging in...</span>
              </div>
            ) : (
              `Login as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Forgot your password? Contact support
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Don't have an account?{" "}
            <Link to="/signup" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

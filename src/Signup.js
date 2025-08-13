import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from ".//firebase";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Building2 } from "lucide-react";

const Signup = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    rollNumber: "",
    batch: "",
    program: "BTech",
    department: "",
    passoutYear: "",
    mobile: "",
    github: "",
    leetcode: "",
    hackerrank: "",
  });

  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState("student");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password should be at least 6 characters");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: formData.name });

      if (selectedRole === "student") {
        // Store student data in Firestore
        await setDoc(doc(db, 'students', user.uid), {
          name: formData.name,
          email: formData.email,
          rollNumber: formData.rollNumber,
          batch: formData.batch,
          program: formData.program,
          department: formData.department,
          passoutYear: formData.passoutYear,
          mobile: formData.mobile,
          github: formData.github,
          leetcode: formData.leetcode,
          hackerrank: formData.hackerrank,
          role: "student",
          createdAt: new Date()
        });
        
        // Set the role in localStorage
        localStorage.setItem("userRole", "student");
        navigate("/student");
      } else {
        // Store admin data in Firestore
        await setDoc(doc(db, 'admins', user.uid), {
          name: formData.name,
          email: formData.email,
          mobile: formData.mobile,
          role: "admin",
          createdAt: new Date()
        });
        
        // Set the role in localStorage
        localStorage.setItem("userRole", "admin");
        navigate("/admin");
      }
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setError("Email already exists");
      } else {
        setError("Error creating account. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-4">Create Account</h2>

        {/* Role Selection */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedRole("student")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                selectedRole === "student"
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <User size={18} />
              <span>Student</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole("admin")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                selectedRole === "admin"
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Building2 size={18} />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4">{error}</div>}

        <form onSubmit={handleSignup} className="space-y-4">
          <input name="name" type="text" placeholder="Full Name" onChange={handleChange} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          <input name="email" type="email" placeholder="Email Address" onChange={handleChange} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          <input name="mobile" type="text" placeholder="Mobile Number" onChange={handleChange} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          
          {selectedRole === "student" && (
            <>
              <input name="rollNumber" type="text" placeholder="Roll Number" onChange={handleChange} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              <select name="program" onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required>
                <option value="">Select Degree</option>
                <option value="BTech">BTech</option>
                <option value="MBA">MBA</option>
              </select>
              <input name="passoutYear" type="text" placeholder="Passout Year" onChange={handleChange} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              <select name="department" onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required>
                <option value="">Select Department</option>
                <option value="CSE">CSE</option>
                <option value="IT">IT</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="ME">ME</option>
                <option value="CE">CE</option>
                <option value="CHE">CHE</option>
                <option value="AIE">AIE</option>
                <option value="CCE">CCE</option>
              </select>
              <input name="github" type="text" placeholder="GitHub Profile Link" onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              <input name="leetcode" type="text" placeholder="LeetCode Profile Link" onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              <input name="hackerrank" type="text" placeholder="HackerRank Profile Link" onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </>
          )}

          <input name="password" type="password" placeholder="Password" onChange={handleChange} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          <input name="confirmPassword" type="password" placeholder="Confirm Password" onChange={handleChange} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg">
            Sign Up as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
          </button>
        </form>

        <p className="text-center mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;

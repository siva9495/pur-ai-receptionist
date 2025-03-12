import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ref, set, get, child } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app, db } from "../Firebase/Firebase";
import img from '../Images/purviewlogo.png'

const AdminSigninPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const auth = getAuth(app);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const dbRef = ref(db);
      const snapshot = await get(child(dbRef, `JPMCReceptionistAdmin/${user.uid}`));

      if (!snapshot.exists()) {
        // Save the user to the database for the first time
        await set(ref(db, `JPMCReceptionistAdmin/${user.uid}`), {
          email: user.email,
          status: "available",
        });

        // Store user details in localStorage
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userId", user.uid);  // Save UID

        toast.success("Welcome back!");
        navigate("/AdminDashboardPage", { state: { email: user.email } });
      } else {
        toast.success("Welcome back!");
        // Store user details in localStorage
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userId", user.uid);  // Save UID

        navigate("/AdminDashboardPage", { state: { email: user.email } });
      }
    } catch (error) {
      toast.error(error.message || "An error occurred. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Responsive Navbar */}
      <nav className="bg-gradient-to-t from-[rgb(12,25,97)] to-[rgb(12,25,97)]/5 backdrop-blur-md border border-white/20 shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center justify-between relative">
            <div className="h-12 flex items-center">
              <img
                className="h-10 filter invert brightness-0"
                src={img}
                alt="Purview Logo"
              />
            </div>
            <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl sm:text-2xl font-bold text-white whitespace-nowrap">
              Assistant Sign In
            </h1>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4">
        {/* Left Section - Hero Image */}
        <div className="hidden lg:flex lg:w-2/3 rounded-3xl overflow-hidden relative">
          <div
            className="w-full h-full bg-cover bg-center"
            style={{
              backgroundImage: `url(https://images.unsplash.com/photo-1616763355603-9755a640a287?ixlib=rb-1.2.1&auto=format&fit=crop&w=1470&q=80)`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center px-8 sm:px-12 lg:px-20">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  Login as an assistant
                </h2>
                <p className="max-w-xl mt-3 text-gray-300">
                  Please login with your credentials.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Login Form */}
        <div className="w-full lg:w-1/3 p-6 sm:p-8 rounded-3xl bg-gradient-to-l from-[rgb(12,25,97)]/20 to-transparent">
          <div className="max-w-md mx-auto">
            {/* Logo and Title */}
            <div className="text-center">
              <img
                className="h-12 mx-auto filter invert brightness-0"
                src={img}
                alt="Purview Logo"
              />
              <p className="mt-3 text-lg font-medium text-white">
                Sign in to access your account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSignIn} className="mt-8 space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm text-white mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 focus:border-[rgb(12,25,97)] focus:ring-2 focus:ring-[rgb(12,25,97)] focus:ring-opacity-40 text-gray-700 placeholder-gray-400"
                  placeholder="example@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm text-white mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 focus:border-[rgb(12,25,97)] focus:ring-2 focus:ring-[rgb(12,25,97)] focus:ring-opacity-40 text-gray-700 placeholder-gray-400"
                  placeholder="Your Password"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-2/3 mx-auto block px-4 py-2 text-white bg-black rounded-lg hover:bg-[rgb(12,25,97)] transition-colors duration-200 font-bold"
                disabled={loading}
              >
                {loading ? "Loading..." : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-sm text-center text-gray-400">
              <a
                href="#"
                className="text-[rgb(12,25,97)] hover:underline focus:outline-none focus:underline"
              >
                Forgot Password?
              </a>
            </p>
            <p className="mt-6 text-sm text-center text-gray-400">
              <a
                href="/signup"
                className="text-[rgb(12,25,97)] hover:underline focus:outline-none focus:underline"
              >
                Register
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSigninPage;

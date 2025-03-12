import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ref, set } from "firebase/database";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { app, db } from "../Firebase/Firebase";
import img from "../Images/purviewlogo.png";

const AdminSignupPage = () => {
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (email !== confirmEmail) {
      toast.error("Emails do not match!");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    if (password.length < 6) {
      toast.error("Password should be at least 6 characters long!");
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth(app);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await sendEmailVerification(user);
      setVerificationSent(true);
      toast.success("Verification email sent. Please check your inbox.");

      const intervalId = setInterval(async () => {
        await user.reload();
        if (user.emailVerified) {
          setIsVerified(true);
          clearInterval(intervalId);
        }
      }, 3000);

      await set(ref(db, `JPMCReceptionistAdmin/${user.uid}`), {
        email: user.email,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      });

      await signOut(auth);
    } catch (error) {
      setErrorMessage(error.message);
      toast.error(error.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVerified) {
      const saveUserData = async () => {
        try {
          toast.success("Email verified! Redirecting...");
          setTimeout(() => navigate("/signin"), 2000);
        } catch (error) {
          setErrorMessage(error.message);
          toast.error("Error saving user data. Please try again.");
        }
      };

      saveUserData();
    }
  }, [isVerified, navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <nav className="bg-gradient-to-t from-[rgb(12,25,97)] to-[rgb(12,25,97)]/5 backdrop-blur-md border border-white/20 shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center justify-between relative">
            <div className="h-12 flex items-center">
              <img
                className="h-6 filter invert brightness-0"
                src={img}
                alt="Purview Logo"
              />
            </div>
            <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl sm:text-2xl font-bold text-white whitespace-nowrap">
              Assistant Sign Up
            </h1>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4">
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
                  Create your assistant account
                </h2>
                <p className="max-w-xl mt-3 text-gray-300">
                  Join our team by creating your account. You'll need to verify your email before signing in.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/3 p-6 sm:p-8 rounded-3xl bg-gradient-to-l from-[rgb(12,25,97)]/20 to-transparent">
          <div className="max-w-md mx-auto">
            <div className="text-center">
              <img
                className="h-8 mx-auto filter invert brightness-0"
                src={img}
                alt="Purview Logo"
              />
              <p className="mt-3 text-lg font-medium text-white">
                Create your account
              </p>
            </div>

            <form onSubmit={handleSignUp} className="mt-8 space-y-4">
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
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmEmail" className="block text-sm text-white mb-2">
                  Confirm Email Address
                </label>
                <input
                  type="email"
                  id="confirmEmail"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 focus:border-[rgb(12,25,97)] focus:ring-2 focus:ring-[rgb(12,25,97)] focus:ring-opacity-40 text-gray-700 placeholder-gray-400"
                  placeholder="Confirm your email"
                  required
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
                  placeholder="Enter password"
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm text-white mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200 focus:border-[rgb(12,25,97)] focus:ring-2 focus:ring-[rgb(12,25,97)] focus:ring-opacity-40 text-gray-700 placeholder-gray-400"
                  placeholder="Confirm your password"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-2/3 mx-auto block px-4 py-2 text-white bg-black rounded-lg hover:bg-[rgb(12,25,97)] transition-colors duration-200 font-bold"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Sign up"}
              </button>
            </form>

            {verificationSent && (
              <p className="mt-4 text-center text-sm text-green-500">
                Verification email sent. Please check your inbox.
              </p>
            )}

            {errorMessage && (
              <p className="mt-4 text-center text-sm text-red-500">
                {errorMessage}
              </p>
            )}

            <p className="mt-6 text-sm text-center text-gray-400">
              Already have an account?{" "}
              <span
                onClick={() => navigate("/signin")}
                className="text-[rgb(12,25,97)] hover:underline focus:outline-none focus:underline cursor-pointer"
              >
                Sign in
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSignupPage;

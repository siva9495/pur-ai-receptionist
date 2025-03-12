import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { ref, set, get, onValue, remove, off, update, runTransaction } from "firebase/database";
import { Loader2, Bell, PhoneCall, PhoneForwarded, PhoneOff, Users } from "lucide-react";
import { db } from "../Firebase/Firebase";
import img from "../Images/purviewlogo.png";

const AdminDashboardPage = () => {
  // State declarations
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callData, setCallData] = useState([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const previousCallsRef = useRef([]);
  const userIdRef = useRef(""); // current admin UID
  const navigate = useNavigate();
  const callListenerRef = useRef(null);
  const [showForwardMenu, setShowForwardMenu] = useState({});
  const [availableUsers, setAvailableUsers] = useState([]);

  // Add new function to handle call forwarding
  const handleForward = async (roomID, targetUserId) => {
    try {
      // Reference to the current call data in the current admin's queue
      const currentCallRef = ref(db, `JPMCReceptionistAdmin/${userIdRef.current}/calls/${roomID}`);
      
      // Retrieve the full call object
      const currentCallSnapshot = await get(currentCallRef);
      if (!currentCallSnapshot.exists()) {
        console.error("Call data not found for roomID:", roomID);
        return;
      }
      const callData = currentCallSnapshot.val();
  
      // Instead of removing the call, update its status to 'forwarding'
      await update(currentCallRef, {
        status: 'forwarding',
        forwardedTo: targetUserId,
        originalAdmin: userIdRef.current
      });
  
      // Forward the call data to the target admin
      await set(ref(db, `JPMCReceptionistAdmin/${targetUserId}/calls/${roomID}`), {
        ...callData,
        status: 'pending',
        timestamp: Date.now(),
        forwardedFrom: userIdRef.current
      });
  
      // Update the status of the target user to "pending"
      await update(ref(db, `JPMCReceptionistAdmin/${targetUserId}`), {
        status: 'pending',
      });
  
      // Hide the forward menu
      setShowForwardMenu((prev) => ({ ...prev, [roomID]: false }));
    } catch (error) {
      console.error("Error forwarding call:", error);
    }
  };

  // Add useEffect to fetch available users
  useEffect(() => {
    const fetchAvailableUsers = async () => {
      const availableRef = ref(db, 'JPMCReceptionistAdmin');
      try {
        const snapshot = await get(availableRef);
        if (snapshot.exists()) {
          // Iterate over each user's node under JPMCReceptionistAdmin
          const users = Object.entries(snapshot.val())
            .filter(([userId, userData]) => userData.status === 'available') // Check for available users
            .map(([userId, userData]) => ({
              id: userId, // userId represents the UID of the user
              email: userData.email
            }));
          setAvailableUsers(users);
        }
      } catch (error) {
        console.error('Error fetching available users:', error);
      }
    };
  
    fetchAvailableUsers();
    const interval = setInterval(fetchAvailableUsers, 10000); // Refresh every 10 seconds
  
    return () => clearInterval(interval);
  }, []);  

  // Request notification permission (fallback, if needed)
  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      console.log("Notification permission:", permission);
      setNotificationPermission(permission === "granted");
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  // Show desktop notification for an incoming call (fallback)
  const showNotification = async (user, roomID) => {
    console.log("Attempting to show notification for:", user, roomID);
    if (!isWindowFocused && Notification.permission === "granted") {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification("Incoming Call", {
          body: `${user} is calling...`,
          icon: img,
          requireInteraction: true,
          actions: [
            { action: "accept", title: "Accept" },
            { action: "decline", title: "Decline" }
          ],
          tag: `call-${roomID}`,
          renotify: true,
          data: { roomID, user }
        });
        console.log("Notification shown successfully");
      } catch (error) {
        console.error("Error showing notification:", error);
      }
    } else {
      console.log("Window is focused or notification permission not granted");
    }
  };

  const toggleProfileDialog = () => {
    setIsDialogOpen(!isDialogOpen);
  };

  // Accept the incoming call using the path:
  const handleAccept = async (roomID) => {
    setIsConnecting(true);
  
    // Clear any existing notifications for this call
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.getNotifications().then((notifications) => {
          notifications.forEach((notification) => {
            if (notification.tag === `call-${roomID}`) {
              notification.close();
            }
          });
        });
      });
    }
  
    try {
      const callRefPath = `JPMCReceptionistAdmin/${userIdRef.current}/calls/${roomID}`;
      const callSnapshot = await get(ref(db, callRefPath));
      
      if (callSnapshot.exists()) {
        const callData = callSnapshot.val();
        
        await runTransaction(ref(db, callRefPath), (currentCall) => {
          if (currentCall && currentCall.status === "pending") {
            currentCall.status = "in-progress";
            currentCall.adminId = userIdRef.current;
            return currentCall;
          }
          return; // abort if call is not pending
        });
  
        // If this was a forwarded call, update the original admin's status
        if (callData.forwardedFrom) {
          await update(ref(db, `JPMCReceptionistAdmin/${callData.forwardedFrom}`), {
            status: "available"
          });
        }
  
        setIsAvailable(false);
        await update(ref(db, `available/${userIdRef.current}`), { status: "unavailable" });
        
        setTimeout(() => {
          setIsConnecting(false);
          navigate(`/video-calling-admin/${roomID}`, {
            state: { roomID, adminId: userIdRef.current }
          });
        }, 3000);
      }
    } catch (error) {
      console.error("Error during transaction:", error);
      setIsConnecting(false);
    }
  };

  // Decline the call by removing it from:
  const handleDecline = async (roomID) => {
    // Clear notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.getNotifications().then((notifications) => {
          notifications.forEach((notification) => {
            if (notification.tag === `call-${roomID}`) {
              notification.close();
            }
          });
        });
      });
    }
  
    try {
      // Get the call data first to check if it was forwarded
      const roomRef = ref(db, `JPMCReceptionistAdmin/${userIdRef.current}/calls/${roomID}`);
      const callSnapshot = await get(roomRef);
      
      if (callSnapshot.exists()) {
        const callData = callSnapshot.val();
        
        // If this was a forwarded call
        if (callData.forwardedFrom) {
          // Update original admin's status to available
          await update(ref(db, `JPMCReceptionistAdmin/${callData.forwardedFrom}`), {
            status: "available"
          });
          await update(ref(db, `available/${callData.forwardedFrom}`), {
            status: "available"
          });
  
          // Remove the call from original admin's queue
          const originalAdminCallRef = ref(
            db, 
            `JPMCReceptionistAdmin/${callData.forwardedFrom}/calls/${roomID}`
          );
          await remove(originalAdminCallRef);
        }
  
        // Remove the call from current admin's queue
        await remove(roomRef);
        
        // Update current admin's status to available
        await update(ref(db, `JPMCReceptionistAdmin/${userIdRef.current}/`), {
          status: "available"
        });
        await update(ref(db, `available/${userIdRef.current}`), {
          status: "available"
        });
  
        console.log(`Room ID ${roomID} removed and admin statuses updated.`);
      }
    } catch (error) {
      console.error("Error handling decline:", error);
    }
  };

  const setAvailability = async (status) => {
    try {
      await update(ref(db, `available/${userIdRef.current}`), { status });
      setIsAvailable(status === "available");
    } catch (error) {
      console.error("Error updating availability status:", error);
    }
  };

  useEffect(() => {
    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        console.log("Notification permission (inside useEffect):", permission);
        setNotificationPermission(permission === "granted");
      } catch (error) {
        console.error("Error requesting notification permission:", error);
      }
    };

    const registerServiceWorker = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.register("/notificationsw.js");
          console.log("Service Worker registered successfully:", registration.scope);
        } catch (error) {
          console.error("Service Worker registration failed:", error);
        }
      }
    };

    const messageHandler = async (event) => {
      console.log("Message received from service worker:", event.data);
      if (event.data.type === "ACCEPT_CALL") {
        const { roomID } = event.data;
        
        // Set connecting state
        setIsConnecting(true);
        
        try {
          const callRefPath = `JPMCReceptionistAdmin/${userIdRef.current}/calls/${roomID}`;
          const callSnapshot = await get(ref(db, callRefPath));
          
          if (callSnapshot.exists()) {
            // Update call status to in-progress
            await runTransaction(ref(db, callRefPath), (currentCall) => {
              if (currentCall && currentCall.status === "pending") {
                currentCall.status = "in-progress";
                currentCall.adminId = userIdRef.current;
                return currentCall;
              }
              return; // abort if call is not pending
            });
            
            // Update admin availability
            setIsAvailable(false);
            await update(ref(db, `available/${userIdRef.current}`), { 
              status: "unavailable" 
            });
            
            // Navigate to video call after brief delay
            setTimeout(() => {
              setIsConnecting(false);
              navigate(`/video-calling-admin/${roomID}`, {
                state: { roomID, adminId: userIdRef.current }
              });
            }, 3000);
          }
        } catch (error) {
          console.error("Error handling notification accept:", error);
          setIsConnecting(false);
        }
      } else if (event.data.type === "DECLINE_CALL") {
        handleDecline(event.data.roomID);
      }
    };

    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    const fetchEmail = async () => {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (!isLoggedIn) {
        navigate("/signin");
        return;
      }
      const email = localStorage.getItem("userEmail");
      if (email) {
        setUserEmail(email);
        setUserInitials(email.slice(0, 2).toUpperCase());
      }
    };

    requestPermission();
    registerServiceWorker();
    fetchEmail();

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);


    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", messageHandler);
    }

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", messageHandler);
      }
    };
  }, [navigate]);

  // Sign-out handler
  const handleSignOut = async () => {
    const auth = getAuth();
    await setAvailability("unavailable");
    signOut(auth)
      .then(() => {
        if (callListenerRef.current) {
          off(ref(db, `JPMCReceptionistAdmin/${userIdRef.current}/calls`), "value", callListenerRef.current);
        }
        navigate("/signin");
      })
      .catch((error) => {
        console.error("Sign-out error:", error);
      });
  };

  // Set up the current user/admin and write availability in Firebase.
  useEffect(() => {
    const setupUser = async () => {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (!isLoggedIn) {
        navigate("/signin");
        return;
      }
  
      const email = localStorage.getItem("userEmail");
      const userId = localStorage.getItem("userId");  // Retrieve UID from localStorage
  
      if (email && userId) {
        setUserEmail(email);
        setUserInitials(email.slice(0, 2).toUpperCase());
        userIdRef.current = userId;  // Set the UID here
  
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          // You can now use userIdRef.current instead of auth.currentUser.uid
          const userId = userIdRef.current;
  
          // Write availability in "available" reference
          const availableRef = ref(db, `available/${userId}`);
          try {
            await set(availableRef, { email, status: "available" });
            console.log("User added to 'available' list in Firebase.");
          } catch (error) {
            console.error("Error adding user to 'available' list:", error);
          }
  
          // Write admin info in "JPMCReceptionistAdmin"
          const receptionistRef = ref(db, `JPMCReceptionistAdmin/${userId}`);
          try {
            await set(receptionistRef, { email, status: "available" });
            console.log("User added to 'JPMCReceptionistAdmin' list in Firebase.");
          } catch (error) {
            console.error("Error adding user to 'JPMCReceptionistAdmin' list:", error);
          }
        }
      } else {
        console.error("Email or UID not found in localStorage");
        navigate("/signin");
      }
    };
  
    setupUser();
  
    return () => {
      const user = getAuth().currentUser;
      if (user) {
        const userId = user.uid;
        update(ref(db, `available/${userId}`), { status: "unavailable" }).catch((error) =>
          console.error("Error marking user unavailable on unmount:", error)
        );
        update(ref(db, `JPMCReceptionistAdmin/${userId}`), { status: "unavailable" }).catch((error) =>
          console.error("Error marking user unavailable on unmount:", error)
        );
      }
    };
  }, [navigate]);
  

  console.log(userIdRef.current+" user uid");

  // CONTINUOUSLY CHECK INCOMING CALLS: Moved to its own `useEffect`
  useEffect(() => {
    if (!userIdRef.current) return;
    console.log(userIdRef.current+" user uid");
    const callRef = ref(db, `JPMCReceptionistAdmin/${userIdRef.current}/calls`);
    const listener = onValue(callRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Filter for only calls with status "pending"
        const filteredData = Object.entries(data)
          .filter(([roomID, details]) => details.status === "pending")
          .map(([roomID, details]) => ({
            roomID,
            user: details.user
          }));
        console.log("Filtered Call Data:", filteredData);
        previousCallsRef.current = filteredData;
        setCallData(filteredData);

        // Show notification for each new call if the window is not focused
        filteredData.forEach((call) => {
          showNotification(call.user, call.roomID);  // Call the notification function
        });
      } else {
        previousCallsRef.current = [];
        setCallData([]);
        console.log("No calls present for this user");
      }
    });
    callListenerRef.current = listener;
    return () => {
      off(callRef, "value", listener);
      callListenerRef.current = null;
    };
  }, [isAvailable, isWindowFocused]);

  return (
    <div
      className="bg-black h-screen flex flex-col bg-gradient-to-t from-gray-900 to-black backdrop-blur-md"
      style={{
        background: `
          radial-gradient(circle at bottom right, rgb(12,25,97) 20%, rgba(0, 0, 0, 1) 70%),
          radial-gradient(circle at top right, rgba(150, 75, 0, 1) 10%, rgba(0, 0, 0, 1) 80%`
      }}
    >
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-t-[rgb(12,25,97)] border-r-[rgb(12,25,97)] border-b-[rgb(12,25,97)]/30 border-l-[rgb(12,25,97)]/30 rounded-full animate-spin mx-auto"></div>
            <p className="text-white text-xl font-medium">Connecting call...</p>
          </div>
        </div>
      )}
      <nav className="bg-gradient-to-t from-[rgb(12,25,97)] to-[rgb(12,25,97)]/5 backdrop-blur-md border border-white/20 shadow-lg">
        <div className="container flex items-center justify-between px-6 py-3 mx-auto">
          <div className="h-12 flex items-center">
            <img className="h-12 filter invert brightness-0" src={img} alt="Purview Logo" />
          </div>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold text-white">
            Assistant Dashboard
          </h1>
          <div className="flex items-center space-x-6">
            <div
              className="flex items-center justify-center w-10 h-10 bg-white rounded-full cursor-pointer"
              onClick={toggleProfileDialog}
            >
              <span className="text-black font-bold">{userInitials}</span>
            </div>
          </div>
        </div>
      </nav>
      {isDialogOpen && (
        <div className="absolute top-16 right-6 bg-black rounded-lg shadow-lg p-4 w-80 z-50">
          <p className="text-white font-medium mb-4 break-words">Email: {userEmail}</p>
          <button
            className="w-full px-4 py-2 text-white bg-[rgb(12,25,97)] rounded-lg hover:bg-[rgb(12,25,97)]"
            onClick={() => setIsSignOutDialogOpen(true)}
          >
            Sign Out
          </button>
        </div>
      )}
      {isSignOutDialogOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Are you sure you want to sign out?
            </h2>
            <div className="flex justify-between">
              <button
                className="px-6 py-2 text-white bg-[rgb(12,25,97)] rounded-lg hover:bg-[rgb(12,25,97)]"
                onClick={() => setIsSignOutDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-start justify-start px-8 py-6 mx-8 my-4 space-y-8">
        <div className="text-white">
          <h2 className="text-3xl font-bold">Incoming Calls</h2>
          <p className="text-gray-400 mt-2">
            Manage your calls and connect to your customers.
          </p>
        </div>
        <div className="w-[500px] space-y-4">
          {callData.map((call) => (
            <div key={call.roomID} className="relative">
              <div className="bg-gradient-to-r from-[rgb(12,25,97)] to-[rgb(12,25,97)] rounded-lg p-6 shadow-lg border border-white/20 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                      <PhoneCall className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-white text-lg font-semibold">{call.user}</h3>
                      <p className="text-white/70 text-sm">Incoming Call</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleAccept(call.roomID)}
                      className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center transition-all hover:bg-green-500/40"
                    >
                      <PhoneCall className="w-6 h-6 text-green-500" />
                    </button>
                    
                    <button
                      onClick={() => setShowForwardMenu(prev => ({ ...prev, [call.roomID]: !prev[call.roomID] }))}
                      className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center transition-all hover:bg-blue-500/40"
                    >
                      <PhoneForwarded className="w-6 h-6 text-blue-500" />
                    </button>
                    
                    <button
                      onClick={() => handleDecline(call.roomID)}
                      className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center transition-all hover:bg-red-500/40"
                    >
                      <PhoneOff className="w-6 h-6 text-red-500" />
                    </button>
                  </div>
                </div>
                
                {/* Forward Menu */}
                {showForwardMenu[call.roomID] && (
                  <div className="absolute right-0 mt-4 w-64 bg-[rgb(12,25,97)] rounded-lg shadow-lg border border-white/20 z-20">
                    <div className="p-3 border-b border-white/10">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-white/70" />
                        <span className="text-white font-medium">Available Users</span>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {availableUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleForward(call.roomID, user.id)}
                          className="w-full p-3 text-left text-white hover:bg-white/10 transition-colors flex items-center justify-between"
                        >
                          <span className="truncate">{user.email}</span>
                          <PhoneForwarded className="w-4 h-4 text-white/70" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
      </div>
      {!notificationPermission && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center space-x-2">
            <Bell className="w-6 h-6 text-[rgb(12,25,97)]" />
            <p className="text-black">Enable notifications to receive call alerts</p>
          </div>
          <button
            className="mt-2 w-full px-4 py-2 text-white bg-[rgb(12,25,97)] rounded-lg hover:bg-[rgb(12,25,97)]"
            onClick={requestNotificationPermission}
          >
            Enable Notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;

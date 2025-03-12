import React, { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { db } from '../Firebase';
import { ref, set, remove, onValue, get, update } from 'firebase/database';
import './VideoCalling.css';
import { MdCallEnd, MdMic, MdMicOff, MdVideocam, MdVideocamOff } from 'react-icons/md';
import img from '../Images/jpmc.png';
import { useLocation, useNavigate } from 'react-router-dom';

const VideoCalling = () => {
  // Local state and refs
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardedTo, setForwardedTo] = useState(null);
  const [isRemoteCameraOn, setIsRemoteCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const [roomID, setRoomID] = useState('');
  const [isCallEnding, setIsCallEnding] = useState(false);
  const navigate = useNavigate();
  const [isInitialized, setIsInitialized] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const location = useLocation();
  const sessionId = location.state?.sessionId;
  const [targetID, setTargetID] = useState(null);
  const setupCallInitialized = useRef(false);

  // Toggle microphone on/off
  const toggleMicrophone = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle camera on/off
  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Loading state helpers
  const showLoadingState = (message) => {
    setIsLoading(true);
    setLoadingMessage(message);
  };

  const hideLoadingState = () => {
    setIsLoading(false);
    setLoadingMessage('');
  };

  // Cleanup any existing rooms (if needed)
  const cleanupExistingRooms = async () => {
    try {
      const callsRef = ref(db, 'v2gettingcalls');
      const snapshot = await get(callsRef);
      if (snapshot.exists()) {
        const rooms = snapshot.val();
        const promises = Object.entries(rooms).map(([key, value]) => {
          if (value.user === '1st Floor') {
            return remove(ref(db, `v2gettingcalls/${key}`));
          }
          return Promise.resolve();
        });
        await Promise.all(promises);
      }
    } catch (error) {
      console.error('Error cleaning up existing rooms:', error);
    }
  };

  // Fetch available admins
  const fetchAvailableAdmins = async () => {
    try {
      const adminsRef = ref(db, 'JPMCReceptionistAdmin');
      const snapshot = await get(adminsRef);
      if (snapshot.exists()) {
        const admins = snapshot.val();
        const availableAdmins = Object.entries(admins)
          .filter(([adminId, adminData]) => adminData.status === 'available')
          .map(([adminId]) => adminId);
        console.log('Available Admin IDs:', availableAdmins);
        return availableAdmins;
      } else {
        console.log('No admins found.');
        return [];
      }
    } catch (error) {
      console.error('Error fetching available admins:', error);
      return [];
    }
  };

  // Fetch chat history from Firebase
  const fetchChatHistoryFromFirebase = async (sessionId) => {
    if (!sessionId) {
      console.error("Session ID is required to fetch chat history.");
      return;
    }
    setIsLoading(true);
    try {
      const chatRef = ref(db, `chatHistory/${sessionId}`);
      const snapshot = await get(chatRef);
      if (snapshot.exists()) {
        const chatData = snapshot.val().history || [];
        console.log("Chat history fetched successfully:", chatData);
        setChatHistory(chatData);
      } else {
        console.log("No chat history found for the given session ID.");
        setChatHistory([]);
      }
    } catch (error) {
      console.error("Error fetching chat history from Firebase:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save room information to Firebase under the selected admin node
  const saveRoomToFirebase = async (roomID, peerID, targetAdminID) => {
    try {
      const roomRef = ref(db, `JPMCReceptionistAdmin/${targetAdminID}/calls/${roomID}`);
      await set(roomRef, {
        sessionId,
        roomID,
        peerID,
        user: '1st Floor',
        timestamp: Date.now(),
        status: 'pending'
      });
      console.log(`Room and Peer ID saved to Firebase under admin ${targetAdminID}`);
    } catch (error) {
      console.error('Error saving room to Firebase:', error);
    }
  };

  // End call: stop streams, update Firebase, and navigate away
  const handleCallEnd = useCallback(() => {
    setIsCallEnding(true);
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    navigate('/');
  }, [localStream, navigate]);

  console.log(targetID+" target");

  const endCall = async () => {
    setIsCallEnding(true);
    if (sessionId) {
      const chatHistoryRef = ref(db, `chatHistory/${sessionId}`);
      await remove(chatHistoryRef);
      console.log(`Chat history for session ID ${sessionId} deleted.`);
    } else {
      console.warn('Session ID is not available. Chat history cannot be deleted.');
    }
    if (roomID) {
      try {
        const roomRef = ref(db, `JPMCReceptionistAdmin/${targetID}/calls/${roomID}`);
        await update(roomRef, { status: 'ended' });
        await remove(roomRef);
        await update(ref(db, `JPMCReceptionistAdmin/${targetID}/`), { status: 'available' });
      } catch (error) {
        console.error('Error updating call status in Firebase:', error);
      }
    }
    handleCallEnd();
  };

  // Initiate an outgoing call (if needed)
  const initiateCall = async (selectedTargetID) => {
    try {
      if (!peerRef.current || !localStream) {
        console.error('Peer or local stream is not initialized.');
        return;
      }
      const outgoingCall = peerRef.current.call(selectedTargetID, localStream);
      outgoingCall.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });
      outgoingCall.on('error', (err) => {
        console.error('Error during the call:', err);
      });
      console.log(`Call initiated with Target ID: ${selectedTargetID}`);
    } catch (error) {
      console.error('Error initiating call:', error);
    }
  };

  // Monitor remote video track changes
  const handleRemoteTrackChange = useCallback((stream) => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        console.log("Remote video track initial enabled state:", videoTrack.enabled);
        videoTrack.onmute = () => {
          console.log("Remote video track muted");
          setIsRemoteCameraOn(false);
        };
        videoTrack.onunmute = () => {
          console.log("Remote video track unmuted");
          setIsRemoteCameraOn(true);
        };
        // Set the initial state
        setIsRemoteCameraOn(videoTrack.enabled);
      } else {
        setIsRemoteCameraOn(false);
      }
    }
  }, []);

  // Fallback polling in case onmute/onunmute are not reliably triggered
  useEffect(() => {
    const interval = setInterval(() => {
      if (remoteStream) {
        const videoTracks = remoteStream.getVideoTracks();
        if (videoTracks.length > 0) {
          setIsRemoteCameraOn(videoTracks[0].enabled);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [remoteStream]);

  // Setup call (initialize Peer, get user media, etc.)
  useEffect(() => {
    if (isInitialized) return; // Prevent multiple initializations
  setIsInitialized(true);

  const setupCall = async () => {
    if (setupCallInitialized.current) return;
    setupCallInitialized.current = true;
    
    try {
      showLoadingState('Initializing your call...');
      await cleanupExistingRooms();

      const generatedRoomID = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setRoomID(generatedRoomID);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize Peer with TURN configuration
        const peer = new Peer({
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              {
                urls: 'turn:relay1.expressturn.com:3478',
                username: 'efU540CXITPYIZZ5KW',
                credential: '9xqHL1gtsHLJfAge'
              }
            ]
          }
        });
        peerRef.current = peer;

        peer.on('open', async (id) => {
          let callInitiated = false;
          const pollInterval = setInterval(async () => {
            if (callInitiated) return;
            const availableAdmins = await fetchAvailableAdmins();
            if (availableAdmins.length === 0) {
              showLoadingState('Please wait... All assistants are currently busy');
            } else {
              showLoadingState('Connecting you with an assistant...');
              const randomIndex = Math.floor(Math.random() * availableAdmins.length);
              const targetAdminID = availableAdmins[randomIndex];
              setTargetID(targetAdminID);
              await update(ref(db, `JPMCReceptionistAdmin/${targetAdminID}/`), { status: 'pending' });
              await saveRoomToFirebase(generatedRoomID, id, targetAdminID);
              hideLoadingState();
              callInitiated = true;
              clearInterval(pollInterval);
            }
          }, 5000);
        });

        // Listen for incoming calls
        peer.on('call', (incomingCall) => {
          incomingCall.answer(stream);
          incomingCall.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
            handleRemoteTrackChange(remoteStream);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            hideLoadingState();
          });
        });
    } catch (error) {
      console.error('Error in setup:', error);
      alert('Unable to access your camera and microphone. Please check permissions.');
    }
  };

  if (sessionId) {
    fetchChatHistoryFromFirebase(sessionId);
  } else {
    console.error('Session ID is not available.');
  }
  if (!peerRef.current) {
    setupCall();
  }
    return () => {
      setIsCallEnding(true);
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (roomID && targetID) {
        const roomRef = ref(db, `JPMCReceptionistAdmin/${targetID}/calls/${roomID}`);
        remove(roomRef).catch((error) =>
          console.error('Error removing room during cleanup:', error)
        );
      }
    };
  }, [isInitialized, sessionId, roomID, targetID, localStream, handleRemoteTrackChange]);

  // Listen for call status updates (for example, when the admin ends the call)
  // Update the useEffect that listens for call status to handle declines:
useEffect(() => {
  if (!roomID || !targetID) return;
  
  const roomRef = ref(db, `JPMCReceptionistAdmin/${targetID}/calls/${roomID}`);
  const unsubscribe = onValue(roomRef, async (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      
      if (data.status === 'forwarding') {
        setIsForwarding(true);
        setForwardedTo(data.forwardedTo);
        showLoadingState('Call is being transferred to another assistant...');
        
        // Start listening to the new admin's call status
        const newAdminRef = ref(db, `JPMCReceptionistAdmin/${data.forwardedTo}/calls/${roomID}`);
        const forwardListener = onValue(newAdminRef, async (forwardSnapshot) => {
          if (forwardSnapshot.exists()) {
            const forwardData = forwardSnapshot.val();
            
            if (forwardData.status === 'in-progress') {
              // New admin accepted the call
              setTargetID(data.forwardedTo);
              setIsForwarding(false);
              hideLoadingState();
              
              // Clean up original admin's call and status
              try {
                await update(ref(db, `JPMCReceptionistAdmin/${data.originalAdmin}`), {
                  status: "available"
                });
                await update(ref(db, `available/${data.originalAdmin}`), {
                  status: "available"
                });
                await remove(roomRef);
              } catch (error) {
                console.error("Error updating original admin status:", error);
              }
            }
          } else {
            // Call was declined by new admin
            if (isForwarding) {
              setIsForwarding(false);
              hideLoadingState();
              
              try {
                // Remove the call record so the VideoCalling listener detects the deletion
                await remove(roomRef);
                
                showLoadingState('Transfer declined. Returning to previous screen...');
                setTimeout(() => {
                  hideLoadingState();
                  endCall(); // Navigate to "/"
                }, 3000);
              } catch (error) {
                console.error("Error handling declined forward:", error);
              }
            }
            // if (isForwarding) {
            //   setIsForwarding(false);
            //   hideLoadingState();
              
            //   // Revert forwarding status and update original admin
            //   try {
            //     await update(roomRef, {
            //       status: 'pending',
            //       forwardedTo: null,
            //       originalAdmin: null
            //     });
                
            //     showLoadingState('Transfer declined. Returning to original assistant...');
            //     setTimeout(() => hideLoadingState(), 3000);
            //   } catch (error) {
            //     console.error("Error handling declined forward:", error);
            //   }
            // }
          }
        });

        return () => off(newAdminRef, 'value', forwardListener);
      } else if (data.status === 'ended') {
        console.log('Call ended by admin');
        endCall();
      }
    } else if (!isForwarding) {
      console.log('Call record removed from database. Navigating back.');
      endCall();
    }
  });

  return () => {
    unsubscribe();
  };
}, [roomID, targetID, isForwarding]);

  return (
    <div className="bg-black min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-gradient-to-t from-[#964b00] to-[#964b00]/5 backdrop-blur-md border border-white/20 shadow-lg">
        <div className="container flex items-center justify-between px-6 py-3 mx-auto">
          <div className="h-12 flex items-center">
            <img
              className="h-6 top-2 filter invert brightness-0"
              src={jpmcLogo}
              alt="JPMC Logo"
            />
          </div>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold text-white">
            Video Calling Assistant
          </h1>
        </div>
      </nav>

      {/* Main Content with Loading Overlay */}
      <div className="flex-1 relative">
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-t-[#964b00] border-r-[#964b00] border-b-[#964b00]/30 border-l-[#964b00]/30 rounded-full animate-spin mx-auto"></div>
            <p className="text-white text-xl font-medium">
              {isForwarding ? 'Transferring your call to another assistant...' : loadingMessage}
            </p>
          </div>
        </div>
      )}

        <div className="flex flex-row items-start justify-center px-8 py-6 space-x-8">
          <div className="w-3/4 bg-black shadow-lg relative rounded-lg overflow-hidden border border-[#964b00]">
            <h3 className="text-white text-center font-bold py-2 bg-gradient-to-r from-[#964b00] to-[#db6e00]">
              Live Assistant Feed
            </h3>
            <div className="relative">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-[550px] object-cover"
              ></video>
              {(!remoteStream || !isRemoteCameraOn) && !isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                  <MdVideocamOff size={48} className="text-white/60 mb-3" />
                  <p className="text-white/80 text-lg">
                    {!remoteStream ? "Please wait, while the human assistant accepts your call..." : "Assistant's camera is turned off"}
                  </p>
                </div>
              )}
            </div>
          </div>
  
          <div className="w-60 flex flex-col items-center bg-black rounded-lg overflow-hidden">
            <h3 className="text-white text-center rounded-t-lg text-lg font-bold py-1 w-full bg-gradient-to-r from-[#964b00] to-[#db6e00]">
              Your Feed
            </h3>
            <div className="w-full h-40 overflow-hidden shadow-md relative">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded-b-lg"
              ></video>
              {!isCameraOn && (
                <div className="absolute inset-0 bg-black flex items-center justify-center border border-[#964b00] rounded-b-lg">
                  <MdVideocamOff size={34} className="text-white" />
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={toggleMicrophone}
                className={`p-4 rounded-full text-white transition-colors duration-200 ${
                  isMicOn ? 'bg-[#964b00] hover:bg-[#6b3500]' : 'bg-red-600 hover:bg-red-700'
                }`}
                title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
              >
                {isMicOn ? <MdMic size={24} /> : <MdMicOff size={24} />}
              </button>
  
              <button
                onClick={toggleCamera}
                className={`p-4 rounded-full text-white transition-colors duration-200 ${
                  isCameraOn ? 'bg-[#964b00] hover:bg-[#6b3500]' : 'bg-red-600 hover:bg-red-700'
                }`}
                title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {isCameraOn ? <MdVideocam size={24} /> : <MdVideocamOff size={24} />}
              </button>
  
              <button
                className="bg-red-600 p-4 rounded-full text-white hover:bg-red-700 transition-colors duration-200"
                onClick={endCall}
                title="End call"
              >
                <MdCallEnd size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCalling;

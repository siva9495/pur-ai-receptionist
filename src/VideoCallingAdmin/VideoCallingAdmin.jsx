import React, { useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';
import { db } from '../Firebase/Firebase';
import { ref, get, onValue, remove, update, set } from 'firebase/database';
import './VideoCallingAdmin.css';
import { MdCallEnd, MdChat, MdClose, MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdPersonAdd } from "react-icons/md";
import { Users } from "lucide-react";
import img from '../Images/purviewlogo.png';
import { useNavigate, useLocation } from 'react-router-dom';

const VideoCallingAdmin = () => {
  // State declarations
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [availableAdmins, setAvailableAdmins] = useState([]);
  const [connectedAdmins, setConnectedAdmins] = useState([]);
  const [isOriginalAdmin, setIsOriginalAdmin] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  // Extract roomID and adminId from location.state.
  const { roomID, adminId } = location.state || {};

  // Refs
  const localVideoRef = useRef(null);
  const userVideoRef = useRef(null);
  const peerRef = useRef(null);
  const peersRef = useRef({});
  const streamsRef = useRef({});

  // Toggle microphone state
  const toggleMicrophone = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  // Toggle camera state
  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  // End the call, clean up, and navigate back to the dashboard
  const endCall = async () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    
    // Destroy all peer connections
    Object.values(peersRef.current).forEach(peer => {
      if (peer) peer.destroy();
    });
    
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    
    // Update call status to "ended" and remove the call from Firebase
    if (roomID) {
      try {
        // Update admin status to "available"
        await update(ref(db, `JPMCReceptionistAdmin/${adminId}`), {
          status: "available"
        });
        await update(ref(db, `available/${adminId}`), {
          status: "available"
        });
        
        // Remove the admin from the conference
        if (!isOriginalAdmin) {
          const conferenceRef = ref(db, `conferenceRooms/${roomID}/admins/${adminId}`);
          await remove(conferenceRef);
        } else {
          // If original admin is leaving, end the call for everyone
          const roomRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
          await update(roomRef, { status: 'ended' });
          
          // Clean up the conference room
          const conferenceRef = ref(db, `conferenceRooms/${roomID}`);
          await remove(conferenceRef);
          
          setTimeout(() => remove(roomRef), 3000);  // Remove the call after 3 seconds
        }
        
        navigate('/AdminDashboardPage');
      } catch (error) {
        console.error('Error ending call:', error);
      }
    } else {
      navigate('/AdminDashboardPage');
    }
  };

  // Open the Add Admin modal
  const openAddAdminModal = async () => {
    await fetchAvailableAdmins();
    setShowAddAdminModal(true);
  };

  // Fetch available admins
  const fetchAvailableAdmins = async () => {
    try {
      const availableRef = ref(db, 'JPMCReceptionistAdmin');
      const snapshot = await get(availableRef);
      
      if (snapshot.exists()) {
        // Get current conference participants
        const conferenceRef = ref(db, `conferenceRooms/${roomID}/admins`);
        const conferenceSnapshot = await get(conferenceRef);
        const currentParticipants = conferenceSnapshot.exists() ? Object.keys(conferenceSnapshot.val()) : [adminId];
        
        // Filter out already connected admins and current admin
        const admins = Object.entries(snapshot.val())
          .filter(([userId, userData]) => 
            userData.status === 'available' && 
            userId !== adminId && 
            !currentParticipants.includes(userId)
          )
          .map(([userId, userData]) => ({
            id: userId,
            email: userData.email
          }));
        
        setAvailableAdmins(admins);
      }
    } catch (error) {
      console.error('Error fetching available admins:', error);
    }
  };

  // Invite another admin to join the conference
  const inviteAdmin = async (targetAdminId) => {
    try {
      const roomRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
      const snapshot = await get(roomRef);
      
      if (snapshot.exists()) {
        const callData = snapshot.val();
        
        // Create conference room if not exists
        await set(ref(db, `conferenceRooms/${roomID}`), {
          createdBy: adminId,
          sessionId: callData.sessionId,
          userPeerId: callData.peerID,
          createdAt: Date.now()
        });
        
        // Add original admin to conference
        await set(ref(db, `conferenceRooms/${roomID}/admins/${adminId}`), {
          email: localStorage.getItem("userEmail"),
          peerId: peerRef.current.id,
          joinedAt: Date.now()
        });
        
        // Create invitation for target admin
        await set(ref(db, `JPMCReceptionistAdmin/${targetAdminId}/calls/${roomID}`), {
          user: callData.user,
          status: 'pending',
          timestamp: Date.now(),
          sessionId: callData.sessionId,
          peerID: callData.peerID,
          isConferenceCall: true,
          conferenceId: roomID,
          invitedBy: adminId
        });
        
        // Update target admin's status
        await update(ref(db, `JPMCReceptionistAdmin/${targetAdminId}`), {
          status: 'pending'
        });
        
        setShowAddAdminModal(false);
      }
    } catch (error) {
      console.error('Error inviting admin:', error);
    }
  };

  // Handle new admin joining the conference
  const handleNewAdminJoined = (adminData) => {
    console.log('New admin joined:', adminData);
    setConnectedAdmins(prev => [...prev, adminData]);
    
    // Connect with the new admin peer
    if (localStream && peerRef.current) {
      const call = peerRef.current.call(adminData.peerId, localStream);
      handlePeerCall(call, adminData.id);
    }
  };

  // Handle peer call
  const handlePeerCall = (call, peerId) => {
    peersRef.current[peerId] = call;
    
    call.on('stream', (remoteStream) => {
      console.log('Received stream from peer:', peerId);
      streamsRef.current[peerId] = remoteStream;
      setRemoteStreams(prev => ({
        ...prev,
        [peerId]: remoteStream
      }));
    });
    
    call.on('close', () => {
      console.log('Call closed with peer:', peerId);
      delete streamsRef.current[peerId];
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[peerId];
        return newStreams;
      });
    });
    
    call.on('error', (err) => {
      console.error('Call error with peer:', peerId, err);
    });
  };

  // Fetch session ID and chat history when the component mounts
  useEffect(() => {
    if (!roomID) {
      console.error('Room ID not provided.');
      return;
    }
  
    const fetchSessionIdFromRoom = async () => {
      if (!roomID) return;
      setLoading(true);
      try {
        const roomRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
        const snapshot = await get(roomRef);
        if (snapshot.exists()) {
          const roomData = snapshot.val();
          setSessionId(roomData.sessionId);
          
          // Check if this is a conference call
          if (roomData.isConferenceCall) {
            console.log('Joining conference call');
          } else {
            setIsOriginalAdmin(true); // First admin in the call
          }
          
          fetchChatHistory(roomData.sessionId);
        } else {
          console.error('Room not found in Firebase.');
        }
      } catch (error) {
        console.error('Error fetching session ID from room:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchSessionIdFromRoom();
  
    // Initialize Peer with TURN configuration for cross-network connectivity.
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
    
    peer.on('open', (id) => {
      console.log('My peer ID:', id);
      joinRoom(peer, roomID);
      
      // Add this admin to conference if it's not the original
      checkAndJoinConference(id);
    });
    
    peer.on('call', (call) => {
      console.log('Received call from peer');
      if (localStream) {
        call.answer(localStream);
        const peerId = call.peer;
        handlePeerCall(call, peerId);
      }
    });
    
    peer.on('error', (err) => console.error('PeerJS error:', err));
  
    // Listen for room status changes to auto-end call if needed.
    const roomRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val().status === 'ended') {
        endCall();
      }
    });
    
    // Listen for new admins joining the conference
    const conferenceRef = ref(db, `conferenceRooms/${roomID}/admins`);
    const conferenceUnsubscribe = onValue(conferenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const admins = snapshot.val();
        const connectedAdminsList = Object.entries(admins)
          .filter(([id]) => id !== adminId) // Filter out current admin
          .map(([id, data]) => ({
            id,
            ...data
          }));
        
        // Find new admins that we need to connect with
        const currentAdminIds = connectedAdmins.map(admin => admin.id);
        const newAdmins = connectedAdminsList.filter(admin => !currentAdminIds.includes(admin.id));
        
        // Update connected admins list
        setConnectedAdmins(connectedAdminsList);
        
        // Connect with any new admins
        newAdmins.forEach(admin => {
          handleNewAdminJoined(admin);
        });
      }
    });
  
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) peerRef.current.destroy();
      unsubscribe();
      conferenceUnsubscribe();
      
      // Clean up admin status on unmount
      update(ref(db, `JPMCReceptionistAdmin/${adminId}`), { status: "available" })
        .catch(error => console.error("Error updating admin status:", error));
      update(ref(db, `available/${adminId}`), { status: "available" })
        .catch(error => console.error("Error updating availability:", error));
        
      // Remove from conference if applicable
      if (!isOriginalAdmin) {
        remove(ref(db, `conferenceRooms/${roomID}/admins/${adminId}`))
          .catch(error => console.error("Error removing from conference:", error));
      }
    };
  }, [roomID, adminId]);

  // Check if this is a conference call and join if needed
  const checkAndJoinConference = async (peerId) => {
    try {
      // Check if call is a conference and we're not the original admin
      const roomRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
      const snapshot = await get(roomRef);
      
      if (snapshot.exists() && snapshot.val().isConferenceCall) {
        console.log('Joining existing conference call');
        setIsOriginalAdmin(false);
        
        // Add this admin to the conference
        await set(ref(db, `conferenceRooms/${roomID}/admins/${adminId}`), {
          email: localStorage.getItem("userEmail"),
          peerId: peerId,
          joinedAt: Date.now()
        });
      }
    } catch (error) {
      console.error('Error checking conference status:', error);
    }
  };

  // Join the room and start the call
  const joinRoom = (peer, roomID) => {
    if (!roomID) return;
    const roomRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
    get(roomRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const roomData = snapshot.val();
          const remotePeerID = roomData.peerID;
          navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((stream) => {
              setLocalStream(stream);
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
              }
              
              // Call the user
              const call = peer.call(remotePeerID, stream);
              call.on('stream', (remoteStream) => {
                streamsRef.current.user = remoteStream;
                setRemoteStreams(prev => ({
                  ...prev,
                  user: remoteStream
                }));
                if (userVideoRef.current) {
                  userVideoRef.current.srcObject = remoteStream;
                }
              });
              
              // Also check for existing admins in conference and connect with them
              if (roomData.isConferenceCall) {
                connectWithExistingAdmins();
              }
              
              call.on('error', (err) => console.error('Call error:', err));
            })
            .catch((err) => console.error('Error accessing media devices:', err));
        } else {
          console.error('No data found for room ID:', roomID);
        }
      })
      .catch((err) => console.error('Error fetching room data:', err));
  };

  // Connect with existing admins in the conference
  const connectWithExistingAdmins = async () => {
    try {
      const conferenceRef = ref(db, `conferenceRooms/${roomID}/admins`);
      const snapshot = await get(conferenceRef);
      
      if (snapshot.exists()) {
        const admins = snapshot.val();
        
        // Connect with each admin except self
        Object.entries(admins).forEach(([id, data]) => {
          if (id !== adminId && data.peerId && localStream) {
            console.log('Connecting with existing admin:', id);
            const call = peerRef.current.call(data.peerId, localStream);
            handlePeerCall(call, id);
          }
        });
      }
    } catch (error) {
      console.error('Error connecting with existing admins:', error);
    }
  };

  // Chat history fetching
  const fetchChatHistory = async (sessionId) => {
    if (!sessionId) {
      setError('Session ID is required to fetch chat history.');
      return;
    }
    try {
      const chatRef = ref(db, `chatHistory/${sessionId}`);
      const snapshot = await get(chatRef);
      if (snapshot.exists()) {
        const chatData = snapshot.val().history || [];
        setChatHistory(chatData);
      } else {
        console.log('No chat history found for the given session ID.');
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      setError('Failed to load chat history.');
    }
  };

  return (
    <div className="bg-black h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-gradient-to-t from-[rgb(12,25,97)] to-[rgb(12,25,97)]/5 backdrop-blur-md border border-white/20 shadow-lg">
        <div className="container flex items-center justify-between px-6 py-3 mx-auto">
          <div className="h-12 flex items-center">
            <img className="h-12 filter invert brightness-0" src={img} alt="Purview Logo" />
          </div>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold text-white">
            Video Conference
          </h1>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center px-8 py-6 space-y-4 relative">
        {/* Main Live Video Grid */}
        <div className="w-full flex flex-wrap gap-4 justify-center">
          {/* User Video */}
          <div className="w-3/5 bg-black shadow-lg relative rounded-lg overflow-hidden border border-[rgb(12,25,97)] min-h-[400px]">
            <h3 className="text-white text-center rounded-t-lg font-bold py-2 bg-gradient-to-r from-[rgb(12,25,97)] to-[rgb(30,60,180)]">
              User Feed
            </h3>
            <video
              ref={userVideoRef}
              autoPlay
              playsInline
              className="w-full h-[400px] object-cover rounded-b-lg"
            ></video>
            {!remoteStreams.user && (
              <div className="waiting-text text-white absolute inset-0 flex items-center justify-center">
                Please wait, connecting to the user...
              </div>
            )}
          </div>

          {/* Connected Admins Videos */}
          {connectedAdmins.map(admin => (
            <div key={admin.id} className="w-72 bg-black shadow-lg relative rounded-lg overflow-hidden border border-[rgb(12,25,97)]">
              <h3 className="text-white text-center rounded-t-lg font-bold py-2 bg-gradient-to-r from-[rgb(12,25,97)] to-[rgb(30,60,180)]">
                {admin.email}
              </h3>
              <video
                ref={el => {
                  if (el && remoteStreams[admin.id]) {
                    el.srcObject = remoteStreams[admin.id];
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-[200px] object-cover rounded-b-lg"
              ></video>
              {!remoteStreams[admin.id] && (
                <div className="waiting-text text-white absolute inset-0 flex items-center justify-center">
                  Connecting...
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Control Bar */}
        <div className="w-full flex items-center justify-center mt-4 space-x-6 bg-black/40 py-4 rounded-lg backdrop-blur-sm border border-white/10">
          {/* Self Video */}
          <div className="w-60 h-32 overflow-hidden shadow-md relative rounded-lg border border-[rgb(12,25,97)]">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            ></video>
            {!isCameraOn && (
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                <MdVideocamOff size={34} className="text-white" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-center text-xs py-1">
              You (Admin)
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={toggleMicrophone}
              className={`p-4 rounded-full text-white transition-colors duration-200 ${
                isMicOn ? 'bg-[rgb(12,25,97)] hover:bg-[rgb(8,16,60)]' : 'bg-red-600 hover:bg-red-700'
              }`}
              title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
            >
              {isMicOn ? <MdMic size={24} /> : <MdMicOff size={24} />}
            </button>

            <button
              onClick={toggleCamera}
              className={`p-4 rounded-full text-white transition-colors duration-200 ${
                isCameraOn ? 'bg-[rgb(12,25,97)] hover:bg-[rgb(8,16,60)]' : 'bg-red-600 hover:bg-red-700'
              }`}
              title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {isCameraOn ? <MdVideocam size={24} /> : <MdVideocamOff size={24} />}
            </button>

            {isOriginalAdmin && (
              <button
                onClick={openAddAdminModal}
                className="bg-[rgb(12,25,97)] p-4 rounded-full text-white hover:bg-[rgb(8,16,60)] focus:outline-none shadow-lg transition-colors"
                title="Add another admin"
              >
                <MdPersonAdd size={24} />
              </button>
            )}

            <button
              className="bg-red-600 p-4 rounded-full text-white hover:bg-red-700 focus:outline-none shadow-lg transition-colors"
              onClick={endCall}
              title="End call"
            >
              <MdCallEnd size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[rgb(20,40,120)] rounded-lg w-96 max-w-md shadow-lg border border-white/20">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-white" />
                <h3 className="text-white text-lg font-semibold">Add Admin to Call</h3>
              </div>
              <button 
                onClick={() => setShowAddAdminModal(false)}
                className="text-white/70 hover:text-white"
              >
                <MdClose size={24} />
              </button>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {availableAdmins.length > 0 ? (
                availableAdmins.map((admin) => (
                  <button
                    key={admin.id}
                    onClick={() => inviteAdmin(admin.id)}
                    className="w-full p-4 text-left text-white hover:bg-white/10 transition-colors flex items-center justify-between border-b border-white/5"
                  >
                    <span className="truncate">{admin.email}</span>
                    <MdPersonAdd className="w-5 h-5 text-white/70" />
                  </button>
                ))
              ) : (
                <div className="p-4 text-white/70 text-center">
                  No available admins found.
                </div>
              )}
            </div>
            
            <div className="p-4 flex justify-end">
              <button
                onClick={() => setShowAddAdminModal(false)}
                className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallingAdmin;
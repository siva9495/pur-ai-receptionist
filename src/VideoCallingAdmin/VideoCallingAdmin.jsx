import React, { useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';
import { db } from '../Firebase/Firebase';
import { ref, get, onValue, remove, update, set } from 'firebase/database';
import './VideoCallingAdmin.css';
import { MdCallEnd, MdChat, MdClose, MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdPersonAdd } from "react-icons/md";
import { Users, PhoneForwarded, UserCheck, UserX } from "react-feather";
import img from '../Images/purviewlogo.png';
import { useNavigate, useLocation } from 'react-router-dom';

// Component for displaying a participant's video feed
const ParticipantVideo = ({ stream, displayName, isMuted }) => {
  const videoRef = useRef(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  
  return (
    <div className="relative rounded-lg overflow-hidden border border-[rgb(12,25,97)] mb-2">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-cover"
      ></video>
      <div className="absolute bottom-0 left-0 bg-black/50 p-1 text-xs text-white">
        {displayName} {isMuted && <MdMicOff className="inline" />}
      </div>
    </div>
  );
};

const VideoCallingAdmin = () => {
  // State declarations
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isChatVisible, setIsChatVisible] = useState(false);
  
  // Conference call related states
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [availableAdmins, setAvailableAdmins] = useState([]);
  const [unavailableAdmins, setUnavailableAdmins] = useState([]);
  const [activeTab, setActiveTab] = useState('available');
  const [selectedAdmins, setSelectedAdmins] = useState([]);
  const [invitedAdmins, setInvitedAdmins] = useState({});
  const [participantStreams, setParticipantStreams] = useState({});

  const navigate = useNavigate();
  const location = useLocation();
  // Extract roomID and adminId from location.state.
  const { roomID, adminId, isInvited} = location.state || {};

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const callsRef = useRef({});
  const connectionsRef = useRef({});

  // Toggle microphone state
  const toggleMicrophone = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
        
        // Update mute status in the call room for other participants
        if (roomID) {
          const participantRef = ref(db, `callRooms/${roomID}/participants/${adminId}`);
          update(participantRef, { isMuted: !audioTrack.enabled });
        }
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
        
        // Update camera status in the call room
        if (roomID) {
          const participantRef = ref(db, `callRooms/${roomID}/participants/${adminId}`);
          update(participantRef, { hasVideo: videoTrack.enabled });
        }
      }
    }
  };

  // End the call, clean up, and navigate back to the dashboard
  const endCall = async () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    
    // Destroy all peer connections
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    
    // Close all connections
    Object.values(connectionsRef.current).forEach(conn => {
      if (conn) conn.close();
    });
    
    // Close all calls
    Object.values(callsRef.current).forEach(call => {
      if (call) call.close();
    });
    
    // Remove this admin from the call room
    if (roomID) {
      try {
        const participantRef = ref(db, `callRooms/${roomID}/participants/${adminId}`);
        await remove(participantRef);
        
        // Check if this admin is the host
        const roomRef = ref(db, `callRooms/${roomID}`);
        const roomSnapshot = await get(roomRef);
        if (roomSnapshot.exists() && roomSnapshot.val().hostId === adminId) {
          // If host is leaving, end the call for everyone
          await update(roomRef, { status: 'ended' });
          
          // Remove the original call from the admin's queue
          const adminCallRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
          await update(adminCallRef, { status: 'ended' });
          setTimeout(() => remove(adminCallRef), 3000);
        }
        
        navigate('/AdminDashboardPage');
      } catch (error) {
        console.error('Error ending call:', error);
        navigate('/AdminDashboardPage');
      }
    } else {
      navigate('/AdminDashboardPage');
    }
  };

  // Fetch available and unavailable admins
  // Fetch available and unavailable admins
  const fetchAdmins = async () => {
    try {
      const adminsRef = ref(db, 'JPMCReceptionistAdmin');
      const snapshot = await get(adminsRef);
      if (snapshot.exists()) {
        const adminsData = snapshot.val();
        const available = [];
        const unavailable = [];
        
        Object.entries(adminsData).forEach(([id, data]) => {
          if (id !== adminId) { // Don't include the current admin
            const adminInfo = {
              id,
              email: data.email || 'Unknown',
              status: data.status || 'offline',
              name: data.email ? data.email.split('@')[0] : 'Admin' // Use email prefix as name if full name not available
            };
            
            // Check if this admin is already in the call
            const isInCall = invitedAdmins[id] && invitedAdmins[id].status === 'joined';
            
            if (data.status === 'available' && !isInCall) {
              available.push(adminInfo);
            } else if (data.status === 'unavailable' || isInCall) {
              unavailable.push(adminInfo);
            }
          }
        });
        
        setAvailableAdmins(available);
        setUnavailableAdmins(unavailable);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  // Toggle the admin selection menu
  const toggleAdminMenu = () => {
    if (!showAdminMenu) {
      fetchAdmins();
    }
    setShowAdminMenu(!showAdminMenu);
  };

  // Handle admin selection for invitation
  const toggleAdminSelection = (admin) => {
    setSelectedAdmins(prevSelected => {
      if (prevSelected.some(a => a.id === admin.id)) {
        return prevSelected.filter(a => a.id !== admin.id);
      } else {
        return [...prevSelected, admin];
      }
    });
  };

  // Send invitation to selected admins
  const inviteAdmins = async () => {
    if (selectedAdmins.length === 0) return;
    
    try {
      // Create a call room if it doesn't exist
      const callRoomRef = ref(db, `callRooms/${roomID}`);
      const roomSnapshot = await get(callRoomRef);
      
      if (!roomSnapshot.exists()) {
        // Create a new call room
        await set(callRoomRef, {
          hostId: adminId,
          status: 'active',
          startTime: Date.now(),
          participants: {
            [adminId]: {
              id: adminId,
              name: 'You (Host)',
              role: 'host',
              status: 'joined',
              joinTime: Date.now(),
              peerId: peerRef.current.id,
              isMuted: !isMicOn,
              hasVideo: isCameraOn,
            }
          }
        });
      }
      
      // Add the current user to the call room participants if not already there
      const participantRef = ref(db, `callRooms/${roomID}/participants/${adminId}`);
      const participantSnapshot = await get(participantRef);
      
      if (!participantSnapshot.exists()) {
        await set(participantRef, {
          id: adminId,
          name: 'You',
          role: 'host',
          status: 'joined',
          joinTime: Date.now(),
          peerId: peerRef.current.id,
          isMuted: !isMicOn,
          hasVideo: isCameraOn,
        });
      }
      
      // Send invitations to selected admins
      const updatedInvitedAdmins = { ...invitedAdmins };
      
      for (const admin of selectedAdmins) {
        // Create an invitation for the admin
        const invitationRef = ref(db, `adminInvitations/${admin.id}/${roomID}`);
        await set(invitationRef, {
          roomID,
          invitedBy: adminId,
          invitedAt: Date.now(),
          status: 'pending',
          hostPeerId: peerRef.current.id,
          originalCallData: {
            sessionId
          }
        });
        
        // Add the admin to the call room participants with 'invited' status
        const adminParticipantRef = ref(db, `callRooms/${roomID}/participants/${admin.id}`);
        await set(adminParticipantRef, {
          id: admin.id,
          name: admin.name || admin.email,
          role: 'admin',
          status: 'invited',
          invitedAt: Date.now(),
          isMuted: true,
          hasVideo: false,
        });
        
        // Update local state
        updatedInvitedAdmins[admin.id] = {
          ...admin,
          status: 'invited',
          invitedAt: Date.now()
        };
      }
      
      setInvitedAdmins(updatedInvitedAdmins);
      setSelectedAdmins([]);
      setShowAdminMenu(false);
    } catch (error) {
      console.error('Error inviting admins:', error);
    }
  };

  // Initialize peer connection and listen for events
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
      console.log('My peer ID is:', id);
      joinRoom(peer, roomID);
      
      // Listen for incoming calls from other admins
      peer.on('call', (call) => {
        console.log('Incoming call from:', call.peer);
        
        // Answer the call with our local stream
        if (localStream) {
          call.answer(localStream);
          
          // Handle the stream from the caller
          call.on('stream', (stream) => {
            console.log('Received stream from:', call.peer);
            
            // Find the admin ID associated with this peer ID
            const findAdminId = async () => {
              const callRoomRef = ref(db, `callRooms/${roomID}/participants`);
              const snapshot = await get(callRoomRef);
              if (snapshot.exists()) {
                const participants = snapshot.val();
                const adminEntry = Object.entries(participants).find(([_, data]) => data.peerId === call.peer);
                if (adminEntry) {
                  const [adminId, adminData] = adminEntry;
                  // Add the stream to participantStreams
                  setParticipantStreams(prev => ({
                    ...prev,
                    [adminId]: {
                      stream,
                      name: adminData.name || 'Admin',
                      isMuted: adminData.isMuted || false
                    }
                  }));
                }
              }
            };
            
            findAdminId();
          });
          
          // Store the call for later cleanup
          callsRef.current[call.peer] = call;
        }
      });
      
      // Listen for incoming data connections
      peer.on('connection', (conn) => {
        console.log('Incoming connection from:', conn.peer);
        
        conn.on('open', () => {
          console.log('Connection opened with:', conn.peer);
          
          conn.on('data', (data) => {
            console.log('Received data:', data);
            // Handle control messages (e.g., mute status changes)
            if (data.type === 'control') {
              // Update participant info
              if (data.action === 'mute') {
                const adminId = data.adminId;
                setParticipantStreams(prev => ({
                  ...prev,
                  [adminId]: {
                    ...prev[adminId],
                    isMuted: data.value
                  }
                }));
              }
            }
          });
        });
        
// Store connection for later cleanup
connectionsRef.current[conn.peer] = conn;
});
});

peer.on('error', (err) => {
console.error('PeerJS error:', err);
});

// Listen for admin invitation responses
const invitationsRef = ref(db, `callRooms/${roomID}/participants`);
const unsubscribe = onValue(invitationsRef, (snapshot) => {
if (snapshot.exists()) {
  const participants = snapshot.val();
  Object.entries(participants).forEach(([id, data]) => {
    if (id !== adminId && data.status) {
      // Update the invitation status in our local state
      setInvitedAdmins(prev => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          id,
          name: data.name,
          status: data.status,
          peerId: data.peerId
        }
      }));
    }
  });
}
});

return () => {
if (peerRef.current) peerRef.current.destroy();
unsubscribe();
};
}, [roomID, adminId]);

// Join the room and start the call
const joinRoom = async (peer, roomID) => {
  if (!roomID) {
    console.error("No room ID provided.");
    return;
  }

  setLoading(true);

  try {
    let roomRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
    let snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      // If no direct call found, check callRooms for conference call
      console.log(`Room ${roomID} not found under JPMCReceptionistAdmin, checking callRooms...`);
      roomRef = ref(db, `adminInvitations/${adminId}/${roomID}`);
      snapshot = await get(roomRef);
    }

    if (!snapshot.exists()) {
      console.error("Room does not exist in Firebase:", roomID);
      return;
    }

    const roomData = snapshot.val();
    const remotePeerID = roomData.peerID || roomData.hostPeerId; // Use correct peer ID

    if (!remotePeerID) {
      console.error("No valid Peer ID found for room:", roomID);
      return;
    }

    // Request user media
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    // Call the remote peer
    const call = peer.call(remotePeerID, stream);
    call.on("stream", (remoteStream) => {
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });
    call.on("error", (err) => console.error("Call error:", err));

    // Store call reference
    callsRef.current[remotePeerID] = call;

    // Create a connection for messaging
    const conn = peer.connect(remotePeerID);
    conn.on("open", () => {
      console.log("Connected to peer:", remotePeerID);
    });

    // Store connection reference
    connectionsRef.current[remotePeerID] = conn;

    // Update participant status in Firebase
    await createOrUpdateParticipant(peer.id, roomID);
  } catch (error) {
    console.error("Error joining room:", error);
  } finally {
    setLoading(false);
  }
};


// Create or update the participant entry in the call room
const createOrUpdateParticipant = async (peerId) => {
if (!roomID) return;

try {
// Check if the call room exists
const roomRef = ref(db, `callRooms/${roomID}`);
const roomSnapshot = await get(roomRef);

if (!roomSnapshot.exists()) {
  // Create the call room
  await set(roomRef, {
    hostId: adminId,
    status: 'active',
    startTime: Date.now(),
    participants: {}
  });
}

// Add or update our participant entry
const participantRef = ref(db, `callRooms/${roomID}/participants/${adminId}`);
await set(participantRef, {
  id: adminId,
  name: 'You',
  role: 'host',
  status: 'joined',
  joinTime: Date.now(),
  peerId,
  isMuted: !isMicOn,
  hasVideo: isCameraOn
});
} catch (error) {
console.error('Error creating/updating participant:', error);
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

// Remove admin from call
const removeAdmin = async (adminId) => {
try {
// Update the admin's status to 'removed'
const participantRef = ref(db, `callRooms/${roomID}/participants/${adminId}`);
await update(participantRef, { status: 'removed', removedAt: Date.now() });

// Remove the stream from our state
setParticipantStreams(prev => {
  const updated = { ...prev };
  delete updated[adminId];
  return updated;
});

// Update invitation status
setInvitedAdmins(prev => ({
  ...prev,
  [adminId]: {
    ...prev[adminId],
    status: 'removed',
    removedAt: Date.now()
  }
}));
} catch (error) {
console.error('Error removing admin:', error);
}
};

// Calculate the grid layout based on number of participants
const getGridLayout = () => {
const participantCount = Object.keys(participantStreams).length;

if (participantCount === 0) {
return "w-full";
} else if (participantCount === 1) {
return "w-1/2";
} else if (participantCount === 2) {
return "w-1/3";
} else {
return "w-1/4";
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
      Video Calling
    </h1>
  </div>
</nav>

<div className="flex-1 flex flex-row items-start justify-center px-8 py-6 space-x-8 relative">
  {/* Main content area with video feeds */}
  <div className="flex flex-1 flex-col h-full">
    {/* Conference Grid - shows when there are participants */}
    {Object.keys(participantStreams).length > 0 ? (
      <div className="w-full bg-black shadow-lg relative rounded-lg overflow-hidden border border-[rgb(12,25,97)] mb-4">
        <h3 className="text-white text-center rounded-t-lg font-bold py-2 bg-gradient-to-r from-[rgb(12,25,97)] to-[rgb(30,60,180)]">
          Conference Call
        </h3>
        <div className="flex flex-wrap p-2 h-[275px]">
          {/* User Feed */}
          <div className={`${getGridLayout()} h-full p-1`}>
            <div className="h-full relative rounded-lg overflow-hidden border border-[rgb(12,25,97)]">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              ></video>
              <div className="absolute bottom-0 left-0 bg-black/50 p-1 text-xs text-white">
                User
              </div>
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm">
                  Connecting to user...
                </div>
              )}
            </div>
          </div>
          
          {/* Admin Participants */}
          {Object.entries(participantStreams).map(([adminId, { stream, name, isMuted }]) => (
            <div key={adminId} className={`${getGridLayout()} h-full p-1`}>
              <div className="h-full relative rounded-lg overflow-hidden border border-[rgb(12,25,97)]">
                <video
                  autoPlay
                  playsInline
                  muted={isMuted}
                  className="w-full h-full object-cover"
                  ref={(ref) => {
                    if (ref) ref.srcObject = stream;
                  }}
                ></video>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 flex justify-between items-center">
                  <span className="text-xs text-white">{name}</span>
                  <button
                    onClick={() => removeAdmin(adminId)}
                    className="text-white bg-red-600 rounded-full p-1 hover:bg-red-700"
                    title="Remove from call"
                  >
                    <X size={12} />
                  </button>
                </div>
                {isMuted && (
                  <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
                    <MdMicOff size={16} className="text-white" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null}
    
    {/* User Feed - full size when no participants */}
    <div className={`${Object.keys(participantStreams).length > 0 ? "h-[275px]" : "h-[550px]"} w-full bg-black shadow-lg relative rounded-lg overflow-hidden border border-[rgb(12,25,97)]`}>
      <h3 className="text-white text-center rounded-t-lg font-bold py-2 bg-gradient-to-r from-[rgb(12,25,97)] to-[rgb(30,60,180)]">
        Live User Feed
      </h3>
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      ></video>
      {!remoteStream && (
        <div className="waiting-text text-white absolute inset-0 flex items-center justify-center">
          Please wait, connecting to the user...
        </div>
      )}
    </div>
  </div>

  {/* Right sidebar with controls and admin feed */}
  <div className="w-80 h-full flex flex-col space-y-4">
    {/* Admin video feed */}
    <div className="bg-black shadow-lg rounded-lg overflow-hidden border border-[rgb(12,25,97)]">
      <h3 className="text-white text-center rounded-t-lg font-bold py-2 bg-gradient-to-r from-[rgb(12,25,97)] to-[rgb(30,60,180)]">
        Your Feed
      </h3>
      <div className="relative h-48">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        ></video>
        {!localStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm">
            Camera off
          </div>
        )}
      </div>
    </div>

    {/* Invited admins list */}
    {Object.keys(invitedAdmins).length > 0 && (
      <div className="bg-black shadow-lg rounded-lg overflow-hidden border border-[rgb(12,25,97)]">
        <h3 className="text-white text-center rounded-t-lg font-bold py-2 bg-gradient-to-r from-[rgb(12,25,97)] to-[rgb(30,60,180)]">
          Invited Admins
        </h3>
        <div className="p-2 max-h-48 overflow-y-auto">
          {Object.entries(invitedAdmins).map(([id, admin]) => (
            <div key={id} className="flex items-center justify-between p-2 border-b border-[rgb(12,25,97)]/30">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  admin.status === 'joined' ? 'bg-green-500' : 
                  admin.status === 'invited' ? 'bg-yellow-500' : 
                  admin.status === 'declined' ? 'bg-red-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-white text-sm">{admin.name || admin.email}</span>
              </div>
              <span className="text-xs text-gray-400">
                {admin.status === 'joined' ? 'Joined' : 
                 admin.status === 'invited' ? 'Invited' : 
                 admin.status === 'declined' ? 'Declined' : 'Left'}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Controls */}
    <div className="bg-black shadow-lg rounded-lg overflow-hidden border border-[rgb(12,25,97)]">
      <h3 className="text-white text-center rounded-t-lg font-bold py-2 bg-gradient-to-r from-[rgb(12,25,97)] to-[rgb(30,60,180)]">
        Controls
      </h3>
      <div className="flex justify-center items-center p-4 space-x-4">
        <button
          onClick={toggleMicrophone}
          className={`p-3 rounded-full ${isMicOn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
          title={isMicOn ? 'Mute' : 'Unmute'}
        >
          {isMicOn ? <MdMic size={24} className="text-white" /> : <MdMicOff size={24} className="text-white" />}
        </button>
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full ${isCameraOn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraOn ? <MdVideocam size={24} className="text-white" /> : <MdVideocamOff size={24} className="text-white" />}
        </button>
        <button
          onClick={toggleAdminMenu}
          className="p-3 rounded-full bg-blue-600 hover:bg-blue-700"
          title="Add Admin"
        >
          <MdPersonAdd size={24} className="text-white" />
        </button>
        <button
          onClick={endCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700"
          title="End Call"
        >
          <MdCallEnd size={24} className="text-white" />
        </button>
      </div>
    </div>

    {/* Chat box */}
    <div className="bg-black shadow-lg rounded-lg overflow-hidden border border-[rgb(12,25,97)] flex-1">
      <h3 className="text-white text-center rounded-t-lg font-bold py-2 bg-gradient-to-r from-[rgb(12,25,97)] to-[rgb(30,60,180)]">
        Chat History
      </h3>
      <div className="p-2 h-full max-h-64 overflow-y-auto">
        {chatHistory.length > 0 ? (
          chatHistory.map((message, index) => (
            <div key={index} className="mb-2">
              <div className={`flex ${message.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg p-2 max-w-[80%] ${
                  message.sender === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
                }`}>
                  <p className="text-sm break-words">{message.message}</p>
                  <p className="text-xs text-gray-300 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-400 py-4">No chat history available</div>
        )}
      </div>
    </div>
  </div>
</div>

{/* Admin selection modal */}
{showAdminMenu && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
    <div className="bg-[rgb(12,25,97)] rounded-lg shadow-lg max-w-md w-full p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-xl font-bold">Add Admin to Call</h3>
        <button onClick={toggleAdminMenu} className="text-white">
          <MdClose size={24} />
        </button>
      </div>
      
      <div className="flex border-b border-gray-600 mb-4">
        <button
          onClick={() => setActiveTab('available')}
          className={`py-2 px-4 font-medium ${activeTab === 'available' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
        >
          Available ({availableAdmins.length})
        </button>
        <button
          onClick={() => setActiveTab('unavailable')}
          className={`py-2 px-4 font-medium ${activeTab === 'unavailable' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
        >
          Unavailable ({unavailableAdmins.length})
        </button>
      </div>
      
      <div className="max-h-64 overflow-y-auto mb-4">
        {activeTab === 'available' ? (
          availableAdmins.length > 0 ? (
            availableAdmins.map(admin => (
              <div
                key={admin.id}
                onClick={() => toggleAdminSelection(admin)}
                className={`flex items-center p-2 mb-2 rounded-lg cursor-pointer ${
                  selectedAdmins.some(a => a.id === admin.id) ? 'bg-blue-700' : 'bg-gray-800'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-white">{admin.name || admin.email}</span>
                {selectedAdmins.some(a => a.id === admin.id) && (
                  <UserCheck size={16} className="ml-auto text-green-500" />
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-gray-400 py-4">No available admins</div>
          )
        ) : (
          unavailableAdmins.length > 0 ? (
            unavailableAdmins.map(admin => (
              <div
                key={admin.id}
                className="flex items-center p-2 mb-2 rounded-lg bg-gray-800"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                <span className="text-white">{admin.name || admin.email}</span>
                <UserX size={16} className="ml-auto text-red-500" />
              </div>
            ))
          ) : (
            <div className="text-center text-gray-400 py-4">No unavailable admins</div>
          )
        )}
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={toggleAdminMenu}
          className="py-2 px-4 rounded-lg bg-gray-700 text-white mr-2"
        >
          Cancel
        </button>
        <button
          onClick={inviteAdmins}
          disabled={selectedAdmins.length === 0}
          className={`py-2 px-4 rounded-lg ${
            selectedAdmins.length > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-800 opacity-50 cursor-not-allowed'
          } text-white flex items-center`}
        >
          <PhoneForwarded size={16} className="mr-2" />
          Invite ({selectedAdmins.length})
        </button>
      </div>
    </div>
  </div>
)}

{/* Loading overlay */}
{loading && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
    <div className="text-white text-lg">Loading...</div>
  </div>
)}
</div>
);
};

export default VideoCallingAdmin;
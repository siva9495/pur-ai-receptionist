import React, { useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';
import { db } from '../Firebase';
import { ref, get, onValue, remove, update } from 'firebase/database';
import './VideoCallingAdmin.css';
import { MdCallEnd, MdChat, MdClose, MdMic, MdMicOff, MdVideocam, MdVideocamOff } from "react-icons/md";
import img from '../Images/purviewlogo.png';
import { useNavigate, useLocation } from 'react-router-dom';

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

  const navigate = useNavigate();
  const location = useLocation();
  // Extract roomID and adminId from location.state.
  const { roomID, adminId } = location.state || {};

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

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
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    if (sessionId) {
      const chatHistoryRef = ref(db, `chatHistory/${sessionId}`);
      await remove(chatHistoryRef);
    }
    // Update call status to "ended" and remove the call from Firebase
    if (roomID) {
      try {
        const roomRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
        await update(roomRef, { status: 'ended' });
        setTimeout(() => remove(roomRef), 3000);  // Remove the call after 3 seconds
        navigate('/AdminDashboardPage');
      } catch (error) {
        console.error('Error ending call:', error);
      }
    } else {
      navigate('/AdminDashboardPage');
    }
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
    
    peer.on('open', () => {
      joinRoom(peer, roomID);
    });
    peer.on('error', (err) => console.error('PeerJS error:', err));
  
    // Listen for room status changes to auto-end call if needed.
    const roomRef = ref(db, `JPMCReceptionistAdmin/${adminId}/calls/${roomID}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val().status === 'ended') {
        endCall();
      }
    });
  
    return () => {
      if (peerRef.current) peerRef.current.destroy();
      unsubscribe();  // Stop listening when component unmounts
    };
  }, [roomID, adminId]);

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
              const call = peer.call(remotePeerID, stream);
              call.on('stream', (remoteStream) => {
                setRemoteStream(remoteStream);
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = remoteStream;
                }
              });
              call.on('error', (err) => console.error('Call error:', err));
            })
            .catch((err) => console.error('Error accessing media devices:', err));
        } else {
          console.error('No data found for room ID:', roomID);
        }
      })
      .catch((err) => console.error('Error fetching room data:', err));
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
      <nav className="bg-gradient-to-t from-[#964b00] to-[#964b00]/5 backdrop-blur-md border border-white/20 shadow-lg">
        <div className="container flex items-center justify-between px-6 py-3 mx-auto">
          <div className="h-12 flex items-center">
            <img className="h-6 filter invert brightness-0" src={img} alt="Purview Logo" />
          </div>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold text-white">
            Video Calling
          </h1>
        </div>
      </nav>

      <div className="flex-1 flex flex-row items-start justify-center px-8 py-6 space-x-8 relative">
        {/* Main Live Video Feed */}
        <div className="w-3/4 bg-black shadow-lg relative rounded-lg overflow-hidden border border-[#964b00]">
          <h3 className="text-white text-center rounded-t-lg font-bold py-2 bg-gradient-to-r from-[#964b00] to-[#db6e00]">
            Live User Feed
          </h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-[550px] object-cover rounded-b-lg"
          ></video>
          {!remoteStream && (
            <div className="waiting-text text-white absolute inset-0 flex items-center justify-center">
              Please wait, connecting to the user...
            </div>
          )}
        </div>

        {/* Smaller Video Feed and Controls */}
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
          {/* Control Buttons */}
          <div className="mt-4 flex space-x-4">
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
              className="bg-red-600 p-4 rounded-full text-white hover:bg-red-700 focus:outline-none shadow-lg transition-colors"
              onClick={endCall}
            >
              <MdCallEnd size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCallingAdmin;
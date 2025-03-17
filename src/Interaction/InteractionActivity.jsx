import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SphereAnimation from '../animations/SphereAnimation';
import AnalyzingAnimation from '../animations/AnalyzingAnimation';
import PointerAnimation from '../animations/PointerAnimation';
import ChatInterface from '../ChatbotComponent/ChatInterface';
import TranscriptDisplay from '../AnimatedTranscriptDisplay/TranscriptDisplay';
import img from '../Images/purviewlogo.png';
import { Maximize2, Mic, Video } from 'lucide-react';
import BASE_URL from '../config';
import axiosInstance from '../Api/axiosInstance';
import './InteractionActivity.css';

const InteractionActivity = () => {
  const [state, setState] = useState({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    response: '',
    isAnalyzing: false,
    hasGreeted: false,
    sessionId: null,
    clearTimer: null,
    isClearing: false,
    isFullscreen: false,
    isMobileDevice: false,
  });

  const isSpeakingRef = useRef(state.isSpeaking); // Ref to track isSpeaking
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const recognitionRef = useRef(null);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /iphone|ipad|ipod|android|blackberry|windows phone/g.test(userAgent);
      setState(prevState => ({ ...prevState, isMobileDevice: isMobile }));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  const saveChatToFirebase = async (sessionId, question, answer) => {
    console.log(sessionId)
    try {
      if (!sessionId) {
        console.error('Session ID is required to save chat data.');
        return;
      }
  
      const chatRef = ref(db, `chatHistory/${sessionId}`);
  
      // Fetch existing data (if any)
      const snapshot = await get(chatRef);
      let chatHistory = snapshot.exists() ? snapshot.val().history || [] : [];
  
      // Append the new question and answer to the history array
      chatHistory.push({
        question,
        answer,
        timestamp: Date.now(),
      });
  
      // Update the Firebase document
      await set(chatRef, {
        sessionId, // Store sessionId for reference
        history: chatHistory, // Store the updated history
      });
  
      console.log('Chat saved to Firebase successfully');
    } catch (error) {
      console.error('Error saving chat to Firebase:', error);
      toast.error('Failed to save conversation');
    }
  };

  // Detect fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState((prevState) => ({
        ...prevState,
        isFullscreen: !!document.fullscreenElement,
      }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const stopSpeaking = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setState(prevState => ({ ...prevState, isSpeaking: false }));
      isSpeakingRef.current = false;
      console.log('Ongoing speech has been canceled.');
    }
  };  

  const handleVideoCall = () => {
    stopSpeaking();

    showLoadingDialog();
    setTimeout(() => {
      hideLoadingDialog();
      // navigate('/video-calling');
      navigate('/video-calling', { state: { sessionId: state.sessionId } });
    }, 5000);
  };

  useEffect(() => {
    initializeSpeechRecognition();

    // Generate a session ID on component mount
    if (!state.sessionId) {
      const generatedSessionId = generateSessionId();
      setState((prevState) => ({ ...prevState, sessionId: generatedSessionId }));
    }

    // Add an event listener for page refresh/unload
    const handlePageUnload = () => {
      if (state.sessionId) {
        // const url = 'https://cricket-smooth-polliwog.ngrok-free.app/clear_chat_history';
        const url = `${BASE_URL}/clear_chat_history`;
        const params = new URLSearchParams();
        params.append("user_id", state.sessionId);

        fetch(url, {
          method: 'DELETE',
          body: params.toString(), // Sending as URL-encoded string
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          keepalive: true, // Allows the request to be sent during page unload
        });
      }
    };
    window.addEventListener('beforeunload', handlePageUnload);

    // Cleanup on component unmount
    return () => {
      if (state.clearTimer) {
        clearTimeout(state.clearTimer);
      }
      window.removeEventListener('beforeunload', handlePageUnload);
      // Optionally clear the session when component unmounts
      if (state.sessionId) {
        // clearSession(state.sessionId);
      }
      stopSpeaking();
    };
  }, [state.sessionId]); // Added state.sessionId as dependency

  // Updated speech recognition initialization for better mobile support
  const initializeSpeechRecognition = () => {
    // Check if the browser supports speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = 'en-US'; // Changed to en-US for better compatibility
      recognition.continuous = false;
      recognition.interimResults = true; // Set to true to get interim results
      recognition.maxAlternatives = 1;
      
      recognitionRef.current = recognition;

      recognition.onresult = handleSpeechResult;
      recognition.onerror = handleSpeechError;
      recognition.onend = handleSpeechEnd;
    } else {
      toast.error('Speech recognition is not supported in your browser. Please try Chrome or Safari.');
    }
  };

  const generateSessionId = () => {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID(); // Use the modern randomUUID method
    } else {
      // Fallback for older browsers
      const random = () =>
        Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
      return `${random()}-${random()}-${random()}-${random()}-${random()}`;
    }
  };

  // Updated speech result handler with improved handling of interim results
  const handleSpeechResult = (event) => {
    let finalTranscript = '';
    
    // Collect results
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
    
    if (finalTranscript !== '') {
      setState((prevState) => ({ ...prevState, transcript: finalTranscript }));
      fetchResponse(finalTranscript);
    }
  };

  const handleSpeechError = (event) => {
    console.error('Speech recognition error:', event.error);
    
    // Custom error messages based on the error type
    let errorMessage = 'An error occurred with speech recognition.';
    
    switch (event.error) {
      case 'no-speech':
        errorMessage = 'No speech was detected. Please try again.';
        break;
      case 'audio-capture':
        errorMessage = 'Microphone not connected or permission denied.';
        break;
      case 'not-allowed':
        errorMessage = 'Microphone permission denied. Please allow microphone access.';
        break;
      case 'network':
        errorMessage = 'Network error occurred. Please check your connection.';
        break;
      case 'aborted':
        // This is a normal cancellation, no need for an error message
        return;
      default:
        errorMessage = `Speech recognition error: ${event.error}`;
    }
    
    toast.error(errorMessage);
    setState((prevState) => ({ ...prevState, isListening: false }));
  };

  const handleSpeechEnd = () => {
    setState((prevState) => ({ ...prevState, isListening: false }));
  };


  // Modified to handle mobile devices better
  const startListening = () => {
    // Check for microphone permission first
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          // Permission granted, proceed with speech recognition
          if (isSpeakingRef.current) {
            // Cancel ongoing speech
            window.speechSynthesis.cancel();
            setState(prevState => ({ ...prevState, isSpeaking: false }));
            isSpeakingRef.current = false;

            setTimeout(() => {
              if (!state.isListening && recognitionRef.current) {
                if (!state.hasGreeted) {
                  speakOut('Hello, This is Maya. How may I help you?', () => {
                    setState(prevState => ({ ...prevState, hasGreeted: true }));
                    startRecognition();
                  });
                } else {
                  startRecognition();
                }
              }
            }, 100);
          } else {
            if (!state.isListening && !state.isSpeaking && recognitionRef.current) {
              if (!state.hasGreeted) {
                speakOut('Hello, This is Maya. How may I help you?', () => {
                  setState(prevState => ({ ...prevState, hasGreeted: true }));
                  startRecognition();
                });
              } else {
                startRecognition();
              }
            }
          }
        })
        .catch(err => {
          console.error('Microphone access error:', err);
          toast.error('Please allow microphone access to use voice features');
        });
    } else {
      toast.error('Your browser does not support audio input');
    }
  };

  const startRecognition = () => {
    try {
      // Reset recognition before starting for mobile devices
      if (state.isMobileDevice && recognitionRef.current) {
        recognitionRef.current.stop();
        setTimeout(() => {
          recognitionRef.current.start();
          setState((prevState) => ({ ...prevState, isListening: true }));
          toast.success('Listening...', { duration: 2000 });
        }, 200);
      } else {
        recognitionRef.current.start();
        setState((prevState) => ({ ...prevState, isListening: true }));
        toast.success('Listening...', { duration: 2000 });
      }

      // Cancel the auto-clear timer if it exists
      if (state.clearTimer) {
        clearTimeout(state.clearTimer);
        setState((prevState) => ({ ...prevState, clearTimer: null }));
      }
    } catch (error) {
      console.warn('Speech recognition error:', error);
      toast.error('Failed to start listening. Please try again.');
    }
  };

  const fetchResponse = async (userInput) => {
    if (isSpeakingRef.current) return;

    setState((prevState) => ({ ...prevState, isAnalyzing: true }));
    try {
      const formData = new FormData();
      formData.append('question', userInput);
      formData.append('user_id', state.sessionId);

      // Fetch response from server using Axios instance
      const response = await axiosInstance.post(
        '/ask_jpmc',
        formData
      );

      const { answer } = response.data;

      // Save the question and answer to Firebase
      await saveChatToFirebase(state.sessionId, userInput, answer);

      setState((prevState) => ({
        ...prevState,
        response: answer,
        isAnalyzing: false,
      }));

      // Speak out the answer
      await speakOut(answer);

      // Set a timer to clear session if listening doesn't start in 20 seconds
      const timer = setTimeout(() => {
        if (!state.isListening) {
          console.log('No listening started. Clearing session and chat history.');
          clearSession(state.sessionId);
        }
      }, 20000);

      setState((prevState) => ({ ...prevState, clearTimer: timer }));
    } catch (error) {
      if (error.response) {
        console.error('Error Response:', error.response.data);
        toast.error(`Failed to get response: ${error.response.data.message || 'Server error'}`);
      } else if (error.request) {
        console.error('Error Request:', error.request);
        toast.error('Network error. Please check your connection.');
      } else {
        console.error('Error Message:', error.message);
        toast.error('An error occurred. Please try again.');
      }
      setState((prevState) => ({ ...prevState, isAnalyzing: false }));
    }
  };

  const clearSession = async (sessionId) => {
    if (!sessionId || state.isClearing) return;

    try {
      setState((prevState) => ({ ...prevState, isClearing: true }));

      const formData = new FormData();
      formData.append("user_id", sessionId);

      await axiosInstance.delete(
        '/clear_chat_history',
        { data: formData }
      );

      console.log("Session and chat history cleared.");
      setState((prevState) => ({
        ...prevState,
        sessionId: null,
        clearTimer: null,
        isClearing: false,
        transcript: "",
        response: "",
        hasGreeted: false,
      }));
    } catch (error) {
      if (error.response) {
        console.error("Error Response:", error.response.data);
        toast.error(`Failed to clear session: ${error.response.data.message || 'Server error'}`);
      } else if (error.request) {
        console.error("Error Request:", error.request);
        toast.error("No response from the server. Please try again later.");
      } else {
        console.error("Error Message:", error.message);
        toast.error("An error occurred. Please try again.");
      }
      setState((prevState) => ({ ...prevState, isClearing: false }));
    }
  };

  const speakOut = async (text, callback) => {
    // Set isSpeaking to true when speech starts
    setState(prevState => ({ ...prevState, isSpeaking: true }));
    isSpeakingRef.current = true;
  
    const synth = window.speechSynthesis;
  
    // Cancel any ongoing or pending speech
    if (synth.speaking) {
      synth.cancel();
    }
  
    // Check for special triggers (e.g., 8-digit numbers)
    const numberRegex = /\b\d{8}\b/;
    if (numberRegex.test(text)) {
      console.log('8-digit number detected, skipping speech and navigating.');
      showLoadingDialog();
      setTimeout(() => {
        hideLoadingDialog();
        navigate('/video-calling');
      }, 5000);
      // Set isSpeaking to false since we're navigating away
      setState(prevState => ({ ...prevState, isSpeaking: false }));
      isSpeakingRef.current = false;
      return;
    }
  
    // Wait for voices to load if not yet initialized
    if (synth.getVoices().length === 0) {
      await new Promise((resolve) => {
        synth.onvoiceschanged = resolve;
      });
    }
  
    // Select Google US Female Voice
    const voice = synth.getVoices().find(v => v.name === "Google US English" && v.gender === "female");
    
    const msg = new SpeechSynthesisUtterance(text);
    msg.voice = voice || null;
    msg.lang = "en-US"; // US English
  
    msg.onend = () => {
      // Set isSpeaking to false when speech ends
      setState(prevState => ({ ...prevState, isSpeaking: false }));
      isSpeakingRef.current = false;
  
      if (callback) {
        callback();
      }
    };
  
    msg.onerror = () => {
      // Handle errors
      setState(prevState => ({ ...prevState, isSpeaking: false }));
      isSpeakingRef.current = false;
    };
  
    synth.speak(msg);
  };  

  const speakOut1 = async (text, callback) => {
  // Set isSpeaking to true when speech starts
  setState(prevState => ({ ...prevState, isSpeaking: true }));
  isSpeakingRef.current = true;

  const synth = window.speechSynthesis;

  // Ensure voices are loaded before speaking
  if (synth.getVoices().length === 0) {
    await new Promise((resolve) => {
      synth.onvoiceschanged = resolve;
    });
  }

  // Select Google US Female Voice
  const voice = synth.getVoices().find(v => v.name === "Google US English" && v.gender === "female");
  
  if (!voice) {
    console.error('Google US English Female voice not found!');
    return;
  }

  const msg = new SpeechSynthesisUtterance(text);
  msg.voice = voice;
  msg.lang = "en-US"; // US English

  // On speech end, mark speaking as false
  msg.onend = () => {
    setState(prevState => ({ ...prevState, isSpeaking: false }));
    isSpeakingRef.current = false;

    if (callback) {
      callback();
    }
  };

  // On error, mark speaking as false
  msg.onerror = () => {
    setState(prevState => ({ ...prevState, isSpeaking: false }));
    isSpeakingRef.current = false;
  };

  // Speak the message
  if (!synth.speaking) {
    synth.speak(msg);
  }
};


  const showLoadingDialog = () => {
    const loadingDialog = document.createElement('div');
    loadingDialog.id = 'loading-dialog';
    loadingDialog.className = 'loading-dialog';
    loadingDialog.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Connecting to human assistant...</p>
    `;
    document.body.appendChild(loadingDialog);
  };

  const hideLoadingDialog = () => {
    const loadingDialog = document.getElementById('loading-dialog');
    if (loadingDialog) {
      document.body.removeChild(loadingDialog);
    }
  };

  return (
    <div
      onClick={startListening}
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden bg-black"
    >
      {/* Fullscreen Button */}
      {!state.isFullscreen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="absolute top-4 right-4 z-50 bg-gray-700 text-white p-2 rounded-full transition-all hover:bg-gray-600"
          aria-label="Toggle fullscreen"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      )}

      {/* JPMC Logo */}
      <div className="absolute top-2 left-4 md:left-5 z-30">
        <img src={img} alt="JPMC Logo" className="jpmc-logo w-24 md:w-32" />
      </div>

      {/* Welcome Message */}
      <h1 className="absolute top-10 left-1/2 -translate-x-1/2 text-white text-xl md:text-3xl font-bold m-0 z-20 text-center px-4 w-full">
        Welcome To Purview Services
      </h1>

      {/* Status Message */}
      <div className={`absolute top-2 left-1/2 -translate-x-1/2 mt-24 md:mt-32 text-white text-lg md:text-2xl z-20 text-center transition-opacity duration-300 ${
        state.isListening || state.isAnalyzing ? 'opacity-100 animate-pulse' : 'opacity-0'
      }`}>
        {state.isListening ? 'Listening...' : ''}
        {state.isAnalyzing ? 'Analyzing...' : ''}
      </div>

      {/* Transcript and Response Display */}
      <TranscriptDisplay
        transcript={state.transcript}
        response={state.response}
      />

      {/* Listen Button - Visible when not listening */}
      {!state.isListening && (
         <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
             <PointerAnimation />
         </div>
      )}

      {/* Video Call Button */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
        <button
          id="videoCallButton"
          onClick={(e) => {
            e.stopPropagation();
            handleVideoCall();
          }}
          className="bg-gradient-to-r from-[#ffffff] to-[#f2f2f2] hover:from-[#f2f2f2] hover:to-[#e6e6e6]
             text-[rgb(12,25,97)] px-4 md:px-8 py-2 md:py-3 rounded-full shadow-lg transform transition-all duration-200
             hover:scale-105 font-semibold tracking-wide flex items-center gap-2 text-sm md:text-base"
        >
          <Video className="w-4 h-4 md:w-5 md:h-5" />
          <span>Video Call</span>
        </button>
      </div>

      {/* Animations */}
      {state.isAnalyzing ? <AnalyzingAnimation /> : <SphereAnimation />}

      {/* Chat Interface */}
      <ChatInterface sessionId={state.sessionId}/>
    </div>
  );
};

export default InteractionActivity;
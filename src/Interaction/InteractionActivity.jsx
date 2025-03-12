import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SphereAnimation from '../animations/SphereAnimation';
import AnalyzingAnimation from '../animations/AnalyzingAnimation';
import PointerAnimation from '../animations/PointerAnimation';
import ChatInterface from '../ChatbotComponent/ChatInterface';
import TranscriptDisplay from '../AnimatedTranscriptDisplay/TranscriptDisplay';
import img from '../Images/purviewlogo.png';
import { Maximize2, Minimize2 } from 'lucide-react';
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
  });

  const isSpeakingRef = useRef(state.isSpeaking); // Ref to track isSpeaking
  const containerRef = useRef(null);
  const recognitionRef = useRef(null);

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

  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      recognition.onresult = handleSpeechResult;
      recognition.onerror = handleSpeechError;
      recognition.onend = handleSpeechEnd;
    } else {
      alert('Speech recognition is not supported in your browser. Please try Chrome.');
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

  const handleSpeechResult = (event) => {
    const userSpeech = event.results[0][0].transcript;
    setState((prevState) => ({ ...prevState, transcript: userSpeech }));
    fetchResponse(userSpeech);
  };

  const handleSpeechError = (event) => {
    alert('Error with speech recognition: ' + event.error);
    setState((prevState) => ({ ...prevState, isListening: false, isSpeaking: false }));
    isSpeakingRef.current = false;
  };

  const handleSpeechEnd = () => {
    setState((prevState) => ({ ...prevState, isListening: false, isSpeaking: false }));
    isSpeakingRef.current = false;
  };

  const startListening = () => {
    if (isSpeakingRef.current) {
      // Cancel ongoing speech
      window.speechSynthesis.cancel();
      // Update the state and ref to reflect that speaking has stopped
      setState(prevState => ({ ...prevState, isSpeaking: false }));
      isSpeakingRef.current = false;

      // Start listening after a short delay to ensure speech is canceled
      setTimeout(() => {
        if (!state.isListening && recognitionRef.current) {
          if (!state.hasGreeted) {
            // Speak greeting and start listening
            speakOut('Hello, This is Maya. How may I help you?', () => {
              setState(prevState => ({ ...prevState, hasGreeted: true }));
              startRecognition();
            });
          } else {
            // Directly start listening
            startRecognition();
          }
        }
      }, 100); // 100ms delay
    } else {
      if (!state.isListening && !state.isSpeaking && recognitionRef.current) {
        if (!state.hasGreeted) {
          // Speak greeting and start listening
          speakOut('Hello, This is Maya. How may I help you?', () => {
            setState(prevState => ({ ...prevState, hasGreeted: true }));
            startRecognition();
          });
        } else {
          // Directly start listening
          startRecognition();
        }
      }
    }
  };

  const startRecognition = () => {
    try {
      recognitionRef.current.start();
      setState((prevState) => ({ ...prevState, isListening: true }));

      // Cancel the auto-clear timer if it exists
      if (state.clearTimer) {
        clearTimeout(state.clearTimer);
        setState((prevState) => ({ ...prevState, clearTimer: null }));
      }
    } catch (error) {
      console.warn('Speech recognition is already running.');
    }
  };

  const fetchResponse = async (userInput) => {
    if (isSpeakingRef.current) return;

    setState((prevState) => ({ ...prevState, isAnalyzing: true }));
    try {
      const formData = new FormData();
      formData.append('question', userInput);
      formData.append('user_id', state.sessionId); // Ensure this matches backend expectations

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
        isAnalyzing: false, // Stop analyzing once response is received
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
        // Server responded with a status other than 2xx
        console.error('Error Response:', error.response.data);
        alert(`Failed to fetch response: ${error.response.data.message || error.response.statusText}`);
      } else if (error.request) {
        // Request was made but no response received
        console.error('Error Request:', error.request);
        alert('No response from the server. Please try again later.');
      } else {
        // Something happened in setting up the request
        console.error('Error Message:', error.message);
        alert('An error occurred while setting up the request.');
      }
      setState((prevState) => ({ ...prevState, isAnalyzing: false }));
    }
  };

  const clearSession = async (sessionId) => {
    if (!sessionId || state.isClearing) return; // Prevent multiple calls if already clearing

    try {
      setState((prevState) => ({ ...prevState, isClearing: true }));

      const formData = new FormData();
      formData.append("user_id", sessionId);

      // Make DELETE request using Axios instance
      await axiosInstance.delete(
        '/clear_chat_history',
        { data: formData }
      );

      console.log("Session and chat history cleared.");
      setState((prevState) => ({
        ...prevState,
        sessionId: null,
        clearTimer: null,
        isClearing: false, // Reset clearing status
        transcript: "",
        response: "",
        hasGreeted: false,
      }));
    } catch (error) {
      // Error handling
      if (error.response) {
        console.error("Error Response:", error.response.data);
        alert(
          `Failed to clear session: ${
            error.response.data.message || error.response.statusText
          }`
        );
      } else if (error.request) {
        console.error("Error Request:", error.request);
        alert("No response from the server. Please try again later.");
      } else {
        console.error("Error Message:", error.message);
        alert("An error occurred while setting up the request.");
      }
      setState((prevState) => ({ ...prevState, isClearing: false })); // Reset clearing status even on error
    }
  };

  const speakOut = async (text, callback) => {
    // Set isSpeaking to true when speech starts
    setState(prevState => ({ ...prevState, isSpeaking: true }));
    isSpeakingRef.current = true;

    const synth = window.speechSynthesis;

    // Split long text into manageable chunks
    const splitText = (text, maxLength = 100) => {
      const words = text.split(' ');
      const chunks = [];
      let chunk = '';

      words.forEach((word) => {
        if ((chunk + word).length <= maxLength) {
          chunk += `${word} `;
        } else {
          chunks.push(chunk.trim());
          chunk = `${word} `;
        }
      });

      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }

      return chunks;
    };

    // Function to handle speech synthesis for each chunk
    const speakChunk = (chunk, language, country, preferredNames) => {
      return new Promise((resolve) => {
        const msg = new SpeechSynthesisUtterance(chunk);

        const selectVoice = () => {
          const voices = synth.getVoices();
          voices.sort((a, b) => {
            if (language) {
              const matchA = a.lang.startsWith(language + "-");
              const matchB = b.lang.startsWith(language + "-");
              if (!matchA && matchB) return 1;
              if (matchA && !matchB) return -1;
            }
            if (country) {
              const matchA = a.lang.endsWith("-" + country);
              const matchB = b.lang.endsWith("-" + country);
              if (!matchA && matchB) return 1;
              if (matchA && !matchB) return -1;
            }
            if (preferredNames) {
              const indexA = preferredNames.findIndex((e) => a.name.match(e));
              const indexB = preferredNames.findIndex((e) => b.name.match(e));
              return (indexA !== -1 ? indexA : voices.length) - (indexB !== -1 ? indexB : voices.length);
            }
            return 0;
          });
          return voices[0] || null;
        };

        const voice = selectVoice();
        msg.voice = voice || null;
        msg.lang = language + (country ? `-${country}` : '');
        msg.onend = resolve;
        msg.onerror = resolve;

        synth.speak(msg);
      });
    };

    // Cancel any ongoing or pending speech
    if (synth.speaking) {
      synth.cancel();
      // The 'onend' event will be triggered, so no need to set isSpeaking to false here
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

    // Process and speak each text chunk
    const chunks = splitText(text);
    for (const chunk of chunks) {
      await speakChunk(chunk, 'en', null, [/Google US English/, /Samantha/, /Fiona/, /Victoria/, /Zira/, /female/i]);
    }

    // Set isSpeaking to false when speech ends
    setState(prevState => ({ ...prevState, isSpeaking: false }));
    isSpeakingRef.current = false;

    if (callback) {
      callback();
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
            e.stopPropagation(); // This prevents the click from bubbling up to the parent div
            toggleFullscreen();
          }}
          className="absolute top-4 right-4 z-50 bg-gray-700 text-white p-2 rounded"
        >
          <Maximize2 className="w-6 h-6" />
        </button>
      )}

      {/* JPMC Logo */}
      <div className="absolute top-2 left-5 z-30">
        <img src={img} alt="JPMC Logo" className="jpmc-logo" />
      </div>

      {/* Welcome Message */}
      <h1 className="absolute top-10 left-1/2 -translate-x-1/2 text-white text-3xl font-bold m-0 z-20 text-center">
        Welcome To Purview Services
      </h1>

      {/* Status Message */}
      <h3 className={`absolute top-2 left-1/2 -translate-x-1/2 mt-32 text-white text-2xl z-20 text-center ${
        state.isListening || state.isAnalyzing ? 'animate-heartbeat' : ''
      }`}>
        {state.isListening ? 'Listening...' : ''}
        {state.isAnalyzing ? 'Analyzing...' : ''}
      </h3>

      {/* Transcript and Response Display */}
      <TranscriptDisplay
        transcript={state.transcript}
        response={state.response}
      />

      {/* Listen Button */}
      {!state.isListening && (
         <button
          // onClick={startListening}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 text-black font-bold py-2 px-6 text-xl rounded-full shadow-md z-10"
        >
          <PointerAnimation />
        </button> 
      )}

      {/* Video Call Button */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-10">
        <button
          id="videoCallButton"
          onClick={(e) => {
            e.stopPropagation(); // This prevents the click from bubbling up to the parent div
            handleVideoCall();
          }}
          className="bg-gradient-to-r from-[#ffffff] to-[#ffffff] hover:from-[#ffffff] hover:to-[#f2f2f2]
             text-[rgb(12,25,97)] px-8 py-3 rounded-full shadow-lg transform transition-all duration-200
             hover:scale-105 font-semibold tracking-wide flex items-center gap-2"
        >
          <span className="text-lg">Video Call</span>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
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
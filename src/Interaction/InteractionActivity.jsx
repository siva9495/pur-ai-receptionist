import React, { useState, useEffect, useRef } from 'react';
import SphereAnimation from '../animations/SphereAnimation';
import axios from 'axios';
import AnalyzingAnimation from '../animations/AnalyzingAnimation';
import './InteractionActivity.css';
import img from '../Images/purviewlogo.png';

const InteractionActivity = () => {
  const [state, setState] = useState({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    response: '',
    isAnalyzing: false,
    hasGreeted: false, // Add a flag to track if the greeting has been provided
    sessionId: null, // Track session ID
    clearTimer: null, // Timer for auto-clearing session
  });

  const recognitionRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    initializeSpeechRecognition();

    // Generate a session ID on component mount
    if (!state.sessionId) {
      const generatedSessionId = generateSessionId();
      setState((prevState) => ({ ...prevState, sessionId: generatedSessionId }));
    }

    // Cleanup on component unmount
    return () => {
      if (state.clearTimer) {
        clearTimeout(state.clearTimer);
      }
    };
  }, []);

  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = 'en-US';
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
  };

  const handleSpeechEnd = () => {
    setState((prevState) => ({ ...prevState, isListening: false }));
  };

  const startListening = () => {
    if (!state.isListening && !state.isSpeaking && recognitionRef.current) {
      if (!state.hasGreeted) {
        // Speak greeting and start listening
        speakOut('Hello, This is Maya. How may I help you?', () => {
          setState((prevState) => ({ ...prevState, hasGreeted: true }));
          startRecognition();
        });
      } else {
        // Directly start listening
        startRecognition();
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
    if (state.isSpeaking) return;

    setState((prevState) => ({ ...prevState, isAnalyzing: true }));
    try {
      const formData = new FormData();
      formData.append('question', userInput);
      formData.append('user_id', state.sessionId); // Add session ID as user_id

      // Fetch response from server
      const response = await axios.post('https://cricket-smooth-polliwog.ngrok-free.app/ask_jpmc', formData);
      const { answer } = response.data;

      setState((prevState) => ({
        ...prevState,
        response: answer,
        isAnalyzing: false, // Stop analyzing once response is received
      }));

      // Speak out the answer
      await speakOut(answer);

      // Set a timer to clear session if listening doesn't start in 5 seconds
      const timer = setTimeout(() => {
        if (!state.isListening) {
          console.log('No listening started. Clearing session and chat history.');
          clearSession(state.sessionId);
        }
      }, 5000);

      setState((prevState) => ({ ...prevState, clearTimer: timer }));
    } catch (error) {
      alert('Failed to fetch response from the server.');
    } finally {
      setState((prevState) => ({ ...prevState, isAnalyzing: false }));
    }
  };

  const clearSession = async (sessionId) => {
    try {
      const formData = new FormData();
      formData.append('user_id', sessionId);

      await axios.delete('https://cricket-smooth-polliwog.ngrok-free.app/clear_chat_history', {
        data: formData, // Send form data with session_id
      });
      console.log('Session and chat history cleared.');
      setState((prevState) => ({
        ...prevState,
        sessionId: null,
        clearTimer: null,
      }));
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };

  const speakOut = async (text, callback) => {
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
    if (synth.speaking || synth.pending) {
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
      className="relative h-screen w-full bg-[#964b00] overflow-hidden"
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

      {/* Animations */}
      {state.isAnalyzing ? <AnalyzingAnimation /> : <SphereAnimation />}

      {/* Chat Interface */}
      <ChatInterface sessionId={state.sessionId}/>
    </div>
  );
};

export default InteractionActivity;
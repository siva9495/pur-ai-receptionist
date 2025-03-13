import React, { useEffect, useRef, useState } from 'react';

const TranscriptDisplay = ({ transcript, response, isSpeaking }) => {
  const responseRef = useRef(null);
  const [textChunks, setTextChunks] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(0);
  
  // Function to check if the text contains an 8-digit number
  const containsEightDigitNumber = (text) => {
    const numberRegex = /\b\d{8}\b/;
    return numberRegex.test(text);
  };
  
  // Determine if the response or transcript contains an 8-digit number
  const shouldHide = containsEightDigitNumber(response);
  
  // Split response into chunks for progressive display when response changes
  useEffect(() => {
    if (response) {
      // Split text into sentences or chunks
      const chunks = response
        .replace(/([.!?])\s+/g, "$1|")
        .split("|")
        .filter(chunk => chunk.trim().length > 0);
      
      setTextChunks(chunks);
      setCurrentPosition(0); // Reset position when response changes
    }
  }, [response]);
  
  // Progressive auto-scroll effect that follows along with speech
  useEffect(() => {
    if (!isSpeaking || !responseRef.current || textChunks.length === 0) return;
    
    // Estimate speaking speed
    const averageWordsPerSecond = 2.5;
    const wordsInResponse = response?.split(' ').length || 0;
    const estimatedTotalTime = (wordsInResponse / averageWordsPerSecond) * 1000;
    const timePerChunk = estimatedTotalTime / textChunks.length;
    
    // Create an interval to handle progressive scrolling during speech
    const scrollInterval = setInterval(() => {
      setCurrentPosition(prev => {
        const nextPos = prev + 1;
        
        // If we've displayed all chunks, clear the interval
        if (nextPos >= textChunks.length) {
          clearInterval(scrollInterval);
          return textChunks.length;
        }
        
        // Calculate how far to scroll
        const lineHeight = 28; // Estimated line height in pixels
        const scrollAmount = nextPos * lineHeight;
        
        // Smooth scroll to current position
        if (responseRef.current) {
          responseRef.current.scrollTo({
            top: scrollAmount,
            behavior: 'smooth'
          });
        }
        
        return nextPos;
      });
    }, timePerChunk);
    
    return () => clearInterval(scrollInterval);
  }, [isSpeaking, textChunks, response]);
  
  // Prevent click events from bubbling up to parent container
  const handleClick = (e) => {
    e.stopPropagation();
  };
  
  // Prevent touch events from bubbling up to parent container
  const handleTouch = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="absolute bottom-32 left-8 w-[400px] px-4 z-20"
      onClick={handleClick}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      onTouchEnd={handleTouch}
    >
      {/* Container for both transcript and response */}
      {!shouldHide && (
        <div className="space-y-4">
          {/* User Transcript */}
          {transcript && (
            <div className="animate-[slideIn_0.5s_ease-out]">
              <div
                className="max-w-[90%] bg-[rgb(12,25,97)] text-white p-4 rounded-2xl rounded-bl-none
                 shadow-[0_0_15px_rgb(12,25,97)] backdrop-blur-sm"
              >
                <div className="text-sm text-blue-200 mb-1">You</div>
                <div className="text-lg">{transcript}</div>
              </div>
            </div>
          )}
          
          {/* Maya's Response */}
          {response && (
            <div className="animate-[slideIn_0.5s_ease-out]">
              <div
                className="max-w-[90%] bg-[rgb(12,25,97)] text-white p-4 rounded-2xl rounded-br-none
                 shadow-[0_0_15px_rgb(12,25,97)] backdrop-blur-sm ml-auto"
              >
                <div className="text-sm text-blue-200 mb-1">Maya</div>
                <div 
                  ref={responseRef}
                  className="text-lg max-h-64 overflow-y-auto pr-2"
                  style={{ 
                    scrollBehavior: 'smooth',
                    lineHeight: '1.75',
                    /* Custom scrollbar styling */
                    scrollbarWidth: 'none', /* Firefox */
                    msOverflowStyle: 'none', /* IE and Edge */
                  }}
                >
                  {response}
                  {/* Invisible spacer to ensure auto-scroll works properly */}
                  <div className="h-4"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptDisplay;
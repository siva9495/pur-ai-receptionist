import React from 'react';

const TranscriptDisplay = ({ transcript, response }) => {
  // Function to check if the text contains an 8-digit number
  const containsEightDigitNumber = (text) => {
    const numberRegex = /\b\d{8}\b/;
    return numberRegex.test(text);
  };

  // Determine if the response or transcript contains an 8-digit number
  const shouldHide = containsEightDigitNumber(response);

  return (
    <div className="absolute bottom-32 left-8 w-[400px] px-4 z-20">
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
                <div className="text-lg">{response}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptDisplay;
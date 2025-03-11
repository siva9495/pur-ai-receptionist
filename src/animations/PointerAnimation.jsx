import React from 'react';
import { PointerIcon } from 'lucide-react';

const PointerAnimation = ({onClick}) => {
  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 cursor-pointer" onClick={onClick}>
      {/* Pointer with wave and pressing animation */}
      <div className="relative flex items-center justify-center">
        <div className="relative animate-pressing">
          {/* Pointer Icon */}
          <PointerIcon 
            className="w-12 h-12 text-white transform transition-transform hover:scale-110 z-10" 
            strokeWidth={1}
          />

          {/* Staggered Wave Animation */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{ transform: 'translate(-7px, -15px)' }}
          >
            <div className="absolute w-full h-full animate-wave rounded-full border border-blue-400" style={{ animationDelay: '0s' }} />
            <div className="absolute w-full h-full animate-wave rounded-full border border-blue-400" style={{ animationDelay: '0.7s' }} />
            <div className="absolute w-full h-full animate-wave rounded-full border border-blue-400" style={{ animationDelay: '1.4s' }} />
          </div>
        </div>
      </div>

      {/* Text with pressing animation */}
      <span className="text-white text-base font-medium tracking-wide whitespace-nowrap mb-2">
        CLICK HERE TO CONNECT THE CALL WITH THE RECEPTIONIST
      </span>

      <style jsx>{`
        @keyframes wave-animation {
          0% {
            transform: scale(0.5); /* Start small */
            opacity: 1;
          }
          70% {
            opacity: 0.2; /* Fading effect */
          }
          100% {
            transform: scale(1.5); /* Grow large */
            opacity: 0; /* Disappear */
          }
        }
        @keyframes pressing {
          0%, 100% {
            transform: scale(1) translateY(0); /* Neutral position */
          }
          50% {
            transform: scale(0.9) translateY(5px); /* Pressing effect */
          }
        }
        .animate-wave {
          animation: wave-animation 2s ease-out infinite;
        }
        .animate-pressing {
          animation: pressing 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default PointerAnimation;
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import BASE_URL from '../config';

const ChatInterface = ({ sessionId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const chatContainerRef = useRef(null);

  const toggleChat = (e) => {
    e.stopPropagation();
    setIsOpen((prevState) => !prevState);
  };

  const handleContainerClick = (e) => {
    e.stopPropagation();
  };
  const showLoadingDialog = () => setIsLoading(true);
  const hideLoadingDialog = () => setIsLoading(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newMessage = { type: 'user', content: message };
    setChatHistory((prev) => [...prev, newMessage]);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('question', message);
      formData.append('user_id', sessionId);

      const response = await fetch(`${BASE_URL}/ask_jpmc`, {
        method: 'POST',
        body: formData,
      });      

      const data = await response.json();
      const numberRegex = /\b\d{8}\b/;
      const answer = data.answer;

      if (numberRegex.test(answer)) {
        const cleanedAnswer = answer.replace(numberRegex, '').trim();
        setChatHistory((prev) => [...prev, { type: 'bot', content: cleanedAnswer }]);
        return;
      }

      setChatHistory((prev) => [...prev, { type: 'bot', content: answer }]);
    } catch (error) {
      console.error('Error:', error);
      setChatHistory((prev) => [...prev, { type: 'bot', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  return (
    <div className="fixed bottom-4 right-4 z-50" onClick={handleContainerClick}>
      {/* Chat Toggle Button with Waves */}
      <div className="relative">
        <button
          onClick={toggleChat}
          type="button"
          className={`relative w-14 h-14 rounded-full bg-[rgb(12,25,97)] text-white shadow-lg 
            transition-all duration-300 hover:scale-110 ${isOpen ? 'rotate-90' : ''}
            before:absolute before:inset-0 before:rounded-full before:animate-pulse
            before:bg-[rgb(12,25,97)] before:opacity-50 before:scale-150
            shadow-[0_0_15px_rgb(12,25,97),0_0_30px_rgb(12,25,97),0_0_45px_rgb(12,25,97)]
            animate-[glow-animation_2s_infinite]
            cursor-pointer`}
        >
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
          </div>
        </button>
        <div className="absolute inset-0 rounded-full border-2 border-[rgba(12,25,97,0.5)] 
            animate-[wave-animation_2s_infinite] pointer-events-none">
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-[rgba(12,25,97,0.5)] 
            animate-[wave-animation_2s_infinite] [animation-delay:1s] pointer-events-none">
        </div>
      </div>

      {/* Chat Window */}
      <div
        className={`absolute bottom-20 right-0 w-96 bg-gradient-to-b from-[rgb(12,25,97)] to-black 
          rounded-lg shadow-xl transition-all duration-300 transform ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        } shadow-[0_0_15px_rgba(12,25,97,0.5)]`}
      >
        {/* Chat Header */}
        <div className="bg-gradient-radial from-[rgb(12,25,97)] to-black text-white p-4 rounded-t-lg border-b border-[rgba(255,255,255,0.2)]">
          <h3 className="text-lg font-semibold">Chat with MAYA</h3>
        </div>

        {/* Chat Messages with Custom Scrollbar */}
        <div
          ref={chatContainerRef}
          className="h-96 overflow-y-auto p-4 space-y-4 custom-scrollbar"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(12,25,97) rgba(0,0,0,0.3)',
          }}
        >
          {/* Custom Scrollbar Track and Thumb (visible in Firefox) */}
          <style jsx>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 8px;
              background-color: rgba(0,0,0,0.3);
              border-radius: 4px;
            }
            
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: linear-gradient(to bottom, rgb(12,25,97), rgb(8,16,60));
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              box-shadow: 0 0 6px rgba(12,25,150,0.5);
            }
            
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(to bottom, rgb(18,37,145), rgb(12,25,97));
              box-shadow: 0 0 10px rgba(12,25,150,0.8);
            }
            
            .custom-scrollbar::-webkit-scrollbar-track {
              background-color: rgba(0,0,0,0.3);
              border-radius: 4px;
              box-shadow: inset 0 0 5px rgba(0,0,0,0.5);
            }
            
            /* For Firefox */
            .custom-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: rgb(12,25,97) rgba(0,0,0,0.3);
            }
          `}</style>

          {chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.type === 'user'
                    ? 'bg-gradient-radial from-[rgb(12,25,97)] to-black text-white rounded-br-none shadow-[0_0_10px_rgb(12,25,97)]'
                    : 'bg-gradient-radial from-[rgba(12,25,97,0.7)] to-black text-white rounded-bl-none shadow-[0_0_10px_rgba(12,25,97,0.7)]'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-[rgba(255,255,255,0.1)]">
          <div className="flex space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 p-2 rounded-lg bg-[rgba(255,255,255,0.1)] text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-[rgb(12,25,97)] border border-[rgba(255,255,255,0.2)]"
            />
            <button
              type="submit"
              className="p-2 bg-gradient-radial from-[rgb(12,25,97)] to-black text-white rounded-lg hover:bg-[rgb(12,25,150)] 
                transition-colors shadow-[0_0_10px_rgba(12,25,97,0.5)]"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ChatInterface = ({ sessionId}) => {
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
  const navigate = useNavigate();
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

      const response = await fetch('https://ruling-goldfish-inherently.ngrok-free.app/ask_jpmc', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      const numberRegex = /\b\d{8}\b/;
      const answer = data.answer;

      if (numberRegex.test(answer)) {
        console.log('8-digit number detected, skipping speech and navigating.');
        showLoadingDialog();
        setTimeout(() => {
          hideLoadingDialog();
          navigate('/video-calling');
        }, 5000);

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
        {/* CHANGED: removed e.preventDefault() */}
        <button
          onClick={toggleChat}
          type="button"
          className={`relative w-14 h-14 rounded-full bg-[#964b00] text-white shadow-lg 
            transition-all duration-300 hover:scale-110 ${isOpen ? 'rotate-90' : ''}
            before:absolute before:inset-0 before:rounded-full before:animate-pulse
            before:bg-[#964b00] before:opacity-50 before:scale-150
            shadow-[0_0_15px_#964b00,0_0_30px_#964b00,0_0_45px_#964b00]
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
        className={`absolute bottom-20 right-0 w-96 bg-gradient-to-b from-[#964b00] to-black 
          rounded-lg shadow-xl transition-all duration-300 transform ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        } shadow-[0_0_15px_rgba(12,25,97,0.5)]`}
      >
        {/* Chat Header */}
        <div className="bg-[#964b00] text-white p-4 rounded-t-lg">
          <h3 className="text-lg font-semibold">Chat with MAYA</h3>
        </div>

        {/* Chat Messages */}
        <div
          ref={chatContainerRef}
          className="h-96 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-[#964b00] scrollbar-track-transparent"
        >
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.type === 'user'
                    ? 'bg-[#964b00] text-white rounded-br-none shadow-[0_0_10px_rgba(12,25,97,0.5)]'
                    : 'bg-[rgba(12,25,97,0.1)] text-white rounded-bl-none shadow-[0_0_10px_rgba(12,25,97,0.3)]'
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
                focus:outline-none focus:ring-2 focus:ring-[#964b00] border border-[rgba(255,255,255,0.2)]"
            />
            <button
              type="submit"
              className="p-2 bg-[#964b00] text-white rounded-lg hover:bg-[rgb(12,25,150)] 
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
import React, { useState, useRef, useEffect } from 'react';

const ChatModal = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    setMessages([...messages, { text: inputMessage, sender: 'user' }]);
    setInputMessage('');
    // TODO: Add AI response logic here
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`; // Max height of 200px
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-4xl h-[80vh] rounded-xl flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-800 p-4 flex justify-between items-center">
          <h2 className="text-white text-xl font-bold">AI Assistant</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} w-full`}
            >
              <div className={`max-w-[70%] rounded-lg px-4 py-3 break-words whitespace-pre-wrap ${
                message.sender === 'user' 
                  ? 'bg-gray-700 text-gray-100 font-medium'
                  : 'bg-gray-800 text-gray-100'
              }`}>
                {message.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="border-t border-gray-800 p-4">
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              rows="1"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 
                focus:outline-none focus:ring-2 focus:ring-[#14C800]
                resize-none min-h-[40px] max-h-[200px] overflow-y-auto"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              className="bg-[#14C800] text-white px-6 py-2 rounded-lg
                transition-all duration-300 hover:bg-[#14C800]/90 
                hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]
                transform hover:-translate-y-1 self-end"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;

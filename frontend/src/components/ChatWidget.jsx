import React, { useState, useRef, useEffect } from 'react';
import api from '../api';
import '../chat.css';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', content: "Bonjour ! Je suis ATLAS AI, votre assistant virtuel. Comment puis-je vous aider aujourd'hui ?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const toggleChat = () => setIsOpen(!isOpen);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to history
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // We pass the history excluding the very first greeting if we want, or pass all
      // We'll pass all except the current user message (since backend expects message separately)
      // Actually, passing history without the current message is best.
      const historyToSend = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await api.post('/chat', {
        message: userMessage,
        history: historyToSend
      });

      setMessages([...newMessages, { role: 'model', content: response.data.reply }]);
    } catch (error) {
      console.error("Chat API Error:", error);
      setMessages([...newMessages, { role: 'model', content: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer plus tard." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={`chat-widget-container ${isOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <div className="chat-title">
            <i className="fa fa-robot"></i> ATLAS AI
          </div>
          <button className="chat-close-btn" onClick={toggleChat}>
            <i className="fa fa-times"></i>
          </button>
        </div>
        
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              <div className="chat-bubble">
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chat-message model">
              <div className="chat-bubble loading-bubble">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez une question..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            <i className="fa fa-paper-plane"></i>
          </button>
        </form>
      </div>

      {!isOpen && (
        <button className="chat-toggle-btn" onClick={toggleChat} aria-label="Ouvrir le chat">
          <i className="fa fa-comment-dots"></i>
        </button>
      )}
    </>
  );
}

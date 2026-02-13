import React, { useState, useRef, useEffect, useContext, useMemo, useCallback } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { portfolioApi } from '../services/portfolioApi';

const CHAT_COPY = {
  en: {
    title: 'AI Assistant',
    subtitle: 'Ask about projects, experience, and skills.',
    launchLabel: 'Open AI assistant',
    statusOnline: 'Online',
    statusLoading: 'Loading portfolio...',
    editMode: 'Edit mode',
    clear: 'Clear',
    close: 'Close',
    placeholder: 'Type your message...',
    unavailableInput: 'Assistant will be available once the portfolio is loaded.',
    send: 'Send',
    sending: 'Sending...',
    thinking: 'Assistant is thinking...',
    noPortfolio: 'No portfolio is selected for chat.',
    noResponse: 'No response received from the assistant.',
    responseErrorPrefix: 'I could not process your request: ',
    genericError: 'Unable to get a response right now.',
    sources: 'Sources',
    hint: 'Press Enter to send, Shift+Enter for a new line.',
    prompts: [
      'Summarize the top projects on this portfolio.',
      'What technologies does this person use most?',
      'Give me a short overview of recent experience.',
    ],
  },
  es: {
    title: 'Asistente de IA',
    subtitle: 'Pregunta sobre proyectos, experiencia y habilidades.',
    launchLabel: 'Abrir asistente de IA',
    statusOnline: 'En linea',
    statusLoading: 'Cargando portafolio...',
    editMode: 'Modo edicion',
    clear: 'Limpiar',
    close: 'Cerrar',
    placeholder: 'Escribe tu mensaje...',
    unavailableInput: 'El asistente estara disponible cuando cargue el portafolio.',
    send: 'Enviar',
    sending: 'Enviando...',
    thinking: 'El asistente esta pensando...',
    noPortfolio: 'No hay un portafolio seleccionado para el chat.',
    noResponse: 'No se recibio respuesta del asistente.',
    responseErrorPrefix: 'No pude procesar tu solicitud: ',
    genericError: 'No fue posible obtener una respuesta ahora.',
    sources: 'Fuentes',
    hint: 'Presiona Enter para enviar y Shift+Enter para una nueva linea.',
    prompts: [
      'Resume los proyectos principales de este portafolio.',
      'Que tecnologias usa con mas frecuencia esta persona?',
      'Dame una breve descripcion de su experiencia reciente.',
    ],
  },
};

const createMessage = (sender, text, citations = []) => ({
  id: `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  sender,
  text,
  citations,
});

const createWelcomeMessage = (portfolioName, languageCopy) => {
  if (languageCopy === CHAT_COPY.es) {
    return createMessage(
      'assistant',
      `Hola, soy tu asistente de IA para ${portfolioName || 'este portafolio'}. Preguntame lo que quieras sobre proyectos, experiencia o habilidades.`
    );
  }

  return createMessage(
    'assistant',
    `Hi, I am your AI assistant for ${portfolioName || 'this portfolio'}. Ask me anything about projects, experience, or skills.`
  );
};

const ChatModal = () => {
  const { language } = useContext(LanguageContext);
  const { portfolio } = usePortfolio();
  const { isEditMode } = useEditMode();
  const languageCopy = useMemo(() => CHAT_COPY[language] || CHAT_COPY.en, [language]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const isOpenRef = useRef(false);
  const initializedPortfolioIdRef = useRef(null);

  const isChatReady = Boolean(portfolio?.id);

  useEffect(() => {
    isOpenRef.current = isOpen;

    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!portfolio?.id) return;
    if (initializedPortfolioIdRef.current === portfolio.id) return;

    initializedPortfolioIdRef.current = portfolio.id;
    setSessionId(null);
    setChatError('');
    setMessages([createWelcomeMessage(portfolio?.name, languageCopy)]);
  }, [portfolio?.id, portfolio?.name, languageCopy]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [inputMessage]);

  const resetConversation = useCallback(() => {
    if (!portfolio?.id) return;

    setSessionId(null);
    setChatError('');
    setMessages([createWelcomeMessage(portfolio?.name, languageCopy)]);
    setInputMessage('');
  }, [portfolio?.id, portfolio?.name, languageCopy]);

  const appendAssistantMessage = useCallback((message) => {
    setMessages((prev) => [...prev, message]);

    if (!isOpenRef.current) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  const sendMessage = useCallback(async (rawMessage) => {
    const trimmedMessage = rawMessage.trim();
    if (!trimmedMessage || isSending) return;

    if (!portfolio?.id) {
      setChatError(languageCopy.noPortfolio);
      return;
    }

    setChatError('');
    setMessages((prev) => [...prev, createMessage('user', trimmedMessage)]);
    setInputMessage('');
    setIsSending(true);

    try {
      const response = await portfolioApi.chatWithPortfolioAgent(
        portfolio.id,
        trimmedMessage,
        sessionId,
        language
      );

      setSessionId(response?.session_id || null);
      appendAssistantMessage(
        createMessage(
          'assistant',
          response?.answer || languageCopy.noResponse,
          response?.citations || []
        )
      );
    } catch (error) {
      const message = error?.message || languageCopy.genericError;
      setChatError(message);
      appendAssistantMessage(
        createMessage('assistant', `${languageCopy.responseErrorPrefix}${message}`)
      );
    } finally {
      setIsSending(false);
    }
  }, [appendAssistantMessage, isSending, language, languageCopy, portfolio?.id, sessionId]);

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(inputMessage);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 right-3 sm:bottom-24 sm:right-6 z-[120] w-[calc(100vw-1.5rem)] max-w-[420px] h-[min(72vh,680px)] pointer-events-auto">
          <div className="h-full bg-[#040911]/95 border border-white/10 rounded-2xl shadow-[0_28px_70px_rgba(3,6,10,0.75)] backdrop-blur-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-white text-sm font-semibold tracking-wide">{languageCopy.title}</h2>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 border rounded-full ${
                      isChatReady
                        ? 'text-[#aef6a7] border-[#14C800]/50 bg-[#14C800]/10'
                        : 'text-amber-200 border-amber-400/40 bg-amber-300/10'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isChatReady ? 'bg-[#14C800]' : 'bg-amber-300'}`} />
                    {isChatReady ? languageCopy.statusOnline : languageCopy.statusLoading}
                  </span>
                  {isEditMode && (
                    <span className="text-[10px] uppercase tracking-wider text-blue-200 border border-blue-300/30 bg-blue-400/10 px-2 py-0.5 rounded-full">
                      {languageCopy.editMode}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/60 mt-1">{languageCopy.subtitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetConversation}
                  disabled={!isChatReady || isSending}
                  className="text-xs px-2.5 py-1 border border-white/15 text-white/70 hover:text-white hover:border-white/40 transition-colors rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {languageCopy.clear}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-white/70 hover:text-white transition-colors rounded-md p-1"
                  aria-label={languageCopy.close}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-3">
              {!isChatReady && (
                <div className="text-sm text-amber-100 bg-amber-500/15 border border-amber-300/30 rounded-lg px-3 py-2">
                  {languageCopy.unavailableInput}
                </div>
              )}

              {isChatReady && messages.length <= 1 && (
                <div className="flex flex-wrap gap-2">
                  {languageCopy.prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-xs border border-white/20 text-white/80 hover:text-white hover:border-[#14C800]/80 bg-white/5 hover:bg-[#14C800]/10 transition-colors rounded-full px-3 py-1.5"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                      message.sender === 'user'
                        ? 'bg-[#14C800]/20 border border-[#14C800]/35 text-white'
                        : 'bg-white/5 border border-white/10 text-white/95'
                    }`}
                  >
                    {message.text}
                    {message.sender === 'assistant' && message.citations?.length > 0 && (
                      <p className="mt-2 text-[11px] text-white/60">
                        {languageCopy.sources}: {message.citations.length}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {chatError && (
                <div className="text-xs text-red-200 bg-red-900/25 border border-red-400/30 rounded-lg px-3 py-2">
                  {chatError}
                </div>
              )}

              {isSending && (
                <div className="text-xs text-white/70">{languageCopy.thinking}</div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/10">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputMessage}
                  onChange={(event) => setInputMessage(event.target.value)}
                  placeholder={isChatReady ? languageCopy.placeholder : languageCopy.unavailableInput}
                  className="flex-1 bg-white/5 text-white rounded-xl px-3 py-2 border border-white/15 focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 focus:border-[#14C800]/40 resize-none min-h-[42px] max-h-[180px] custom-scrollbar"
                  disabled={isSending || !isChatReady}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage(inputMessage);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isSending || !inputMessage.trim() || !isChatReady}
                  className="btn-flat btn-flat-sm !rounded-xl !px-3.5 !py-2.5 self-end"
                >
                  {isSending ? languageCopy.sending : languageCopy.send}
                </button>
              </div>
              <p className="text-[11px] text-white/45 mt-2">{languageCopy.hint}</p>
            </form>
          </div>
        </div>
      )}

      <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-[120] pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={languageCopy.launchLabel}
          className={`relative group rounded-full transition-all duration-200 shadow-[0_16px_35px_rgba(4,9,17,0.6)] border ${
            isOpen
              ? 'bg-[#14C800]/20 border-[#14C800]/60 text-white'
              : 'bg-[#0a1322]/90 border-white/20 text-white/90 hover:border-[#14C800]/70 hover:bg-[#10203a]/95'
          } px-4 py-3 flex items-center gap-2`}
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#14C800]/20 border border-[#14C800]/50">
            <svg className="w-4.5 h-4.5 text-[#c9ffc4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 10h8M8 14h5m-7 6l-3-3 3-3m14 6l3-3-3-3M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4 4v-4H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
            </svg>
          </span>
          <span className="text-sm font-medium tracking-wide hidden sm:inline">{languageCopy.title}</span>

          {!isOpen && unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] rounded-full bg-[#14C800] text-black text-[11px] font-semibold flex items-center justify-center px-1.5 border border-black/40">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
};

export default ChatModal;

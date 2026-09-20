'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  X,
  Sparkles,
  Send,
  Bot,
  User,
  Loader2,
  Cpu,
  ShieldCheck,
  HelpCircle,
  MapPin,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  ExternalLink,
  Wrench,
  Compass,
  Zap,
  Image as ImageIcon
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  modelUsed?: string;
  mapLinks?: Array<{ title: string; uri: string }>;
}

let msgCounter = 10;
function generateMsgId(prefix: string) {
  msgCounter += 1;
  return `${prefix}-${msgCounter}`;
}

export const AiConsultantDrawer: React.FC = () => {
  const { isAiAssistantOpen, setIsAiAssistantOpen, navigateTo } = useStore();

  const [selectedModel, setSelectedModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite'>('gemini-3.5-flash');
  const [selectedRole, setSelectedRole] = useState<'store_specialist' | 'pc_architect' | 'repair_cctv_tech' | 'local_guide'>('store_specialist');
  const [enableMapsGrounding, setEnableMapsGrounding] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Namaste! I am Intel AI, your technical consultant for Intel Computer Center in New Road, Kailali.

How can I assist you today?
• 💻 **Laptops & Monitors:** Recommendation for office, gaming, or coding in Nepal.
• 🛠️ **Custom PC Architecture:** GPU/CPU compatibility, TDP power & cooling.
• 📹 **CCTV & Security:** Hikvision/Dahua camera kits & DVR storage.
• 📍 **Store & Delivery:** Showroom directions in New Road & nationwide delivery.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.5-flash',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isAiAssistantOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: generateMsgId('reset'),
        sender: 'assistant',
        text: `Conversation cleared. I am ready with **${selectedModel}** configured for **${selectedRole.replace(/_/g, ' ')}**. Ask me anything!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
      },
    ]);
  };

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || isLoading) return;

    const userMsgId = generateMsgId('user');
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          chatHistory: history,
          model: selectedModel,
          role: selectedRole,
          enableMapsGrounding: enableMapsGrounding,
          userLocation: { lat: 27.700769, lng: 85.312950 },
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const botMsgId = generateMsgId('bot');
      const botMsg: ChatMessage = {
        id: botMsgId,
        sender: 'assistant',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.model || selectedModel,
        mapLinks: data.mapLinks,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: generateMsgId('err'),
          sender: 'assistant',
          text: 'I apologize, but I encountered a network issue. You can also reach our Dhangadhi store directly at **091-525287** or WhatsApp **+977-9848424859**.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    'Recommend a laptop under NPR 120,000 for college and programming',
    'Custom PC specs with RTX 4070 Ti for 4K video rendering',
    'Compare Epson L3210 vs Canon G3010 ink tank printers',
    'Where is Intel Computer located in New Road Kailali?',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl h-full flex flex-col shadow-2xl border-l border-slate-200">

        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 text-white flex flex-col gap-3 border-b border-blue-900/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md ring-1 ring-white/20">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <span>Intel AI Consultant</span>
                </h3>
                <p className="text-[11px] text-blue-200/80">Kailali Retail, Engineering & Maps Grounded</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={`p-2 rounded-xl transition-all ${showConfig ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white'}`}
                title="Model & Role Controls"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearHistory}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Clear Chat History"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsAiAssistantOpen(false)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-900/50 text-slate-300 hover:text-red-300 transition-colors"
                title="Close Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Model & Role Configuration Drawer Section */}
          {showConfig && (
            <div className="bg-slate-900/90 rounded-2xl p-3 border border-blue-800/50 space-y-3 text-xs animate-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-[11px] font-bold text-blue-200 mb-1.5 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gemini Model Architecture:</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedModel('gemini-3.5-flash')}
                    className={`p-2 rounded-xl text-left border transition-all ${selectedModel === 'gemini-3.5-flash'
                      ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-sm'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                  >
                    <div className="text-[11px] font-bold">gemini-3.5-flash</div>
                    <div className="text-[9px] opacity-80">General Tasks & Maps</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                    className={`p-2 rounded-xl text-left border transition-all ${selectedModel === 'gemini-3.1-pro-preview'
                      ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-sm'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                  >
                    <div className="text-[11px] font-bold">3.1-pro-preview</div>
                    <div className="text-[9px] opacity-80">Complex Engineering</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                    className={`p-2 rounded-xl text-left border transition-all ${selectedModel === 'gemini-3.1-flash-lite'
                      ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-sm'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                  >
                    <div className="text-[11px] font-bold">3.1-flash-lite</div>
                    <div className="text-[9px] opacity-80">Ultra-Fast Instant</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-blue-200 mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Specialist Persona:</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('store_specialist')}
                    className={`p-2 rounded-xl text-left border transition-all ${selectedRole === 'store_specialist'
                      ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                  >
                    <div className="font-bold">Store Specialist</div>
                    <div className="text-[9px] opacity-80">Laptops, Deals & Specs</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('pc_architect')}
                    className={`p-2 rounded-xl text-left border transition-all ${selectedRole === 'pc_architect'
                      ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                  >
                    <div className="font-bold">PC Architect</div>
                    <div className="text-[9px] opacity-80">Gaming Rigs & Overclocking</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('repair_cctv_tech')}
                    className={`p-2 rounded-xl text-left border transition-all ${selectedRole === 'repair_cctv_tech'
                      ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                  >
                    <div className="font-bold">Repair & CCTV Tech</div>
                    <div className="text-[9px] opacity-80">NVR, Printers & Lab</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('local_guide')}
                    className={`p-2 rounded-xl text-left border transition-all ${selectedRole === 'local_guide'
                      ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                  >
                    <div className="font-bold">Kailali Guide</div>
                    <div className="text-[9px] opacity-80">New Road & Delivery</div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <label className="text-[11px] font-bold text-blue-200 flex items-center gap-1.5 cursor-pointer">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Google Maps Grounding</span>
                </label>
                <button
                  type="button"
                  onClick={() => setEnableMapsGrounding(!enableMapsGrounding)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${enableMapsGrounding
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                >
                  {enableMapsGrounding ? 'Enabled (3.5-flash)' : 'Disabled'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chat History Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-700 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-md">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] space-y-2`}>
                <div
                  className={`rounded-2xl p-4 text-xs shadow-sm leading-relaxed relative group ${msg.sender === 'user'
                    ? 'bg-[#0056b3] text-white font-medium rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-none whitespace-pre-wrap'
                    }`}
                >
                  <div>{msg.text}</div>

                  {/* Render Google Maps Grounding Links if available */}
                  {msg.mapLinks && msg.mapLinks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span>Google Maps Grounded Locations:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.mapLinks.map((loc, idx) => (
                          <a
                            key={idx}
                            href={loc.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] bg-blue-50 hover:bg-blue-100 text-[#0056b3] font-bold px-2.5 py-1 rounded-lg border border-blue-200 transition-colors"
                          >
                            <span>{loc.title}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5 text-[9px]">
                    <span className={msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}>
                      {msg.timestamp}
                    </span>

                    {msg.sender === 'assistant' && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-0.5"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-md">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-700 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3.5 shadow-sm flex items-center gap-2.5 text-xs text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Intel AI ({selectedModel}) is analyzing Kailali inventory & technical schemas...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Suggested Quick Prompts */}
        <div className="p-3 bg-white border-t border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Suggested Technical Questions:</span>
            </div>
            <button
              onClick={() => {
                setIsAiAssistantOpen(false);
                navigateTo('ai-studio');
              }}
              className="text-[10px] text-[#0056b3] font-bold hover:underline flex items-center gap-1"
            >
              <span>Full AI Studio & Image Lab</span>
              <Sparkles className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                className="text-[10px] bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors text-left"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${selectedRole.replace(/_/g, ' ')} about laptops, custom rigs, CCTV...`}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-[#0056b3] hover:bg-blue-700 disabled:bg-slate-300 text-white p-2.5 rounded-xl transition-colors shadow flex items-center justify-center"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

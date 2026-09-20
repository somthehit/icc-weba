'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  Sparkles,
  Bot,
  Send,
  User,
  Loader2,
  Cpu,
  MapPin,
  Image as ImageIcon,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  ExternalLink,
  Zap,
  Layers,
  Wrench,
  Compass,
  Upload,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Maximize2,
  RefreshCw,
  Search,
  Navigation
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  modelUsed?: string;
  mapLinks?: Array<{ title: string; uri: string }>;
}

export const AiStudioView: React.FC = () => {
  const {
    products,
    savedImages,
    saveGeneratedImage,
    deleteGeneratedImage,
    navigateTo,
    currentUser,
    isUserLoggedIn,
    setIsAuthModalOpen
  } = useStore();

  const [activeTab, setActiveTab] = useState<'chat' | 'image_studio' | 'maps_grounding'>('chat');

  // --- CHAT STATE ---
  const [chatModel, setChatModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite'>('gemini-3.5-flash');
  const [chatRole, setChatRole] = useState<'store_specialist' | 'pc_architect' | 'repair_cctv_tech' | 'local_guide'>('store_specialist');
  const [chatMapsGrounding, setChatMapsGrounding] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatCopiedId, setChatCopiedId] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-studio',
      sender: 'assistant',
      text: `Namaste! Welcome to the **Intel Computer AI Studio**.

I am powered by Google Gemini with multi-model intelligence:
• **gemini-3.5-flash**: Balanced, fast general queries & Google Maps Grounding.
• **gemini-3.1-pro-preview**: Deep multi-step PC architecture, electrical calculations & hardware diagnostics.
• **gemini-3.1-flash-lite**: Ultra-low latency responses for specs and inventory.

Select your preferred specialist persona or model above, or explore the **AI Image Creator & Editor** and **Maps Grounding Navigator** tabs!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.5-flash',
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  const handleSendChat = async (textToSend?: string) => {
    const promptText = textToSend || chatInput;
    if (!promptText.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setIsChatLoading(true);

    try {
      const history = chatMessages.map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          chatHistory: history,
          model: chatModel,
          role: chatRole,
          enableMapsGrounding: chatMapsGrounding,
          userLocation: { lat: 27.700769, lng: 85.312950 },
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.model || chatModel,
        mapLinks: data.mapLinks,
      };

      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `An error occurred while connecting to the Gemini server: ${err.message || 'Unknown issue'}. You can contact Intel Computer Dhangadhi directly at 091-525287 or WhatsApp 9848424859.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- IMAGE STUDIO STATE ---
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStylePreset, setImageStylePreset] = useState<'hardware_studio' | 'cyberpunk_rgb' | 'minimalist_desk' | 'blueprint_schematic'>('hardware_studio');
  const [imageAspectRatio, setImageAspectRatio] = useState<'1:1' | '16:9' | '4:3' | '9:16'>('1:1');
  const [selectedCatalogImage, setSelectedCatalogImage] = useState<string | null>(null);
  const [uploadedBaseImage, setUploadedBaseImage] = useState<string | null>(null);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [generatedImageResult, setGeneratedImageResult] = useState<{
    url: string;
    prompt: string;
    description?: string;
  } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSuccessNotice, setImageSuccessNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedBaseImage(reader.result as string);
      setSelectedCatalogImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || isImageGenerating) return;

    setIsImageGenerating(true);
    setImageError(null);
    setImageSuccessNotice(null);

    const activeBase = uploadedBaseImage || selectedCatalogImage;

    try {
      const res = await fetch('/api/gemini/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          baseImage: activeBase || undefined,
          aspectRatio: imageAspectRatio,
          stylePreset: imageStylePreset,
          imageSize: '1K',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate image');
      }

      setGeneratedImageResult({
        url: data.imageUrl,
        prompt: data.prompt || imagePrompt,
        description: data.description,
      });

      // Save to global and Firestore gallery
      await saveGeneratedImage({
        url: data.imageUrl,
        prompt: imagePrompt,
        originalPrompt: data.originalPrompt || imagePrompt,
        aspectRatio: imageAspectRatio,
      });

      setImageSuccessNotice('Image successfully created with Intel CC AI and saved to your gallery!');
    } catch (err: any) {
      console.error(err);
      setImageError(err.message || 'Image generation failed. Please check your prompt and try again.');
    } finally {
      setIsImageGenerating(false);
    }
  };

  // --- MAPS GROUNDING STATE ---
  const [mapsQuery, setMapsQuery] = useState('Authorized computer stores and IT repair markets in New Road Kailali');
  const [mapsResults, setMapsResults] = useState<{
    text: string;
    places: Array<{ title: string; uri: string; sourceSnippet?: string }>;
  } | null>(null);
  const [isMapsLoading, setIsMapsLoading] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const handleQueryMaps = async (queryText?: string) => {
    const q = queryText || mapsQuery;
    if (!q.trim() || isMapsLoading) return;

    setIsMapsLoading(true);
    setMapsError(null);

    try {
      const res = await fetch('/api/gemini/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          latitude: 27.700769,
          longitude: 85.312950,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Maps grounding query failed');
      }

      setMapsResults({
        text: data.text,
        places: data.places || [],
      });
    } catch (err: any) {
      console.error(err);
      setMapsError(err.message || 'Failed to query Google Maps grounding.');
    } finally {
      setIsMapsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Studio Top Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-[#002d62] to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-blue-900/40 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-200 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>Next-Gen Intell CC AI Studio & Hardware Intelligence</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Intel Computer AI Studio & Hardware Intelligence
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed">
                Harness multi-model Intel CC AI Studio & Hardware Intelligence, Google Maps Grounding for Kailali tech centers, and 3.1-flash-image for custom hardware image creation and editing.
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap sm:flex-nowrap bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-blue-800/40 text-xs font-bold self-start md:self-auto">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'chat'
                  ? 'bg-[#0056b3] text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
              >
                <Bot className="w-4 h-4" />
                <span>Multi-Model Chatbot</span>
              </button>

              <button
                onClick={() => setActiveTab('image_studio')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'image_studio'
                  ? 'bg-[#0056b3] text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>AI Image Creator & Editor</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('maps_grounding');
                  if (!mapsResults) handleQueryMaps();
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'maps_grounding'
                  ? 'bg-[#0056b3] text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Maps Grounding Explorer</span>
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: MULTI-MODEL CHATBOT */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* Sidebar Controls: Model & Role Configuration */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-5">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 mb-1 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Model Intelligence</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">Select appropriate model intelligence:</p>

                  <div className="space-y-2">
                    {[
                      {
                        id: 'gemini-3.5-flash',
                        name: 'gemini-3.5-flash',
                        badge: 'General & Maps',
                        desc: 'Best for product comparisons, deals & live store maps',
                      },
                      {
                        id: 'gemini-3.1-pro-preview',
                        name: 'gemini-3.1-pro-preview',
                        badge: 'Complex Work',
                        desc: 'Advanced custom PC builds, thermal TDP & diagnostics',
                      },
                      {
                        id: 'gemini-3.1-flash-lite',
                        name: 'gemini-3.1-flash-lite',
                        badge: 'Ultra Fast',
                        desc: 'Sub-second pricing, stock & basic spec queries',
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setChatModel(m.id as any)}
                        className={`w-full text-left p-3 rounded-2xl border transition-all text-xs ${chatModel === m.id
                          ? 'bg-blue-50 border-[#0056b3] text-[#0056b3] font-bold ring-1 ring-[#0056b3]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold">{m.name}</span>
                          <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-800">
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-[10px] font-normal text-slate-500 leading-tight">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="font-extrabold text-sm text-slate-900 mb-1 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    <span>Specialist Role</span>
                  </h3>
                  <div className="space-y-2 mt-3">
                    {[
                      {
                        id: 'store_specialist',
                        title: 'Store Hardware Specialist',
                        desc: 'Laptops, printers, monitors & pricing in NPR',
                      },
                      {
                        id: 'pc_architect',
                        title: 'Custom PC Architect',
                        desc: 'Gaming rigs, overclocking & bottleneck analysis',
                      },
                      {
                        id: 'repair_cctv_tech',
                        title: 'Repairs & CCTV Tech',
                        desc: 'Hikvision setups, chip repairs & ink nozzles',
                      },
                      {
                        id: 'local_guide',
                        title: 'Kailali Navigator',
                        desc: 'New Road showroom directions & Nepal courier',
                      },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setChatRole(r.id as any)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs ${chatRole === r.id
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        <div className="font-bold">{r.title}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>Google Maps Grounding</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setChatMapsGrounding(!chatMapsGrounding)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${chatMapsGrounding ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                    >
                      {chatMapsGrounding ? 'ON (3.5-flash)' : 'OFF'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Retrieves verified place links from Google Maps for locations in Kailali and Nepal.
                  </p>
                </div>
              </div>
            </div>

            {/* Chat History & Input Panel */}
            <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[700px] overflow-hidden">

              {/* Chat Header Bar */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm flex items-center gap-2">
                      <span>Intel AI Consultant</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Active Role: <strong className="text-blue-300">{chatRole.replace(/_/g, ' ')}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setChatMessages([
                      {
                        id: `reset-${Date.now()}`,
                        sender: 'assistant',
                        text: `Chat thread reset. Model is **${chatModel}** with role **${chatRole.replace(/_/g, ' ')}**. Ask your technical question.`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        modelUsed: chatModel,
                      },
                    ]);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
                  title="Clear Chat"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear Chat</span>
                </button>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender === 'assistant' && (
                      <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-700 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className="max-w-[85%] space-y-2">
                      <div
                        className={`rounded-2xl p-4 text-xs shadow-sm leading-relaxed ${msg.sender === 'user'
                          ? 'bg-[#0056b3] text-white font-medium rounded-tr-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none whitespace-pre-wrap'
                          }`}
                      >
                        <div>{msg.text}</div>

                        {/* Maps links */}
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

                        <div className="flex items-center justify-between mt-2.5 pt-1 border-t border-black/5 text-[9px]">
                          <span className={msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}>
                            {msg.timestamp}
                          </span>

                          {msg.sender === 'assistant' && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(msg.text);
                                setChatCopiedId(msg.id);
                                setTimeout(() => setChatCopiedId(null), 2000);
                              }}
                              className="text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1"
                            >
                              {chatCopiedId === msg.id ? (
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
                      <div className="w-8 h-8 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-700 text-white flex items-center justify-center flex-shrink-0 shadow">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3.5 shadow-sm flex items-center gap-2.5 text-xs text-slate-600">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Intel AI is evaluating specs with {chatModel}...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-white border-t border-slate-200 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Laptops with RTX 4060 under 150k NPR',
                    'Building an architectural CAD workstation budget',
                    'Directions to Intel Computer New Road Kailali',
                    'CCTV 4-camera IP kit price & installation',
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendChat(s)}
                      className="text-[10px] bg-slate-100 hover:bg-blue-50 hover:text-[#0056b3] text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="flex items-center gap-2 pt-1"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Ask ${chatRole.replace(/_/g, ' ')}...`}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0056b3] focus:bg-white transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="bg-[#0056b3] hover:bg-blue-700 disabled:bg-slate-300 text-white px-5 py-3 rounded-2xl font-bold text-xs transition-colors shadow flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI IMAGE CREATOR & EDITOR */}
        {activeTab === 'image_studio' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* Creator Controls */}
              <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-[#0056b3]" />
                      <span>Create or Edit Hardware Images</span>
                    </h2>
                    <span className="text-[10px] bg-blue-50 text-[#0056b3] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                      gemini-3.1-flash-image
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Generate concept PC builds, studio product renders, or upload/select a catalog image to perform AI-powered edits.
                  </p>
                </div>

                {imageError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{imageError}</span>
                  </div>
                )}

                {imageSuccessNotice && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    <span>{imageSuccessNotice}</span>
                  </div>
                )}

                {/* Prompt Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Text Prompt / Edit Instructions:
                  </label>
                  <textarea
                    rows={3}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="e.g. Custom liquid cooled gaming PC with glowing cyan RGB, dual RTX 4090 GPUs, tempered glass chassis in a high-tech studio setup"
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs text-slate-900 focus:ring-2 focus:ring-[#0056b3] focus:bg-white outline-none"
                  />
                </div>

                {/* Quick Prompt Ideas */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Instant Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Ultra-clean ASUS ROG gaming laptop on Kailali oak wood desk',
                      'Futuristic RGB liquid cooling loop with neon tubes and dark chassis',
                      'High-resolution blueprint schematic of a computer motherboard',
                      'Commercial studio product photo of 4K IP security dome camera',
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImagePrompt(p)}
                        className="text-[10px] bg-slate-100 hover:bg-blue-50 hover:text-[#0056b3] text-slate-700 px-2.5 py-1 rounded-xl border border-slate-200 transition-colors text-left"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style Presets */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Visual Style Preset:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'hardware_studio', label: 'Studio Hardware Commercial', sub: 'Clean lighting, 8k crisp' },
                      { id: 'cyberpunk_rgb', label: 'Cyberpunk Neon RGB', sub: 'Vibrant neon glows, dark rig' },
                      { id: 'minimalist_desk', label: 'Minimalist Tech Setup', sub: 'Natural light, Scandinavian' },
                      { id: 'blueprint_schematic', label: 'Engineering Blueprint', sub: 'Vector schematic diagram' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setImageStylePreset(st.id as any)}
                        className={`p-2.5 rounded-2xl border text-left transition-all ${imageStylePreset === st.id
                          ? 'bg-blue-50 border-[#0056b3] text-[#0056b3] font-bold ring-1 ring-[#0056b3]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        <div className="text-xs font-bold">{st.label}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{st.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Aspect Ratio:
                  </label>
                  <div className="flex gap-2">
                    {['1:1', '16:9', '4:3', '9:16'].map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setImageAspectRatio(ratio as any)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${imageAspectRatio === ratio
                          ? 'bg-[#0056b3] text-white border-[#0056b3]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Image-to-Image / Editing Source */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-indigo-600" />
                      <span>Image-to-Image Editing (Optional):</span>
                    </label>
                    {(uploadedBaseImage || selectedCatalogImage) && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedBaseImage(null);
                          setSelectedCatalogImage(null);
                        }}
                        className="text-[10px] text-red-600 font-bold hover:underline"
                      >
                        Clear Source Image
                      </button>
                    )}
                  </div>

                  {/* Active Source Image Preview */}
                  {(uploadedBaseImage || selectedCatalogImage) ? (
                    <div className="relative p-2 bg-slate-100 rounded-2xl border border-slate-300 flex items-center gap-3">
                      <img
                        src={uploadedBaseImage || selectedCatalogImage!}
                        alt="Source to edit"
                        className="w-16 h-16 object-cover rounded-xl border border-white shadow-sm"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">Source Image Loaded</span>
                        <span className="text-slate-500 text-[11px]">
                          Your text prompt will guide Gemini to edit this image.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs border border-slate-300 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload File</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>

                      {/* Select from catalog products */}
                      <div className="text-[11px] text-slate-500 font-medium">
                        Or pick a product from Kailali store:
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {products.slice(0, 5).map((prod) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => {
                              setSelectedCatalogImage(prod.images[0]);
                              setUploadedBaseImage(null);
                            }}
                            className="flex-shrink-0 w-14 h-14 rounded-xl border border-slate-200 overflow-hidden hover:border-[#0056b3] transition-all relative group"
                            title={prod.name}
                          >
                            <img
                              src={prod.images[0]}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={!imagePrompt.trim() || isImageGenerating}
                  className="w-full bg-gradient-to-r from-[#0056b3] via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {isImageGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Intel AI Image is Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-amber-300" />
                      <span>
                        {uploadedBaseImage || selectedCatalogImage ? 'Apply AI Edits to Image' : 'Generate New Image'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Preview & Active Result */}
              <div className="lg:col-span-6 flex flex-col space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#0056b3]" />
                      <span>High-Resolution Output Preview</span>
                    </h3>

                    {generatedImageResult && (
                      <div className="flex items-center gap-2">
                        <a
                          href={generatedImageResult.url}
                          download={`intel-ai-${Date.now()}.png`}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 text-xs font-bold"
                          title="Download Image"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Save PNG</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Main Display Box */}
                  <div className="flex-1 bg-slate-950 rounded-2xl flex items-center justify-center p-4 min-h-[380px] overflow-hidden relative border border-slate-800">
                    {isImageGenerating ? (
                      <div className="text-center space-y-3 text-white p-6">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto animate-pulse">
                          <Sparkles className="w-7 h-7 text-amber-400 animate-spin" />
                        </div>
                        <h4 className="font-bold text-sm">Rendering with Intel CC AI Image</h4>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">
                          Processing hardware lighting, textures, and geometry prompts...
                        </p>
                      </div>
                    ) : generatedImageResult ? (
                      <div className="relative w-full h-full flex flex-col items-center justify-center">
                        <img
                          src={generatedImageResult.url}
                          alt="AI Generated"
                          className="max-h-[440px] w-auto object-contain rounded-xl shadow-2xl"
                        />
                      </div>
                    ) : (
                      <div className="text-center space-y-2 text-slate-500 p-6">
                        <ImageIcon className="w-12 h-12 mx-auto stroke-1 opacity-50" />
                        <p className="text-xs">Your generated or edited image will render here in crisp quality.</p>
                      </div>
                    )}
                  </div>

                  {generatedImageResult && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700">
                      <span className="font-bold block text-slate-900 mb-1">Prompt Used:</span>
                      <p className="text-[11px] text-slate-600 italic leading-relaxed">
                        &quot;{generatedImageResult.prompt}&quot;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* User Gallery Section */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0056b3]" />
                    <span>Saved AI Image Gallery (Firestore Synced)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Images created in your session are automatically saved to your cloud database.
                  </p>
                </div>
                <span className="text-xs font-bold bg-blue-50 text-[#0056b3] px-3 py-1 rounded-full border border-blue-200">
                  {savedImages.length} Saved
                </span>
              </div>

              {savedImages.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs">
                  No images generated yet. Create your first hardware concept above!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {savedImages.map((img) => (
                    <div
                      key={img.id}
                      className="group bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col relative"
                    >
                      <div className="aspect-square relative overflow-hidden bg-slate-950">
                        <img
                          src={img.url}
                          alt={img.prompt}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                          <a
                            href={img.url}
                            download={`intel-${img.id}.png`}
                            className="p-1.5 rounded-lg bg-white/90 text-slate-900 hover:bg-white transition-colors"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => deleteGeneratedImage(img.id)}
                            className="p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-2.5 bg-white flex-1 flex flex-col justify-between">
                        <p className="text-[11px] text-slate-800 line-clamp-2 font-medium">
                          {img.prompt}
                        </p>
                        <span className="text-[9px] text-slate-400 mt-1 block">
                          {new Date(img.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: GOOGLE MAPS GROUNDING EXPLORER */}
        {activeTab === 'maps_grounding' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-rose-500" />
                    <span>Google Maps Grounding Navigator</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Powered by <strong>Intel CC AI</strong> with the official Google Maps Tool grounding for Kailali Valley, New Road, and authorized IT centers across Nepal.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-2xl text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Google Maps Grounding Active</span>
                </div>
              </div>

              {mapsError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{mapsError}</span>
                </div>
              )}

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={mapsQuery}
                    onChange={(e) => setMapsQuery(e.target.value)}
                    placeholder="Search locations, electronics hubs, repair centers in Nepal..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl py-3.5 px-4 pl-10 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0056b3] focus:bg-white"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                </div>
                <button
                  type="button"
                  onClick={() => handleQueryMaps()}
                  disabled={!mapsQuery.trim() || isMapsLoading}
                  className="bg-[#0056b3] hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-3.5 rounded-2xl text-xs shadow transition-colors flex items-center justify-center gap-2"
                >
                  {isMapsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                  <span>Query Grounded Locations</span>
                </button>
              </div>

              {/* Instant Preset Queries */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  'Intel Computer Center New Road showroom Kailali',
                  'Computer repair shops near Putalisadak Kailali',
                  'IT electronic hubs around Bishal Bazar New Road',
                  'Authorized laptop service centers in Dhangadhi and Biratnagar',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMapsQuery(preset);
                      handleQueryMaps(preset);
                    }}
                    className="text-[11px] bg-slate-100 hover:bg-blue-50 hover:text-[#0056b3] text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Results View */}
              {isMapsLoading ? (
                <div className="p-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <Loader2 className="w-8 h-8 animate-spin text-[#0056b3] mx-auto" />
                  <h4 className="font-bold text-sm text-slate-800">Grounding via Google Maps Data...</h4>
                  <p className="text-xs text-slate-500">
                    Intel CC is extracting verified place records, URIs, and localized context for Kailali.
                  </p>
                </div>
              ) : mapsResults ? (
                <div className="space-y-6 pt-4 border-t border-slate-200">
                  {/* Verified Maps Links Chips */}
                  {mapsResults.places.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-rose-500" />
                        <span>Verified Google Maps Locations ({mapsResults.places.length}):</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {mapsResults.places.map((place, idx) => (
                          <a
                            key={idx}
                            href={place.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-50 hover:bg-blue-100/80 p-4 rounded-2xl border border-blue-200 transition-all flex flex-col justify-between group"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-black text-xs text-[#0056b3] group-hover:underline">
                                  {place.title}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#0056b3]" />
                              </div>
                              {place.sourceSnippet && (
                                <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                                  &quot;{place.sourceSnippet}&quot;
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-blue-700 font-bold mt-2 inline-flex items-center gap-1">
                              <span>Open in Google Maps</span>
                              <span>→</span>
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gemini Detailed Text Analysis */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs text-slate-800 space-y-2 leading-relaxed">
                    <span className="font-bold text-slate-900 block text-xs">
                      Geospatial Analysis & Store Directions:
                    </span>
                    <div className="whitespace-pre-wrap">{mapsResults.text}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

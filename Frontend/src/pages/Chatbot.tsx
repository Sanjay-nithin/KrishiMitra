import { useState, useRef } from "react";
// Hardcoded sample for TTS (Malayalam + English mix)
const MALAYALAM_SAMPLE = `
In Kerala alle, red soil aanu very common. Ithu oru special type of soil aanu, so correct crop choose cheyyanam. Okay, nokkaam best crops for red soil.

 Grains section:
Rice – ithu nalla grow aavum red soil-il, especially low-lying areas-il.
Maize – proper irrigation um seed management um koduthaal, ithu kittum nalla yield.
Sorghum – athu oru drought-tolerant crop aanu, even rain kuravayalum red soil-il nannayi grow cheyyum.

 Pulses:
Red gram (toor dal) – nalla suitable aanu, Kerala-yil popular aayittulla pulse aanu.
Black gram (urad dal) – ithum grow aavum, but care kodukkanam.
Green gram (moong dal) – ithu nalla grow aavum, especially high altitude areas-il.

Vegetables:
Chillies – Kerala-yil popular aanu, red soil-il super aayi grow cheyyum.
Tomato – proper attention koduthaal nalla yield kittum.
Cucumber – ithu red soil-il good aanu, especially low areas-il.
Okra (ladies' finger) – upland red soil-il nannayi grow cheyyum.

 Fruits:
Mango – red soil-il perfect aanu, Kerala-yil very popular fruit.
Banana – ithum red soil-il nalla aayi cultivate cheyyam, if properly managed.

So overall paranjaal, red soil Kerala-yil nalla fertile aanu, but water um nutrients um correct aayi manage cheythaal best results kittum.`;
  // Speech synthesis for Malayalam and English
  const speakMalayalam = () => {
    const utter = new window.SpeechSynthesisUtterance(MALAYALAM_SAMPLE);
    utter.lang = 'ml-IN';
    window.speechSynthesis.speak(utter);
  };

  const speakEnglish = (text: string) => {
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    window.speechSynthesis.speak(utter);
  };
import { Send, Camera, Mic, Image } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type: 'text' | 'image' | 'voice';
  // For translation dropdown
  content_ml?: string;
  content_en?: string;
  showTranslation?: boolean;
}

const Chatbot = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'ഹലോ! ഞാൻ കൃഷി മിത്ര, നിങ്ങളുടെ AI ഫാമിംഗ് അസിസ്റ്റന്റ്. ഇന്ന് എനിക്ക് നിങ്ങളെ എങ്ങനെ സഹായിക്കാനാകും? വിളകൾ, കാലാവസ്ഥ, കീട നിയന്ത്രണം അല്ലെങ്കിൽ കൃഷിയുമായി ബന്ധപ്പെട്ട എന്തെങ്കിലും ചോദ്യങ്ങൾ എന്നിവയെക്കുറിച്ച് നിങ്ങൾക്ക് എന്നോട് ചോദിക്കാം.',
      content_ml: 'ഹലോ! ഞാൻ കൃഷി മിത്ര, നിങ്ങളുടെ AI ഫാമിംഗ് അസിസ്റ്റന്റ്. ഇന്ന് എനിക്ക് നിങ്ങളെ എങ്ങനെ സഹായിക്കാനാകും? വിളകൾ, കാലാവസ്ഥ, കീട നിയന്ത്രണം അല്ലെങ്കിൽ കൃഷിയുമായി ബന്ധപ്പെട്ട എന്തെങ്കിലും ചോദ്യങ്ങൾ എന്നിവയെക്കുറിച്ച് നിങ്ങൾക്ക് എന്നോട് ചോദിക്കാം.',
      content_en: "Hello! I'm Krishi Mitra, your AI farming assistant. How can I help you today? You can ask me about crops, weather, pest control, or any farming-related questions.",
      sender: 'bot',
      timestamp: new Date(),
      type: 'text'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // Prefer '/api' proxy in dev; allow override via VITE_API_BASE_URL for direct calls
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [voicePrompt, setVoicePrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Light formatter: ensures headings and list markers render well if Groq returns plain text
  const normalizeToMarkdown = (text: string): string => {
    let t = text.trim();
    // Replace bold-like markers if model uses **text** already (keep as is)
    // Ensure there are blank lines before headings-like segments
    t = t.replace(/\n?\s*([A-Za-z].*?:)\s*\n/g, '\n\n**$1**\n');
    // Ensure list items start on new lines
    t = t.replace(/\s*(\d+)\)\s+/g, '\n$1. '); // handle 1) -> 1.
    t = t.replace(/\s*(\d+)\.\s+/g, '\n$1. ');
    t = t.replace(/\s*[-•]\s+/g, '\n- ');
    // Collapse excessive blank lines
    t = t.replace(/\n{3,}/g, '\n\n');
    return t;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Show actual user input as main; no translation dropdown for user text
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);
    try {
      const data = await generateBotResponse(inputMessage);
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: data.reply_ml ?? data.reply ?? '',
        content_ml: data.reply_ml,
        content_en: data.reply_en,
        sender: 'bot',
        timestamp: new Date(),
        type: 'text',
      };
      setMessages(prev => [...prev, botResponse]);
    } catch (err) {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I could not reach the assistant right now. Please try again in a moment.',
        sender: 'bot',
        timestamp: new Date(),
        type: 'text',
      };
      setMessages(prev => [...prev, botResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateBotResponse = async (userInput: string): Promise<{ reply_ml?: string; reply_en?: string; reply?: string; }> => {
    // Call backend FastAPI endpoint which proxies to Groq
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userInput }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Backend error ${res.status}: ${text}`);
    }

  const data = await res.json();
  return data;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };


  // Voice recording logic
  const handleVoiceStart = async () => {
    setVoicePrompt('');
    setIsRecording(true);
    setAudioChunks([]);
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Voice recording not supported in this browser.');
      setIsRecording(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new window.MediaRecorder(stream);
    setMediaRecorder(recorder);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      setAudioChunks([...chunks]);
    };
    recorder.start();
  };

  const handleVoiceStop = async () => {
    if (!mediaRecorder) return;
    mediaRecorder.stop();
    setIsRecording(false);
    // Always use fixed Malayalam and English prompt for demo
    const mlPrompt = "ചുവന്ന മണ്ണിന് ഏറ്റവും നല്ല വിളകൾ നിർദ്ദേശിക്കുക";
    const enPrompt = "suggest best crops for red soil";
    setVoicePrompt(mlPrompt);
    // Show Malayalam as main, English in dropdown
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: mlPrompt,
      content_ml: mlPrompt,
      content_en: enPrompt,
      sender: 'user',
      timestamp: new Date(),
      type: 'voice',
      showTranslation: false,
    }]);
    setIsTyping(true);
    try {
      const formData = new FormData();
      if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        formData.append('audio', audioBlob, 'voice.webm');
      }
      formData.append('prompt', mlPrompt);
      const res = await fetch(`${API_BASE}/voice-demo`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error(`Backend error ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: data.reply_ml,
        content_ml: data.reply_ml,
        content_en: data.reply_en,
        sender: 'bot',
        timestamp: new Date(),
        type: 'text',
        showTranslation: false,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'ക്ഷമിക്കണം, ഇപ്പോൾ വോയ്സ് അസിസ്റ്റന്റ് പ്രവർത്തിക്കുന്നില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
        sender: 'bot',
        timestamp: new Date(),
        type: 'text',
      }]);
    } finally {
      setIsTyping(false);
      setAudioChunks([]);
      setMediaRecorder(null);
    }
  };

  return (
    <div className="mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-4 sm:mb-6">
        <div className="bg-hero-gradient rounded-2xl p-4 sm:p-6 text-primary-foreground shadow-card">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Ask Krishi Mitra</h1>
          <p className="text-xs sm:text-sm text-primary-foreground/80">
            Your AI farming assistant for Kerala agriculture
          </p>
        </div>
      </div>

      {/* Chat Container */}
  <Card className="bg-card-gradient shadow-card flex flex-col h-[75dvh] md:h-[600px]">
        {/* Messages Area */}
  <CardContent className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {messages.map((message, idx) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className={
                  message.sender === 'bot' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-secondary-foreground'
                }>
                  {message.sender === 'bot' ? '🌱' : 'You'}
                </AvatarFallback>
              </Avatar>
              <div className={`max-w-[80%] sm:max-w-[70%] ${message.sender === 'user' ? 'text-right' : 'text-left'} break-words`}>
                <div
                  className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-accent text-foreground'
                  }`}
                >
                  {/* Malayalam main, English in dropdown if present */}
                  {message.sender === 'bot' ? (
                    message.content_en ? (
                      <>
                        <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none break-words leading-snug sm:leading-relaxed flex items-start gap-2">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {normalizeToMarkdown(message.content_ml || message.content)}
                          </ReactMarkdown>
                          <Button size="sm" variant="secondary" className="ml-2 mt-1" onClick={speakMalayalam}>
                            Read
                          </Button>
                        </div>
                        <Accordion type="single" collapsible className="w-full mt-1">
                          <AccordionItem value={`trans-${message.id}`}>
                            <AccordionTrigger className="text-xs sm:text-sm text-left px-0 py-1">
                              English Translation
                            </AccordionTrigger>
                            <AccordionContent className="text-xs sm:text-sm text-muted-foreground px-0 pt-0 flex items-start gap-2">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {normalizeToMarkdown(message.content_en)}
                              </ReactMarkdown>
                              <Button size="sm" variant="secondary" className="ml-2 mt-1" onClick={() => speakEnglish(message.content_en || '')}>
                                Read
                              </Button>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </>
                    ) : (
                      <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none break-words leading-snug sm:leading-relaxed flex items-start gap-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {normalizeToMarkdown(message.content_ml || message.content)}
                        </ReactMarkdown>
                        <Button size="sm" variant="secondary" className="ml-2 mt-1" onClick={speakMalayalam}>
                          Read
                        </Button>
                      </div>
                    )
                  ) : message.content_en ? (
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value={`trans-${message.id}`}>
                        <AccordionTrigger className="text-xs sm:text-sm text-left px-0 py-1">
                          {message.content_ml || message.content}
                        </AccordionTrigger>
                        <AccordionContent className="text-xs sm:text-sm text-muted-foreground px-0 pt-0">
                          <span>{message.content_en}</span>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ) : (
                    <p className="text-xs sm:text-sm leading-snug sm:leading-relaxed break-words">{message.content}</p>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  🌱
                </AvatarFallback>
              </Avatar>
              <div className="bg-accent text-accent-foreground rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        {/* Input Area */}
        <div className="border-t border-border p-3 sm:p-4">
          {/* Mobile: show Voice button only */}
          <div className="flex sm:hidden gap-2 mb-3">
            {!isRecording ? (
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleVoiceStart}>
                <Mic className="h-4 w-4" />
                Voice
              </Button>
            ) : (
              <Button variant="destructive" size="sm" className="gap-2" onClick={handleVoiceStop}>
                Stop
              </Button>
            )}
          </div>
          {/* Desktop: show all action buttons */}
          <div className="hidden sm:flex gap-2 mb-3">
            <Button variant="ghost" size="sm" className="gap-2">
              <Camera className="h-4 w-4" />
              Photo
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <Image className="h-4 w-4" />
              Gallery
            </Button>
            {!isRecording ? (
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleVoiceStart}>
                <Mic className="h-4 w-4" />
                Voice
              </Button>
            ) : (
              <Button variant="destructive" size="sm" className="gap-2" onClick={handleVoiceStop}>
                Stop
              </Button>
            )}
          </div>
          
          <div className="flex gap-2 min-w-0">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about farming..."
              className="flex-1 min-w-0"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="bg-primary hover:bg-primary-dark shadow-soft"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Chatbot;
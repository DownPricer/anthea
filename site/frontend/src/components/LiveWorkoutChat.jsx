import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Send } from 'lucide-react';
import { liveWorkoutApi } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

const QUICK_MESSAGES = [
  { text: 'Courage', emoji: '💪' },
  { text: "J'arrive", emoji: '🏃' },
  { text: 'Trop dur', emoji: '😅' },
  { text: 'On finit', emoji: '✅' },
  { text: 'Bien joué', emoji: '👏' },
  { text: '🔥', emoji: '🔥' },
  { text: '❤️', emoji: '❤️' },
];

export function LiveWorkoutChat({ partnerName, open: controlledOpen, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const loadMessages = async () => {
    try {
      const { data } = await liveWorkoutApi.getMessages();
      setMessages(data || []);
    } catch {
      /* silencieux */
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    loadMessages();
    const id = setInterval(loadMessages, 6000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async (message) => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await liveWorkoutApi.sendMessage({ message: trimmed });
      setText('');
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-amber-300 text-xs font-medium">
          Chat live {partnerName ? `avec ${partnerName}` : ''}
        </span>
        {open ? (
          <ChevronUp size={16} className="text-amber-400/70" />
        ) : (
          <ChevronDown size={16} className="text-amber-400/70" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-amber-500/15">
          <div
            ref={scrollRef}
            className="max-h-28 overflow-y-auto space-y-1.5 py-2"
          >
            {messages.length === 0 ? (
              <p className="text-zinc-500 text-[11px] text-center py-2">
                Envoie un message rapide à ton partenaire
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`text-[11px] px-2 py-1 rounded-lg max-w-[85%] ${
                    m.is_mine
                      ? 'ml-auto bg-amber-500/20 text-amber-100'
                      : 'bg-white/5 text-zinc-300'
                  }`}
                >
                  <span className="text-zinc-500 text-[9px] block mb-0.5">
                    {m.is_mine ? 'Moi' : m.from_username}
                  </span>
                  {m.message}
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {QUICK_MESSAGES.map((q) => (
              <button
                key={q.text}
                type="button"
                onClick={() => sendMessage(`${q.emoji} ${q.text}`.trim())}
                disabled={sending}
                className="px-2 py-1 rounded-full text-[10px] bg-white/5 text-zinc-300 hover:bg-white/10"
              >
                {q.emoji} {q.text}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(text);
            }}
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message..."
              maxLength={120}
              className="h-8 text-xs bg-[#0A0A0A] border-white/10 text-white"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !text.trim()}
              className="h-8 w-8 shrink-0 bg-amber-500/80 hover:bg-amber-500 text-white"
            >
              <Send size={14} />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

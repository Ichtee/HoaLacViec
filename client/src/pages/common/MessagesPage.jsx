import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, Send, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { getChats, openChat, getChatMessages, sendChatMessage } from '@/services';
import { Toast } from '@/components/Feedback.jsx';

const LIST_POLL_MS = 15000;
const THREAD_POLL_MS = 5000;

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

/** Trang tin nhắn dùng chung cho sinh viên và nhà tuyển dụng (hỏi lại máy chủ định kỳ). */
export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const bottomRef = useRef(null);
  const lastSeenRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const rows = await getChats();
      setConversations(Array.isArray(rows) ? rows : []);
    } catch {
      // giữ danh sách cũ khi mất mạng tạm thời
    }
  }, []);

  // Mở cuộc trò chuyện từ liên kết ?open=application:<id> hoặc task:<id>
  useEffect(() => {
    const target = searchParams.get('open');
    if (!target) return;
    const [kind, refId] = target.split(':');
    openChat(kind, refId)
      .then((conversation) => setActiveId(conversation.id))
      .catch((err) => setToast({ type: 'error', message: err.message || 'Không thể mở cuộc trò chuyện.' }))
      .finally(() => {
        setSearchParams({}, { replace: true });
        loadList();
      });
  }, [searchParams, setSearchParams, loadList]);

  useEffect(() => {
    loadList();
    const timer = setInterval(loadList, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [loadList]);

  // Tải toàn bộ tin khi đổi cuộc trò chuyện, sau đó chỉ lấy tin mới
  useEffect(() => {
    if (!activeId) return undefined;
    let cancelled = false;
    lastSeenRef.current = null;
    setMessages([]);

    const fetchMessages = async () => {
      try {
        const data = await getChatMessages(activeId, lastSeenRef.current);
        if (cancelled || !data?.messages?.length) return;
        lastSeenRef.current = data.messages[data.messages.length - 1].createdAt;
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          return [...prev, ...data.messages.filter((m) => !known.has(m.id))];
        });
      } catch {
        // thử lại ở lần hỏi kế tiếp
      }
    };
    fetchMessages();
    const timer = setInterval(fetchMessages, THREAD_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function handleSend(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    try {
      const message = await sendChatMessage(activeId, body);
      lastSeenRef.current = message.createdAt;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setDraft('');
      loadList();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không gửi được tin nhắn.' });
    } finally {
      setSending(false);
    }
  }

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-card">
        <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-green-dark" /> Tin nhắn
        </h1>
        <p className="text-xs text-text-muted mt-1">Trao đổi trực tiếp trong ứng dụng. Số điện thoại ứng viên chỉ hiện với cửa hàng sau khi có đề nghị nhận việc.</p>
      </div>

      <div className="grid md:grid-cols-[18rem_1fr] gap-4 min-h-[28rem]">
        <aside className={clsx('bg-white rounded-3xl border border-stone-200 shadow-card overflow-hidden', activeId && 'hidden md:block')}>
          {conversations.length === 0 ? (
            <p className="p-5 text-sm text-text-muted">Chưa có cuộc trò chuyện nào. Mở từ nút "Nhắn tin" ở đơn ứng tuyển hoặc việc vặt.</p>
          ) : conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={clsx('w-full text-left px-4 py-3 border-b border-stone-100 hover:bg-stone-50', c.id === activeId && 'bg-green-50')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-text-main truncate">{c.otherName || 'Cuộc trò chuyện'}</span>
                {c.unread > 0 && <span className="shrink-0 text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">{c.unread}</span>}
              </div>
              <p className="text-[11px] text-text-muted truncate">{c.title}</p>
              {c.lastMessagePreview && <p className="text-xs text-text-muted truncate mt-0.5">{c.lastMessagePreview}</p>}
            </button>
          ))}
        </aside>

        <section className={clsx('bg-white rounded-3xl border border-stone-200 shadow-card flex flex-col', !activeId && 'hidden md:flex')}>
          {!activeId ? (
            <p className="m-auto text-sm text-text-muted p-6">Chọn một cuộc trò chuyện để bắt đầu.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
                <button onClick={() => setActiveId(null)} className="md:hidden p-1" aria-label="Quay lại">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-text-main truncate">{active?.otherName || 'Cuộc trò chuyện'}</p>
                  <p className="text-[11px] text-text-muted truncate">{active?.title}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[26rem]">
                {messages.length === 0 && <p className="text-xs text-text-muted text-center">Chưa có tin nhắn. Hãy gửi lời chào!</p>}
                {messages.map((m) => (
                  <div key={m.id} className={clsx('flex', m.mine ? 'justify-end' : 'justify-start')}>
                    <div className={clsx('max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                      m.mine ? 'bg-green-main text-white' : 'bg-stone-100 text-text-main')}>
                      {m.body}
                      <p className={clsx('text-[10px] mt-1', m.mine ? 'text-green-100' : 'text-text-muted')}>{formatTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-stone-100">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={1000}
                  placeholder="Nhập tin nhắn..."
                  aria-label="Tin nhắn"
                  className="flex-1 p-2.5 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-green-main focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="p-2.5 rounded-xl bg-green-main text-white disabled:opacity-50"
                  aria-label="Gửi"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

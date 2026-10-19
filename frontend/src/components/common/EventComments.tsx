import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, Send, ThumbsUp, ThumbsDown, CornerDownRight } from 'lucide-react';

interface CommentType {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  votesUp?: number;
  votesDown?: number;
  replies: CommentType[];
}

// One-vote-per-browser guard - old's real voting has no per-voter identity
// tracking server-side either (a plain aggregate counter), so this matches
// that same scope rather than building real account-based vote dedup.
const VOTED_KEY = 'hirondelle_voted_comments';
const getVoted = (): Record<string, 'up' | 'down'> => {
  try { return JSON.parse(localStorage.getItem(VOTED_KEY) || '{}'); } catch { return {}; }
};
const setVoted = (id: string, direction: 'up' | 'down') => {
  try {
    const all = getVoted();
    all[id] = direction;
    localStorage.setItem(VOTED_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
};

// Old's real CComment setting date_format="age" - a relative "vor X Jahren"
// style timestamp, not the absolute calendar date this widget showed before.
const formatRelativeDate = (isoDate: string): string => {
  const seconds = Math.max(0, (Date.now() - new Date(isoDate).getTime()) / 1000);
  // "vor" takes the dative case, e.g. "vor 5 Tagen" (not "Tage") - Tag/
  // Monat/Jahr's plural dative form adds -n, unlike Sekunde/Minute/Stunde
  // whose ordinary plural already is the dative form.
  const units: [number, string, string][] = [
    [60, 'Sekunde', 'Sekunden'],
    [60, 'Minute', 'Minuten'],
    [24, 'Stunde', 'Stunden'],
    [30, 'Tag', 'Tagen'],
    [12, 'Monat', 'Monaten'],
    [Infinity, 'Jahr', 'Jahren'],
  ];
  let value = seconds;
  for (const [divisor, singular, plural] of units) {
    if (value < divisor) {
      const rounded = Math.max(1, Math.floor(value));
      return `vor ${rounded} ${rounded === 1 ? singular : plural}`;
    }
    value /= divisor;
  }
  return new Date(isoDate).toLocaleDateString('de-DE');
};

export const EventComments = ({ eventId, pageSlug }: { eventId?: string, pageSlug?: string }) => {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [voted, setVotedState] = useState<Record<string, 'up' | 'down'>>({});
  // Public "Antworten" - the API's `parentId` support already existed
  // (used by the admin's own reply feature), just no UI let a real visitor
  // reply to another visitor's comment, only submit fresh top-level ones.
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyName, setReplyName] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyStatusMsg, setReplyStatusMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    setVotedState(getVoted());
  }, []);

  const fetchComments = async () => {
    try {
      const url = eventId 
        ? `/api/comments/public?eventId=${eventId}` 
        : `/api/comments/public?pageSlug=${pageSlug}`;
        
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (eventId || pageSlug) {
      fetchComments();
    }
  }, [eventId, pageSlug]);

  const handleVote = async (commentId: string, direction: 'up' | 'down') => {
    if (voted[commentId]) return; // already voted from this browser
    try {
      const res = await fetch(`/api/comments/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      if (res.ok) {
        const updated = await res.json();
        setVoted(commentId, direction);
        setVotedState(getVoted());
        setComments((prev) => updateVotesRecursive(prev, commentId, updated));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateVotesRecursive = (items: CommentType[], id: string, votes: { votesUp: number; votesDown: number }): CommentType[] =>
    items.map((c) => c.id === id
      ? { ...c, votesUp: votes.votesUp, votesDown: votes.votesDown }
      : { ...c, replies: updateVotesRecursive(c.replies, id, votes) });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment) return;

    try {
      const res = await fetch('/api/comments/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, pageSlug, content: newComment, name, email: email || undefined })
      });
      const data = await res.json();
      setStatusMsg(data.message);
      if (res.ok) {
        setNewComment('');
        setName('');
        setEmail('');
      }
    } catch (err) {
      setStatusMsg('Fehler beim Senden des Kommentars');
    }
  };

  const openReply = (commentId: string) => {
    setReplyingTo(replyingTo === commentId ? null : commentId);
    setReplyContent('');
  };

  const handleReplySubmit = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setReplySending(true);
    try {
      const res = await fetch('/api/comments/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId, pageSlug, parentId,
          content: replyContent, name: replyName, email: replyEmail || undefined,
        }),
      });
      const data = await res.json();
      setReplyStatusMsg((prev) => ({ ...prev, [parentId]: data.message }));
      if (res.ok) {
        setReplyContent('');
        setReplyName('');
        setReplyEmail('');
        setReplyingTo(null);
      }
    } catch {
      setReplyStatusMsg((prev) => ({ ...prev, [parentId]: 'Fehler beim Senden der Antwort' }));
    } finally {
      setReplySending(false);
    }
  };

  const CommentItem = ({ comment, isReply = false }: { comment: CommentType, isReply?: boolean }) => (
    <div className={`flex gap-4 ${isReply ? 'ml-12 mt-4' : 'mt-6 border-b border-gray-100 pb-6'}`}>
      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-gray-500 font-bold uppercase">{comment.authorName.charAt(0)}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-bold text-sm text-luxury-dark">{comment.authorName}</span>
          <span className="text-xs text-gray-400">
            {formatRelativeDate(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm text-gray-600 font-light leading-relaxed whitespace-pre-wrap">{comment.content}</p>

        {/* Old's real per-comment voting (Ja/Nein/Gesamt columns) */}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => handleVote(comment.id, 'up')}
            disabled={!!voted[comment.id]}
            className={`flex items-center gap-1 text-xs transition-colors ${voted[comment.id] === 'up' ? 'text-luxury-gold' : 'text-gray-400 hover:text-luxury-gold'} disabled:cursor-default`}
          >
            <ThumbsUp size={14} /> {comment.votesUp || 0}
          </button>
          <button
            type="button"
            onClick={() => handleVote(comment.id, 'down')}
            disabled={!!voted[comment.id]}
            className={`flex items-center gap-1 text-xs transition-colors ${voted[comment.id] === 'down' ? 'text-gray-600' : 'text-gray-400 hover:text-gray-600'} disabled:cursor-default`}
          >
            <ThumbsDown size={14} /> {comment.votesDown || 0}
          </button>
          {!isReply && (
            <button
              type="button"
              onClick={() => openReply(comment.id)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-luxury-gold transition-colors"
            >
              <CornerDownRight size={14} /> Antworten
            </button>
          )}
        </div>

        {/* Inline reply composer - a real visitor answering another
            visitor's comment, same public /api/comments/public endpoint
            the top-level form uses (parentId), goes through the same
            moderation setting rather than being auto-approved. */}
        {replyingTo === comment.id && (
          <form onSubmit={(e) => handleReplySubmit(e, comment.id)} className="mt-3 bg-[#FAF9F7] p-4 rounded-sm space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={replyName}
                onChange={(e) => setReplyName(e.target.value)}
                placeholder="Dein Name (optional)"
                className="flex-1 bg-white border border-gray-200 text-black p-2 outline-none focus:border-luxury-gold transition-colors text-sm"
              />
              <input
                type="email"
                value={replyEmail}
                onChange={(e) => setReplyEmail(e.target.value)}
                placeholder="Deine E-Mail (optional)"
                className="flex-1 bg-white border border-gray-200 text-black p-2 outline-none focus:border-luxury-gold transition-colors text-sm"
              />
            </div>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Deine Antwort..."
              required
              className="w-full bg-white border border-gray-200 text-black p-2 outline-none focus:border-luxury-gold transition-colors text-sm min-h-[70px]"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={replySending || !replyContent.trim()}
                className="bg-luxury-gold text-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Send size={14} /> Antwort senden
              </button>
              <button type="button" onClick={() => setReplyingTo(null)} className="text-xs text-gray-500 hover:text-gray-700">
                Abbrechen
              </button>
            </div>
            {replyStatusMsg[comment.id] && (
              <p className="text-xs text-green-600 flex items-center gap-1 font-bold"><CheckCircle size={14} /> {replyStatusMsg[comment.id]}</p>
            )}
          </form>
        )}

        {/* Render Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} isReply={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    // data-live-*: lets the Joomla-style page editor keep this section live
    // (utils/liveBlocks.tsx) instead of copying it as static HTML.
    <div id="comments" data-live-block="comments" data-live-slug={pageSlug || ''} data-live-event={eventId || ''} className="mt-12 w-full mx-auto font-luxurysans bg-white p-8 rounded-sm shadow-sm border border-gray-100">
      <h3 className="text-2xl font-luxury text-luxury-dark mb-6 flex items-center gap-3">
        <MessageSquare className="text-luxury-gold" />
        Kommentare & Bewertungen
      </h3>

      {/* Comment Form */}
      <div className="bg-[#FAF9F7] p-6 rounded-sm mb-8">
        <h4 className="font-bold text-sm mb-4">Hinterlasse einen Kommentar</h4>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Dein Name (Optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-gray-200 text-black p-3 outline-none focus:border-luxury-gold transition-colors text-sm"
              placeholder="Name eingeben..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Deine E-Mail (Optional, für Antwort-Benachrichtigung)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-gray-200 text-black p-3 outline-none focus:border-luxury-gold transition-colors text-sm"
              placeholder="E-Mail eingeben..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Kommentar *</label>
            <textarea 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full bg-white border border-gray-200 text-black p-3 outline-none focus:border-luxury-gold transition-colors text-sm min-h-[100px]"
              placeholder="Schreibe deinen Kommentar..."
              required
            />
          </div>
          <button type="submit" className="bg-luxury-gold text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors flex items-center gap-2">
            <Send size={16} /> Senden
          </button>
          {statusMsg && (
            <p className="text-sm text-green-600 flex items-center gap-2 font-bold mt-2">
              <CheckCircle size={16} /> {statusMsg}
            </p>
          )}
        </form>
      </div>

      {/* Comments List */}
      <div>
        <h4 className="font-bold text-sm mb-4 border-b border-gray-200 pb-2">
          {comments.length} {comments.length === 1 ? 'Kommentar' : 'Kommentare'}
        </h4>
        
        {comments.length === 0 ? (
          <p className="text-gray-400 font-light text-sm italic py-4">Noch keine Kommentare vorhanden. Sei der Erste!</p>
        ) : (
          comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
};

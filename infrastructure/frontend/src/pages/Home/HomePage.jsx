import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import { fetchTechNews, timeAgo, getRecentNews, trackRecentNews } from '../../api/newsApi';
import './HomePage.css';

const INITIAL_POSTS = [
  {
    id: 1,
    author: 'Sundar Pichai',
    headline: 'CEO at Google',
    avatar_color: '#0a66c2',
    time: '2h',
    image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=552&h=276&fit=crop&auto=format',
    content: `Excited to announce that Google Cloud has expanded its distributed systems infrastructure to 40 new regions globally. This means faster, more reliable services for developers everywhere.\n\nBuilding resilient distributed systems isn't just about technology — it's about enabling people to build the next generation of applications without worrying about scale.\n\n#DistributedSystems #CloudComputing #GoogleCloud`,
    likes: 12453,
    comments: 847,
    reposts: 1203,
    liked: false,
    reposted: false,
    reaction: null,
    commentList: [
      { id: 'c1', author: 'Jane Smith', headline: 'Cloud Architect', avatar_color: '#057642', text: 'This is amazing! The new Mumbai region has cut our latency by 40%.', time: '1h', likes: 23 },
      { id: 'c2', author: 'Mike Chen', headline: 'SDE at AWS', avatar_color: '#b24020', text: 'Congrats! Competition drives innovation for all of us.', time: '45m', likes: 8 }
    ]
  },
  {
    id: 2,
    author: 'Priya Sharma',
    headline: 'Senior Software Engineer at Netflix | Kafka Expert',
    avatar_color: '#057642',
    time: '5h',
    image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=552&h=276&fit=crop&auto=format',
    content: `Just published a deep dive on how we handle 8 million Kafka events per second at Netflix.\n\nKey takeaways:\n\u2022 Idempotent consumers are non-negotiable\n\u2022 Use trace_id across services for observability\n\u2022 Event envelopes with standardized schemas saved us months\n\u2022 Redis caching reduced our DB read load by 73%\n\nLink to the full blog post in the comments.`,
    likes: 3241,
    comments: 289,
    reposts: 567,
    liked: false,
    reposted: false,
    reaction: null,
    commentList: [
      { id: 'c3', author: 'Alex R.', headline: 'Staff Engineer at Uber', avatar_color: '#5f4b8b', text: 'The idempotency patterns you described are spot on. We use a similar approach with Kafka consumer groups.', time: '3h', likes: 45 }
    ]
  },
  {
    id: 3,
    author: 'Rajesh Paruchuri',
    headline: 'Graduate Student at SJSU | Distributed Systems',
    avatar_color: '#004182',
    time: '1d',
    image_url: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=552&h=276&fit=crop&auto=format',
    content: `Thrilled to share that our team just completed the Messaging and Connection microservices for our LinkedIn Simulation project!\n\nTech stack:\n\u2022 Node.js + Express for REST APIs\n\u2022 MongoDB for flexible message storage\n\u2022 MySQL for relational connection data\n\u2022 Apache Kafka for async event streaming\n\u2022 React for the frontend\n\nThe idempotent message delivery and duplicate connection prevention were the trickiest parts to get right. Learned a ton about distributed systems patterns in practice.\n\n#SJSU #DistributedSystems #Microservices #BuildInPublic`,
    likes: 156,
    comments: 24,
    reposts: 12,
    liked: true,
    reposted: false,
    reaction: 'like',
    commentList: [
      { id: 'c4', author: 'Prof. Williams', headline: 'SJSU Faculty', avatar_color: '#915907', text: 'Great work Rajesh! The architecture choices show a solid understanding of distributed systems fundamentals.', time: '20h', likes: 12 },
      { id: 'c5', author: 'Team Member 3', headline: 'SJSU Student', avatar_color: '#1b6f72', text: 'Nice job on the Kafka integration! The idempotency key approach is clean.', time: '18h', likes: 5 }
    ]
  },
  {
    id: 4,
    author: 'Sarah Chen',
    headline: 'Engineering Manager at Amazon | Hiring',
    avatar_color: '#b24020',
    time: '1d',
    image_url: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=552&h=276&fit=crop&auto=format',
    content: `We're hiring Software Engineers for our distributed systems team at AWS!\n\nWhat you'll work on:\n\u2022 Building highly available services processing millions of requests/sec\n\u2022 Designing event-driven architectures with Kafka and SQS\n\u2022 Implementing caching strategies with Redis and ElastiCache\n\nExperience with microservices, Docker, Kubernetes is a plus.\n\nDM me or apply through the link below. Remote friendly!`,
    likes: 2890,
    comments: 431,
    reposts: 892,
    liked: false,
    reposted: false,
    reaction: null,
    commentList: []
  },
  {
    id: 5,
    author: 'Alex Rodriguez',
    headline: 'Staff Engineer at Uber | System Design',
    avatar_color: '#5f4b8b',
    time: '2d',
    content: `Hot take: Most "microservices" architectures are actually distributed monoliths.\n\nSigns you might have a distributed monolith:\n\u2022 Deploying one service requires deploying 3 others\n\u2022 Services share a database\n\u2022 Synchronous calls everywhere\n\u2022 No event-driven communication\n\nThe fix? Embrace async messaging (Kafka, RabbitMQ), define clear service boundaries, and let each service own its data.\n\nAgree or disagree?`,
    likes: 8721,
    comments: 1243,
    reposts: 2156,
    liked: false,
    reposted: false,
    reaction: null,
    commentList: [
      { id: 'c6', author: 'Dev Patel', headline: 'Architect at Shopify', avatar_color: '#c37d16', text: 'Disagree slightly — shared databases can work if you have clearly defined ownership boundaries at the schema level.', time: '1d', likes: 67 },
      { id: 'c7', author: 'Lisa Wang', headline: 'SRE at Google', avatar_color: '#0a66c2', text: '100% agree. We spent 6 months untangling a distributed monolith and the root cause was exactly this list.', time: '1d', likes: 89 }
    ]
  },
  {
    id: 6,
    author: 'Monica Patel',
    headline: 'Tech Lead at Microsoft | Azure & Cloud Architecture',
    avatar_color: '#c37d16',
    time: '3d',
    content: `Completed my first marathon this weekend! 26.2 miles of pure determination.\n\nFunny how running a marathon is like building a distributed system:\n\u2022 You have to pace yourself (rate limiting)\n\u2022 You need water stations (caching layers)\n\u2022 Some parts are uphill (scaling challenges)\n\u2022 The finish line makes it all worth it (production deploy)\n\nWhat's your "marathon" project right now?`,
    likes: 4532,
    comments: 312,
    reposts: 89,
    liked: false,
    reposted: false,
    reaction: null,
    commentList: []
  }
];

const REACTIONS = [
  { key: 'like', emoji: '\uD83D\uDC4D', label: 'Like', color: '#378fe9' },
  { key: 'celebrate', emoji: '\uD83D\uDC4F', label: 'Celebrate', color: '#44712e' },
  { key: 'support', emoji: '\uD83D\uDE4C', label: 'Support', color: '#7a3dc8' },
  { key: 'love', emoji: '\u2764\uFE0F', label: 'Love', color: '#df704d' },
  { key: 'insightful', emoji: '\uD83D\uDCA1', label: 'Insightful', color: '#e9a817' },
  { key: 'funny', emoji: '\uD83D\uDE02', label: 'Funny', color: '#44712e' }
];

const formatCount = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
  return num.toString();
};

// ====== POST CARD ======
const PostCard = ({ post, onUpdate, userName }) => {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const reactionTimeout = useRef(null);
  const commentInputRef = useRef(null);

  const lines = post.content.split('\n');
  const isLong = lines.length > 4 || post.content.length > 250;
  const displayContent = isLong && !expanded
    ? lines.slice(0, 3).join('\n') + (lines.length > 3 ? '' : post.content.substring(0, 200))
    : post.content;

  const handleReaction = (reaction) => {
    setShowReactions(false);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 600);

    if (post.reaction === reaction.key) {
      onUpdate({ ...post, liked: false, reaction: null, likes: post.likes - 1 });
    } else {
      const wasLiked = post.liked;
      onUpdate({
        ...post,
        liked: true,
        reaction: reaction.key,
        likes: wasLiked ? post.likes : post.likes + 1
      });
      toast(`You reacted with ${reaction.label}`, 'info');
    }
  };

  const handleQuickLike = () => {
    if (post.liked) {
      onUpdate({ ...post, liked: false, reaction: null, likes: post.likes - 1 });
    } else {
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 600);
      onUpdate({ ...post, liked: true, reaction: 'like', likes: post.likes + 1 });
    }
  };

  const handleRepost = () => {
    if (post.reposted) {
      onUpdate({ ...post, reposted: false, reposts: post.reposts - 1 });
    } else {
      onUpdate({ ...post, reposted: true, reposts: post.reposts + 1 });
      toast('Reposted to your feed', 'success');
    }
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: 'c' + Date.now(),
      author: userName,
      headline: 'Graduate Student at SJSU',
      avatar_color: '#004182',
      text: commentText,
      time: 'Just now',
      likes: 0
    };
    onUpdate({
      ...post,
      comments: post.comments + 1,
      commentList: [...post.commentList, newComment]
    });
    setCommentText('');
    toast('Comment posted', 'success');
  };

  const handleCommentLike = (commentId) => {
    const updatedComments = post.commentList.map(c =>
      c.id === commentId ? { ...c, likes: c.likes + 1 } : c
    );
    onUpdate({ ...post, commentList: updatedComments });
  };

  const handleShare = () => {
    setShowShareMenu(false);
    navigator.clipboard?.writeText(`https://linkedin.com/post/${post.id}`);
    toast('Link copied to clipboard', 'info');
  };

  const reactionEmoji = REACTIONS.find(r => r.key === post.reaction);

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="post-avatar" style={{ backgroundColor: post.avatar_color }}>
          {post.author.charAt(0)}
        </div>
        <div className="post-meta">
          <div className="post-author">{post.author}</div>
          <div className="post-headline">{post.headline}</div>
          <div className="post-time">{post.time} &#183; &#127760;</div>
        </div>
        <button className="post-follow">+ Follow</button>
        <button className="post-more">&#8943;</button>
      </div>

      <div className="post-content">
        {displayContent.split('\n').map((line, i) => (
          <React.Fragment key={i}>{line}{i < displayContent.split('\n').length - 1 && <br />}</React.Fragment>
        ))}
        {isLong && !expanded && (
          <button className="see-more-btn" onClick={() => setExpanded(true)}>...see more</button>
        )}
        {isLong && expanded && (
          <button className="see-more-btn" onClick={() => setExpanded(false)}>show less</button>
        )}
      </div>

      {post.image_url && (
        <div className="post-image">
          <img src={post.image_url} alt="" loading="lazy" />
        </div>
      )}

      {/* Stats row */}
      <div className="post-stats">
        <div className="post-stats-left" onClick={() => setShowComments(!showComments)} style={{ cursor: 'pointer' }}>
          <span className="reaction-icons">
            <span className="reaction-badge like">{'\uD83D\uDC4D'}</span>
            <span className="reaction-badge heart">{'\u2764\uFE0F'}</span>
            <span className="reaction-badge clap">{'\uD83D\uDC4F'}</span>
          </span>
          <span className="stats-count">{formatCount(post.likes)}</span>
        </div>
        <div className="post-stats-right">
          <span className="stat-link" onClick={() => { setShowComments(!showComments); }}>
            {formatCount(post.comments)} comments
          </span>
          <span> &#183; </span>
          <span>{formatCount(post.reposts)} reposts</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="post-actions">
        <div
          className="post-action-wrapper"
          onMouseEnter={() => { reactionTimeout.current = setTimeout(() => setShowReactions(true), 500); }}
          onMouseLeave={() => { clearTimeout(reactionTimeout.current); setShowReactions(false); }}
        >
          {showReactions && (
            <div className="reaction-picker">
              {REACTIONS.map(r => (
                <button
                  key={r.key}
                  className="reaction-option"
                  onClick={() => handleReaction(r)}
                  title={r.label}
                >
                  <span className="reaction-emoji">{r.emoji}</span>
                  <span className="reaction-label">{r.label}</span>
                </button>
              ))}
            </div>
          )}
          <button className={`post-action-btn ${post.liked ? 'liked' : ''} ${likeAnim ? 'like-anim' : ''}`} onClick={handleQuickLike}>
            <span className="action-icon" style={post.liked && reactionEmoji ? { color: reactionEmoji.color } : {}}>
              {post.liked && reactionEmoji ? reactionEmoji.emoji : '\uD83D\uDC4D'}
            </span>
            <span>{post.liked && reactionEmoji ? reactionEmoji.label : 'Like'}</span>
          </button>
        </div>

        <button className="post-action-btn" onClick={() => { setShowComments(true); setTimeout(() => commentInputRef.current?.focus(), 100); }}>
          <span className="action-icon">{'\uD83D\uDCAC'}</span>
          <span>Comment</span>
        </button>

        <button className={`post-action-btn ${post.reposted ? 'reposted' : ''}`} onClick={handleRepost}>
          <span className="action-icon">{'\u21BA'}</span>
          <span>{post.reposted ? 'Reposted' : 'Repost'}</span>
        </button>

        <div className="post-action-wrapper">
          <button className="post-action-btn" onClick={() => setShowShareMenu(!showShareMenu)}>
            <span className="action-icon">{'\u27A4'}</span>
            <span>Send</span>
          </button>
          {showShareMenu && (
            <div className="share-menu">
              <button onClick={handleShare}>{'\uD83D\uDD17'} Copy link</button>
              <button onClick={() => { setShowShareMenu(false); toast('Shared via message', 'success'); }}>{'\u2709\uFE0F'} Send in message</button>
            </div>
          )}
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="comments-section">
          <div className="comment-composer">
            <div className="comment-composer-avatar">{userName.charAt(0)}</div>
            <div className="comment-input-wrap">
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              />
              {commentText.trim() && (
                <button className="comment-post-btn" onClick={handleComment}>Post</button>
              )}
            </div>
          </div>

          {post.commentList.map(comment => (
            <div key={comment.id} className="comment-item">
              <div className="comment-avatar" style={{ backgroundColor: comment.avatar_color }}>
                {comment.author.charAt(0)}
              </div>
              <div className="comment-body">
                <div className="comment-bubble">
                  <div className="comment-author">
                    {comment.author}
                    <span className="comment-headline">{comment.headline}</span>
                  </div>
                  <div className="comment-text">{comment.text}</div>
                </div>
                <div className="comment-actions-row">
                  <button className="comment-action" onClick={() => handleCommentLike(comment.id)}>
                    Like {comment.likes > 0 && `(${comment.likes})`}
                  </button>
                  <span className="comment-sep">|</span>
                  <button className="comment-action">Reply</button>
                  <span className="comment-time">{comment.time}</span>
                </div>
              </div>
            </div>
          ))}

          {post.commentList.length === 0 && (
            <div className="no-comments">Be the first to comment</div>
          )}
        </div>
      )}
    </div>
  );
};

// ====== POST COMPOSER MODAL ======
const ComposerModal = ({ onClose, onPost, userName }) => {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };

  useEffect(() => {
    textareaRef.current?.focus();
    return () => { setImageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); };
  }, []);

  const handlePost = () => {
    if (!text.trim()) return;
    onPost(text, imageUrl);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="composer-modal" onClick={e => e.stopPropagation()}>
        <div className="composer-modal-header">
          <div className="composer-modal-user">
            <div className="composer-modal-avatar">{userName.charAt(0)}</div>
            <div>
              <div className="composer-modal-name">{userName}</div>
              <button className="composer-visibility">{'\uD83C\uDF10'} Anyone &#9660;</button>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <textarea
          ref={textareaRef}
          className="composer-modal-textarea"
          placeholder="What do you want to talk about?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {imageUrl && (
          <div className="composer-image-preview">
            <img src={imageUrl} alt="Preview" />
            <button
              className="composer-image-preview__remove"
              onClick={() => { URL.revokeObjectURL(imageUrl); setImageUrl(null); }}
            >&times;</button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div className="composer-modal-toolbar">
          <div className="composer-modal-tools">
            <button title="Photo" style={{ color: '#378fe9' }} onClick={() => fileInputRef.current?.click()}>{'\uD83D\uDCF7'}</button>
            <button title="Video" style={{ color: '#5f9b41' }}>{'\uD83C\uDFA5'}</button>
            <button title="Document" style={{ color: '#e16745' }}>{'\uD83D\uDCC4'}</button>
            <button title="Poll" style={{ color: '#e9a817' }}>{'\uD83D\uDCCA'}</button>
            <button title="Emoji" style={{ color: '#c37d16' }}>{'\uD83D\uDE0A'}</button>
            <button title="More">&#8943;</button>
          </div>
          <button
            className={`composer-modal-post-btn ${text.trim() ? 'active' : ''}`}
            disabled={!text.trim()}
            onClick={handlePost}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
};

// ====== HOME PAGE ======
const HomePage = ({ currentUserId = '', currentUserName = 'Rajesh Paruchuri', currentUserPhoto = null }) => {
  const toast = useToast();
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [showComposer, setShowComposer] = useState(false);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [showAllNews, setShowAllNews] = useState(false);
  const [recentNews, setRecentNews] = useState(() => getRecentNews());
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    function refresh() {
      fetchTechNews({ pageSize: 20 }).then(({ articles }) => {
        setNews(articles)
        setNewsLoading(false)
        setLastUpdated(new Date())
      })
    }
    refresh()
    const interval = setInterval(refresh, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(interval)
  }, [])

  function handleNewsClick(article) {
    trackRecentNews(article)
    setRecentNews(getRecentNews())
    window.open(article.url, '_blank', 'noopener noreferrer')
  }

  const handleUpdatePost = (updatedPost) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handleNewPost = (text, imageUrl = null) => {
    const newPost = {
      id: Date.now(),
      author: currentUserName,
      headline: 'Graduate Student at SJSU | Distributed Systems',
      avatar_color: '#004182',
      time: 'Just now',
      content: text,
      image_url: imageUrl,
      likes: 0,
      comments: 0,
      reposts: 0,
      liked: false,
      reposted: false,
      reaction: null,
      commentList: []
    };
    setPosts([newPost, ...posts]);
    toast('Your post has been published!', 'success');
  };

  return (
    <div className="home-page">
      {/* Left Sidebar */}
      <div className="home-sidebar-left">
        <div className="profile-card">
          <div className="profile-banner" />
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar" style={currentUserPhoto ? { background: 'none', padding: 0, overflow: 'hidden' } : {}}>
              {currentUserPhoto
                ? <img src={currentUserPhoto} alt={currentUserName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : currentUserName.charAt(0)}
            </div>
          </div>
          <div className="profile-info">
            {currentUserId
              ? <Link to={`/members/${currentUserId}`} style={{ textDecoration: 'none', color: 'inherit' }}><h3 style={{ cursor: 'pointer' }}>{currentUserName}</h3></Link>
              : <h3>{currentUserName}</h3>}
            <p className="profile-headline">Graduate Student at SJSU | Distributed Systems</p>
          </div>
          <div className="profile-stats">
            <div className="profile-stat-row">
              <span>Profile viewers</span>
              <span className="stat-num">128</span>
            </div>
            <div className="profile-stat-row">
              <span>Post impressions</span>
              <span className="stat-num">1,451</span>
            </div>
          </div>
        </div>
        <div className="recent-card">
          <h4>Recent</h4>
          {recentNews.length === 0 ? (
            <p className="recent-empty">Articles you click will appear here.</p>
          ) : (
            recentNews.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="recent-item"
              >
                <span className="recent-item-title">
                  {item.title?.length > 52 ? item.title.slice(0, 52) + '…' : item.title}
                </span>
                {item.source && <span className="recent-item-source">{item.source}</span>}
              </a>
            ))
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="home-feed">
        <div className="composer-card">
          <div className="composer-top">
            <div className="composer-avatar" style={currentUserPhoto ? { background: 'none', padding: 0, overflow: 'hidden' } : {}}>
              {currentUserPhoto
                ? <img src={currentUserPhoto} alt={currentUserName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : currentUserName.charAt(0)}
            </div>
            <button className="composer-input" onClick={() => setShowComposer(true)}>
              Start a post
            </button>
          </div>
          <div className="composer-actions">
            <button className="composer-action" onClick={() => setShowComposer(true)}>
              <span style={{ color: '#378fe9' }}>{'\uD83D\uDCF7'}</span> Photo
            </button>
            <button className="composer-action" onClick={() => setShowComposer(true)}>
              <span style={{ color: '#5f9b41' }}>{'\uD83C\uDFA5'}</span> Video
            </button>
            <button className="composer-action" onClick={() => setShowComposer(true)}>
              <span style={{ color: '#c37d16' }}>{'\uD83D\uDCC5'}</span> Event
            </button>
            <button className="composer-action" onClick={() => setShowComposer(true)}>
              <span style={{ color: '#e16745' }}>{'\uD83D\uDCDD'}</span> Write article
            </button>
          </div>
        </div>

        <div className="feed-sort">
          <hr />
          <span>Sort by: <strong>Top</strong> &#9660;</span>
        </div>

        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onUpdate={handleUpdatePost}
            userName={currentUserName}
          />
        ))}
      </div>

      {/* Right Sidebar */}
      <div className="home-sidebar-right">
        <div className="news-card">
          <div className="news-card-header">
            <h3>LinkedIn News</h3>
            <p>
              Top stories for tech professionals
              {lastUpdated && (
                <span style={{ marginLeft: 6, color: 'rgba(0,0,0,0.35)' }}>
                  · updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          {newsLoading ? (
            <div style={{ padding: '14px 16px', color: '#56687A', fontSize: 13 }}>Loading…</div>
          ) : news.length === 0 ? (
            <div style={{ padding: '14px 16px', color: '#56687A', fontSize: 13 }}>
              Add <code>VITE_NEWS_API_KEY</code> to .env to enable live news.
            </div>
          ) : (
            (showAllNews ? news : news.slice(0, 5)).map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-item"
                onClick={() => { trackRecentNews(article); setRecentNews(getRecentNews()); }}
              >
                <div className="news-item-title">{article.title}</div>
                <div className="news-item-meta">
                  {article.source?.name && <span className="news-item-source">{article.source.name}</span>}
                  {article.source?.name && <span>·</span>}
                  <span>{timeAgo(article.publishedAt)}</span>
                  <span className="news-item-link-icon">↗</span>
                </div>
              </a>
            ))
          )}
          {news.length > 5 && (
            <button className="news-show-more" onClick={() => setShowAllNews(v => !v)}>
              {showAllNews ? 'Show less ▲' : 'Show more ▼'}
            </button>
          )}
        </div>
        <div className="footer-links">
          <span>About</span><span>Accessibility</span><span>Help Center</span>
          <span>Privacy & Terms</span><span>Ad Choices</span><span>Advertising</span>
          <span>Business Services</span>
          <div className="footer-brand">LinkedIn Corporation &copy; 2026</div>
        </div>
      </div>

      {showComposer && (
        <ComposerModal
          userName={currentUserName}
          onClose={() => setShowComposer(false)}
          onPost={handleNewPost}
        />
      )}
    </div>
  );
};

export default HomePage;

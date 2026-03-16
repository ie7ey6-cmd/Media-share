/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage, signInWithGoogle, logout } from './firebase';
import { 
  Upload, 
  MessageSquare, 
  Download, 
  LogOut, 
  LogIn, 
  Image as ImageIcon, 
  Video as VideoIcon,
  X,
  Send,
  Trash2,
  Loader2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  description?: string;
}

interface Comment {
  id: string;
  mediaId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: any;
}

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  console.log("App state:", { user: user?.email, loading, error: error?.message });

  // Sync user profile to Firestore
  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, {
        name: user.displayName || 'Anonymous',
        email: user.email,
        photoURL: user.photoURL
      }, { merge: true });
    }
  }, [user]);

  // Fetch media feed
  useEffect(() => {
    const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MediaItem[];
      setMedia(items);
    }, (error) => {
      console.error("Firestore Error (Media):", error);
    });
    return () => unsubscribe();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !fileInputRef.current?.files?.[0]) return;

    const file = fileInputRef.current.files[0];
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      alert("Please upload an image or video file.");
      return;
    }

    setIsUploading(true);
    const storageRef = ref(storage, `media/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        setIsUploading(false);
        alert("Upload failed. Please check your connection.");
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, 'media'), {
          type: isVideo ? 'video' : 'image',
          url: downloadURL,
          authorId: user.uid,
          authorName: user.displayName || 'Anonymous',
          createdAt: serverTimestamp(),
          description: description
        });
        setIsUploading(false);
        setUploadProgress(0);
        setDescription('');
        setShowUploadModal(false);
      }
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5A5A40]" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#1a1a1a] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#5A5A40]/10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
            <ImageIcon size={24} />
          </div>
          <h1 className="text-2xl font-serif italic font-bold tracking-tight">MediaShare</h1>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <button 
                onClick={() => setShowUploadModal(true)}
                className="bg-[#5A5A40] text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-[#4a4a35] transition-colors"
              >
                <Upload size={18} />
                <span className="hidden sm:inline">Upload</span>
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-[#5A5A40]/20">
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-[#5A5A40]/20" referrerPolicy="no-referrer" />
                <button onClick={logout} className="text-[#5A5A40] hover:text-red-600 transition-colors">
                  <LogOut size={20} />
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="bg-[#5A5A40] text-white px-6 py-2 rounded-full flex items-center gap-2 hover:bg-[#4a4a35] transition-colors"
            >
              <LogIn size={18} />
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Feed */}
      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {!user && (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-[#5A5A40]/5">
            <h2 className="text-3xl font-serif italic mb-4">Welcome to MediaShare</h2>
            <p className="text-[#5A5A40]/70 mb-8 max-w-md mx-auto">
              A refined space for sharing your visual stories. Sign in to upload your photos and videos and join the conversation.
            </p>
            <button 
              onClick={signInWithGoogle}
              className="bg-[#5A5A40] text-white px-8 py-3 rounded-full text-lg font-medium hover:bg-[#4a4a35] transition-all transform hover:scale-105"
            >
              Get Started with Google
            </button>
          </div>
        )}

        <div className="grid gap-8">
          {media.map((item) => (
            <MediaCard key={item.id} item={item} currentUser={user} />
          ))}
          {user && media.length === 0 && (
            <div className="text-center py-20 opacity-50">
              <ImageIcon size={48} className="mx-auto mb-4" />
              <p>No media shared yet. Be the first!</p>
            </div>
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif italic">Upload Media</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-[#5A5A40]/50 hover:text-[#1a1a1a]">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-6">
              <div className="border-2 border-dashed border-[#5A5A40]/20 rounded-2xl p-8 text-center hover:border-[#5A5A40]/40 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*,video/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-[#f5f5f0] rounded-full flex items-center justify-center mx-auto text-[#5A5A40]">
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-medium">Click or drag to upload</p>
                  <p className="text-xs text-[#5A5A40]/50">Images or Videos (max 10MB recommended)</p>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest font-bold text-[#5A5A40]/60 mb-2">Description</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#f5f5f0] rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 min-h-[100px]"
                  placeholder="Tell a story about this media..."
                />
              </div>

              {isUploading ? (
                <div className="space-y-2">
                  <div className="h-2 bg-[#f5f5f0] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#5A5A40] transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-xs font-mono">Uploading... {Math.round(uploadProgress)}%</p>
                </div>
              ) : (
                <button 
                  type="submit"
                  className="w-full bg-[#5A5A40] text-white py-4 rounded-full font-bold hover:bg-[#4a4a35] transition-colors"
                >
                  Share to Feed
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaCard(props: { item: MediaItem, currentUser: any, key?: any }) {
  const { item, currentUser } = props;
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'media', item.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(items);
    });
    return () => unsubscribe();
  }, [item.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newComment.trim()) return;

    await addDoc(collection(db, 'media', item.id, 'comments'), {
      mediaId: item.id,
      authorId: currentUser.uid,
      authorName: currentUser.displayName || 'Anonymous',
      text: newComment,
      createdAt: serverTimestamp()
    });
    setNewComment('');
  };

  const handleDeleteMedia = async () => {
    if (confirm("Are you sure you want to delete this post?")) {
      await deleteDoc(doc(db, 'media', item.id));
    }
  };

  const downloadFile = async () => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mediashare_${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
      window.open(item.url, '_blank');
    }
  };

  return (
    <article className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-[#5A5A40]/5">
      {/* Author Header */}
      <div className="p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f5f5f0] rounded-full flex items-center justify-center text-[#5A5A40] font-serif italic text-lg">
            {item.authorName[0]}
          </div>
          <div>
            <h3 className="font-bold text-sm">{item.authorName}</h3>
            <p className="text-[10px] uppercase tracking-widest text-[#5A5A40]/50 font-bold">
              {item.createdAt?.toDate().toLocaleDateString()}
            </p>
          </div>
        </div>
        {currentUser?.uid === item.authorId && (
          <button onClick={handleDeleteMedia} className="text-[#5A5A40]/30 hover:text-red-500 transition-colors">
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Media Content */}
      <div className="relative aspect-square sm:aspect-video bg-black flex items-center justify-center group">
        {item.type === 'image' ? (
          <img 
            src={item.url} 
            alt={item.description} 
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        ) : (
          <video 
            src={item.url} 
            controls 
            className="w-full h-full"
          />
        )}
        
        <button 
          onClick={downloadFile}
          className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/40"
          title="Download"
        >
          <Download size={20} />
        </button>
      </div>

      {/* Description & Actions */}
      <div className="p-6 space-y-4">
        {item.description && (
          <p className="text-[#1a1a1a] leading-relaxed italic font-serif text-lg">
            "{item.description}"
          </p>
        )}

        <div className="flex items-center gap-6 pt-2 border-t border-[#5A5A40]/5">
          <button 
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 text-[#5A5A40] hover:text-[#1a1a1a] transition-colors"
          >
            <MessageSquare size={20} />
            <span className="text-sm font-bold">{comments.length} Comments</span>
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="space-y-4 pt-4 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-[#f5f5f0] p-4 rounded-2xl">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-[#5A5A40]">{comment.authorName}</span>
                    <span className="text-[10px] text-[#5A5A40]/40">{comment.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm">{comment.text}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-center text-xs text-[#5A5A40]/40 py-4">No comments yet. Start the conversation!</p>
              )}
            </div>

            {currentUser ? (
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input 
                  type="text" 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-[#f5f5f0] rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                />
                <button 
                  type="submit"
                  disabled={!newComment.trim()}
                  className="bg-[#5A5A40] text-white p-2 rounded-full disabled:opacity-30 hover:bg-[#4a4a35] transition-colors"
                >
                  <Send size={16} />
                </button>
              </form>
            ) : (
              <p className="text-center text-xs text-[#5A5A40]/60 italic">Sign in to comment</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

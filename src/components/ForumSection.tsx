import React, { useState } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Pin, 
  CheckCircle, 
  Paperclip, 
  ThumbsUp, 
  Eye, 
  Send, 
  Tag, 
  X, 
  FileText, 
  BookOpen, 
  Users, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { ForumTopic, Kelas, User, ForumReply } from '../types';
import { forumApi } from '../utils/community-api';

interface ForumSectionProps {
  topics: ForumTopic[];
  setTopics: React.Dispatch<React.SetStateAction<ForumTopic[]>>;
  currentUser: User | null;
  kelasList: Kelas[];
  onNewTopicNotification?: (topicTitle: string, category: string) => void;
  onOpenLogin: () => void;
}

export const ForumSection: React.FC<ForumSectionProps> = ({
  topics,
  setTopics,
  currentUser,
  kelasList,
  onNewTopicNotification,
  onOpenLogin
}) => {
  // Filters
  const [selectedCategoryType, setSelectedCategoryType] = useState<'all' | 'mapel' | 'kelas'>('all');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  // Active Selected Topic Detail Modal
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);

  // New Topic Form State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategoryType, setNewCategoryType] = useState<'mapel' | 'kelas'>('mapel');
  const [newCategoryName, setNewCategoryName] = useState<string>('Pemrograman Web & Perangkat Bergerak');
  const [newContent, setNewContent] = useState<string>('');
  const [newTagsInput, setNewTagsInput] = useState<string>('WebDev, Diskusi');

  // Reply Form State inside active topic
  const [replyText, setReplyText] = useState<string>('');

  // Predefined category options
  const mapelOptions = [
    'Pemrograman Web & Perangkat Bergerak',
    'Administrasi Infrastruktur Jaringan',
    'Pemeliharaan Engine Kendaraan',
    'Praktikum Akuntansi Lembaga',
    'Bahasa Indonesia Vokasi',
    'General / Pengumuman Lomba'
  ];

  const kelasOptions = kelasList.map(kelas => kelas.name);

  // Create Topic Handler
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) return;

    const parsedTags = newTagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(t => t.length > 0);

    const createdTopic: ForumTopic = {
      id: `ft-${Date.now()}`,
      title: newTitle,
      categoryType: newCategoryType,
      categoryName: newCategoryName,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorAvatar: currentUser.avatar,
      createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      content: newContent,
      tags: parsedTags.length > 0 ? parsedTags : ['DiskusiSekolah'],
      likes: 1,
      likedBy: [currentUser.id],
      views: 1,
      replies: [],
      isPinned: false,
      isResolved: false
    };

    try {
      const saved = await forumApi.create(createdTopic);
      setTopics([saved, ...topics]);
      onNewTopicNotification?.(saved.title, saved.categoryName);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Topik gagal dibuat.');
      return;
    }

    // Reset Form
    setNewTitle('');
    setNewContent('');
    setShowCreateModal(false);
  };

  // Submit Reply Handler
  const handleAddReply = async (topicId: string) => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    if (!replyText.trim()) return;

    const newReply: ForumReply = {
      id: `fr-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorAvatar: currentUser.avatar,
      createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      content: replyText,
      likes: 0,
      likedBy: []
    };

    let savedReply: ForumReply;
    try {
      savedReply = await forumApi.reply(topicId, newReply);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Balasan gagal dikirim.');
      return;
    }
    setTopics(topics.map(t => {
      if (t.id === topicId) {
        return {
          ...t,
          replies: [...t.replies, savedReply]
        };
      }
      return t;
    }));

    setReplyText('');
  };

  // Like Topic Toggle
  const handleToggleLike = async (topicId: string) => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }

    const topic = topics.find(item => item.id === topicId);
    if (!topic) return;
    const willLike = !(topic.likedBy || []).includes(currentUser.id);
    try { await forumApi.like(topicId, willLike); } catch (error) { alert(error instanceof Error ? error.message : 'Like gagal disimpan.'); return; }
    setTopics(topics.map(t => {
      if (t.id === topicId) {
        const likedBy = t.likedBy || [];
        const isAlreadyLiked = likedBy.includes(currentUser.id);

        return {
          ...t,
          likes: isAlreadyLiked ? t.likes - 1 : t.likes + 1,
          likedBy: isAlreadyLiked 
            ? likedBy.filter(id => id !== currentUser.id)
            : [...likedBy, currentUser.id]
        };
      }
      return t;
    }));
  };

  // Toggle Pin / Resolve (Admin/Guru)
  const handleTogglePin = async (topicId: string) => {
    const topic = topics.find(item => item.id === topicId); if (!topic) return;
    try { await forumApi.moderate(topicId, { isPinned: !topic.isPinned }); setTopics(topics.map(t => t.id === topicId ? { ...t, isPinned: !t.isPinned } : t)); } catch (error) { alert(error instanceof Error ? error.message : 'Moderasi gagal.'); }
  };

  const handleToggleResolve = async (topicId: string) => {
    const topic = topics.find(item => item.id === topicId); if (!topic) return;
    try { await forumApi.moderate(topicId, { isResolved: !topic.isResolved }); setTopics(topics.map(t => t.id === topicId ? { ...t, isResolved: !t.isResolved } : t)); } catch (error) { alert(error instanceof Error ? error.message : 'Moderasi gagal.'); }
  };

  // Filter Topics
  const filteredTopics = topics.filter(t => {
    // Category Type Filter
    if (selectedCategoryType !== 'all' && t.categoryType !== selectedCategoryType) {
      return false;
    }
    // Specific Category Name Filter
    if (selectedCategoryName !== 'all' && t.categoryName !== selectedCategoryName) {
      return false;
    }
    // Tag Filter
    if (selectedTag && !t.tags.includes(selectedTag)) {
      return false;
    }
    // Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchContent = t.content.toLowerCase().includes(q);
      const matchAuthor = t.authorName.toLowerCase().includes(q);
      const matchCategory = t.categoryName.toLowerCase().includes(q);
      return matchTitle || matchContent || matchAuthor || matchCategory;
    }
    return true;
  });

  const activeTopic = topics.find(t => t.id === activeTopicId);

  // Collect all unique tags
  const allTags = Array.from(new Set(topics.flatMap(t => t.tags)));

  return (
    <div id="forum-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Section Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full border border-blue-400/30">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ruang Diskusi & Kolaborasi Pembelajaran</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Forum Diskusi Siswa & Guru
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Wadah interaksi akademis berdasarkan mata pelajaran kejuruan maupun kelas untuk membuat topik dan tanggapan secara real-time.
            </p>
          </div>

          <button
            id="create-topic-btn"
            onClick={() => {
              if (!currentUser) {
                onOpenLogin();
              } else {
                setShowCreateModal(true);
              }
            }}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all cursor-pointer text-sm shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span>Buat Topik Baru</span>
          </button>
        </div>
      </div>

      {/* Main Forum Controls & Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Sidebar Filters */}
        <div className="space-y-6">
          
          {/* Category Type Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Kategori Forum</span>
            </h3>

            <div className="space-y-1">
              <button
                id="filter-category-all"
                onClick={() => {
                  setSelectedCategoryType('all');
                  setSelectedCategoryName('all');
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  selectedCategoryType === 'all'
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Semua Topik</span>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                  {topics.length}
                </span>
              </button>

              <button
                id="filter-category-mapel"
                onClick={() => {
                  setSelectedCategoryType('mapel');
                  setSelectedCategoryName('all');
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  selectedCategoryType === 'mapel'
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Mata Pelajaran</span>
                </div>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                  {topics.filter(t => t.categoryType === 'mapel').length}
                </span>
              </button>

              <button
                id="filter-category-kelas"
                onClick={() => {
                  setSelectedCategoryType('kelas');
                  setSelectedCategoryName('all');
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  selectedCategoryType === 'kelas'
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>Diskusi Kelas</span>
                </div>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                  {topics.filter(t => t.categoryType === 'kelas').length}
                </span>
              </button>
            </div>

            {/* Sub-Category Dropdown / Selection */}
            {selectedCategoryType !== 'all' && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">
                  Spesifik {selectedCategoryType === 'mapel' ? 'Mata Pelajaran' : 'Kelas'}
                </label>
                <select
                  id="select-subcategory-name"
                  value={selectedCategoryName}
                  onChange={(e) => setSelectedCategoryName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">-- Semua {selectedCategoryType === 'mapel' ? 'Mapel' : 'Kelas'} --</option>
                  {(selectedCategoryType === 'mapel' ? mapelOptions : kelasOptions).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tags Cloud Filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Tag Topik</span>
              </h3>
              {selectedTag && (
                <button 
                  onClick={() => setSelectedTag('')}
                  className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(isSelected ? '' : tag)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Status Card */}
          <div className="bg-blue-50/80 rounded-xl border border-blue-200/80 p-4 text-xs space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Status Akun Anda</span>
            </div>
            {currentUser ? (
              <div className="space-y-1 text-slate-600">
                <div>Akses sebagai: <strong className="text-blue-700 capitalize">{currentUser.name}</strong> ({currentUser.role})</div>
                <div className="text-[11px] text-slate-500">Anda dapat membuat postingan baru dan membalas diskusi.</div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-slate-600">Anda berselancar sebagai Tamu. Masuk ke portal untuk dapat berpartisipasi.</p>
                <button
                  onClick={onOpenLogin}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Masuk Sekarang
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right Main Topics List */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Search & Topic Count Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="forum-search-input"
                type="text"
                placeholder="Cari topik, penulis, atau kata kunci..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-semibold self-end sm:self-center">
              Menampilkan <span className="text-blue-600 font-bold">{filteredTopics.length}</span> diskusi
            </div>
          </div>

          {/* Topics Cards List */}
          {filteredTopics.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">Tidak ada topik diskusi ditemukan</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Coba ubah kata kunci pencarian atau bersihkan filter kategori untuk menampilkan lebih banyak hasil.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTopics.map((topic) => {
                const isLikedByCurrent = currentUser && topic.likedBy?.includes(currentUser.id);
                return (
                  <div
                    key={topic.id}
                    id={`topic-card-${topic.id}`}
                    onClick={() => setActiveTopicId(topic.id)}
                    className={`bg-white rounded-xl border transition-all hover:shadow-md cursor-pointer p-5 space-y-3 relative ${
                      topic.isPinned 
                        ? 'border-blue-300 bg-blue-50/20 shadow-xs' 
                        : 'border-slate-200 hover:border-blue-200'
                    }`}
                  >
                    {/* Header Badges & Meta */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {topic.isPinned && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <Pin className="w-3 h-3 fill-amber-800" />
                            Disematkan
                          </span>
                        )}
                        {topic.isResolved && (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <CheckCircle className="w-3 h-3" />
                            Selesai
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          topic.categoryType === 'mapel'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {topic.categoryName}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 font-medium">
                        {topic.createdAt}
                      </div>
                    </div>

                    {/* Title & Excerpt */}
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {topic.title}
                      </h2>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {topic.content}
                      </p>
                    </div>

                    {/* Tags & Attachments pill indicator */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      
                      {/* Author Info */}
                      <div className="flex items-center gap-2">
                        <img 
                          src={topic.authorAvatar} 
                          alt={topic.authorName} 
                          className="w-6 h-6 rounded-full object-cover border border-slate-200"
                        />
                        <span className="text-xs font-semibold text-slate-800">
                          {topic.authorName}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold capitalize ${
                          topic.authorRole === 'guru' ? 'bg-blue-100 text-blue-800' :
                          topic.authorRole === 'admin' ? 'bg-purple-100 text-purple-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {topic.authorRole}
                        </span>
                      </div>

                      {/* Stats & Actions */}
                      <div className="flex items-center gap-4 text-slate-500 text-xs font-medium">
                        {topic.attachments && topic.attachments.length > 0 && (
                          <span className="flex items-center gap-1 text-slate-500" title="Lampiran File">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>{topic.attachments.length}</span>
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          <span>{topic.views}</span>
                        </span>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLike(topic.id);
                          }}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors ${
                            isLikedByCurrent ? 'text-blue-600 font-bold' : ''
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${isLikedByCurrent ? 'fill-blue-600' : ''}`} />
                          <span>{topic.likes}</span>
                        </button>

                        <span className="flex items-center gap-1 text-blue-600 font-bold">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{topic.replies.length} balasan</span>
                        </span>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {/* CREATE TOPIC MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <span>Buat Topik Diskusi Baru</span>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="space-y-4 text-xs">
              
              {/* Category Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-topic-category-type" className="block font-bold text-slate-700 mb-1">Tipe Kategori</label>
                  <select
                    id="new-topic-category-type"
                    value={newCategoryType}
                    onChange={(e) => {
                       const val = e.target.value as 'mapel' | 'kelas';
                       setNewCategoryType(val);
                       setNewCategoryName(val === 'mapel' ? mapelOptions[0] : (kelasOptions[0] || ''));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mapel">Mata Pelajaran</option>
                    <option value="kelas">Diskusi Kelas</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="new-topic-category-name" className="block font-bold text-slate-700 mb-1">Nama {newCategoryType === 'mapel' ? 'Mata Pelajaran' : 'Kelas'}</label>
                  <select
                    id="new-topic-category-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(newCategoryType === 'mapel' ? mapelOptions : kelasOptions).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Topik Diskusi *</label>
                <input
                  id="new-topic-title-input"
                  type="text"
                  required
                  placeholder="Contoh: Pertanyaan seputar Tugas Praktikum Flexbox CSS..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Tags Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tag / Kata Kunci (pisahkan dengan koma)</label>
                <input
                  id="new-topic-tags-input"
                  type="text"
                  placeholder="Contoh: CSS, Tugas, WebDev"
                  value={newTagsInput}
                  onChange={(e) => setNewTagsInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Main Content Textarea */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Isi Konten & Pertanyaan *</label>
                <textarea
                  id="new-topic-content-input"
                  required
                  rows={5}
                  placeholder="Jelaskan pertanyaan atau topik diskusi secara rinci..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed text-xs"
                ></textarea>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                <div className="flex items-center gap-2 font-bold">
                  <Paperclip className="h-4 w-4" />
                  Lampiran belum tersedia
                </div>
                <p className="mt-1 text-[11px]">Topik hanya akan menyimpan teks sampai penyimpanan dan pemindaian berkas tersedia.</p>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="submit-new-topic-btn"
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Terbitkan Topik
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* TOPIC DETAIL VIEW MODAL */}
      {activeTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            
            {/* Detail Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                    {activeTopic.categoryName}
                  </span>
                  {activeTopic.isPinned && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Pin className="w-3 h-3 fill-amber-800" /> Disematkan
                    </span>
                  )}
                  {activeTopic.isResolved && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Selesai
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {activeTopic.title}
                </h2>
              </div>

              <button 
                onClick={() => setActiveTopicId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Author Header */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <img 
                  src={activeTopic.authorAvatar} 
                  alt={activeTopic.authorName} 
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>{activeTopic.authorName}</span>
                    <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded font-bold capitalize">
                      {activeTopic.authorRole}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">{activeTopic.createdAt}</div>
                </div>
              </div>

              {/* Action Toggles for Teachers/Admin */}
              {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'guru') && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePin(activeTopic.id)}
                    className="p-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                    title="Sematkan Topik"
                  >
                    <Pin className={`w-3.5 h-3.5 ${activeTopic.isPinned ? 'text-amber-600 fill-amber-600' : 'text-slate-400'}`} />
                  </button>
                  <button
                    onClick={() => handleToggleResolve(activeTopic.id)}
                    className="p-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    title="Tandai Selesai"
                  >
                    <CheckCircle className={`w-3.5 h-3.5 ${activeTopic.isResolved ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Topic Main Content Body */}
            <div className="text-xs text-slate-800 leading-relaxed bg-white space-y-4">
              <p className="whitespace-pre-line text-sm">{activeTopic.content}</p>

              {/* Attachments list */}
              {activeTopic.attachments && activeTopic.attachments.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span>Berkas / File Terlampir ({activeTopic.attachments.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeTopic.attachments.map(att => (
                      <div 
                        key={att.id} 
                        className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-2 shadow-2xs hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="truncate">
                            <div className="font-semibold text-slate-800 text-xs truncate">{att.name}</div>
                            <div className="text-[10px] text-slate-400">{att.size}</div>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold text-amber-700">Tidak tersedia</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {activeTopic.tags.map(t => (
                  <span key={t} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Like Counter & Topic Footer */}
            <div className="flex items-center justify-between border-t border-b border-slate-100 py-3 text-xs">
              <button
                onClick={() => handleToggleLike(activeTopic.id)}
                className={`flex items-center gap-2 font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  currentUser && activeTopic.likedBy?.includes(currentUser.id)
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Sukai Topik ({activeTopic.likes})</span>
              </button>

              <div className="text-slate-500 font-semibold">
                {activeTopic.replies.length} Balasan Diskusi
              </div>
            </div>

            {/* Replies List */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span>Diskusi & Tanggapan ({activeTopic.replies.length})</span>
              </h3>

              {activeTopic.replies.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-xl text-center text-xs text-slate-500 italic">
                  Belum ada tanggapan. Jadilah yang pertama memberikan balasan pada topik ini!
                </div>
              ) : (
                <div className="space-y-3">
                  {activeTopic.replies.map((reply) => (
                    <div key={reply.id} className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img 
                            src={reply.authorAvatar} 
                            alt={reply.authorName} 
                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                          />
                          <span className="text-xs font-bold text-slate-900">{reply.authorName}</span>
                          <span className="bg-white border border-slate-200 text-slate-700 text-[9px] px-1.5 py-0.2 rounded font-bold capitalize">
                            {reply.authorRole}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">{reply.createdAt}</span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed pl-9">
                        {reply.content}
                      </p>

                      {/* Reply Attachments */}
                      {reply.attachments && reply.attachments.length > 0 && (
                        <div className="pl-9 pt-1 flex flex-wrap gap-2">
                          {reply.attachments.map(att => (
                            <div key={att.id} className="bg-white border border-slate-200 px-2 py-1 rounded text-[10px] font-medium text-blue-700 flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              <span>{att.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reply Form */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 pt-4">
              <label className="block text-xs font-bold text-slate-800">
                Tulis Balasan / Tanggapan Anda
              </label>

              <textarea
                id="reply-content-input"
                rows={3}
                placeholder={currentUser ? "Ketik balasan Anda di sini..." : "Masuk ke portal akun untuk membalas..."}
                disabled={!currentUser}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed disabled:bg-slate-100"
              ></textarea>

              {currentUser && (
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                  <span className="text-[11px] text-amber-700">Lampiran balasan belum tersedia.</span>
                  <button
                    id="submit-reply-btn"
                    onClick={() => handleAddReply(activeTopic.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer w-full sm:w-auto justify-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim Balasan</span>
                  </button>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  LayoutTemplate,
  CheckSquare,
  Copy,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Loader2,
  Clock,
  Calendar,
  Music,
  Briefcase,
  Heart,
  Star,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';

interface TaskItem {
  id: string;
  title: string;
  dueOffset: number; // days before/after event
  required: boolean;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: 'wedding' | 'corporate' | 'festival' | 'private' | 'rehearsal' | 'other';
  tasks: TaskItem[];
  band_id: string;
  is_default: boolean;
  created_at: string;
}

interface TaskTemplatesViewProps {
  onBack: () => void;
  bandId: string;
}

const CATEGORIES = {
  wedding: { label: 'Wedding', icon: Heart, color: 'bg-pink-500/10 text-pink-600' },
  corporate: { label: 'Corporate', icon: Briefcase, color: 'bg-blue-500/10 text-blue-600' },
  festival: { label: 'Festival', icon: Music, color: 'bg-purple-500/10 text-purple-600' },
  private: { label: 'Private Party', icon: Star, color: 'bg-amber-500/10 text-amber-600' },
  rehearsal: { label: 'Rehearsal', icon: Clock, color: 'bg-green-500/10 text-green-600' },
  other: { label: 'Other', icon: LayoutTemplate, color: 'bg-black/5 text-black/60' },
};

const DEFAULT_TEMPLATES: Omit<TaskTemplate, 'id' | 'band_id' | 'created_at'>[] = [
  {
    name: 'Wedding Gig Checklist',
    description: 'Complete checklist for wedding performances',
    category: 'wedding',
    is_default: true,
    tasks: [
      { id: '1', title: 'Confirm final setlist with couple', dueOffset: -14, required: true },
      { id: '2', title: 'Check venue access and load-in times', dueOffset: -7, required: true },
      { id: '3', title: 'Prepare contracts and get signatures', dueOffset: -14, required: true },
      { id: '4', title: 'Confirm sound check time', dueOffset: -3, required: true },
      { id: '5', title: 'Pack equipment checklist', dueOffset: -1, required: true },
      { id: '6', title: 'Send final invoice', dueOffset: 1, required: false },
    ],
  },
  {
    name: 'Corporate Event',
    description: 'Standard corporate gig preparation',
    category: 'corporate',
    is_default: true,
    tasks: [
      { id: '1', title: 'Review event brief', dueOffset: -7, required: true },
      { id: '2', title: 'Confirm dress code', dueOffset: -5, required: false },
      { id: '3', title: 'Check AV requirements', dueOffset: -5, required: true },
      { id: '4', title: 'Prepare invoice', dueOffset: -3, required: true },
      { id: '5', title: 'Sound check', dueOffset: 0, required: true },
    ],
  },
  {
    name: 'Festival Set',
    description: 'Festival and outdoor event checklist',
    category: 'festival',
    is_default: true,
    tasks: [
      { id: '1', title: 'Confirm stage time', dueOffset: -7, required: true },
      { id: '2', title: 'Submit tech rider', dueOffset: -14, required: true },
      { id: '3', title: 'Arrange transport', dueOffset: -5, required: true },
      { id: '4', title: 'Pack weather gear', dueOffset: -1, required: false },
      { id: '5', title: 'Collect artist passes', dueOffset: 0, required: true },
    ],
  },
  {
    name: 'Rehearsal Session',
    description: 'Pre-rehearsal preparation',
    category: 'rehearsal',
    is_default: true,
    tasks: [
      { id: '1', title: 'Share setlist with band', dueOffset: -3, required: true },
      { id: '2', title: 'Book rehearsal room', dueOffset: -7, required: true },
      { id: '3', title: 'Prepare charts/lyrics', dueOffset: -2, required: false },
      { id: '4', title: 'Check equipment', dueOffset: -1, required: true },
    ],
  },
];

export const TaskTemplatesView: React.FC<TaskTemplatesViewProps> = ({ onBack, bandId }) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  
  // Create form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<TaskTemplate['category']>('other');
  const [formTasks, setFormTasks] = useState<TaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskOffset, setNewTaskOffset] = useState(-7);
  const [newTaskRequired, setNewTaskRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCategory('other');
    setFormTasks([]);
    setNewTaskTitle('');
    setNewTaskOffset(-7);
    setNewTaskRequired(true);
  };
  
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: TaskItem = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      dueOffset: newTaskOffset,
      required: newTaskRequired,
    };
    setFormTasks([...formTasks, task]);
    setNewTaskTitle('');
    setNewTaskOffset(-7);
    setNewTaskRequired(true);
  };
  
  const handleRemoveTask = (taskId: string) => {
    setFormTasks(formTasks.filter(t => t.id !== taskId));
  };
  
  const handleSaveTemplate = async () => {
    if (!formName.trim() || formTasks.length === 0) return;
    setSaving(true);
    
    try {
      const newTemplate: TaskTemplate = {
        id: crypto.randomUUID(),
        name: formName.trim(),
        description: formDescription.trim(),
        category: formCategory,
        tasks: formTasks,
        band_id: bandId,
        is_default: false,
        created_at: new Date().toISOString(),
      };
      
      // Try to save to Supabase
      const { error } = await supabase
        .from('task_templates')
        .insert({
          id: newTemplate.id,
          name: newTemplate.name,
          description: newTemplate.description,
          category: newTemplate.category,
          tasks: newTemplate.tasks,
          band_id: bandId,
          is_default: false,
        });
      
      if (error) {
        console.error('Error saving template:', error);
      }
      
      // Add to local state
      setTemplates([newTemplate, ...templates]);
      resetForm();
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error saving template:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [bandId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_templates')
        .select('*')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      // Use default templates if table doesn't exist
      setTemplates(DEFAULT_TEMPLATES.map((t, i) => ({
        ...t,
        id: `default-${i}`,
        band_id: bandId,
        created_at: new Date().toISOString(),
      })));
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDuplicate = (template: TaskTemplate) => {
    const newTemplate: TaskTemplate = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} (Copy)`,
      is_default: false,
      created_at: new Date().toISOString(),
    };
    setTemplates([newTemplate, ...templates]);
    setMenuOpenId(null);
  };

  const handleDelete = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
    setMenuOpenId(null);
  };

  const handleEdit = (template: TaskTemplate) => {
    // Populate form with template data
    setFormName(template.name);
    setFormDescription(template.description);
    setFormCategory(template.category);
    setFormTasks([...template.tasks]);
    setShowCreateModal(true);
    setMenuOpenId(null);
  };

  const formatDueOffset = (offset: number) => {
    if (offset === 0) return 'Day of event';
    if (offset < 0) return `${Math.abs(offset)} days before`;
    return `${offset} days after`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-6 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Workflows</p>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase">TEMPLATES</h1>
            <p className="text-sm text-black/50 font-bold tracking-tight mt-1">{templates.length} templates</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-12 h-12 rounded-full bg-[#D4FB46] flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 text-black" />
            </button>
            <button
              onClick={onBack}
              className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all"
            >
              <X className="w-6 h-6 text-black/50" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white text-sm font-medium text-black placeholder:text-black/30 border border-black/5 focus:outline-none focus:border-black/20 transition-colors"
          />
        </div>
      </div>

      {/* Templates List */}
      <div className="flex-1 px-5 py-4 pb-20 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-black/40" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LayoutTemplate className="w-12 h-12 text-black/20 mb-3" />
            <p className="text-black/50 font-medium">No templates found</p>
            <p className="text-black/40 text-sm">Create your first task template</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTemplates.map((template, index) => {
              const categoryConfig = CATEGORIES[template.category];
              const CategoryIcon = categoryConfig.icon;
              
              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl p-4 relative"
                >
                  <div 
                    className="flex items-start gap-4 cursor-pointer"
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      categoryConfig.color
                    )}>
                      <CategoryIcon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-black">{template.name}</h3>
                          <p className="text-sm text-black/50 line-clamp-1">{template.description}</p>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === template.id ? null : template.id);
                          }}
                          className="p-2 -mr-2 -mt-1 rounded-lg hover:bg-black/5 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-black/40" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs text-black/40 flex items-center gap-1">
                          <CheckSquare className="w-3 h-3" />
                          {template.tasks.length} tasks
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          categoryConfig.color
                        )}>
                          {categoryConfig.label}
                        </span>
                        {template.is_default && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#D4FB46]/20 text-[#1A1A1A]">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-black/20 mt-3" />
                  </div>

                  {/* Context Menu */}
                  <AnimatePresence>
                    {menuOpenId === template.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-4 top-12 bg-white rounded-xl shadow-xl border border-black/5 overflow-hidden z-10"
                      >
                        <button
                          onClick={() => handleDuplicate(template)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-black/70 hover:bg-white/80"
                        >
                          <Copy className="w-4 h-4" />
                          Duplicate
                        </button>
                        <button
                          onClick={() => handleEdit(template)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-black/70 hover:bg-white/80"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        {!template.is_default && (
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Template Detail Modal */}
      <AnimatePresence>
        {selectedTemplate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[80]"
              onClick={() => setSelectedTemplate(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-black">{selectedTemplate.name}</h2>
                    <p className="text-sm text-black/50">{selectedTemplate.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center"
                  >
                    <X className="w-5 h-5 text-black/60" />
                  </button>
                </div>

                <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3">
                  Tasks ({selectedTemplate.tasks.length})
                </h3>
                
                <div className="space-y-3">
                  {selectedTemplate.tasks.map((task, i) => (
                    <div 
                      key={task.id}
                      className="flex items-center gap-4 p-4 bg-white/50 rounded-xl"
                    >
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-bold text-black/40">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-black">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-black/40 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDueOffset(task.dueOffset)}
                          </span>
                          {task.required && (
                            <span className="text-xs text-red-500 font-medium">Required</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="w-full h-14 rounded-full bg-[#D4FB46] text-black font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 mt-6 active:scale-[0.98] transition-all"
                >
                  <Copy className="w-5 h-5" />
                  Use This Template
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Modal - Swiss Editorial Fullscreen */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#E6E5E1]"
          >
            {/* Header */}
            <div 
              className="px-6 pt-6 pb-4 flex-shrink-0"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Task Templates</p>
                  <h1 className="text-4xl font-black text-black tracking-tight">CREATE</h1>
                  <p className="text-sm text-black/50 mt-1">Build your workflow</p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
                >
                  <X className="w-5 h-5 text-black" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-32">
              <div className="space-y-6">
                {/* Template Name */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">Template Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Festival Preparation"
                    className="w-full bg-white/50 border-b-2 border-black/10 py-4 px-0 text-xl font-medium text-black placeholder:text-black/30 focus:outline-none focus:border-black transition-colors"
                  />
                </motion.div>
                
                {/* Description */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Short description of this template"
                    className="w-full bg-white/50 border-b-2 border-black/10 py-3 px-0 text-base font-medium text-black placeholder:text-black/30 focus:outline-none focus:border-black transition-colors"
                  />
                </motion.div>
                
                {/* Category */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-3">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {(['gig', 'rehearsal', 'meeting', 'other'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFormCategory(cat)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all",
                          formCategory === cat
                            ? "bg-black text-white"
                            : "bg-white/50 text-black/50 hover:bg-white"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </motion.div>
                
                {/* Tasks */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-3">Tasks ({formTasks.length})</label>
                  
                  {/* Tasks List */}
                  <div className="space-y-2 mb-4">
                    {formTasks.map((task, index) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 bg-white rounded-2xl flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-xs font-bold text-black/40">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-black">{task.title}</p>
                          <p className="text-xs text-black/50">{formatDueOffset(task.dueOffset)} {task.required && '• Required'}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveTask(task.id)}
                          className="w-8 h-8 rounded-full hover:bg-red-100 flex items-center justify-center transition-colors"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Add Task */}
                  <div className="p-4 bg-white/50 rounded-2xl border-2 border-dashed border-black/10 space-y-3">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="New task title..."
                      className="w-full bg-transparent text-base font-medium text-black placeholder:text-black/30 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    />
                    <div className="flex items-center gap-3">
                      <select
                        value={newTaskOffset}
                        onChange={(e) => setNewTaskOffset(parseInt(e.target.value))}
                        className="flex-1 bg-white rounded-xl px-3 py-2 text-sm font-medium text-black outline-none"
                      >
                        <option value={-14}>14 days before</option>
                        <option value={-7}>7 days before</option>
                        <option value={-3}>3 days before</option>
                        <option value={-1}>1 day before</option>
                        <option value={0}>Day of event</option>
                        <option value={1}>1 day after</option>
                      </select>
                      <button
                        onClick={() => setNewTaskRequired(!newTaskRequired)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                          newTaskRequired ? "bg-[#D4FB46] text-black" : "bg-black/10 text-black/40"
                        )}
                      >
                        {newTaskRequired ? 'Required' : 'Optional'}
                      </button>
                      <button
                        onClick={handleAddTask}
                        disabled={!newTaskTitle.trim()}
                        className="w-10 h-10 rounded-full bg-black flex items-center justify-center disabled:opacity-30 transition-opacity"
                      >
                        <Plus className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-4 bg-gradient-to-t from-[#E6E5E1] via-[#E6E5E1] to-transparent"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
            >
              <button
                onClick={handleSaveTemplate}
                disabled={!formName.trim() || formTasks.length === 0 || saving}
                className="w-full h-14 rounded-full bg-black text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.98] transition-all"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckSquare className="w-5 h-5" />
                    Create Template
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TaskTemplatesView;

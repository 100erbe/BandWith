import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  LayoutTemplate,
  CheckSquare,
  Copy,
  MoreHorizontal,
  Edit2,
  Trash2,
  X,
  Loader2,
  Calendar,
  ArrowLeft,
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

const CATEGORIES: Record<string, { label: string }> = {
  wedding: { label: 'Wedding' },
  corporate: { label: 'Corporate' },
  festival: { label: 'Festival' },
  private: { label: 'Private Party' },
  rehearsal: { label: 'Rehearsal' },
  other: { label: 'Other' },
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
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto overflow-x-hidden flex flex-col"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      {/* Header */}
      <div className="px-4 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
            style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
          >
            <ArrowLeft className="w-[24px] h-[24px] text-black" />
          </button>
          <div className="flex flex-col leading-none flex-1">
            <span className="text-[32px] font-bold text-black leading-none">TASK</span>
            <span className="text-[32px] font-bold text-black leading-none">TEMPLATES</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center bg-[#D5FB46] shrink-0 active:scale-90 transition-transform"
          >
            <Plus className="w-[20px] h-[20px] text-black" />
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-transparent border-b-2 border-black/10 py-3 text-sm font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-colors"
          />
        </div>
      </div>

      {/* Templates List */}
      <div className="flex-1 px-4 pb-20 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-black/30" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <LayoutTemplate className="w-12 h-12 text-black/15 mb-3" />
            <span className="text-xs font-bold text-black/40 uppercase tracking-wide mb-1">No templates found</span>
            <span className="text-[10px] font-medium text-black/30 uppercase">Create your first task template</span>
          </div>
        ) : (
          <>
            {/* Section Title */}
            <div className="flex flex-col mb-5">
              <span className="text-[32px] font-bold leading-none text-black">ALL</span>
              <span className="text-[32px] font-bold leading-none text-black">TEMPLATES</span>
            </div>

            <div className="flex flex-col gap-0">
              {filteredTemplates.map((template, index) => {
                const categoryConfig = CATEGORIES[template.category];
                
                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="relative"
                  >
                    <div
                      className="flex items-center justify-between py-4 border-b border-black/10 cursor-pointer active:opacity-70 transition-opacity"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-[10px] bg-[#CDCACA] flex items-center justify-center shrink-0">
                          <CheckSquare className="w-5 h-5 text-black/50" />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-xs font-bold text-black uppercase tracking-wide truncate max-w-full">{template.name}</span>
                          <span className="text-[10px] font-medium text-black/40 uppercase">
                            {template.tasks.length} TASKS · {categoryConfig.label}
                            {template.is_default ? ' · DEFAULT' : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === template.id ? null : template.id);
                        }}
                        className="w-8 h-8 flex items-center justify-center active:opacity-70 transition-opacity shrink-0"
                      >
                        <MoreHorizontal className="w-4 h-4 text-black" />
                      </button>
                    </div>

                    {/* Inline Action Menu */}
                    <AnimatePresence>
                      {menuOpenId === template.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden border-b border-black/10"
                        >
                          <div className="py-2 flex flex-col gap-0">
                            <button
                              onClick={() => handleDuplicate(template)}
                              className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                            >
                              <Copy className="w-4 h-4 text-black/40" />
                              <span className="text-xs font-bold text-black uppercase tracking-wide">DUPLICATE</span>
                            </button>
                            <button
                              onClick={() => handleEdit(template)}
                              className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                            >
                              <Edit2 className="w-4 h-4 text-black/40" />
                              <span className="text-xs font-bold text-black uppercase tracking-wide">EDIT</span>
                            </button>
                            {!template.is_default && (
                              <button
                                onClick={() => handleDelete(template.id)}
                                className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4 text-[#A73131]" />
                                <span className="text-xs font-bold text-[#A73131] uppercase tracking-wide">DELETE</span>
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </>
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
              className="px-4 shrink-0"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
            >
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
                  style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
                >
                  <ArrowLeft className="w-[24px] h-[24px] text-black" />
                </button>
                <div className="flex flex-col leading-none">
                  <span className="text-[32px] font-bold text-black leading-none">CREATE</span>
                  <span className="text-[32px] font-bold text-black leading-none">TEMPLATE</span>
                </div>
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

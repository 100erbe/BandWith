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
  Search,
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
  const [formCategory, setFormCategory] = useState<string>('other');
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
    if (!formName.trim() || formTasks.length === 0 || saving) return;
    setSaving(true);
    
    try {
      const newTemplate: TaskTemplate = {
        id: crypto.randomUUID(),
        name: formName.trim(),
        description: formDescription.trim(),
        category: formCategory as any,
        tasks: formTasks,
        band_id: bandId,
        is_default: false,
        created_at: new Date().toISOString(),
      };
      
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
      className="fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
      style={{
        overscrollBehaviorX: 'none',
        touchAction: 'pan-y',
      }}
    >
      {/* ═══ STICKY HEADER ═══ */}
      <div
        className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingBottom: '14px',
        }}
      >
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Go back"
              className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground transition-all active:scale-90 shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                WORKFLOWS & CHECKLISTS
              </span>
              <h1 className="text-[22px] font-black uppercase text-foreground leading-none">
                TASK TEMPLATES
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs active:scale-95 transition-all shrink-0"
            aria-label="Create template"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="p-4 flex-1 flex flex-col gap-5 max-w-2xl mx-auto w-full pb-32">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by name or description..."
            className="w-full px-4 py-2.5 pl-10 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
        </div>

        {/* Templates List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-foreground/40 border border-dashed border-foreground/15 rounded-[16px] p-8">
            <LayoutTemplate className="w-12 h-12 text-foreground/20 mb-3" />
            <h3 className="text-base font-bold text-foreground mb-1">No templates found</h3>
            <p className="text-xs text-foreground/50 max-w-xs mb-5">
              Create reusable checklists for gigs, weddings, rehearsals, or festival setups.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-[10px] font-bold text-xs uppercase tracking-wider shadow-xs hover:opacity-95 transition-opacity"
            >
              Create First Template
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                TEMPLATES ({filteredTemplates.length})
              </span>
            </div>

            <div className="space-y-2.5">
              {filteredTemplates.map((template, index) => {
                const categoryConfig = CATEGORIES[template.category] || { label: template.category };
                
                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3) }}
                    className="bg-card rounded-[14px] p-4 border border-foreground/10 shadow-xs flex items-center justify-between hover:border-foreground/20 transition-all cursor-pointer group"
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-[10px] bg-foreground/5 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/10 transition-colors">
                        <CheckSquare className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground truncate">{template.name}</h3>
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-[6px] border bg-foreground/5 text-foreground/60 border-foreground/10 shrink-0">
                            {categoryConfig.label}
                          </span>
                          {template.is_default && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-[6px] border bg-primary/10 text-primary border-primary/20 shrink-0">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-foreground/50 truncate mt-0.5">
                          {template.tasks.length} tasks · {template.description}
                        </p>
                      </div>
                    </div>

                    <div className="relative shrink-0 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === template.id ? null : template.id);
                        }}
                        aria-label="Actions"
                        className="w-8 h-8 rounded-full hover:bg-foreground/10 flex items-center justify-center text-foreground/50 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <AnimatePresence>
                        {menuOpenId === template.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-9 bg-card rounded-[12px] shadow-lg border border-foreground/15 p-1 z-20 min-w-[140px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleDuplicate(template)}
                              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-foreground/5 rounded-[8px] text-left text-xs font-semibold text-foreground transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5 text-foreground/60" /> Duplicate
                            </button>
                            <button
                              onClick={() => handleEdit(template)}
                              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-foreground/5 rounded-[8px] text-left text-xs font-semibold text-foreground transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-foreground/60" /> Edit
                            </button>
                            {!template.is_default && (
                              <button
                                onClick={() => handleDelete(template.id)}
                                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-destructive/10 rounded-[8px] text-left text-xs font-semibold text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ TEMPLATE DETAIL BOTTOM SHEET ═══ */}
      <AnimatePresence>
        {selectedTemplate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
              onClick={() => setSelectedTemplate(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed inset-x-0 bottom-0 z-[90] bg-card rounded-t-[24px] max-h-[85vh] overflow-y-auto border-t border-foreground/10 shadow-2xl text-foreground"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
            >
              <div className="max-w-xl mx-auto w-full p-6">
                <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-5" />
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider block mb-1">
                      TEMPLATE DETAILS
                    </span>
                    <h2 className="text-xl font-black text-foreground">{selectedTemplate.name}</h2>
                    <p className="text-xs text-foreground/50 mt-0.5">{selectedTemplate.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="w-8 h-8 rounded-full border border-foreground/20 bg-foreground/5 flex items-center justify-center text-foreground hover:bg-foreground/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                    TASKS ({selectedTemplate.tasks.length})
                  </span>
                </div>
                
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {selectedTemplate.tasks.map((task, i) => (
                    <div 
                      key={task.id}
                      className="flex items-center gap-3 p-3 bg-foreground/5 rounded-[12px] border border-foreground/5"
                    >
                      <div className="w-6 h-6 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs text-foreground truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-foreground/50 flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3" />
                            {formatDueOffset(task.dueOffset)}
                          </span>
                          {task.required && (
                            <span className="text-[9px] font-bold text-red-500 uppercase">Required</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="w-full h-12 rounded-[12px] bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 mt-5 shadow-xs active:scale-[0.98] transition-all"
                >
                  <Copy className="w-4 h-4" />
                  Use This Template
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ CREATE TEMPLATE MODAL ═══ */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background text-foreground"
          >
            {/* Header */}
            <div
              className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
              style={{
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                paddingBottom: '14px',
              }}
            >
              <div className="max-w-xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground transition-all active:scale-90 shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                      NEW TEMPLATE
                    </span>
                    <h2 className="text-[20px] font-black uppercase text-foreground leading-none">
                      CREATE TEMPLATE
                    </h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-6 max-w-xl mx-auto w-full pb-32 space-y-5">
              {/* Template Name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Festival Preparation Checklist"
                  className="w-full px-4 py-3 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g., Gear packing and stage protocol"
                  className="w-full px-4 py-3 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              
              {/* Category */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['wedding', 'corporate', 'festival', 'private', 'rehearsal', 'other'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={cn(
                        'px-3.5 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-all border',
                        formCategory === cat
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-foreground/5 text-foreground/70 border-foreground/10 hover:bg-foreground/10'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Tasks List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                    Tasks ({formTasks.length})
                  </label>
                </div>
                
                {formTasks.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {formTasks.map((task, index) => (
                      <div
                        key={task.id}
                        className="p-3 bg-card border border-foreground/10 rounded-[12px] flex items-center gap-3 shadow-xs"
                      >
                        <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate">{task.title}</p>
                          <p className="text-[10px] text-foreground/50 mt-0.5">
                            {formatDueOffset(task.dueOffset)} {task.required ? '• Required' : '• Optional'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTask(task.id)}
                          className="w-7 h-7 rounded-full hover:bg-destructive/10 text-foreground/40 hover:text-destructive flex items-center justify-center transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add Task Box */}
                <div className="p-3.5 bg-foreground/5 rounded-[12px] border border-dashed border-foreground/15 space-y-3">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="New task title..."
                    className="w-full px-3 py-2 rounded-[8px] bg-background border border-foreground/10 text-xs font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTask())}
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newTaskOffset}
                      onChange={(e) => setNewTaskOffset(parseInt(e.target.value))}
                      className="flex-1 bg-background border border-foreground/10 rounded-[8px] px-2.5 py-1.5 text-xs font-medium text-foreground outline-none"
                    >
                      <option value={-14}>14 days before</option>
                      <option value={-7}>7 days before</option>
                      <option value={-3}>3 days before</option>
                      <option value={-1}>1 day before</option>
                      <option value={0}>Day of event</option>
                      <option value={1}>1 day after</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setNewTaskRequired(!newTaskRequired)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-[8px] text-[10px] font-bold uppercase tracking-wider transition-all border',
                        newTaskRequired 
                          ? 'bg-primary/10 text-primary border-primary/20' 
                          : 'bg-background text-foreground/50 border-foreground/10'
                      )}
                    >
                      {newTaskRequired ? 'Required' : 'Optional'}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddTask}
                      disabled={!newTaskTitle.trim()}
                      className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0 shadow-xs"
                      aria-label="Add task item"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="sticky bottom-0 left-0 right-0 px-4 py-4 border-t border-foreground/10 bg-background/95 backdrop-blur-md"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            >
              <div className="max-w-xl mx-auto w-full">
                <button
                  onClick={handleSaveTemplate}
                  disabled={!formName.trim() || formTasks.length === 0 || saving}
                  className="w-full h-12 rounded-[12px] bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      Create Template ({formTasks.length} tasks)
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TaskTemplatesView;
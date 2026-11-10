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
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';
import { ScreenHeader, IconButton, SearchField, Card, Tag, BwSheet, type TagStyle } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector } from '@/app/components/bw/Form';

interface TaskItem {
  id: string;
  title: string;
  /** Days before (<0) / after (>0) the event. Older rows may not have it. */
  dueOffset?: number;
  required?: boolean;
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

/** Category tag colours follow the event palette (Figma: Templates / Task templates). */
const CATEGORIES: Record<string, { label: string; tag: TagStyle }> = {
  wedding: { label: 'Wedding', tag: 'gig' },
  corporate: { label: 'Corporate', tag: 'quote' },
  festival: { label: 'Festival', tag: 'personal' },
  private: { label: 'Private party', tag: 'outline' },
  rehearsal: { label: 'Rehearsal', tag: 'rehearsal' },
  other: { label: 'Other', tag: 'subtle' },
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
      setTemplates(
        (data || []).map((t: any) => ({
          ...t,
          description: t.description ?? '',
          tasks: (Array.isArray(t.tasks) ? t.tasks : []).map((task: any, i: number) => ({
            id: task.id ?? `${t.id}-${i}`,
            title: task.title ?? '',
            dueOffset: task.dueOffset ?? task.due_offset ?? undefined,
            required: task.required ?? false,
          })),
        })),
      );
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

  const formatDueOffset = (offset?: number | null) => {
    if (offset == null || Number.isNaN(Number(offset))) return null;
    const n = Number(offset);
    if (n === 0) return 'Day of event';
    const days = Math.abs(n) === 1 ? 'day' : 'days';
    return n < 0 ? `${Math.abs(n)} ${days} before` : `${n} ${days} after`;
  };

  const offsetOptions = [
    { value: -14, label: '14 days before' },
    { value: -7, label: '7 days before' },
    { value: -3, label: '3 days before' },
    { value: -1, label: '1 day before' },
    { value: 0, label: 'Day of event' },
    { value: 1, label: '1 day after' },
  ];

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      <ScreenHeader
        sticky
        onBack={onBack}
        overline="Workflows & checklists"
        title="Task templates"
        actions={
          <IconButton label="Create template" variant="filled" icon={<Plus />} onClick={() => setShowCreateModal(true)} />
        }
      />

      <div className="flex-1 flex flex-col gap-4 px-4 pt-4 max-w-2xl mx-auto w-full" style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
        <SearchField value={searchQuery} onChange={setSearchQuery} label="Search templates" placeholder="Search templates…" />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="items-center text-center py-10 gap-4">
            <LayoutTemplate className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">{searchQuery ? 'No matches' : 'No templates yet'}</h2>
              <p className="bw-body-sm text-muted-foreground max-w-xs">
                {searchQuery
                  ? 'Try another name or description.'
                  : 'Create reusable checklists for gigs, weddings, rehearsals or festival setups.'}
              </p>
            </div>
            {!searchQuery && (
              <PillButton size="md" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
                Create template
              </PillButton>
            )}
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {filteredTemplates.map((template, index) => {
              const category = CATEGORIES[template.category] || { label: template.category, tag: 'subtle' as TagStyle };
              const summary = [`${template.tasks.length} ${template.tasks.length === 1 ? 'task' : 'tasks'}`, template.description]
                .filter(Boolean)
                .join(' · ');
              return (
                <motion.li
                  key={template.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="relative"
                >
                  <Card className="relative">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <Tag variant={category.tag}>{category.label}</Tag>
                        {template.is_default && <Tag variant="solid">Default</Tag>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === template.id ? null : template.id)}
                        aria-label={`Actions for ${template.name}`}
                        aria-expanded={menuOpenId === template.id}
                        className="relative z-10 -m-3 p-3 text-foreground"
                      >
                        <MoreHorizontal className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate(template)}
                      className="text-left flex flex-col gap-3 after:absolute after:inset-0 after:rounded-[24px] after:content-['']"
                    >
                      <h3 className="bw-h3 text-foreground [overflow-wrap:anywhere]">{template.name}</h3>
                      <p className="bw-body-sm text-muted-foreground line-clamp-2">{summary}</p>
                    </button>
                  </Card>

                  <AnimatePresence>
                    {menuOpenId === template.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-3 top-11 z-20 min-w-[168px] p-1 rounded-[16px] bg-popover text-popover-foreground shadow-lg border border-border origin-top-right"
                        role="menu"
                      >
                        {[
                          { label: 'Duplicate', icon: <Copy className="w-4 h-4" />, run: () => handleDuplicate(template) },
                          { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, run: () => handleEdit(template) },
                          ...(!template.is_default
                            ? [{ label: 'Delete', icon: <Trash2 className="w-4 h-4" />, run: () => handleDelete(template.id), danger: true }]
                            : []),
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={item.run}
                            className={cn(
                              'w-full h-11 px-3 flex items-center gap-3 rounded-[12px] bw-body-sm font-medium text-left hover:bg-foreground/[0.06]',
                              'danger' in item && item.danger ? 'text-destructive' : 'text-foreground',
                            )}
                          >
                            {item.icon}
                            {item.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Template details (Figma Sheet, Style=Dark) */}
      <BwSheet
        open={!!selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        overline="Template details"
        title={selectedTemplate?.name ?? ''}
        footer={
          <PillButton icon={<Copy className="w-[18px] h-[18px]" />} onClick={() => setSelectedTemplate(null)}>
            Use this template
          </PillButton>
        }
      >
        {selectedTemplate && (
          <div className="flex flex-col gap-4">
            {selectedTemplate.description && <p className="bw-body-md text-sheet-foreground/80">{selectedTemplate.description}</p>}
            <p className="bw-label-sm text-sheet-foreground/85">Tasks ({selectedTemplate.tasks.length})</p>
            <ol className="flex flex-col gap-2">
              {selectedTemplate.tasks.map((task, i) => {
                const due = formatDueOffset(task.dueOffset);
                return (
                  <li key={task.id} className="flex items-center gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
                    <span className="w-8 h-8 rounded-full border-[1.5px] border-sheet-foreground/40 flex items-center justify-center bw-label-sm shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <p className="bw-body-lg [overflow-wrap:anywhere]">{task.title}</p>
                      {(due || task.required) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {due && (
                            <span className="bw-body-sm text-sheet-foreground/70 inline-flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {due}
                            </span>
                          )}
                          {task.required && <Tag variant="accent">Required</Tag>}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </BwSheet>

      {/* Create template — full screen */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground"
          >
            <ScreenHeader
              onBack={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              overline="New template"
              title="Create template"
              titleSize="h1"
            />

            <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8 max-w-xl mx-auto w-full flex flex-col gap-6">
              <PillField
                label="Template name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Festival preparation"
              />
              <PillField
                label="Description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Gear packing and stage protocol"
              />

              <fieldset className="flex flex-col gap-2">
                <legend className="bw-label-sm text-muted-foreground mb-2">Category</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((cat) => (
                    <Selector key={cat} size="md" selected={formCategory === cat} onClick={() => setFormCategory(cat)}>
                      {CATEGORIES[cat].label}
                    </Selector>
                  ))}
                </div>
              </fieldset>

              <section className="flex flex-col gap-3">
                <h2 className="bw-label-sm text-muted-foreground">Tasks ({formTasks.length})</h2>
                {formTasks.length > 0 && (
                  <ol className="flex flex-col gap-2">
                    {formTasks.map((task, index) => (
                      <li key={task.id} className="flex items-center gap-3 p-4 rounded-[16px] bg-card">
                        <span className="w-8 h-8 rounded-full border-[1.5px] border-foreground/30 flex items-center justify-center bw-label-sm shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <p className="bw-body-lg [overflow-wrap:anywhere]">{task.title}</p>
                          <p className="bw-body-sm text-muted-foreground">
                            {[formatDueOffset(task.dueOffset), task.required ? 'Required' : 'Optional'].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <IconButton label={`Remove ${task.title}`} variant="ghost" size="sm" icon={<X />} onClick={() => handleRemoveTask(task.id)} />
                      </li>
                    ))}
                  </ol>
                )}

                <Card className="gap-4">
                  <PillField
                    label="New task"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Charge in-ears"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTask())}
                  />
                  <div className="flex flex-col gap-2">
                    <p className="bw-label-sm text-muted-foreground">Due</p>
                    <div className="flex flex-wrap gap-2">
                      {offsetOptions.map((o) => (
                        <Selector key={o.value} selected={newTaskOffset === o.value} onClick={() => setNewTaskOffset(o.value)}>
                          {o.label}
                        </Selector>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Selector size="md" selected={newTaskRequired} onClick={() => setNewTaskRequired(!newTaskRequired)}>
                      {newTaskRequired ? 'Required' : 'Optional'}
                    </Selector>
                    <div className="flex-1" />
                    <PillButton size="md" variant="dark" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
                      Add task
                    </PillButton>
                  </div>
                </Card>
              </section>
            </div>

            <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
              <div className="max-w-xl mx-auto w-full">
                <PillButton
                  onClick={handleSaveTemplate}
                  loading={saving}
                  disabled={!formName.trim() || formTasks.length === 0}
                  icon={<CheckSquare className="w-[18px] h-[18px]" />}
                >
                  Create template ({formTasks.length} {formTasks.length === 1 ? 'task' : 'tasks'})
                </PillButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TaskTemplatesView;
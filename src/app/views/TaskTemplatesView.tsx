import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  Sparkles,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { ScreenHeader, IconButton, SearchField, Card, Tag, BwSheet, type TagStyle } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector, FormError } from '@/app/components/bw/Form';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  insertStarterTemplates,
  listTemplates,
  updateTemplate,
  type TaskTemplate,
  type TemplateCategory,
  type TemplateTask,
} from '@/lib/services/taskTemplates';
import { DeleteChatSheet } from '@/app/components/chat/DeleteChatSheet';
import { UseTemplateSheet, type TemplateTargetEvent, type TemplateTargetKind } from '@/app/components/templates/UseTemplateSheet';
import { useT } from '@/lib/i18n';

export type { TaskTemplate, TemplateTask } from '@/lib/services/taskTemplates';

type TaskItem = TemplateTask;

interface TaskTemplatesViewProps {
  onBack: () => void;
  bandId: string;
  /**
   * "Use this template" in the details sheet. The parent opens the matching
   * create flow pre-filled with `template.tasks`. The sheet closes either way.
   */
  onUseTemplate?: (template: TaskTemplate, kind: TemplateTargetKind) => void;
  /** The band's upcoming gigs, rehearsals and quotes ("Add to an existing one"). */
  events?: TemplateTargetEvent[];
  userId?: string | null;
  /** Feedback after the tasks were added to an existing event or draft. */
  onNotify?: (message: string) => void;
  /** Only active admins write templates (migration 074); members read them. Defaults to true. */
  canEdit?: boolean;
}

/** Category tag colours follow the event palette (Figma: Templates / Task templates). */
const CATEGORIES: Record<TemplateCategory, { label: string; tag: TagStyle }> = {
  wedding: { label: 'Wedding', tag: 'gig' },
  corporate: { label: 'Corporate', tag: 'quote' },
  festival: { label: 'Festival', tag: 'personal' },
  private: { label: 'Private party', tag: 'outline' },
  rehearsal: { label: 'Rehearsal', tag: 'rehearsal' },
  other: { label: 'Other', tag: 'subtle' },
};

export const TaskTemplatesView: React.FC<TaskTemplatesViewProps> = ({ onBack, bandId, onUseTemplate, events = [], userId, onNotify, canEdit = true }) => {
  const t = useT();
  const categoryLabel: Record<TemplateCategory, string> = {
    wedding: t('Wedding'),
    corporate: t('Corporate'),
    festival: t('Festival'),
    private: t('Private party'),
    rehearsal: t('Rehearsal'),
    other: t('Other'),
  };
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  /** "Use this list" choices (new gig / rehearsal / quote, or add to one). */
  const [usingTemplate, setUsingTemplate] = useState<TaskTemplate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Create / edit form state (`editingId` set = editing an existing row)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<TemplateCategory>('other');
  const [formTasks, setFormTasks] = useState<TaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskOffset, setNewTaskOffset] = useState(-7);
  const [newTaskRequired, setNewTaskRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormCategory('other');
    setFormTasks([]);
    setNewTaskTitle('');
    setNewTaskOffset(-7);
    setNewTaskRequired(true);
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowCreateModal(false);
    resetForm();
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
    setFormTasks(formTasks.filter(task => task.id !== taskId));
  };

  // A task typed in the field but not yet added with "Add task" is saved too.
  const pendingTask: TaskItem | null = newTaskTitle.trim()
    ? { id: 'pending', title: newTaskTitle.trim(), dueOffset: newTaskOffset, required: newTaskRequired }
    : null;
  const tasksToSave = pendingTask ? [...formTasks, pendingTask] : formTasks;

  const handleSaveTemplate = async () => {
    if (!formName.trim() || tasksToSave.length === 0 || saving) return;
    setSaving(true);
    setFormError(null);
    const tasks = tasksToSave.map((task) => (task.id === 'pending' ? { ...task, id: crypto.randomUUID() } : task));
    const input = { name: formName, description: formDescription, category: formCategory, tasks };
    const { data, error } = editingId ? await updateTemplate(editingId, input) : await createTemplate(bandId, input);
    setSaving(false);
    if (error || !data) {
      setFormError(error?.message || t('Could not save the list.'));
      return;
    }
    setTemplates((prev) => (editingId ? prev.map((tpl) => (tpl.id === data.id ? data : tpl)) : [data, ...prev]));
    setSelectedTemplate((cur) => (cur && cur.id === data.id ? data : cur));
    setShowCreateModal(false);
    resetForm();
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await listTemplates(bandId);
    if (error) setLoadError(error.message);
    else setTemplates(data || []);
    setLoading(false);
  }, [bandId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleAddStarters = async () => {
    if (seeding) return;
    setSeeding(true);
    setListError(null);
    const { data, error } = await insertStarterTemplates(bandId);
    setSeeding(false);
    if (error || !data) {
      setListError(error?.message || t('Could not add the starter lists.'));
      return;
    }
    setTemplates((prev) => [...data, ...prev]);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDuplicate = async (template: TaskTemplate) => {
    setMenuOpenId(null);
    if (busyId) return;
    setBusyId(template.id);
    setListError(null);
    const { data, error } = await duplicateTemplate(template);
    setBusyId(null);
    if (error || !data) {
      setListError(`${t('Couldn\'t duplicate "{name}".', { name: template.name })} ${error?.message ?? ''}`.trim());
      return;
    }
    setTemplates((prev) => [data, ...prev]);
  };

  const [pendingDelete, setPendingDelete] = useState<TaskTemplate | null>(null);

  const handleDelete = async (template: TaskTemplate) => {
    setMenuOpenId(null);
    if (busyId) return;
    setBusyId(template.id);
    setListError(null);
    const { error } = await deleteTemplate(template.id);
    setBusyId(null);
    setPendingDelete(null);
    if (error) {
      setListError(`${t('Couldn\'t delete "{name}".', { name: template.name })} ${error.message}`);
      return;
    }
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== template.id));
    setSelectedTemplate((cur) => (cur && cur.id === template.id ? null : cur));
  };

  const handleEdit = (template: TaskTemplate) => {
    resetForm();
    setEditingId(template.id);
    setFormName(template.name);
    setFormDescription(template.description);
    setFormCategory(template.category);
    setFormTasks(template.tasks.map((task) => ({ ...task })));
    setShowCreateModal(true);
    setMenuOpenId(null);
  };

  const handleUseTemplate = () => {
    const template = selectedTemplate;
    setSelectedTemplate(null);
    if (template) setUsingTemplate(template);
  };

  const formatDueOffset = (offset?: number | null) => {
    if (offset == null || Number.isNaN(Number(offset))) return null;
    const n = Number(offset);
    if (n === 0) return t('Day of event');
    const count = Math.abs(n);
    if (n < 0) return count === 1 ? t('{count} day before', { count }) : t('{count} days before', { count });
    return count === 1 ? t('{count} day after', { count }) : t('{count} days after', { count });
  };

  const offsetOptions = [
    { value: -14, label: t('{count} days before', { count: 14 }) },
    { value: -7, label: t('{count} days before', { count: 7 }) },
    { value: -3, label: t('{count} days before', { count: 3 }) },
    { value: -1, label: t('{count} day before', { count: 1 }) },
    { value: 0, label: t('Day of event') },
    { value: 1, label: t('{count} day after', { count: 1 }) },
  ];

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-hub fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      <ScreenHeader
        sticky
        onBack={onBack}
        overline={t('Workflows & checklists')}
        title={t('To-do lists')}
        actions={
          canEdit ? <IconButton label={t('New to-do list')} variant="filled" icon={<Plus />} onClick={openCreate} /> : undefined
        }
      />

      <div className="flex-1 flex flex-col gap-4 px-4 pt-4 max-w-2xl mx-auto w-full" style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
        <SearchField value={searchQuery} onChange={setSearchQuery} label={t('Search to-do lists')} placeholder={t('Search to-do lists…')} />

        {listError && <FormError>{listError}</FormError>}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <Card className="items-center text-center py-10 gap-4" role="alert">
            <LayoutTemplate className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">{t("Couldn't load the to-do lists")}</h2>
              <p className="bw-body-sm text-muted-foreground max-w-xs [overflow-wrap:anywhere]">{loadError}</p>
            </div>
            <PillButton size="md" fullWidth={false} icon={<RefreshCw className="w-4 h-4" />} onClick={loadTemplates}>
              {t('Try again')}
            </PillButton>
          </Card>
        ) : filteredTemplates.length === 0 ? (
          <Card className="items-center text-center py-10 gap-4">
            <LayoutTemplate className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">{searchQuery ? t('No matches') : t('No to-do lists yet')}</h2>
              <p className="bw-body-sm text-muted-foreground max-w-xs">
                {searchQuery
                  ? t('Try another name or description.')
                  : t('Create reusable checklists for gigs, weddings, rehearsals or festival setups.')}
              </p>
            </div>
            {!searchQuery && canEdit && (
              <div className="flex flex-wrap justify-center gap-2">
                <PillButton size="md" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
                  {t('New to-do list')}
                </PillButton>
                <PillButton
                  size="md"
                  variant="outline"
                  fullWidth={false}
                  icon={<Sparkles className="w-4 h-4" />}
                  loading={seeding}
                  onClick={handleAddStarters}
                >
                  {t('Add starter lists')}
                </PillButton>
              </div>
            )}
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {filteredTemplates.map((template, index) => {
              const category = CATEGORIES[template.category] || { label: template.category, tag: 'subtle' as TagStyle };
              const summary = [template.tasks.length === 1 ? t('{count} task', { count: 1 }) : t('{count} tasks', { count: template.tasks.length }), template.description]
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
                        <Tag variant={category.tag}>{categoryLabel[template.category] ?? category.label}</Tag>
                        {template.is_default && <Tag variant="solid">{t('Default')}</Tag>}
                      </div>
                      {canEdit && <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === template.id ? null : template.id)}
                        aria-label={t('Actions for {name}', { name: template.name })}
                        aria-expanded={menuOpenId === template.id}
                        disabled={busyId === template.id}
                        className="relative z-10 -m-3 p-3 text-foreground"
                      >
                        {busyId === template.id ? (
                          <Loader2 className="w-[18px] h-[18px] animate-spin" />
                        ) : (
                          <MoreHorizontal className="w-[18px] h-[18px]" />
                        )}
                      </button>}
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
                          { label: t('Duplicate'), icon: <Copy className="w-4 h-4" />, run: () => handleDuplicate(template) },
                          { label: t('Edit'), icon: <Edit2 className="w-4 h-4" />, run: () => handleEdit(template) },
                          ...(!template.is_default
                            ? [{ label: t('Delete'), icon: <Trash2 className="w-4 h-4" />, run: () => { setMenuOpenId(null); setPendingDelete(template); }, danger: true }]
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
      {/* Portal: inside this screen (its own z-70 layer, a scroller) the sheet
          sat under other layers and iOS gave its X and drag no touches. */}
      <BwSheet
        open={!!selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        portal
        zIndex={110}
        overline={t('To-do list')}
        title={selectedTemplate?.name ?? ''}
        footer={
          canEdit ? (
            <PillButton icon={<Copy className="w-[18px] h-[18px]" />} onClick={handleUseTemplate}>
              {t('Use this list')}
            </PillButton>
          ) : undefined
        }
      >
        {selectedTemplate && (
          <div className="flex flex-col gap-4">
            {selectedTemplate.description && <p className="bw-body-md text-sheet-foreground/80">{selectedTemplate.description}</p>}
            <p className="bw-label-sm text-sheet-foreground/85">{t('Tasks ({count})', { count: selectedTemplate.tasks.length })}</p>
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
                          {task.required && <Tag variant="accent">{t('Required')}</Tag>}
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
            className="bw-pane-detail fixed inset-0 z-[100] flex flex-col bg-background text-foreground"
          >
            <ScreenHeader
                pane
              onBack={closeForm}
              overline={editingId ? t('To-do list') : t('New to-do list')}
              title={editingId ? t('Edit to-do list') : t('New to-do list')}
              titleSize="h1"
            />

            <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8 max-w-xl mx-auto w-full flex flex-col gap-6">
              {formError && <FormError>{formError}</FormError>}
              <PillField
                label={t('List name')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('Festival preparation')}
              />
              <PillField
                label={t('Description')}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('Gear packing and stage protocol')}
              />

              <fieldset className="flex flex-col gap-2">
                <legend className="bw-label-sm text-muted-foreground mb-2">{t('Category')}</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CATEGORIES) as TemplateCategory[]).map((cat) => (
                    <Selector key={cat} size="md" selected={formCategory === cat} onClick={() => setFormCategory(cat)}>
                      {categoryLabel[cat]}
                    </Selector>
                  ))}
                </div>
              </fieldset>

              <section className="flex flex-col gap-3">
                <h2 className="bw-label-sm text-muted-foreground">{t('Tasks ({count})', { count: formTasks.length })}</h2>
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
                            {[formatDueOffset(task.dueOffset), task.required ? t('Required') : t('Optional')].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <IconButton label={t('Remove {title}', { title: task.title })} variant="ghost" size="sm" icon={<X />} onClick={() => handleRemoveTask(task.id)} />
                      </li>
                    ))}
                  </ol>
                )}

                <Card className="gap-4">
                  <PillField
                    label={t('New task')}
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder={t('Charge in-ears')}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTask())}
                  />
                  <div className="flex flex-col gap-2">
                    <p className="bw-label-sm text-muted-foreground">{t('Due')}</p>
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
                      {newTaskRequired ? t('Required') : t('Optional')}
                    </Selector>
                    <div className="flex-1" />
                    <PillButton size="md" variant="dark" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
                      {t('Add task')}
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
                  disabled={!formName.trim() || tasksToSave.length === 0}
                  icon={<CheckSquare className="w-[18px] h-[18px]" />}
                >
                  {editingId
                    ? t('Save changes')
                    : tasksToSave.length === 1
                      ? t('Create list ({count} task)', { count: 1 })
                      : t('Create list ({count} tasks)', { count: tasksToSave.length })}
                </PillButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UseTemplateSheet
        open={!!usingTemplate}
        onClose={() => setUsingTemplate(null)}
        template={usingTemplate}
        events={events}
        userId={userId}
        bandId={bandId}
        onNew={(kind) => {
          const tpl = usingTemplate;
          setUsingTemplate(null);
          if (tpl) onUseTemplate?.(tpl, kind);
        }}
        onAdded={(message) => {
          setUsingTemplate(null);
          onNotify?.(message);
        }}
      />

      <DeleteChatSheet
        open={!!pendingDelete}
        title={pendingDelete ? t('Delete "{name}"?', { name: pendingDelete.name }) : undefined}
        body={t('The list is removed for the whole band. Events already created keep their tasks.')}
        deleting={!!pendingDelete && busyId === pendingDelete.id}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />
    </motion.div>
  );
};

export default TaskTemplatesView;
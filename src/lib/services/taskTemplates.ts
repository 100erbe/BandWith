import { supabase } from '../supabase';

/* ─────────────────────────────────────────────────────────────────────────
 * Task templates (table `task_templates`, migrations 006 / 008).
 * Writes return their error and treat "0 rows touched" (RLS) as an error.
 * ───────────────────────────────────────────────────────────────────────── */

export type TemplateCategory = 'wedding' | 'corporate' | 'festival' | 'private' | 'rehearsal' | 'other';

export interface TemplateTask {
  id: string;
  title: string;
  /** Days before (<0) / after (>0) the event. Older rows may not have it. */
  dueOffset?: number;
  required?: boolean;
}

export interface TaskTemplate {
  id: string;
  band_id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tasks: TemplateTask[];
  is_default: boolean;
  created_at: string;
}

export interface TemplateInput {
  name: string;
  description?: string;
  category: TemplateCategory;
  tasks: TemplateTask[];
}

type Result<T> = { data: T | null; error: Error | null };

const NO_ROWS_MESSAGE = "This change wasn't saved: you don't have permission to manage this band's templates.";

const asError = (err: unknown, fallback: string) => {
  const e = err as { message?: string } | null;
  return new Error(e?.message || fallback);
};

const CATEGORIES: TemplateCategory[] = ['wedding', 'corporate', 'festival', 'private', 'rehearsal', 'other'];

/** Normalises a DB row (tasks JSON may use snake_case or miss ids). */
export const normalizeTemplate = (t: any): TaskTemplate => ({
  id: t.id,
  band_id: t.band_id,
  name: t.name ?? '',
  description: t.description ?? '',
  category: CATEGORIES.includes(t.category) ? t.category : 'other',
  is_default: !!t.is_default,
  created_at: t.created_at ?? '',
  tasks: (Array.isArray(t.tasks) ? t.tasks : []).map((task: any, i: number) => ({
    id: String(task?.id ?? `${t.id}-${i}`),
    title: task?.title ?? '',
    dueOffset: task?.dueOffset ?? task?.due_offset ?? undefined,
    required: task?.required ?? false,
  })),
});

const toRow = (input: TemplateInput) => ({
  name: input.name.trim(),
  description: (input.description ?? '').trim() || null,
  category: input.category,
  tasks: input.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    ...(t.dueOffset != null ? { dueOffset: t.dueOffset } : {}),
    required: !!t.required,
  })),
});

export async function listTemplates(bandId: string): Promise<Result<TaskTemplate[]>> {
  const { data, error } = await supabase
    .from('task_templates')
    .select('*')
    .eq('band_id', bandId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: asError(error, 'Could not load templates.') };
  return { data: (data || []).map(normalizeTemplate), error: null };
}

export async function createTemplate(bandId: string, input: TemplateInput, isDefault = false): Promise<Result<TaskTemplate>> {
  if (!input.name.trim()) return { data: null, error: new Error('Give the template a name.') };
  const { data, error } = await supabase
    .from('task_templates')
    .insert({ band_id: bandId, ...toRow(input), is_default: isDefault })
    .select()
    .single();
  if (error) return { data: null, error: asError(error, 'Could not save the template.') };
  if (!data) return { data: null, error: new Error(NO_ROWS_MESSAGE) };
  return { data: normalizeTemplate(data), error: null };
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<Result<TaskTemplate>> {
  if (!input.name.trim()) return { data: null, error: new Error('Give the template a name.') };
  const { data, error } = await supabase.from('task_templates').update(toRow(input)).eq('id', id).select();
  if (error) return { data: null, error: asError(error, 'Could not save the template.') };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: null, error: new Error(NO_ROWS_MESSAGE) };
  return { data: normalizeTemplate(row), error: null };
}

/** Inserts a copy named "… (Copy)"; copies are never defaults. */
export const duplicateTemplate = (template: TaskTemplate) =>
  createTemplate(template.band_id, {
    name: `${template.name} (Copy)`,
    description: template.description,
    category: template.category,
    tasks: template.tasks.map((t) => ({ ...t })),
  });

export async function deleteTemplate(id: string): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.from('task_templates').delete().eq('id', id).select('id');
  if (error) return { error: asError(error, 'Could not delete the template.') };
  if (!data || (Array.isArray(data) && data.length === 0)) return { error: new Error(NO_ROWS_MESSAGE) };
  return { error: null };
}

/** Starter set offered to bands with no templates. Inserted for real, tagged Default. */
export const STARTER_TEMPLATES: TemplateInput[] = [
  {
    name: 'Wedding gig checklist',
    description: 'Complete checklist for wedding performances',
    category: 'wedding',
    tasks: [
      { id: 't1', title: 'Prepare contract and get it signed', dueOffset: -14, required: true },
      { id: 't2', title: 'Confirm final setlist with the couple', dueOffset: -14, required: true },
      { id: 't3', title: 'Check venue access and load-in times', dueOffset: -7, required: true },
      { id: 't4', title: 'Confirm sound check time', dueOffset: -3, required: true },
      { id: 't5', title: 'Pack equipment checklist', dueOffset: -1, required: true },
      { id: 't6', title: 'Send final invoice', dueOffset: 1, required: false },
    ],
  },
  {
    name: 'Corporate event',
    description: 'Standard corporate gig preparation',
    category: 'corporate',
    tasks: [
      { id: 't1', title: 'Review event brief', dueOffset: -7, required: true },
      { id: 't2', title: 'Confirm dress code', dueOffset: -3, required: false },
      { id: 't3', title: 'Check AV requirements', dueOffset: -3, required: true },
      { id: 't4', title: 'Prepare invoice', dueOffset: -3, required: true },
      { id: 't5', title: 'Sound check', dueOffset: 0, required: true },
    ],
  },
  {
    name: 'Festival set',
    description: 'Festival and outdoor event checklist',
    category: 'festival',
    tasks: [
      { id: 't1', title: 'Submit tech rider', dueOffset: -14, required: true },
      { id: 't2', title: 'Confirm stage time', dueOffset: -7, required: true },
      { id: 't3', title: 'Arrange transport', dueOffset: -3, required: true },
      { id: 't4', title: 'Pack weather gear', dueOffset: -1, required: false },
      { id: 't5', title: 'Collect artist passes', dueOffset: 0, required: true },
    ],
  },
  {
    name: 'Rehearsal session',
    description: 'Pre-rehearsal preparation',
    category: 'rehearsal',
    tasks: [
      { id: 't1', title: 'Book rehearsal room', dueOffset: -7, required: true },
      { id: 't2', title: 'Share setlist with the band', dueOffset: -3, required: true },
      { id: 't3', title: 'Prepare charts and lyrics', dueOffset: -1, required: false },
      { id: 't4', title: 'Check equipment', dueOffset: -1, required: true },
    ],
  },
];

export async function insertStarterTemplates(bandId: string): Promise<Result<TaskTemplate[]>> {
  const { data, error } = await supabase
    .from('task_templates')
    .insert(STARTER_TEMPLATES.map((t) => ({ band_id: bandId, ...toRow(t), is_default: true })))
    .select();
  if (error) return { data: null, error: asError(error, 'Could not add the starter templates.') };
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) return { data: null, error: new Error(NO_ROWS_MESSAGE) };
  return { data: rows.map(normalizeTemplate), error: null };
}

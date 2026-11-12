import React from 'react';
import { Loader2, Mail, Pencil, Phone, Plus, Trash2, Users } from '@/app/components/icons';
import { BwSheet, Card, IconButton } from '@/app/components/bw/Screen';
import { PillButton, PillField } from '@/app/components/bw/Form';
import {
  deleteDeputy,
  deputiesUnavailable,
  listDeputies,
  saveDeputy,
  type Deputy,
} from '@/lib/services/deputies';
import { useT } from '@/lib/i18n';

const EMPTY = { name: '', instrument: '', phone: '', email: '', fee: '', notes: '' };

/**
 * Band members → Deputies (admins only): the session musicians the band calls
 * when a member can't play. A gig's lineup offers them to replace a member
 * who declined ("Find a deputy").
 */
export const DeputiesSection: React.FC<{ bandId: string; bandName?: string }> = ({ bandId, bandName }) => {
  const t = useT();
  const [deputies, setDeputies] = React.useState<Deputy[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [unavailable, setUnavailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Deputy | 'new' | null>(null);
  const [form, setForm] = React.useState(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data, error: e } = await listDeputies(bandId);
    if (deputiesUnavailable(e)) setUnavailable(true);
    else if (e) setError(t('Could not load the deputies.'));
    else {
      setDeputies(data);
      setError(null);
    }
    setLoading(false);
  }, [bandId, t]);

  React.useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const open = (d: Deputy | 'new') => {
    setEditing(d);
    setConfirmDelete(false);
    setError(null);
    setForm(
      d === 'new'
        ? EMPTY
        : {
            name: d.name,
            instrument: d.instrument || '',
            phone: d.phone || '',
            email: d.email || '',
            fee: d.default_fee != null ? String(d.default_fee) : '',
            notes: d.notes || '',
          },
    );
  };
  const close = () => !saving && setEditing(null);

  const fee = form.fee.trim() ? Number(form.fee.replace(',', '.')) : null;
  const feeInvalid = fee != null && (!Number.isFinite(fee) || fee < 0);
  const emailInvalid = !!form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim());
  const canSave = !!form.name.trim() && !feeInvalid && !emailInvalid && !saving;

  const save = async () => {
    if (!canSave || !editing) return;
    setSaving(true);
    const { error: e } = await saveDeputy(
      bandId,
      { name: form.name, instrument: form.instrument, phone: form.phone, email: form.email, notes: form.notes, default_fee: fee },
      editing === 'new' ? undefined : editing.id,
    );
    setSaving(false);
    if (e) {
      setError(deputiesUnavailable(e) ? t('Deputies need the latest app update on the server.') : t('Could not save. Try again.'));
      return;
    }
    setEditing(null);
    void load();
  };

  const remove = async () => {
    if (!editing || editing === 'new') return;
    setSaving(true);
    const { error: e } = await deleteDeputy(editing.id);
    setSaving(false);
    if (e) {
      setError(t('Could not delete. Try again.'));
      return;
    }
    setEditing(null);
    void load();
  };

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section aria-labelledby="deputies-title" className="@container flex flex-col gap-3 pt-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h2 id="deputies-title" className="bw-h3">{t('Deputies')}</h2>
          <p className="bw-body-sm text-muted-foreground">{t("Session players you call when a member can't make a gig. Only admins see this list.")}</p>
        </div>
        {!unavailable && <IconButton label={t('Add deputy')} variant="outline" size="sm" icon={<Plus />} onClick={() => open('new')} />}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : unavailable ? (
        <Card className="gap-1">
          <p className="bw-label-md">{t('Coming with the next update')}</p>
          <p className="bw-body-sm text-muted-foreground">{t('The deputies list will be available as soon as the server is updated.')}</p>
        </Card>
      ) : deputies.length === 0 ? (
        <Card className="items-center text-center py-6 gap-3">
          <Users className="w-8 h-8 text-muted-foreground" aria-hidden />
          <p className="bw-body-sm text-muted-foreground">{t('No deputies yet. Add the players you trust for each instrument.')}</p>
          <PillButton size="md" variant="outline" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={() => open('new')}>
            {t('Add deputy')}
          </PillButton>
        </Card>
      ) : (
        // Grid: one column on phones and the closed Duo, two when wide.
        <ul className="grid grid-cols-1 @min-[600px]:grid-cols-2 gap-3" aria-label={t('Deputies')}>
          {deputies.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => open(d)}
                className="w-full h-full flex items-center gap-3 p-4 rounded-[24px] bg-card text-card-foreground text-left active:scale-[0.99] transition-transform"
              >
                <span className="w-11 h-11 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0 bw-label-md" aria-hidden>
                  {d.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="bw-label-md truncate">{d.name}</span>
                  <span className="bw-body-sm text-muted-foreground truncate">
                    {[d.instrument, d.phone || d.email].filter(Boolean).join(' · ') || t('No contact yet')}
                  </span>
                </span>
                <Pencil className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && !editing && <p role="alert" className="bw-body-sm text-destructive">{error}</p>}

      <BwSheet
        open={!!editing}
        onClose={close}
        overline={bandName}
        title={editing === 'new' ? t('New deputy') : confirmDelete ? t('Delete deputy?') : t('Edit deputy')}
        zIndex={102}
        footer={
          confirmDelete ? (
            <div className="grid grid-cols-2 gap-2">
              <PillButton variant="white" onClick={() => setConfirmDelete(false)} disabled={saving}>
                {t('Cancel')}
              </PillButton>
              <PillButton variant="danger" loading={saving} icon={<Trash2 className="w-4 h-4" />} onClick={remove}>
                {t('Delete')}
              </PillButton>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <PillButton disabled={!canSave} loading={saving} onClick={save}>
                {editing === 'new' ? t('Add deputy') : t('Save')}
              </PillButton>
              {editing && editing !== 'new' && (
                <PillButton variant="danger" size="md" icon={<Trash2 className="w-4 h-4" />} onClick={() => setConfirmDelete(true)}>
                  {t('Delete deputy')}
                </PillButton>
              )}
            </div>
          )
        }
      >
        {confirmDelete ? (
          <p className="bw-body-md text-sheet-foreground/80">
            {t("{name} is removed from the band's list. You can add them again later.", { name: editing && editing !== 'new' ? editing.name : t('This deputy') })}
          </p>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <PillField tone="sheet" label={t('Name')} value={form.name} onChange={set('name')} maxLength={120} autoComplete="off" required />
            <PillField tone="sheet" label={t('Instrument')} value={form.instrument} onChange={set('instrument')} maxLength={60} placeholder={t('Bass, drums…')} />
            <PillField
              tone="sheet"
              label={t('Phone (WhatsApp)')}
              icon={<Phone className="w-5 h-5" />}
              value={form.phone}
              onChange={set('phone')}
              maxLength={40}
              type="tel"
              inputMode="tel"
              placeholder="+39 333 123 4567"
            />
            <PillField
              tone="sheet"
              label={t('Email')}
              icon={<Mail className="w-5 h-5" />}
              value={form.email}
              onChange={set('email')}
              maxLength={200}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              error={emailInvalid ? t('Check the email address.') : null}
            />
            <PillField
              tone="sheet"
              label={t('Usual fee')}
              value={form.fee}
              onChange={set('fee')}
              inputMode="decimal"
              placeholder={t('Optional')}
              error={feeInvalid ? t('Use a number, like 150.') : null}
            />
            <PillField tone="sheet" label={t('Notes')} value={form.notes} onChange={set('notes')} maxLength={1000} placeholder={t('Reads charts, has own gear…')} />
            {error && <p role="alert" className="bw-body-sm text-destructive">{error}</p>}
            <button type="submit" hidden aria-hidden tabIndex={-1} />
          </form>
        )}
      </BwSheet>
    </section>
  );
};

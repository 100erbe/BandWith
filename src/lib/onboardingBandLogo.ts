import { supabase } from './supabase';
import { dataUrlToBlob } from './imageResize';

/**
 * The band photo picked during onboarding is a small inline thumbnail until
 * the band exists. Once it does, upload it to the band's public branding
 * folder (admins of the band write there, 047) and store that URL instead,
 * so band lists, the offline cache and emails don't carry a data URL.
 * Never throws: if the upload isn't possible the thumbnail stays inline.
 */
export async function storeOnboardingBandLogo(bandId: string, logo: string | undefined | null): Promise<void> {
  if (!bandId || !logo || !logo.startsWith('data:')) return;
  try {
    const blob = dataUrlToBlob(logo);
    if (!blob) return;
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = `${bandId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('band-branding')
      .upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) {
      console.warn('[Onboarding] Band photo upload failed, keeping it inline:', error.message);
      return;
    }
    const { data } = supabase.storage.from('band-branding').getPublicUrl(path);
    if (!data?.publicUrl) return;
    await supabase.from('bands').update({ logo_url: data.publicUrl }).eq('id', bandId);
  } catch (err) {
    console.warn('[Onboarding] Band photo upload failed, keeping it inline:', err);
  }
}

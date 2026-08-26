-- ====================================================================
-- 041_transactions_admin_rls.sql
--
-- Members must only ever see their own personal fees. Band financials
-- (the transactions table) are now visible ONLY to band admins/creators,
-- not to every band member.
-- ====================================================================

DROP POLICY IF EXISTS "Users can view transactions of their bands" ON transactions;
DROP POLICY IF EXISTS "Admins can view transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can delete transactions" ON transactions;

CREATE POLICY "Admins can view transactions" ON transactions
  FOR SELECT USING (is_band_admin_or_creator(band_id));

CREATE POLICY "Admins can insert transactions" ON transactions
  FOR INSERT WITH CHECK (is_band_admin_or_creator(band_id));

CREATE POLICY "Admins can update transactions" ON transactions
  FOR UPDATE USING (is_band_admin_or_creator(band_id));

CREATE POLICY "Admins can delete transactions" ON transactions
  FOR DELETE USING (is_band_admin_or_creator(band_id));

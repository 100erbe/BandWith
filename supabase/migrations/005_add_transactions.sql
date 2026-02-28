-- =============================================
-- TRANSACTIONS TABLE
-- =============================================

-- Create transactions table for financial tracking
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  
  -- Transaction info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  category VARCHAR(50), -- GIG, ROYALTY, GEAR, RENT, TRAVEL, OTHER
  
  -- Related entities (optional)
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  
  -- Date
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view transactions of their bands" ON transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members 
      WHERE band_members.band_id = transactions.band_id 
      AND band_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert transactions" ON transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members 
      WHERE band_members.band_id = transactions.band_id 
      AND band_members.user_id = auth.uid()
      AND band_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can update transactions" ON transactions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members 
      WHERE band_members.band_id = transactions.band_id 
      AND band_members.user_id = auth.uid()
      AND band_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete transactions" ON transactions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members 
      WHERE band_members.band_id = transactions.band_id 
      AND band_members.user_id = auth.uid()
      AND band_members.role = 'admin'
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_band_id ON transactions(band_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

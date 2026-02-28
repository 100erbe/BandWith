-- Migration 006: Add inventory, contracts, and task_templates tables
-- Run this in the Supabase SQL Editor

-- ============================================
-- INVENTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Instruments', 'Cables', 'Stands', 'Microphones', 'Cases', 'Lighting', 'Other')),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'lost')),
  location VARCHAR(255),
  notes TEXT,
  serial_number VARCHAR(100),
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory of their bands" ON inventory
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = inventory.band_id AND band_members.user_id = auth.uid() AND band_members.is_active = true)
  );

CREATE POLICY "Admins can insert inventory" ON inventory
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = inventory.band_id AND band_members.user_id = auth.uid() AND band_members.role = 'admin' AND band_members.is_active = true)
  );

CREATE POLICY "Admins can update inventory" ON inventory
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = inventory.band_id AND band_members.user_id = auth.uid() AND band_members.role = 'admin' AND band_members.is_active = true)
  );

CREATE POLICY "Admins can delete inventory" ON inventory
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = inventory.band_id AND band_members.user_id = auth.uid() AND band_members.role = 'admin' AND band_members.is_active = true)
  );

-- Indexes for inventory
CREATE INDEX IF NOT EXISTS idx_inventory_band_id ON inventory(band_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

-- ============================================
-- CONTRACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('contract', 'rider')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'expired')),
  event_name VARCHAR(255),
  event_date DATE,
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  content TEXT,
  file_url TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contracts of their bands" ON contracts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = contracts.band_id AND band_members.user_id = auth.uid() AND band_members.is_active = true)
  );

CREATE POLICY "Admins can insert contracts" ON contracts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = contracts.band_id AND band_members.user_id = auth.uid() AND band_members.role = 'admin' AND band_members.is_active = true)
  );

CREATE POLICY "Admins can update contracts" ON contracts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = contracts.band_id AND band_members.user_id = auth.uid() AND band_members.role = 'admin' AND band_members.is_active = true)
  );

CREATE POLICY "Admins can delete contracts" ON contracts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = contracts.band_id AND band_members.user_id = auth.uid() AND band_members.role = 'admin' AND band_members.is_active = true)
  );

-- Indexes for contracts
CREATE INDEX IF NOT EXISTS idx_contracts_band_id ON contracts(band_id);
CREATE INDEX IF NOT EXISTS idx_contracts_event_id ON contracts(event_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(type);

-- ============================================
-- TASK TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (category IN ('wedding', 'corporate', 'festival', 'private', 'rehearsal', 'other')),
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for task_templates
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task templates of their bands" ON task_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = task_templates.band_id AND band_members.user_id = auth.uid() AND band_members.is_active = true)
  );

CREATE POLICY "Admins can insert task templates" ON task_templates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = task_templates.band_id AND band_members.user_id = auth.uid() AND band_members.role = 'admin' AND band_members.is_active = true)
  );

CREATE POLICY "Admins can update task templates" ON task_templates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = task_templates.band_id AND band_members.user_id = auth.uid() AND band_members.role = 'admin' AND band_members.is_active = true)
  );

CREATE POLICY "Admins can delete task templates" ON task_templates
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = task_templates.band_id AND band_members.user_id = auth.uid() AND band_members.role = 'admin' AND band_members.is_active = true)
  );

-- Indexes for task_templates
CREATE INDEX IF NOT EXISTS idx_task_templates_band_id ON task_templates(band_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_category ON task_templates(category);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Inventory trigger
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Contracts trigger
DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Task templates trigger
DROP TRIGGER IF EXISTS update_task_templates_updated_at ON task_templates;
CREATE TRIGGER update_task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Nexus Ledger Supabase Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Items Table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  amount_owed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  amount_payable DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions Table (Sales, Purchases, Payments)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('sale', 'purchase', 'payment_in', 'payment_out')),
  entity_id UUID, -- Can be customer_id or supplier_id depending on type
  total_amount DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transaction Items Table (Line items for sales/purchases)
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create views for dashboard analytics
CREATE OR REPLACE VIEW monthly_summary AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  SUM(CASE WHEN type = 'sale' THEN total_amount ELSE 0 END) as total_sales,
  SUM(CASE WHEN type = 'purchase' THEN total_amount ELSE 0 END) as total_purchases
FROM transactions
GROUP BY DATE_TRUNC('month', created_at);

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'received', 'cancelled')) DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  expected_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Order Items Table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RPC Functions for Atomic Transactions

-- Record Sale
CREATE OR REPLACE FUNCTION record_sale(
  p_customer_id UUID,
  p_total_amount DECIMAL,
  p_amount_paid DECIMAL,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_item RECORD;
BEGIN
  INSERT INTO transactions (type, entity_id, total_amount, notes)
  VALUES ('sale', p_customer_id, p_total_amount, 'Sale recorded')
  RETURNING id INTO v_tx_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, quantity INT, price DECIMAL)
  LOOP
    INSERT INTO transaction_items (transaction_id, item_id, quantity, price)
    VALUES (v_tx_id, v_item.item_id, v_item.quantity, v_item.price);
    
    UPDATE items SET stock = stock - v_item.quantity WHERE id = v_item.item_id;
  END LOOP;

  IF p_customer_id IS NOT NULL AND p_total_amount > p_amount_paid THEN
    UPDATE customers SET amount_owed = amount_owed + (p_total_amount - p_amount_paid)
    WHERE id = p_customer_id;
  END IF;

  IF p_amount_paid > 0 THEN
    INSERT INTO transactions (type, entity_id, total_amount, notes)
    VALUES ('payment_in', p_customer_id, p_amount_paid, 'Payment for sale ' || v_tx_id);
  END IF;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

-- Record Purchase
CREATE OR REPLACE FUNCTION record_purchase(
  p_supplier_id UUID,
  p_total_amount DECIMAL,
  p_amount_paid DECIMAL,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_item RECORD;
BEGIN
  INSERT INTO transactions (type, entity_id, total_amount, notes)
  VALUES ('purchase', p_supplier_id, p_total_amount, 'Purchase recorded')
  RETURNING id INTO v_tx_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, quantity INT, cost DECIMAL)
  LOOP
    INSERT INTO transaction_items (transaction_id, item_id, quantity, price)
    VALUES (v_tx_id, v_item.item_id, v_item.quantity, v_item.cost);
    
    UPDATE items SET stock = stock + v_item.quantity WHERE id = v_item.item_id;
  END LOOP;

  IF p_supplier_id IS NOT NULL AND p_total_amount > p_amount_paid THEN
    UPDATE suppliers SET amount_payable = amount_payable + (p_total_amount - p_amount_paid)
    WHERE id = p_supplier_id;
  END IF;

  IF p_amount_paid > 0 THEN
    INSERT INTO transactions (type, entity_id, total_amount, notes)
    VALUES ('payment_out', p_supplier_id, p_amount_paid, 'Payment for purchase ' || v_tx_id);
  END IF;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

-- Receive Purchase Order
CREATE OR REPLACE FUNCTION receive_purchase_order(
  p_po_id UUID,
  p_amount_paid DECIMAL
) RETURNS UUID AS $$
DECLARE
  v_po RECORD;
  v_items JSONB;
  v_tx_id UUID;
BEGIN
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO not found or already processed';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('item_id', item_id, 'quantity', quantity, 'cost', cost))
  INTO v_items
  FROM purchase_order_items WHERE po_id = p_po_id;

  v_tx_id := record_purchase(v_po.supplier_id, v_po.total_amount, p_amount_paid, v_items);

  UPDATE purchase_orders SET status = 'received' WHERE id = p_po_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

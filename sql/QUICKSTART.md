# Database Setup - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Open Supabase Dashboard

Visit: https://supabase.com/dashboard/project/medpqabiozetwuphwygz

### Step 2: Navigate to SQL Editor

Click "SQL Editor" in the left sidebar

### Step 3: Run Migration 1 - Create Tables

1. Open file: `sql/migrations/001_initial_schema.sql`
2. Copy entire contents (Cmd+A / Ctrl+A, then Cmd+C / Ctrl+C)
3. Paste into SQL Editor
4. Click **"Run"** button (or press Cmd+Enter / Ctrl+Enter)
5. Wait for ✅ "Success" message

### Step 4: Run Migration 2 - Enable Security

1. Open file: `sql/migrations/002_rls_policies.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click **"Run"**
5. Wait for ✅ "Success" message

### Step 5: Verify Setup

Click "Table Editor" in sidebar. You should see:
- ✅ `hotels`
- ✅ `hotel_groups`
- ✅ `hotel_group_members`
- ✅ `review_snapshots`

## ✅ Done!

Your database is now ready to use with full Row-Level Security!

## 🧪 Test It

1. Run your app: `npm run dev`
2. Sign up at http://localhost:3000/login
3. Try adding a hotel from your dashboard

## 📚 Need More Info?

See `sql/README.md` for:
- Detailed table schemas
- Verification queries
- Troubleshooting tips
- Rollback instructions

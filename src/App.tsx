import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

const db = supabase as any

// ─── TYPES ────────────────────────────────────────────────────
type Business  = { id: string; name: string; business_type: string; color: string; address: string | null; tax_rate: number }
type Location  = { id: string; name: string }
type Shift     = { id: string; location_id: string; location_name: string; status: string; total_revenue: number; total_cost: number; total_orders: number; started_at: string; ended_at?: string }
type Category  = { id: string; name: string; emoji: string; sort_order: number }
type MenuItem  = { id: string; name: string; emoji: string; price: number; cost_price: number; category_id: string; is_active: boolean; image_url?: string }
type OrderLine = { menu_item_id: string; name: string; emoji: string; qty: number; unit_price: number; unit_cost: number }
type KDSOrder  = { id: string; order_number: number; kitchen_status: 'new'|'cooking'|'ready'|'served'; created_at: string; paid_at: string; payment_method: string; total: number; items: { name: string; emoji: string; quantity: number }[] }
type InventoryItem = { id: string; truck_id: string; menu_item_id: string | null; ingredient_name: string; unit: string; stock_qty: number; low_stock_alert: number; deduct_per_sale: number; track_mode: string }

// ─── SEED DATA ────────────────────────────────────────────────
const SEED_CATS  = [
  { name: 'Wraps',   emoji: '🌯', sort_order: 1 },
  { name: 'Burgers', emoji: '🍔', sort_order: 2 },
  { name: 'Sides',   emoji: '🍟', sort_order: 3 },
  { name: 'Drinks',  emoji: '🥤', sort_order: 4 },
]
const SEED_ITEMS = [
  { name: 'Seoul Fire Wrap',    emoji: '🌯', price: 8.90, cost_price: 2.80, cat: 'Wraps'   },
  { name: 'Fusion Chicken Wrap',emoji: '🌯', price: 8.50, cost_price: 2.60, cat: 'Wraps'   },
  { name: 'Falafel Street Wrap',emoji: '🌯', price: 7.50, cost_price: 1.90, cat: 'Wraps'   },
  { name: 'The Smash Burger',   emoji: '🍔', price: 9.50, cost_price: 3.20, cat: 'Burgers' },
  { name: 'Spicy Fries',        emoji: '🍟', price: 4.00, cost_price: 0.90, cat: 'Sides'   },
  { name: 'Loaded Fries',       emoji: '🍟', price: 6.00, cost_price: 1.50, cat: 'Sides'   },
  { name: 'Onion Rings',        emoji: '🧅', price: 3.50, cost_price: 0.80, cat: 'Sides'   },
  { name: 'Cola',               emoji: '🥤', price: 2.50, cost_price: 0.40, cat: 'Drinks'  },
  { name: 'Mango Juice',        emoji: '🧃', price: 3.00, cost_price: 0.60, cat: 'Drinks'  },
  { name: 'Water',              emoji: '💧', price: 1.50, cost_price: 0.10, cat: 'Drinks'  },
]
const SEED_LOCS  = ['Marktplatz', 'Anger Park', 'Bahnhof Nord', 'Stadtpark']

const BUSINESS_TYPES = [
  { value: 'food_truck',  label: 'Food Truck',  emoji: '🚚' },
  { value: 'restaurant',  label: 'Restaurant',  emoji: '🍽️' },
  { value: 'cafe',        label: 'Café',         emoji: '☕' },
  { value: 'bakery',      label: 'Bakery',       emoji: '🥐' },
  { value: 'bar',         label: 'Bar',          emoji: '🍺' },
  { value: 'popup',       label: 'Pop-up',       emoji: '⛺' },
]
const BRAND_COLORS = ['#0d9488','#f59e0b','#8b5cf6','#ef4444','#22c55e','#0ea5e9','#f97316','#ec4899']
const typeEmoji = (t: string) => BUSINESS_TYPES.find(b => b.value === t)?.emoji || '🏪'

// ─── OFFLINE QUEUE ────────────────────────────────────────────
const QUEUE_KEY = 'setzio_street_offline_queue'
type QueuedOrder = {
  id: string; business_id: string; shift_id: string; order_number: number
  subtotal: number; tax_amount: number; total: number; cost_total: number
  profit: number; payment_method: string; queued_at: string
  items: { menu_item_id: string; name: string; emoji: string; quantity: number; unit_price: number; unit_cost: number; line_total: number; line_profit: number }[]
}
const getQueue   = (): QueuedOrder[] => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] } }
const addToQueue = (o: QueuedOrder) => { const q = getQueue(); q.push(o); localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) }
const clearQueue = () => localStorage.removeItem(QUEUE_KEY)

const fmt      = (n: number) => `€${n.toFixed(2)}`
const fmtShort = (n: number) => n >= 1000 ? `€${(n/1000).toFixed(1)}k` : `€${n.toFixed(0)}`
const dayName  = (d: string) => new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
const timeStr  = (d: string) => new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
const elapsed  = (d: string) => { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s`; return `${Math.floor(s/60)}m ${s%60}s` }

// ─── STYLES ───────────────────────────────────────────────────
const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; overflow: hidden; background: #0f172a; }
  .app { height: 100vh; display: flex; flex-direction: column; background: #0f172a; color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; }

  .auth-root { min-height:100vh; background:#0f172a; display:flex; align-items:center; justify-content:center; padding:20px; flex-direction:column; gap:20px; }
  .auth-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:40px 36px; width:100%; max-width:400px; box-shadow:0 40px 80px rgba(0,0,0,0.4); }
  .auth-logo { display:flex; align-items:center; gap:10px; margin-bottom:32px; }
  .auth-logo-s { width:40px; height:40px; background:#0d9488; border-radius:12px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:20px; color:white; }
  .auth-logo-name { font-size:20px; font-weight:800; color:#f8fafc; letter-spacing:-0.02em; }
  .auth-logo-name span { color:#0d9488; }
  .auth-logo-sub { font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; margin-top:-2px; }
  .auth-title { font-size:24px; font-weight:800; color:#f8fafc; margin-bottom:6px; }
  .auth-sub { font-size:14px; color:#64748b; margin-bottom:28px; line-height:1.5; }
  .auth-field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .auth-label { font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; }
  .auth-input { padding:13px 16px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:15px; font-weight:500; color:#f8fafc; font-family:'Plus Jakarta Sans',sans-serif; outline:none; width:100%; transition:border-color 0.15s; }
  .auth-input::placeholder { color:#475569; }
  .auth-input:focus { border-color:#0d9488; }
  .auth-btn { width:100%; padding:14px; background:#0d9488; border:none; border-radius:12px; font-size:15px; font-weight:800; color:white; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; margin-bottom:16px; }
  .auth-btn:hover { background:#14b8a6; transform:translateY(-1px); }
  .auth-btn:disabled { background:#334155; color:#64748b; cursor:not-allowed; transform:none; }
  .auth-error { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); border-radius:10px; padding:12px 14px; font-size:13px; color:#fca5a5; margin-bottom:16px; }
  .auth-toggle { text-align:center; font-size:13px; color:#64748b; padding-top:16px; border-top:1px solid #334155; }
  .auth-toggle button { background:none; border:none; color:#0d9488; font-weight:700; cursor:pointer; font-size:13px; font-family:'Plus Jakarta Sans',sans-serif; margin-left:4px; }
  .auth-powered { font-size:11px; color:#334155; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; }
  .auth-powered span { color:#0d9488; }

  .picker-root { min-height:100vh; background:#0f172a; display:flex; align-items:center; justify-content:center; padding:20px; }
  .picker-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:36px; width:100%; max-width:480px; }
  .picker-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; }
  .picker-title { font-size:22px; font-weight:800; color:#f8fafc; }
  .picker-sub { font-size:13px; color:#64748b; margin-top:2px; }
  .picker-signout { padding:6px 12px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:11px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; text-transform:uppercase; letter-spacing:0.05em; transition:all 0.15s; }
  .picker-signout:hover { border-color:#ef4444; color:#ef4444; }
  .biz-list { display:flex; flex-direction:column; gap:10px; margin-bottom:20px; }
  .biz-card { display:flex; align-items:center; gap:14px; padding:16px; background:#0f172a; border:1.5px solid #334155; border-radius:14px; cursor:pointer; transition:all 0.15s; }
  .biz-card:hover { border-color:#0d9488; transform:translateY(-1px); }
  .biz-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
  .biz-info { flex:1; }
  .biz-name { font-size:15px; font-weight:800; color:#f8fafc; margin-bottom:2px; }
  .biz-type { font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }
  .biz-arrow { font-size:18px; color:#334155; }
  .add-biz-btn { width:100%; padding:13px; background:transparent; border:1.5px dashed #334155; border-radius:14px; font-size:14px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; display:flex; align-items:center; justify-content:center; gap:8px; }
  .add-biz-btn:hover { border-color:#0d9488; color:#14b8a6; }

  .create-root { min-height:100vh; background:#0f172a; display:flex; align-items:center; justify-content:center; padding:20px; }
  .create-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:36px; width:100%; max-width:480px; }
  .create-title { font-size:22px; font-weight:800; color:#f8fafc; margin-bottom:6px; }
  .create-sub { font-size:14px; color:#64748b; margin-bottom:28px; line-height:1.5; }
  .create-field { display:flex; flex-direction:column; gap:6px; margin-bottom:16px; }
  .create-label { font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; }
  .create-input { padding:12px 14px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:14px; font-weight:500; color:#f8fafc; font-family:'Plus Jakarta Sans',sans-serif; outline:none; width:100%; transition:border-color 0.15s; }
  .create-input::placeholder { color:#475569; }
  .create-input:focus { border-color:#0d9488; }
  .type-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .type-btn { padding:10px 8px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; text-align:center; transition:all 0.12s; display:flex; flex-direction:column; align-items:center; gap:4px; }
  .type-btn:hover { border-color:#0d9488; color:#f8fafc; }
  .type-btn.selected { border-color:#0d9488; color:#f8fafc; background:rgba(13,148,136,0.1); }
  .type-btn-emoji { font-size:20px; }
  .color-row { display:flex; gap:8px; flex-wrap:wrap; }
  .color-dot { width:28px; height:28px; border-radius:50%; cursor:pointer; transition:all 0.12s; border:2px solid transparent; }
  .color-dot:hover { transform:scale(1.15); }
  .color-dot.selected { border-color:white; transform:scale(1.15); }
  .create-btn { width:100%; padding:14px; border:none; border-radius:12px; font-size:15px; font-weight:800; color:white; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; margin-top:8px; }
  .create-btn:hover { filter:brightness(1.1); transform:translateY(-1px); }
  .create-btn:disabled { background:#334155 !important; color:#64748b; cursor:not-allowed; transform:none; filter:none; }
  .back-btn { width:100%; padding:10px; background:transparent; border:1px solid #334155; border-radius:10px; font-size:13px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; margin-top:8px; transition:all 0.15s; }

  .topbar { height:52px; background:#1e293b; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; padding:0 16px; flex-shrink:0; }
  .topbar-logo { display:flex; align-items:center; gap:8px; cursor:pointer; }
  .topbar-s { width:28px; height:28px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px; color:white; }
  .topbar-name { font-size:15px; font-weight:800; letter-spacing:-0.02em; }
  .topbar-right { display:flex; align-items:center; gap:8px; }
  .topbar-shift-badge { display:flex; align-items:center; gap:6px; background:rgba(13,148,136,0.12); border:1px solid rgba(13,148,136,0.25); border-radius:20px; padding:4px 10px; font-size:11px; font-weight:700; color:#14b8a6; }
  .topbar-dot { width:6px; height:6px; border-radius:50%; background:#22c55e; box-shadow:0 0 6px #22c55e; animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .topbar-offline { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:700; color:#f59e0b; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); border-radius:20px; padding:4px 10px; }
  .topbar-orders { font-size:11px; font-weight:700; color:#64748b; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:4px 10px; font-family:'Space Grotesk',monospace; }
  .topbar-icon-btn { width:32px; height:32px; border-radius:8px; background:transparent; border:1px solid #334155; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:16px; transition:all 0.15s; }
  .topbar-icon-btn:hover { border-color:#0d9488; background:rgba(13,148,136,0.1); }
  .topbar-icon-btn.active { border-color:#0d9488; background:rgba(13,148,136,0.15); }
  .switch-biz-btn { padding:6px 10px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:11px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
  .switch-biz-btn:hover { border-color:#0d9488; color:#14b8a6; }
  .end-shift-btn { padding:6px 12px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:11px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; text-transform:uppercase; letter-spacing:0.05em; transition:all 0.15s; }
  .end-shift-btn:hover { border-color:#ef4444; color:#ef4444; }

  .shift-root { flex:1; display:flex; align-items:center; justify-content:center; padding:20px; background:#0f172a; }
  .shift-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:36px; width:100%; max-width:420px; }
  .shift-title { font-size:22px; font-weight:800; color:#f8fafc; margin-bottom:6px; }
  .shift-sub { font-size:14px; color:#64748b; margin-bottom:28px; line-height:1.5; }
  .shift-label { font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px; display:block; }
  .loc-grid { display:flex; flex-direction:column; gap:8px; margin-bottom:24px; }
  .loc-btn { padding:14px 16px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:14px; font-weight:700; color:#94a3b8; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; text-align:left; display:flex; align-items:center; gap:10px; transition:all 0.12s; }
  .loc-btn:hover { border-color:#0d9488; color:#f8fafc; }
  .loc-btn.selected { border-color:#0d9488; color:#f8fafc; background:rgba(13,148,136,0.1); }
  .cash-row { display:flex; flex-direction:column; gap:8px; margin-bottom:24px; }
  .cash-input { padding:13px 16px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:18px; font-weight:700; color:#f8fafc; font-family:'Space Grotesk',monospace; outline:none; width:100%; transition:border-color 0.15s; }
  .cash-input:focus { border-color:#0d9488; }
  .start-btn { width:100%; padding:15px; border:none; border-radius:12px; font-size:16px; font-weight:800; color:white; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
  .start-btn:hover { filter:brightness(1.1); transform:translateY(-1px); }
  .start-btn:disabled { background:#334155 !important; color:#64748b; cursor:not-allowed; transform:none; filter:none; }

  .pos-body { flex:1; display:flex; overflow:hidden; }
  .menu-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; border-right:1px solid #334155; }
  .cats-bar { display:flex; gap:6px; padding:10px 12px; border-bottom:1px solid #334155; overflow-x:auto; flex-shrink:0; scrollbar-width:none; }
  .cats-bar::-webkit-scrollbar { display:none; }
  .cat-chip { padding:7px 14px; border-radius:20px; border:1px solid #334155; background:transparent; color:#64748b; font-size:12px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; white-space:nowrap; transition:all 0.12s; }
  .cat-chip:hover { border-color:#0d9488; color:#14b8a6; }
  .cat-chip.active { background:#0d9488; border-color:#0d9488; color:white; }
  .menu-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:10px; overflow-y:auto; flex:1; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
  @media(min-width:768px){ .menu-grid { grid-template-columns:repeat(4,1fr); } }
  .menu-item { background:#1e293b; border:1.5px solid #334155; border-radius:12px; padding:14px 8px 12px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px; position:relative; transition:all 0.12s; user-select:none; overflow:hidden; }
  .menu-item:hover { border-color:#0d9488; background:rgba(13,148,136,0.06); transform:translateY(-1px); }
  .menu-item:active { transform:scale(0.96); }
  .menu-item.soldout { opacity:0.4; cursor:not-allowed; }
  .menu-item.soldout:hover { transform:none; border-color:#334155; background:#1e293b; }
  .item-img { width:52px; height:52px; border-radius:10px; object-fit:cover; }
  .item-emoji { font-size:28px; line-height:1; }
  .item-name { font-size:11px; font-weight:700; text-align:center; color:#e2e8f0; line-height:1.3; }
  .item-price { font-size:14px; font-weight:800; font-family:'Space Grotesk',monospace; }
  .item-margin { position:absolute; top:6px; right:6px; font-size:9px; font-weight:700; color:#22c55e; background:rgba(34,197,94,0.1); padding:2px 5px; border-radius:4px; font-family:'Space Grotesk',monospace; }
  .item-soldout-badge { position:absolute; top:6px; left:6px; font-size:9px; font-weight:700; color:#ef4444; background:rgba(239,68,68,0.1); padding:2px 5px; border-radius:4px; }
  .order-panel { width:270px; display:flex; flex-direction:column; background:#0f172a; flex-shrink:0; }
  @media(min-width:768px){ .order-panel { width:300px; } }
  .order-hd { padding:12px 14px; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
  .order-hd-title { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; }
  .order-num-badge { font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; font-family:'Space Grotesk',monospace; border:1px solid; }
  .order-lines { flex:1; overflow-y:auto; padding:8px; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
  .order-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:8px; }
  .order-empty-icon { font-size:40px; opacity:0.3; }
  .order-empty-text { font-size:12px; color:#475569; }
  .order-line { display:flex; align-items:center; gap:6px; padding:8px 6px; border-bottom:1px solid rgba(51,65,85,0.5); animation:slideIn 0.15s ease; }
  @keyframes slideIn { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:none} }
  .ol-emoji { font-size:18px; flex-shrink:0; }
  .ol-name { flex:1; font-size:12px; font-weight:600; color:#e2e8f0; line-height:1.2; }
  .ol-qty { display:flex; align-items:center; gap:4px; }
  .ol-qbtn { width:22px; height:22px; border-radius:6px; background:#1e293b; border:none; color:#e2e8f0; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.1s; }
  .ol-qbtn:hover { background:#0d9488; }
  .ol-qnum { width:20px; text-align:center; font-size:13px; font-weight:700; font-family:'Space Grotesk',monospace; }
  .ol-price { font-size:13px; font-weight:700; font-family:'Space Grotesk',monospace; min-width:46px; text-align:right; }
  .order-ft { padding:12px 14px; border-top:1px solid #334155; display:flex; flex-direction:column; gap:8px; flex-shrink:0; }
  .ord-row { display:flex; justify-content:space-between; font-size:12px; color:#64748b; font-family:'Space Grotesk',monospace; }
  .ord-total { display:flex; justify-content:space-between; align-items:baseline; padding:6px 0 2px; border-top:1px solid #334155; }
  .ord-total-label { font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; }
  .ord-total-amt { font-size:28px; font-weight:800; font-family:'Space Grotesk',monospace; letter-spacing:-0.03em; }
  .ord-profit { font-size:10px; color:#22c55e; text-align:right; font-family:'Space Grotesk',monospace; }
  .pay-methods { display:flex; gap:6px; }
  .pay-btn { flex:1; padding:8px; background:#1e293b; border:1.5px solid #334155; border-radius:8px; color:#64748b; font-size:11px; font-weight:700; text-transform:uppercase; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.12s; letter-spacing:0.04em; }
  .pay-btn:hover { border-color:#0d9488; color:#14b8a6; }
  .pay-btn.active { border-color:#0d9488; color:#14b8a6; background:rgba(13,148,136,0.1); }
  .charge-btn { width:100%; padding:15px; border:none; border-radius:12px; font-size:16px; font-weight:800; color:white; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
  .charge-btn:hover { filter:brightness(1.1); transform:translateY(-1px); }
  .charge-btn:active { transform:none; }
  .charge-btn:disabled { background:#334155 !important; color:#64748b; cursor:not-allowed; transform:none; filter:none; }
  .void-btn { width:100%; padding:8px; background:transparent; border:1px solid #334155; border-radius:8px; color:#64748b; font-size:11px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; text-transform:uppercase; letter-spacing:0.05em; transition:all 0.12s; }
  .void-btn:hover { border-color:#ef4444; color:#ef4444; }
  .offline-banner { background:rgba(245,158,11,0.1); border-bottom:1px solid rgba(245,158,11,0.2); padding:8px 16px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
  .offline-banner-text { font-size:12px; font-weight:700; color:#f59e0b; }
  .offline-banner-count { font-size:11px; color:#f59e0b; font-family:'Space Grotesk',monospace; background:rgba(245,158,11,0.15); padding:2px 8px; border-radius:6px; }
  .ai-bar { height:52px; background:#1e293b; border-top:1px solid #334155; display:flex; align-items:center; flex-shrink:0; overflow:hidden; }
  .ai-bar-label { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#334155; padding:0 10px; border-right:1px solid #334155; height:100%; display:flex; align-items:center; flex-shrink:0; }
  .ai-cards { display:flex; flex:1; overflow:hidden; }
  .ai-card { flex:1; display:flex; align-items:center; gap:8px; padding:0 14px; border-right:1px solid #334155; min-width:0; }
  .ai-card:last-child { border-right:none; }
  .ai-card-icon { font-size:16px; flex-shrink:0; }
  .ai-card-body { display:flex; flex-direction:column; min-width:0; }
  .ai-card-label { font-size:8px; text-transform:uppercase; letter-spacing:0.08em; color:#475569; font-weight:700; white-space:nowrap; }
  .ai-card-val { font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:'Space Grotesk',monospace; }

  /* MENU MGMT */
  .mgmt-overlay { position:fixed; inset:0; background:#0f172a; z-index:100; display:flex; flex-direction:column; animation:slideUp 0.25s ease; }
  @keyframes slideUp { from{transform:translateY(30px);opacity:0} to{transform:none;opacity:1} }
  .mgmt-topbar { height:52px; background:#1e293b; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; padding:0 16px; flex-shrink:0; }
  .mgmt-topbar-title { font-size:15px; font-weight:800; color:#f8fafc; }
  .mgmt-topbar-right { display:flex; align-items:center; gap:8px; }
  .mgmt-close-btn { padding:7px 14px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
  .mgmt-close-btn:hover { border-color:#f8fafc; color:#f8fafc; }
  .mgmt-add-btn { padding:7px 14px; border:none; border-radius:8px; font-size:12px; font-weight:800; color:white; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .mgmt-body { flex:1; display:flex; overflow:hidden; }
  .mgmt-cats-sidebar { width:160px; border-right:1px solid #334155; overflow-y:auto; flex-shrink:0; padding:12px 8px; display:flex; flex-direction:column; gap:4px; }
  .mgmt-cat-btn { padding:10px 12px; border-radius:10px; border:none; background:transparent; color:#64748b; font-size:13px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; text-align:left; transition:all 0.12s; display:flex; align-items:center; gap:8px; }
  .mgmt-cat-btn:hover { background:#1e293b; color:#f8fafc; }
  .mgmt-cat-btn.active { background:#1e293b; color:#f8fafc; }
  .mgmt-items-list { flex:1; overflow-y:auto; padding:16px; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
  .mgmt-item-row { background:#1e293b; border:1px solid #334155; border-radius:14px; padding:14px 16px; display:flex; align-items:center; gap:14px; margin-bottom:10px; }
  .mgmt-item-row.inactive { opacity:0.5; }
  .mgmt-item-thumb { width:48px; height:48px; border-radius:10px; background:#0f172a; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; overflow:hidden; }
  .mgmt-item-thumb img { width:100%; height:100%; object-fit:cover; }
  .mgmt-item-info { flex:1; min-width:0; }
  .mgmt-item-name { font-size:14px; font-weight:700; color:#f8fafc; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mgmt-item-meta { font-size:12px; color:#64748b; font-family:'Space Grotesk',monospace; }
  .mgmt-item-margin { font-size:11px; font-weight:700; color:#22c55e; margin-left:8px; }
  .mgmt-item-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
  .mgmt-toggle-btn { width:44px; height:24px; border-radius:12px; border:none; cursor:pointer; transition:all 0.2s; position:relative; flex-shrink:0; }
  .mgmt-toggle-btn::after { content:''; position:absolute; top:2px; width:20px; height:20px; border-radius:50%; background:white; transition:all 0.2s; }
  .mgmt-toggle-btn.on::after { left:22px; }
  .mgmt-toggle-btn.off { background:#334155; }
  .mgmt-toggle-btn.off::after { left:2px; }
  .mgmt-edit-btn { padding:6px 12px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:11px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.12s; }
  .mgmt-edit-btn:hover { border-color:#0d9488; color:#14b8a6; }
  .mgmt-del-btn { padding:6px 10px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:14px; cursor:pointer; transition:all 0.12s; }
  .mgmt-del-btn:hover { border-color:#ef4444; background:rgba(239,68,68,0.08); }
  .form-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:300; padding:20px; }
  .form-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:32px; width:100%; max-width:440px; max-height:90vh; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
  .form-title { font-size:20px; font-weight:800; color:#f8fafc; margin-bottom:24px; }
  .form-field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .form-label { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; }
  .form-input { padding:11px 14px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:14px; font-weight:500; color:#f8fafc; font-family:'Plus Jakarta Sans',sans-serif; outline:none; width:100%; transition:border-color 0.15s; }
  .form-input::placeholder { color:#475569; }
  .form-input:focus { border-color:#0d9488; }
  .form-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .form-select { padding:11px 14px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:14px; font-weight:500; color:#f8fafc; font-family:'Plus Jakarta Sans',sans-serif; outline:none; width:100%; -webkit-appearance:none; }
  .form-select option { background:#0f172a; }
  .img-upload-zone { border:2px dashed #334155; border-radius:12px; padding:24px; text-align:center; cursor:pointer; transition:all 0.15s; }
  .img-upload-zone:hover { border-color:#0d9488; }
  .img-preview { width:80px; height:80px; border-radius:12px; object-fit:cover; margin:0 auto 10px; display:block; }
  .img-upload-text { font-size:12px; color:#64748b; font-weight:600; }
  .img-upload-hint { font-size:10px; color:#475569; margin-top:4px; }
  .form-btns { display:flex; gap:10px; margin-top:20px; }
  .form-cancel { flex:1; padding:12px; background:transparent; border:1px solid #334155; border-radius:10px; color:#64748b; font-size:13px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .form-save { flex:2; padding:12px; border:none; border-radius:10px; color:white; font-size:13px; font-weight:800; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .form-save:disabled { background:#334155 !important; color:#64748b; cursor:not-allowed; }
  .margin-preview { display:flex; align-items:center; justify-content:space-between; background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px 14px; margin-bottom:14px; }
  .margin-preview-label { font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; }
  .margin-preview-val { font-size:18px; font-weight:800; font-family:'Space Grotesk',monospace; }

  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:200; padding:20px; }
  .modal-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:32px; width:100%; max-width:380px; }
  .modal-title { font-size:20px; font-weight:800; color:#f8fafc; margin-bottom:6px; }
  .modal-sub { font-size:13px; color:#64748b; margin-bottom:24px; line-height:1.5; }
  .modal-kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:24px; }
  .modal-kpi { background:#0f172a; border:1px solid #334155; border-radius:10px; padding:12px; text-align:center; }
  .modal-kpi-val { font-family:'Space Grotesk',monospace; font-size:20px; font-weight:700; display:block; }
  .modal-kpi-label { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-top:2px; display:block; }
  .modal-btns { display:flex; gap:10px; }
  .modal-cancel { flex:1; padding:12px; background:transparent; border:1px solid #334155; border-radius:10px; color:#64748b; font-size:13px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .modal-confirm { flex:2; padding:12px; background:#ef4444; border:none; border-radius:10px; color:white; font-size:13px; font-weight:800; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .modal-confirm:hover { background:#dc2626; }
  .del-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:400; padding:20px; }
  .del-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:32px; width:100%; max-width:360px; text-align:center; }
  .del-icon { font-size:40px; margin-bottom:16px; }
  .del-title { font-size:18px; font-weight:800; color:#f8fafc; margin-bottom:8px; }
  .del-sub { font-size:13px; color:#64748b; margin-bottom:24px; line-height:1.5; }
  .del-btns { display:flex; gap:10px; }
  .del-cancel { flex:1; padding:12px; background:transparent; border:1px solid #334155; border-radius:10px; color:#64748b; font-size:13px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .del-confirm { flex:1; padding:12px; background:#ef4444; border:none; border-radius:10px; color:white; font-size:13px; font-weight:800; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }

  .toast { position:fixed; top:60px; left:50%; transform:translateX(-50%); background:#22c55e; color:#0a0a0a; font-weight:800; font-size:14px; padding:10px 24px; border-radius:10px; z-index:999; white-space:nowrap; animation:toastIn 0.2s ease, toastOut 0.3s ease 1.7s forwards; pointer-events:none; }
  @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(-8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  @keyframes toastOut { from{opacity:1} to{opacity:0} }
  .toast-warn { background:#f59e0b !important; }
  .toast-err  { background:#ef4444 !important; }

  .loading-root { min-height:100vh; background:#0f172a; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:14px; font-family:'Plus Jakarta Sans',sans-serif; }
  .loading-s { width:48px; height:48px; background:#0d9488; border-radius:14px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:24px; color:white; animation:breathe 1.5s ease-in-out infinite; }
  @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
  .loading-text { font-size:13px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.1em; }

  /* DASHBOARD */
  .dash-overlay { position:fixed; inset:0; background:#0f172a; z-index:100; display:flex; flex-direction:column; animation:slideUp 0.25s ease; }
  .dash-topbar { height:52px; background:#1e293b; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; padding:0 16px; flex-shrink:0; }
  .dash-topbar-title { font-size:15px; font-weight:800; color:#f8fafc; }
  .dash-close-btn { padding:7px 14px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
  .dash-close-btn:hover { border-color:#f8fafc; color:#f8fafc; }
  .dash-tabs { display:flex; gap:0; border-bottom:1px solid #334155; flex-shrink:0; overflow-x:auto; scrollbar-width:none; }
  .dash-tab { padding:12px 20px; border:none; background:transparent; color:#64748b; font-size:13px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; border-bottom:2px solid transparent; transition:all 0.15s; white-space:nowrap; }
  .dash-tab:hover { color:#f8fafc; }
  .dash-tab.active { color:#f8fafc; border-bottom-color:#0d9488; }
  .dash-body { flex:1; overflow-y:auto; padding:20px; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
  .kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:20px; }
  @media(min-width:600px){ .kpi-grid { grid-template-columns:repeat(4,1fr); } }
  .kpi-card { background:#1e293b; border:1px solid #334155; border-radius:14px; padding:16px; }
  .kpi-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:8px; }
  .kpi-value { font-size:26px; font-weight:800; font-family:'Space Grotesk',monospace; letter-spacing:-0.03em; line-height:1; margin-bottom:4px; }
  .kpi-sub { font-size:11px; color:#64748b; font-weight:600; }
  .kpi-sub.up { color:#22c55e; }
  .chart-card { background:#1e293b; border:1px solid #334155; border-radius:14px; padding:18px; margin-bottom:20px; }
  .chart-card-title { font-size:13px; font-weight:800; color:#f8fafc; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em; }
  .chart-card-sub { font-size:11px; color:#64748b; margin-bottom:20px; }
  .bar-chart { display:flex; align-items:flex-end; gap:8px; height:120px; }
  .bar-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; justify-content:flex-end; }
  .bar-val { font-size:9px; font-weight:700; font-family:'Space Grotesk',monospace; color:#64748b; white-space:nowrap; }
  .bar-fill { width:100%; border-radius:5px 5px 0 0; min-height:3px; }
  .bar-label { font-size:9px; color:#64748b; font-weight:600; }
  .dash-section { background:#1e293b; border:1px solid #334155; border-radius:14px; overflow:hidden; margin-bottom:20px; }
  .dash-section-hd { padding:14px 16px; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; }
  .dash-section-title { font-size:13px; font-weight:800; color:#f8fafc; text-transform:uppercase; letter-spacing:0.05em; }
  .dash-section-tag { font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px; }
  .shift-row { display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid rgba(51,65,85,0.5); }
  .shift-row:last-child { border-bottom:none; }
  .shift-row-icon { width:38px; height:38px; border-radius:10px; background:#0f172a; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
  .shift-row-info { flex:1; min-width:0; }
  .shift-row-name { font-size:13px; font-weight:700; color:#f8fafc; margin-bottom:2px; }
  .shift-row-meta { font-size:11px; color:#64748b; }
  .shift-row-stats { text-align:right; flex-shrink:0; }
  .shift-row-rev { font-size:15px; font-weight:800; font-family:'Space Grotesk',monospace; }
  .shift-row-profit { font-size:11px; color:#22c55e; font-family:'Space Grotesk',monospace; }
  .shift-status-badge { font-size:9px; font-weight:700; padding:2px 7px; border-radius:5px; text-transform:uppercase; letter-spacing:0.06em; }
  .loc-perf-row { padding:12px 16px; border-bottom:1px solid rgba(51,65,85,0.4); }
  .loc-perf-row:last-child { border-bottom:none; }
  .loc-perf-hd { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
  .loc-perf-name { font-size:13px; font-weight:700; color:#f8fafc; }
  .loc-perf-vals { font-size:12px; font-weight:700; font-family:'Space Grotesk',monospace; }
  .loc-bar-track { height:6px; background:#0f172a; border-radius:3px; overflow:hidden; }
  .loc-bar-fill { height:100%; border-radius:3px; }
  .loc-perf-sub { font-size:10px; color:#64748b; margin-top:4px; }
  .seller-row { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid rgba(51,65,85,0.4); }
  .seller-row:last-child { border-bottom:none; }
  .seller-rank { width:24px; height:24px; border-radius:7px; background:#0f172a; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#64748b; flex-shrink:0; }
  .seller-rank.gold { background:rgba(245,158,11,0.15); color:#f59e0b; }
  .seller-rank.silver { background:rgba(148,163,184,0.15); color:#94a3b8; }
  .seller-rank.bronze { background:rgba(234,88,12,0.15); color:#ea580c; }
  .seller-emoji { font-size:22px; flex-shrink:0; }
  .seller-info { flex:1; }
  .seller-name { font-size:13px; font-weight:700; color:#f8fafc; }
  .seller-stats { text-align:right; }
  .seller-sold { font-size:13px; font-weight:700; font-family:'Space Grotesk',monospace; }
  .seller-rev { font-size:11px; color:#64748b; font-family:'Space Grotesk',monospace; }
  .empty-state { text-align:center; padding:60px 20px; }
  .empty-state-icon { font-size:48px; margin-bottom:16px; opacity:0.4; }
  .empty-state-title { font-size:16px; font-weight:700; color:#f8fafc; margin-bottom:8px; }
  .empty-state-sub { font-size:13px; color:#64748b; line-height:1.6; }

  /* ── KDS — KITCHEN DISPLAY SYSTEM ── */
  .kds-root { min-height:100vh; background:#080c14; display:flex; flex-direction:column; font-family:'Plus Jakarta Sans',sans-serif; overflow:hidden; }
  .kds-topbar { height:60px; background:#0f172a; border-bottom:2px solid #1e293b; display:flex; align-items:center; justify-content:space-between; padding:0 24px; flex-shrink:0; }
  .kds-logo { display:flex; align-items:center; gap:10px; }
  .kds-logo-s { width:34px; height:34px; background:#0d9488; border-radius:9px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:17px; color:white; }
  .kds-logo-text { font-size:17px; font-weight:800; color:#f8fafc; letter-spacing:-0.02em; }
  .kds-logo-text span { color:#0d9488; }
  .kds-title { font-size:14px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; }
  .kds-stats { display:flex; align-items:center; gap:20px; }
  .kds-stat { text-align:center; }
  .kds-stat-val { font-size:22px; font-weight:800; font-family:'Space Grotesk',monospace; display:block; line-height:1; }
  .kds-stat-label { font-size:9px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.08em; }
  .kds-live { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#22c55e; }
  .kds-live-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e; animation:pulse 2s infinite; }

  /* STATUS COLUMNS */
  .kds-body { flex:1; display:grid; grid-template-columns:repeat(3,1fr); gap:16px; padding:16px; overflow:hidden; }
  .kds-col { display:flex; flex-direction:column; gap:12px; overflow:hidden; }
  .kds-col-hd { display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:12px; flex-shrink:0; }
  .kds-col-hd-icon { font-size:20px; }
  .kds-col-hd-title { font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; }
  .kds-col-hd-count { font-size:13px; font-weight:800; font-family:'Space Grotesk',monospace; margin-left:auto; padding:4px 10px; border-radius:8px; }
  .kds-col-body { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px; scrollbar-width:none; }
  .kds-col-body::-webkit-scrollbar { display:none; }

  /* ORDER CARDS */
  .kds-card { border-radius:16px; padding:16px; cursor:pointer; transition:all 0.2s; border:2px solid transparent; animation:cardIn 0.3s ease; }
  @keyframes cardIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  .kds-card:hover { transform:translateY(-2px); }
  .kds-card:active { transform:scale(0.98); }

  /* NEW — white/bright */
  .kds-card.new { background:#1e2a3a; border-color:#334155; }
  .kds-card.new:hover { border-color:#60a5fa; }

  /* COOKING — amber */
  .kds-card.cooking { background:#1c1a0e; border-color:#713f12; animation:cardIn 0.3s ease; }
  .kds-card.cooking:hover { border-color:#f59e0b; }

  /* READY — green pulsing */
  .kds-card.ready { background:#0a1f0f; border-color:#14532d; animation:cardIn 0.3s ease, readyPulse 2s ease-in-out infinite; }
  @keyframes readyPulse { 0%,100%{border-color:#14532d} 50%{border-color:#22c55e; box-shadow:0 0 20px rgba(34,197,94,0.2)} }
  .kds-card.ready:hover { border-color:#22c55e; }

  .kds-card-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .kds-order-num { font-size:28px; font-weight:800; font-family:'Space Grotesk',monospace; line-height:1; }
  .kds-card.new    .kds-order-num { color:#f8fafc; }
  .kds-card.cooking .kds-order-num { color:#f59e0b; }
  .kds-card.ready  .kds-order-num { color:#22c55e; }
  .kds-card-meta { text-align:right; }
  .kds-card-time { font-size:13px; font-weight:700; font-family:'Space Grotesk',monospace; }
  .kds-card.new    .kds-card-time { color:#64748b; }
  .kds-card.cooking .kds-card-time { color:#f59e0b; }
  .kds-card.ready  .kds-card-time { color:#22c55e; }
  .kds-card-payment { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-top:2px; }
  .kds-items { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .kds-item { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; background:rgba(255,255,255,0.04); }
  .kds-item-qty { font-size:18px; font-weight:800; font-family:'Space Grotesk',monospace; min-width:28px; }
  .kds-card.new    .kds-item-qty { color:#f8fafc; }
  .kds-card.cooking .kds-item-qty { color:#fbbf24; }
  .kds-card.ready  .kds-item-qty { color:#4ade80; }
  .kds-item-emoji { font-size:20px; }
  .kds-item-name { font-size:15px; font-weight:700; color:#e2e8f0; }
  .kds-action-btn { width:100%; padding:14px; border:none; border-radius:12px; font-size:16px; font-weight:800; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; display:flex; align-items:center; justify-content:center; gap:8px; }
  .kds-action-btn:hover { filter:brightness(1.1); transform:translateY(-1px); }
  .kds-action-btn:active { transform:none; }
  .kds-card.new    .kds-action-btn { background:#1d4ed8; color:white; }
  .kds-card.cooking .kds-action-btn { background:#d97706; color:white; }
  .kds-card.ready  .kds-action-btn { background:#16a34a; color:white; }

  .kds-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:10px; opacity:0.3; }
  .kds-empty-icon { font-size:40px; }
  .kds-empty-text { font-size:13px; font-weight:700; color:#64748b; }

  .kds-auth-root { min-height:100vh; background:#080c14; display:flex; align-items:center; justify-content:center; padding:20px; flex-direction:column; gap:20px; }
  .kds-auth-card { background:#0f172a; border:1px solid #1e293b; border-radius:20px; padding:40px; width:100%; max-width:380px; }
  .kds-auth-title { font-size:22px; font-weight:800; color:#f8fafc; margin-bottom:6px; }
  .kds-auth-sub { font-size:14px; color:#475569; margin-bottom:28px; line-height:1.5; }

  /* ── AI INSIGHTS ── */
  .ai-insights-overlay { position:fixed; inset:0; background:#0f172a; z-index:100; display:flex; flex-direction:column; animation:slideUp 0.25s ease; }
  .ai-insights-topbar { height:52px; background:#1e293b; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; padding:0 16px; flex-shrink:0; }
  .ai-insights-topbar-left { display:flex; align-items:center; gap:10px; }
  .ai-bolt-badge { width:32px; height:32px; background:#0f172a; border-radius:8px; border:1px solid #0d9488; display:flex; align-items:center; justify-content:center; font-size:16px; }
  .ai-insights-title { font-size:15px; font-weight:800; color:#f8fafc; }
  .ai-insights-sub { font-size:11px; color:#64748b; font-weight:600; }
  .ai-close-btn { padding:7px 14px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
  .ai-close-btn:hover { border-color:#f8fafc; color:#f8fafc; }
  .ai-insights-body { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:14px; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
  .ai-insight-card { background:#1e293b; border:1px solid #334155; border-radius:14px; padding:20px; display:flex; gap:16px; align-items:flex-start; transition:border-color 0.15s; }
  .ai-insight-card:hover { border-color:rgba(13,148,136,0.3); }
  .ai-insight-icon-wrap { width:44px; height:44px; border-radius:12px; background:#0f172a; border:1px solid #334155; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
  .ai-insight-body { flex:1; }
  .ai-insight-type { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#64748b; margin-bottom:4px; }
  .ai-insight-headline { font-size:17px; font-weight:800; color:#f8fafc; margin-bottom:6px; line-height:1.3; }
  .ai-insight-detail { font-size:13px; color:#94a3b8; line-height:1.6; }
  .ai-insight-stat { display:inline-flex; align-items:center; gap:6px; margin-top:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; padding:6px 12px; font-size:13px; font-weight:700; font-family:'Space Grotesk',monospace; }
  .ai-no-data { text-align:center; padding:80px 20px; }
  .ai-no-data-icon { font-size:52px; margin-bottom:16px; opacity:0.3; }
  .ai-no-data-title { font-size:18px; font-weight:800; color:#f8fafc; margin-bottom:8px; }
  .ai-no-data-sub { font-size:14px; color:#64748b; line-height:1.6; max-width:320px; margin:0 auto; }

  /* ── INVENTORY ── */
  .inv-overlay { position:fixed; inset:0; background:#0f172a; z-index:100; display:flex; flex-direction:column; animation:slideUp 0.25s ease; }
  .inv-topbar { height:52px; background:#1e293b; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; padding:0 16px; flex-shrink:0; }
  .inv-topbar-title { font-size:15px; font-weight:800; color:#f8fafc; }
  .inv-topbar-right { display:flex; align-items:center; gap:8px; }
  .inv-add-btn { padding:7px 14px; border:none; border-radius:8px; font-size:12px; font-weight:800; color:white; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .inv-close-btn { padding:7px 14px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
  .inv-close-btn:hover { border-color:#f8fafc; color:#f8fafc; }
  .inv-body { flex:1; overflow-y:auto; padding:16px; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
  .inv-summary-bar { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
  .inv-summary-card { background:#1e293b; border:1px solid #334155; border-radius:12px; padding:14px; text-align:center; }
  .inv-summary-val { font-size:22px; font-weight:800; font-family:'Space Grotesk',monospace; display:block; line-height:1; margin-bottom:4px; }
  .inv-summary-label { font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.07em; }
  .inv-item-card { background:#1e293b; border:1px solid #334155; border-radius:14px; padding:16px; margin-bottom:10px; transition:border-color 0.15s; }
  .inv-item-card.low { border-color:rgba(239,68,68,0.4); background:rgba(239,68,68,0.03); }
  .inv-item-card.ok  { border-color:#334155; }
  .inv-item-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .inv-item-name { font-size:15px; font-weight:800; color:#f8fafc; }
  .inv-item-badges { display:flex; align-items:center; gap:6px; }
  .inv-unit-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px; background:#0f172a; border:1px solid #334155; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; }
  .inv-mode-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px; text-transform:uppercase; letter-spacing:0.06em; }
  .inv-status-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px; text-transform:uppercase; letter-spacing:0.06em; }
  .inv-item-track { margin-bottom:12px; }
  .inv-track-hd { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; }
  .inv-track-qty { font-size:20px; font-weight:800; font-family:'Space Grotesk',monospace; }
  .inv-track-alert { font-size:11px; color:#64748b; font-family:'Space Grotesk',monospace; }
  .inv-bar-track { height:8px; background:#0f172a; border-radius:4px; overflow:hidden; }
  .inv-bar-fill { height:100%; border-radius:4px; transition:width 0.6s ease; }
  .inv-item-meta { font-size:11px; color:#64748b; margin-top:6px; }
  .inv-item-actions { display:flex; gap:8px; margin-top:12px; }
  .inv-restock-btn { flex:2; padding:9px; border:none; border-radius:8px; font-size:13px; font-weight:800; color:white; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
  .inv-restock-btn:hover { filter:brightness(1.1); }
  .inv-edit-btn { flex:1; padding:9px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.12s; }
  .inv-edit-btn:hover { border-color:#0d9488; color:#14b8a6; }
  .inv-del-btn { padding:9px 12px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:14px; cursor:pointer; transition:all 0.12s; }
  .inv-del-btn:hover { border-color:#ef4444; background:rgba(239,68,68,0.08); }
  .inv-form-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:300; padding:20px; }
  .inv-form-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:32px; width:100%; max-width:420px; max-height:90vh; overflow-y:auto; }
  .inv-form-title { font-size:20px; font-weight:800; color:#f8fafc; margin-bottom:24px; }
  .inv-form-field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .inv-form-label { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; }
  .inv-form-input { padding:11px 14px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:14px; font-weight:500; color:#f8fafc; font-family:'Plus Jakarta Sans',sans-serif; outline:none; width:100%; transition:border-color 0.15s; }
  .inv-form-input::placeholder { color:#475569; }
  .inv-form-input:focus { border-color:#0d9488; }
  .inv-form-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .inv-form-select { padding:11px 14px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:14px; font-weight:500; color:#f8fafc; font-family:'Plus Jakarta Sans',sans-serif; outline:none; width:100%; -webkit-appearance:none; }
  .inv-form-select option { background:#0f172a; }
  .inv-mode-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .inv-mode-btn { padding:12px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; text-align:center; transition:all 0.12s; }
  .inv-mode-btn:hover { border-color:#0d9488; color:#f8fafc; }
  .inv-mode-btn.selected { border-color:#0d9488; color:#f8fafc; background:rgba(13,148,136,0.1); }
  .inv-mode-desc { font-size:10px; color:#475569; margin-top:4px; font-weight:400; }
  .inv-form-btns { display:flex; gap:10px; margin-top:20px; }
  .inv-form-cancel { flex:1; padding:12px; background:transparent; border:1px solid #334155; border-radius:10px; color:#64748b; font-size:13px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .inv-form-save { flex:2; padding:12px; border:none; border-radius:10px; color:white; font-size:13px; font-weight:800; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .inv-form-save:disabled { background:#334155 !important; color:#64748b; cursor:not-allowed; }
  .restock-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:400; padding:20px; }
  .restock-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:32px; width:100%; max-width:360px; }
  .restock-title { font-size:20px; font-weight:800; color:#f8fafc; margin-bottom:6px; }
  .restock-sub { font-size:13px; color:#64748b; margin-bottom:24px; }
  .restock-current { font-size:13px; color:#64748b; margin-bottom:16px; font-family:'Space Grotesk',monospace; }
  .restock-input { padding:16px; background:#0f172a; border:1.5px solid #334155; border-radius:12px; font-size:24px; font-weight:800; color:#f8fafc; font-family:'Space Grotesk',monospace; outline:none; width:100%; margin-bottom:16px; text-align:center; transition:border-color 0.15s; }
  .restock-input:focus { border-color:#0d9488; }
  .restock-btns { display:flex; gap:10px; }
  .restock-cancel { flex:1; padding:12px; background:transparent; border:1px solid #334155; border-radius:10px; color:#64748b; font-size:13px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .restock-confirm { flex:2; padding:12px; border:none; border-radius:10px; color:white; font-size:14px; font-weight:800; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .inv-empty { text-align:center; padding:80px 20px; }
  .inv-empty-icon { font-size:52px; margin-bottom:16px; opacity:0.3; }
  .inv-empty-title { font-size:18px; font-weight:800; color:#f8fafc; margin-bottom:8px; }
  .inv-empty-sub { font-size:14px; color:#64748b; line-height:1.6; max-width:300px; margin:0 auto 24px; }
  .inv-empty-btn { padding:12px 24px; border:none; border-radius:10px; font-size:14px; font-weight:800; color:white; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }

  /* ── LOCATION MANAGEMENT ── */
  .loc-mgmt-overlay { position:fixed; inset:0; background:#0f172a; z-index:100; display:flex; flex-direction:column; animation:slideUp 0.25s ease; }
  .loc-mgmt-topbar { height:52px; background:#1e293b; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; padding:0 16px; flex-shrink:0; }
  .loc-mgmt-title { font-size:15px; font-weight:800; color:#f8fafc; }
  .loc-mgmt-right { display:flex; align-items:center; gap:8px; }
  .loc-mgmt-add-btn { padding:7px 14px; border:none; border-radius:8px; font-size:12px; font-weight:800; color:white; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .loc-mgmt-close-btn { padding:7px 14px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:12px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
  .loc-mgmt-close-btn:hover { border-color:#f8fafc; color:#f8fafc; }
  .loc-mgmt-body { flex:1; overflow-y:auto; padding:20px; max-width:600px; margin:0 auto; width:100%; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
  .loc-card { background:#1e293b; border:1px solid #334155; border-radius:14px; padding:18px 20px; display:flex; align-items:center; gap:14px; margin-bottom:10px; transition:border-color 0.15s; }
  .loc-card:hover { border-color:rgba(13,148,136,0.3); }
  .loc-card-icon { width:42px; height:42px; border-radius:10px; background:#0f172a; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
  .loc-card-info { flex:1; }
  .loc-card-name { font-size:15px; font-weight:700; color:#f8fafc; margin-bottom:3px; }
  .loc-card-address { font-size:12px; color:#64748b; }
  .loc-card-actions { display:flex; gap:6px; flex-shrink:0; }
  .loc-edit-btn { padding:7px 14px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:11px; font-weight:700; color:#64748b; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.12s; }
  .loc-edit-btn:hover { border-color:#0d9488; color:#14b8a6; }
  .loc-del-btn { padding:7px 10px; background:transparent; border:1px solid #334155; border-radius:8px; font-size:14px; cursor:pointer; transition:all 0.12s; }
  .loc-del-btn:hover { border-color:#ef4444; background:rgba(239,68,68,0.08); }
  .loc-form-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:300; padding:20px; }
  .loc-form-card { background:#1e293b; border:1px solid #334155; border-radius:20px; padding:32px; width:100%; max-width:400px; }
  .loc-form-title { font-size:20px; font-weight:800; color:#f8fafc; margin-bottom:24px; }
  .loc-form-field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .loc-form-label { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; }
  .loc-form-input { padding:12px 14px; background:#0f172a; border:1.5px solid #334155; border-radius:10px; font-size:14px; font-weight:500; color:#f8fafc; font-family:'Plus Jakarta Sans',sans-serif; outline:none; width:100%; transition:border-color 0.15s; }
  .loc-form-input::placeholder { color:#475569; }
  .loc-form-input:focus { border-color:#0d9488; }
  .loc-form-btns { display:flex; gap:10px; margin-top:20px; }
  .loc-form-cancel { flex:1; padding:12px; background:transparent; border:1px solid #334155; border-radius:10px; color:#64748b; font-size:13px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .loc-form-save { flex:2; padding:12px; border:none; border-radius:10px; color:white; font-size:13px; font-weight:800; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
  .loc-form-save:disabled { background:#334155 !important; color:#64748b; cursor:not-allowed; }
  .loc-empty { text-align:center; padding:80px 20px; }
  .loc-empty-icon { font-size:52px; margin-bottom:16px; opacity:0.3; }
  .loc-empty-title { font-size:18px; font-weight:800; color:#f8fafc; margin-bottom:8px; }
  .loc-empty-sub { font-size:14px; color:#64748b; line-height:1.6; margin-bottom:24px; }
`

// ─── SHARED COMPONENTS ────────────────────────────────────────
function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="loading-root">
      <div className="loading-s">S</div>
      <div className="loading-text">{text}</div>
    </div>
  )
}

function AuthScreen({ onAuth }: { onAuth?: () => void }) {
  const [mode, setMode]       = useState<'login'|'signup'>('login')
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const handle = async () => {
    if (!email || !pass) return
    setLoading(true); setError('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (error) setError(error.message); else onAuth?.()
    } else {
      const { error } = await supabase.auth.signUp({ email, password: pass })
      if (error) setError(error.message)
      else setError('Check your email to confirm, then sign in.')
    }
    setLoading(false)
  }
  return (
    <div className="auth-root">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-s">S</div>
          <div><div className="auth-logo-name">Setzio<span>Street</span></div><div className="auth-logo-sub">Business OS</div></div>
        </div>
        <div className="auth-title">{mode === 'login' ? 'Welcome back 👋' : 'Create account'}</div>
        <div className="auth-sub">{mode === 'login' ? 'Sign in to your dashboard.' : 'Start selling smarter.'}</div>
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-field"><label className="auth-label">Email</label><input className="auth-input" type="email" placeholder="you@yourbusiness.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter'&&handle()} /></div>
        <div className="auth-field"><label className="auth-label">Password</label><input className="auth-input" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==='Enter'&&handle()} /></div>
        <button className="auth-btn" onClick={handle} disabled={loading||!email||!pass}>{loading?'One moment…':mode==='login'?'→ Sign In':'→ Create Account'}</button>
        <div className="auth-toggle">{mode==='login'?"No account?":'Have an account?'}<button onClick={() => { setMode(mode==='login'?'signup':'login'); setError('') }}>{mode==='login'?'Sign up':'Sign in'}</button></div>
      </div>
      <div className="auth-powered">Powered by <span>Setzio</span></div>
    </div>
  )
}

// ─── KDS ──────────────────────────────────────────────────────
function KitchenDisplay({ business }: { business: Business }) {
  const [orders, setOrders] = useState<KDSOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick]       = useState(0)

  // Tick every second to update elapsed times
  useEffect(() => {
    const t = setInterval(() => setTick(n => n+1), 1000)
    return () => clearInterval(t)
  }, [])

  const loadOrders = useCallback(async () => {
    const { data: orderData } = await db
      .from('orders')
      .select('id, order_number, kitchen_status, created_at, paid_at, payment_method, total')
      .eq('truck_id', business.id)
      .in('kitchen_status', ['new','cooking','ready'])
      .order('created_at', { ascending: true })

    if (!orderData) { setLoading(false); return }

    // Load items for each order
    const withItems: KDSOrder[] = await Promise.all(orderData.map(async (o: any) => {
      const { data: items } = await db
        .from('order_items')
        .select('name, emoji, quantity')
        .eq('order_id', o.id)
      return { ...o, items: items || [] }
    }))

    setOrders(withItems)
    setLoading(false)
  }, [business.id])

  useEffect(() => {
    loadOrders()

    // Realtime — fires instantly if websocket works
    const channel = supabase
      .channel(`kds-${business.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadOrders() })
      .subscribe()

    // 3-second polling fallback — guarantees orders appear even if realtime is blocked by RLS
    const poll = setInterval(() => loadOrders(), 3000)

    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [business.id, loadOrders])

  const advance = async (order: KDSOrder) => {
    const next = order.kitchen_status === 'new' ? 'cooking' : order.kitchen_status === 'cooking' ? 'ready' : 'served'
    await db.from('orders').update({ kitchen_status: next }).eq('id', order.id)
    if (next === 'served') {
      setOrders(prev => prev.filter(o => o.id !== order.id))
    } else {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, kitchen_status: next as any } : o))
    }
  }

  const byStatus = (s: string) => orders.filter(o => o.kitchen_status === s)

  const actionLabel = (s: string) => s === 'new' ? '👨‍🍳 Start Cooking' : s === 'cooking' ? '✅ Mark Ready' : '🙌 Served'

  const cols = [
    { status: 'new',     label: 'New Orders',   icon: '🔔', bg: 'rgba(29,78,216,0.12)',  countBg: 'rgba(29,78,216,0.2)',  countColor: '#60a5fa' },
    { status: 'cooking', label: 'Cooking',       icon: '🔥', bg: 'rgba(217,119,6,0.12)',  countBg: 'rgba(217,119,6,0.2)',  countColor: '#f59e0b' },
    { status: 'ready',   label: 'Ready to Serve',icon: '✅', bg: 'rgba(22,163,74,0.12)',  countBg: 'rgba(22,163,74,0.2)',  countColor: '#22c55e' },
  ]

  const newCount     = byStatus('new').length
  const cookingCount = byStatus('cooking').length
  const readyCount   = byStatus('ready').length

  if (loading) return (
    <div className="kds-root" style={{alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',color:'#475569'}}>
        <div style={{fontSize:48,marginBottom:16}}>👨‍🍳</div>
        <div style={{fontSize:14,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em'}}>Loading orders…</div>
      </div>
    </div>
  )

  return (
    <div className="kds-root">
      <div className="kds-topbar">
        <div className="kds-logo">
          <div className="kds-logo-s">S</div>
          <div>
            <div className="kds-logo-text">Setzio<span>Street</span></div>
          </div>
        </div>
        <div className="kds-title">🍳 Kitchen Display</div>
        <div className="kds-stats">
          <div className="kds-stat">
            <span className="kds-stat-val" style={{color:'#60a5fa'}}>{newCount}</span>
            <span className="kds-stat-label">New</span>
          </div>
          <div className="kds-stat">
            <span className="kds-stat-val" style={{color:'#f59e0b'}}>{cookingCount}</span>
            <span className="kds-stat-label">Cooking</span>
          </div>
          <div className="kds-stat">
            <span className="kds-stat-val" style={{color:'#22c55e'}}>{readyCount}</span>
            <span className="kds-stat-label">Ready</span>
          </div>
          <div className="kds-live"><div className="kds-live-dot"/>Live</div>
        </div>
      </div>

      <div className="kds-body">
        {cols.map(col => (
          <div key={col.status} className="kds-col">
            <div className="kds-col-hd" style={{background:col.bg}}>
              <span className="kds-col-hd-icon">{col.icon}</span>
              <span className="kds-col-hd-title" style={{color:col.countColor}}>{col.label}</span>
              <span className="kds-col-hd-count" style={{background:col.countBg,color:col.countColor}}>
                {byStatus(col.status).length}
              </span>
            </div>
            <div className="kds-col-body">
              {byStatus(col.status).length === 0 ? (
                <div className="kds-empty">
                  <div className="kds-empty-icon">{col.status==='new'?'🛎️':col.status==='cooking'?'🍳':'🎉'}</div>
                  <div className="kds-empty-text">{col.status==='new'?'Waiting for orders…':col.status==='cooking'?'Nothing cooking yet':'Nothing ready yet'}</div>
                </div>
              ) : byStatus(col.status).map(order => (
                <div key={order.id} className={`kds-card ${order.kitchen_status}`} onClick={() => advance(order)}>
                  <div className="kds-card-hd">
                    <div className="kds-order-num">#{order.order_number}</div>
                    <div className="kds-card-meta">
                      <div className="kds-card-time">{elapsed(order.paid_at || order.created_at)}</div>
                      <div className="kds-card-payment">{order.payment_method === 'cash' ? '💵 Cash' : '💳 Card'}</div>
                    </div>
                  </div>
                  <div className="kds-items">
                    {order.items.map((item, i) => (
                      <div key={i} className="kds-item">
                        <span className="kds-item-qty">{item.quantity}×</span>
                        <span className="kds-item-emoji">{item.emoji}</span>
                        <span className="kds-item-name">{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <button className="kds-action-btn" onClick={e => { e.stopPropagation(); advance(order) }}>
                    {actionLabel(order.kitchen_status)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── KDS ROOT — handles auth for kitchen tablet ───────────────
function KDSRoot() {
  const [session, setSession]   = useState<Session | null>(null)
  const [loading, setLoading]   = useState(true)
  const [business, setBusiness] = useState<Business | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    db.from('trucks').select('*').eq('owner_id', session.user.id).limit(1).single()
      .then(({ data }: any) => { if (data) setBusiness(data) })
  }, [session])

  if (loading) return <><style>{css}</style><Loading text="Kitchen Display Loading…" /></>

  if (!session) return (
    <>
      <style>{css}</style>
      <div className="kds-auth-root">
        <div className="kds-auth-card">
          <div style={{fontSize:48,marginBottom:16,textAlign:'center'}}>🍳</div>
          <div className="kds-auth-title">Kitchen Display</div>
          <div className="kds-auth-sub">Sign in with your Setzio Street account to see incoming orders.</div>
          <AuthScreen />
        </div>
      </div>
    </>
  )

  if (!business) return <><style>{css}</style><Loading text="Loading kitchen…" /></>

  return <><style>{css}</style><KitchenDisplay business={business} /></>
}

// ─── MENU MANAGEMENT ─────────────────────────────────────────
function MenuManagement({ business, categories, menuItems, onClose, onUpdated }: { business: Business; categories: Category[]; menuItems: MenuItem[]; onClose: () => void; onUpdated: (items: MenuItem[]) => void }) {
  const [items, setItems]         = useState<MenuItem[]>(menuItems)
  const [activeCat, setActiveCat] = useState('all')
  const [editItem, setEditItem]   = useState<MenuItem | null>(null)
  const [isNew, setIsNew]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [toast, setToast]         = useState<string | null>(null)
  const [toastType, setToastType] = useState<'ok'|'warn'|'err'>('ok')
  const showToast = (msg: string, type: 'ok'|'warn'|'err' = 'ok') => { setToast(msg); setToastType(type); setTimeout(() => setToast(null), 2200) }
  const filtered = activeCat === 'all' ? items : items.filter(i => i.category_id === activeCat)
  const margin   = (i: MenuItem) => i.price > 0 ? Math.round(((i.price - i.cost_price) / i.price) * 100) : 0
  const toggleActive = async (item: MenuItem) => {
    const newVal = !item.is_active
    await db.from('menu_items').update({ is_active: newVal }).eq('id', item.id)
    const updated = items.map(i => i.id === item.id ? { ...i, is_active: newVal } : i)
    setItems(updated); onUpdated(updated); showToast(newVal ? `${item.name} is now available` : `${item.name} marked as 86'd`)
  }
  const deleteItem = async () => {
    if (!deleteTarget) return
    await db.from('menu_items').delete().eq('id', deleteTarget.id)
    const updated = items.filter(i => i.id !== deleteTarget.id)
    setItems(updated); onUpdated(updated); setDeleteTarget(null); showToast(`${deleteTarget.name} deleted`, 'warn')
  }
  const handleSave = async (item: MenuItem, imageFile?: File) => {
    let imageUrl = item.image_url || ''
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${business.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('menu-images').upload(path, imageFile, { upsert: true })
      if (!upErr) { const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(path); imageUrl = urlData.publicUrl }
    }
    if (isNew) {
      const { data, error } = await db.from('menu_items').insert({ truck_id: business.id, category_id: item.category_id, name: item.name, emoji: item.emoji, price: item.price, cost_price: item.cost_price, is_active: true, image_url: imageUrl || null }).select().single()
      if (!error && data) { const updated = [...items, data]; setItems(updated); onUpdated(updated); showToast(`${item.name} added 🎉`) }
    } else {
      await db.from('menu_items').update({ name: item.name, emoji: item.emoji, price: item.price, cost_price: item.cost_price, category_id: item.category_id, image_url: imageUrl || null }).eq('id', item.id)
      const updated = items.map(i => i.id === item.id ? { ...i, ...item, image_url: imageUrl } : i)
      setItems(updated); onUpdated(updated); showToast(`${item.name} updated`)
    }
    setEditItem(null); setIsNew(false)
  }
  return (
    <div className="mgmt-overlay">
      {toast && <div className={`toast ${toastType==='warn'?'toast-warn':toastType==='err'?'toast-err':''}`}>{toast}</div>}
      {deleteTarget && <div className="del-overlay"><div className="del-card"><div className="del-icon">🗑️</div><div className="del-title">Delete {deleteTarget.name}?</div><div className="del-sub">This can't be undone.</div><div className="del-btns"><button className="del-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="del-confirm" onClick={deleteItem}>Delete</button></div></div></div>}
      {editItem && <ItemForm item={editItem} isNew={isNew} categories={categories} color={business.color} onSave={handleSave} onCancel={() => { setEditItem(null); setIsNew(false) }} />}
      <div className="mgmt-topbar">
        <div className="mgmt-topbar-title">📋 Menu Management</div>
        <div className="mgmt-topbar-right">
          <button className="mgmt-add-btn" style={{background:business.color}} onClick={() => { setEditItem({id:'',name:'',emoji:'🍽️',price:0,cost_price:0,category_id:categories[0]?.id||'',is_active:true,image_url:''}); setIsNew(true) }}>＋ Add Item</button>
          <button className="mgmt-close-btn" onClick={onClose}>← Back to POS</button>
        </div>
      </div>
      <div className="mgmt-body">
        <div className="mgmt-cats-sidebar">
          <button className={`mgmt-cat-btn ${activeCat==='all'?'active':''}`} onClick={() => setActiveCat('all')} style={activeCat==='all'?{color:business.color}:{}}>🍽️ All ({items.length})</button>
          {categories.map(c => <button key={c.id} className={`mgmt-cat-btn ${activeCat===c.id?'active':''}`} onClick={() => setActiveCat(c.id)} style={activeCat===c.id?{color:business.color}:{}}>{c.emoji} {c.name} ({items.filter(i=>i.category_id===c.id).length})</button>)}
        </div>
        <div className="mgmt-items-list">
          {filtered.length === 0 && <div style={{textAlign:'center',padding:'60px 20px',color:'#475569'}}><div style={{fontSize:40,marginBottom:12}}>🍽️</div><div style={{fontWeight:700}}>No items yet</div></div>}
          {filtered.map(item => (
            <div key={item.id} className={`mgmt-item-row ${!item.is_active?'inactive':''}`}>
              <div className="mgmt-item-thumb">{item.image_url ? <img src={item.image_url} alt={item.name} /> : item.emoji}</div>
              <div className="mgmt-item-info">
                <div className="mgmt-item-name">{item.name}</div>
                <div className="mgmt-item-meta">€{item.price.toFixed(2)} sell · €{item.cost_price.toFixed(2)} cost<span className="mgmt-item-margin">{margin(item)}% margin</span></div>
              </div>
              <div className="mgmt-item-actions">
                <button className={`mgmt-toggle-btn ${item.is_active?'on':'off'}`} style={item.is_active?{background:business.color}:{}} onClick={() => toggleActive(item)} />
                <button className="mgmt-edit-btn" onClick={() => { setEditItem(item); setIsNew(false) }}>Edit</button>
                <button className="mgmt-del-btn" onClick={() => setDeleteTarget(item)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── ITEM FORM ────────────────────────────────────────────────
function ItemForm({ item, isNew, categories, color, onSave, onCancel }: { item: MenuItem; isNew: boolean; categories: Category[]; color: string; onSave: (item: MenuItem, file?: File) => void; onCancel: () => void }) {
  const [form, setForm]             = useState<MenuItem>({ ...item })
  const [imgFile, setImgFile]       = useState<File | undefined>()
  const [imgPreview, setImgPreview] = useState<string>(item.image_url || '')
  const [saving, setSaving]         = useState(false)
  const fileRef                     = useRef<HTMLInputElement>(null)
  const margin      = form.price > 0 ? Math.round(((form.price-form.cost_price)/form.price)*100) : 0
  const marginColor = margin >= 70 ? '#22c55e' : margin >= 50 ? '#f59e0b' : '#ef4444'
  const handleImg = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if(!file) return; setImgFile(file); setImgPreview(URL.createObjectURL(file)) }
  const save = async () => { if(!form.name.trim()||!form.price) return; setSaving(true); await onSave(form,imgFile); setSaving(false) }
  return (
    <div className="form-overlay">
      <div className="form-card">
        <div className="form-title">{isNew?'➕ Add Menu Item':`✏️ Edit ${item.name}`}</div>
        <div className="form-field">
          <label className="form-label">Photo (optional)</label>
          <div className="img-upload-zone" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImg} style={{display:'none'}} />
            {imgPreview ? <img src={imgPreview} className="img-preview" alt="preview" /> : <div style={{fontSize:32,marginBottom:8}}>📸</div>}
            <div className="img-upload-text">{imgPreview?'Tap to change photo':'Tap to upload photo'}</div>
            <div className="img-upload-hint">JPG or PNG · Max 5MB</div>
          </div>
        </div>
        <div className="form-row">
          <div className="form-field"><label className="form-label">Emoji</label><input className="form-input" value={form.emoji} onChange={e => setForm(f=>({...f,emoji:e.target.value}))} style={{fontSize:24,textAlign:'center'}} /></div>
          <div className="form-field" style={{flex:3}}><label className="form-label">Item Name *</label><input className="form-input" placeholder="Seoul Fire Wrap" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} /></div>
        </div>
        <div className="form-field">
          <label className="form-label">Category</label>
          <select className="form-select" value={form.category_id} onChange={e => setForm(f=>({...f,category_id:e.target.value}))}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-field"><label className="form-label">Sell Price (€) *</label><input className="form-input" type="number" step="0.10" min="0" placeholder="8.90" value={form.price||''} onChange={e => setForm(f=>({...f,price:parseFloat(e.target.value)||0}))} style={{fontFamily:"'Space Grotesk',monospace"}} /></div>
          <div className="form-field"><label className="form-label">Your Cost (€)</label><input className="form-input" type="number" step="0.10" min="0" placeholder="2.80" value={form.cost_price||''} onChange={e => setForm(f=>({...f,cost_price:parseFloat(e.target.value)||0}))} style={{fontFamily:"'Space Grotesk',monospace"}} /></div>
        </div>
        <div className="margin-preview"><span className="margin-preview-label">Profit Margin</span><span className="margin-preview-val" style={{color:marginColor}}>{margin}%</span></div>
        <div className="form-btns">
          <button className="form-cancel" onClick={onCancel}>Cancel</button>
          <button className="form-save" style={{background:color}} onClick={save} disabled={!form.name.trim()||!form.price||saving}>{saving?'Saving…':isNew?'Add to Menu':'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── DASHBOARD ────────────────────────────────────────────────
function Dashboard({ business, currentShift, onClose }: { business: Business; currentShift: Shift | null; onClose: () => void }) {
  const [tab, setTab]           = useState<'today'|'history'|'locations'|'items'>('today')
  const [loading, setLoading]   = useState(true)
  const [shifts, setShifts]     = useState<Shift[]>([])
  const [topItems, setTopItems] = useState<{ name: string; emoji: string; sold: number; revenue: number }[]>([])
  const [locStats, setLocStats] = useState<{ name: string; revenue: number; profit: number; orders: number; shifts: number }[]>([])
  const [weekData, setWeekData] = useState<{ label: string; revenue: number }[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: shiftData } = await db.from('shifts').select('*, locations(name)').eq('truck_id', business.id).order('started_at', { ascending: false }).limit(50)
    const allShifts: Shift[] = (shiftData || []).map((s: any) => ({ ...s, location_name: s.locations?.name || 'Unknown' }))
    setShifts(allShifts)
    const locMap: Record<string,{ name:string; revenue:number; profit:number; orders:number; shifts:number }> = {}
    allShifts.forEach(s => {
      if (!locMap[s.location_name]) locMap[s.location_name] = { name: s.location_name, revenue:0, profit:0, orders:0, shifts:0 }
      locMap[s.location_name].revenue += s.total_revenue
      locMap[s.location_name].profit  += s.total_revenue - s.total_cost
      locMap[s.location_name].orders  += s.total_orders
      locMap[s.location_name].shifts  += 1
    })
    setLocStats(Object.values(locMap).sort((a,b) => b.revenue - a.revenue))
    const days: { label: string; revenue: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i)
      const label = d.toLocaleDateString('de-DE', { weekday:'short' })
      const revenue = allShifts.filter(s => { const sd = new Date(s.started_at); return sd.getDate()===d.getDate()&&sd.getMonth()===d.getMonth()&&sd.getFullYear()===d.getFullYear() }).reduce((s,sh)=>s+sh.total_revenue,0)
      days.push({ label, revenue })
    }
    setWeekData(days)
    const { data: orderItems } = await db.from('order_items').select('name, emoji, quantity, line_total, orders!inner(truck_id)').eq('orders.truck_id', business.id)
    const itemMap: Record<string,{ name:string; emoji:string; sold:number; revenue:number }> = {}
    ;(orderItems || []).forEach((oi: any) => {
      if (!itemMap[oi.name]) itemMap[oi.name] = { name: oi.name, emoji: oi.emoji||'🍽️', sold:0, revenue:0 }
      itemMap[oi.name].sold    += oi.quantity
      itemMap[oi.name].revenue += oi.line_total
    })
    setTopItems(Object.values(itemMap).sort((a,b)=>b.sold-a.sold).slice(0,8))
    setLoading(false)
  }, [business.id])

  useEffect(() => { loadData() }, [loadData])

  const today = new Date()
  const todayShifts  = shifts.filter(s => { const d = new Date(s.started_at); return d.getDate()===today.getDate()&&d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear() })
  const todayRevenue = currentShift ? currentShift.total_revenue : todayShifts.reduce((s,sh)=>s+sh.total_revenue,0)
  const todayCost    = currentShift ? currentShift.total_cost    : todayShifts.reduce((s,sh)=>s+sh.total_cost,0)
  const todayOrders  = currentShift ? currentShift.total_orders  : todayShifts.reduce((s,sh)=>s+sh.total_orders,0)
  const todayProfit  = todayRevenue - todayCost
  const avgOrder     = todayOrders > 0 ? todayRevenue / todayOrders : 0
  const allRevenue   = shifts.reduce((s,sh)=>s+sh.total_revenue,0)
  const allProfit    = shifts.reduce((s,sh)=>s+(sh.total_revenue-sh.total_cost),0)
  const allOrders    = shifts.reduce((s,sh)=>s+sh.total_orders,0)
  const maxWeekRev   = Math.max(...weekData.map(d=>d.revenue),1)
  const rankClass    = (i: number) => i===0?'gold':i===1?'silver':i===2?'bronze':''

  return (
    <div className="dash-overlay">
      <div className="dash-topbar"><div className="dash-topbar-title">📊 Dashboard — {business.name}</div><button className="dash-close-btn" onClick={onClose}>← Back to POS</button></div>
      <div className="dash-tabs">{([['today','Today'],['history','Shift History'],['locations','Locations'],['items','Top Items']] as [string,string][]).map(([id,label]) => <button key={id} className={`dash-tab ${tab===id?'active':''}`} onClick={() => setTab(id as any)}>{label}</button>)}</div>
      <div className="dash-body">
        {loading ? <div style={{textAlign:'center',padding:'60px',color:'#475569'}}><div style={{fontSize:32,marginBottom:12}}>📊</div><div style={{fontWeight:700}}>Loading…</div></div> : <>
          {tab === 'today' && <>
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-label">Revenue Today</div><div className="kpi-value" style={{color:business.color}}>{fmtShort(todayRevenue)}</div><div className="kpi-sub">{todayOrders} orders</div></div>
              <div className="kpi-card"><div className="kpi-label">Profit Today</div><div className="kpi-value" style={{color:'#22c55e'}}>{fmtShort(todayProfit)}</div><div className={`kpi-sub ${todayRevenue>0?'up':''}`}>{todayRevenue>0?`${Math.round((todayProfit/todayRevenue)*100)}% margin`:'No sales yet'}</div></div>
              <div className="kpi-card"><div className="kpi-label">Avg Order</div><div className="kpi-value" style={{color:'#f59e0b'}}>{fmt(avgOrder)}</div><div className="kpi-sub">per transaction</div></div>
              <div className="kpi-card"><div className="kpi-label">Shift Status</div><div className="kpi-value" style={{fontSize:20,color:currentShift?'#22c55e':'#64748b',marginTop:4}}>{currentShift?'🟢 Open':'⚫ Closed'}</div><div className="kpi-sub">{currentShift?currentShift.location_name:'No active shift'}</div></div>
            </div>
            <div className="chart-card">
              <div className="chart-card-title">Revenue — Last 7 Days</div>
              <div className="chart-card-sub">Daily revenue</div>
              <div className="bar-chart">{weekData.map((d,i) => <div key={i} className="bar-col"><div className="bar-val">{d.revenue>0?fmtShort(d.revenue):''}</div><div className="bar-fill" style={{height:`${(d.revenue/maxWeekRev)*100}px`,background:business.color,opacity:i===6?1:0.5}} /><div className="bar-label">{d.label}</div></div>)}</div>
            </div>
            <div className="dash-section">
              <div className="dash-section-hd"><span className="dash-section-title">All-Time Totals</span><span className="dash-section-tag" style={{background:'rgba(13,148,136,0.1)',color:'#14b8a6'}}>{shifts.length} shifts</span></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:'#334155'}}>
                {[{label:'Total Revenue',value:fmtShort(allRevenue),color:business.color},{label:'Total Profit',value:fmtShort(allProfit),color:'#22c55e'},{label:'Total Orders',value:String(allOrders),color:'#f59e0b'}].map((s,i) => <div key={i} style={{background:'#1e293b',padding:'16px',textAlign:'center'}}><div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{s.label}</div><div style={{fontSize:22,fontWeight:800,color:s.color,fontFamily:"'Space Grotesk',monospace"}}>{s.value}</div></div>)}
              </div>
            </div>
          </>}
          {tab === 'history' && <div className="dash-section">
            <div className="dash-section-hd"><span className="dash-section-title">Shift History</span><span className="dash-section-tag" style={{background:'rgba(13,148,136,0.1)',color:'#14b8a6'}}>{shifts.length} total</span></div>
            {shifts.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">No shifts yet</div></div> : shifts.map((s,i) => {
              const profit = s.total_revenue - s.total_cost; const isOpen = s.status==='open'
              return <div key={i} className="shift-row"><div className="shift-row-icon">{typeEmoji(business.business_type)}</div><div className="shift-row-info"><div className="shift-row-name">{s.location_name}</div><div className="shift-row-meta">{dayName(s.started_at)} · {timeStr(s.started_at)}{s.ended_at&&` → ${timeStr(s.ended_at)}`} · {s.total_orders} orders</div></div><div className="shift-row-stats"><div className="shift-row-rev" style={{color:business.color}}>{fmt(s.total_revenue)}</div><div className="shift-row-profit">+{fmt(profit)} profit</div></div><span className="shift-status-badge" style={isOpen?{background:'rgba(34,197,94,0.1)',color:'#22c55e'}:{background:'rgba(100,116,139,0.1)',color:'#64748b'}}>{isOpen?'Open':'Done'}</span></div>
            })}
          </div>}
          {tab === 'locations' && <>{locStats.length===0?<div className="empty-state"><div className="empty-state-icon">📍</div><div className="empty-state-title">No location data yet</div></div>:<div className="dash-section"><div className="dash-section-hd"><span className="dash-section-title">📍 Revenue by Location</span></div>{(() => { const maxRev=Math.max(...locStats.map(l=>l.revenue),1); return locStats.map((loc,i) => <div key={i} className="loc-perf-row"><div className="loc-perf-hd"><span className="loc-perf-name">📍 {loc.name}</span><span className="loc-perf-vals" style={{color:business.color}}>{fmt(loc.revenue)}</span></div><div className="loc-bar-track"><div className="loc-bar-fill" style={{width:`${(loc.revenue/maxRev)*100}%`,background:business.color}} /></div><div className="loc-perf-sub">{fmt(loc.profit)} profit · {loc.orders} orders · {loc.shifts} shifts</div></div>) })()}</div>}</>}
          {tab === 'items' && <div className="dash-section">
            <div className="dash-section-hd"><span className="dash-section-title">🔥 Top Selling Items</span></div>
            {topItems.length===0?<div className="empty-state"><div className="empty-state-icon">🍽️</div><div className="empty-state-title">No sales data yet</div></div>:topItems.map((item,i) => <div key={i} className="seller-row"><div className={`seller-rank ${rankClass(i)}`}>{i+1}</div><div className="seller-emoji">{item.emoji}</div><div className="seller-info"><div className="seller-name">{item.name}</div></div><div className="seller-stats"><div className="seller-sold" style={{color:business.color}}>{item.sold} sold</div><div className="seller-rev">{fmt(item.revenue)}</div></div></div>)}
          </div>}
        </>}
      </div>
    </div>
  )
}

// ─── AI INSIGHTS ──────────────────────────────────────────────
function AIInsights({ business, currentShift, menuItems, onClose }: {
  business: Business; currentShift: Shift | null; menuItems: MenuItem[]; onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<{ icon:string; type:string; headline:string; detail:string; stat?:string; statColor?:string }[]>([])

  const generate = useCallback(async () => {
    setLoading(true)

    // Load all shift data
    const { data: shiftData } = await db
      .from('shifts').select('*, locations(name)')
      .eq('truck_id', business.id)
      .eq('status', 'closed')
      .order('started_at', { ascending: false }).limit(60)

    const shifts: Shift[] = (shiftData || []).map((s: any) => ({ ...s, location_name: s.locations?.name || 'Unknown' }))

    // Load all order items
    const { data: rawItems } = await db
      .from('order_items')
      .select('name, emoji, quantity, unit_price, unit_cost, line_profit, orders!inner(truck_id, created_at)')
      .eq('orders.truck_id', business.id)

    const orderItems = rawItems || []
    const results: { icon:string; type:string; headline:string; detail:string; stat?:string; statColor?:string }[] = []

    // ── INSIGHT 1: Best location by day of week ──
    if (shifts.length >= 3) {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
      const locByDay: Record<string, Record<string, { revenue: number; count: number }>> = {}
      shifts.forEach(s => {
        const day = new Date(s.started_at).toLocaleDateString('en-US', { weekday: 'long' })
        if (!locByDay[day]) locByDay[day] = {}
        if (!locByDay[day][s.location_name]) locByDay[day][s.location_name] = { revenue: 0, count: 0 }
        locByDay[day][s.location_name].revenue += s.total_revenue
        locByDay[day][s.location_name].count   += 1
      })
      const todayLocs = locByDay[today]
      if (todayLocs && Object.keys(todayLocs).length > 0) {
        const best = Object.entries(todayLocs).sort((a,b) => (b[1].revenue/b[1].count) - (a[1].revenue/a[1].count))[0]
        const avgRev = (best[1].revenue / best[1].count).toFixed(0)
        results.push({
          icon: '📍', type: 'Location Intelligence',
          headline: `Park at ${best[0]} today`,
          detail: `On ${today}s, ${best[0]} averages €${avgRev} per shift — your strongest day-location combo based on ${best[1].count} previous ${today}s.`,
          stat: `€${avgRev} avg on ${today}s`, statColor: business.color,
        })
      } else {
        // Overall best location
        const locTotals: Record<string, { revenue: number; count: number }> = {}
        shifts.forEach(s => {
          if (!locTotals[s.location_name]) locTotals[s.location_name] = { revenue: 0, count: 0 }
          locTotals[s.location_name].revenue += s.total_revenue
          locTotals[s.location_name].count   += 1
        })
        const best = Object.entries(locTotals).sort((a,b) => (b[1].revenue/b[1].count) - (a[1].revenue/a[1].count))[0]
        if (best) {
          const avgRev = (best[1].revenue / best[1].count).toFixed(0)
          results.push({
            icon: '📍', type: 'Location Intelligence',
            headline: `${best[0]} is your top spot`,
            detail: `Averaging €${avgRev} per shift across ${best[1].count} visits. Prioritise this location when planning your week.`,
            stat: `€${avgRev} per shift`, statColor: business.color,
          })
        }
      }
    }

    // ── INSIGHT 2: Push this item (high margin, underselling) ──
    if (menuItems.length > 0 && orderItems.length > 0) {
      const itemSales: Record<string, number> = {}
      orderItems.forEach((oi: any) => { itemSales[oi.name] = (itemSales[oi.name] || 0) + oi.quantity })
      const avgSold = Object.values(itemSales).reduce((a,b) => a+b, 0) / Object.keys(itemSales).length
      const activeItems = menuItems.filter(i => i.is_active && i.price > 0)
      const candidates = activeItems
        .map(i => ({
          ...i,
          margin: Math.round(((i.price - i.cost_price) / i.price) * 100),
          sold: itemSales[i.name] || 0,
        }))
        .filter(i => i.margin >= 65 && i.sold < avgSold)
        .sort((a,b) => b.margin - a.margin)
      if (candidates.length > 0) {
        const pick = candidates[0]
        results.push({
          icon: '🎯', type: 'Push This Item',
          headline: `${pick.emoji} Upsell the ${pick.name}`,
          detail: `It has a ${pick.margin}% margin but is selling below average. Mention it when taking orders — "Would you like to add a ${pick.name}?" could add €${(pick.price - pick.cost_price).toFixed(2)} pure profit per upsell.`,
          stat: `${pick.margin}% margin`, statColor: '#22c55e',
        })
      }
    }

    // ── INSIGHT 3: Shift performance vs average ──
    if (currentShift && shifts.length >= 3) {
      const avgRevenue = shifts.reduce((s,sh) => s + sh.total_revenue, 0) / shifts.length
      const avgOrders  = shifts.reduce((s,sh) => s + sh.total_orders, 0)  / shifts.length
      const pctDiff    = avgRevenue > 0 ? Math.round(((currentShift.total_revenue - avgRevenue) / avgRevenue) * 100) : 0
      const above      = pctDiff >= 0
      results.push({
        icon: above ? '📈' : '📉', type: 'Shift Performance',
        headline: above
          ? `You're ${pctDiff}% above your average shift`
          : `You're ${Math.abs(pctDiff)}% below your average shift`,
        detail: above
          ? `Your average shift earns €${avgRevenue.toFixed(0)}. Today at €${currentShift.total_revenue.toFixed(0)} you're ahead. Keep pushing — ${Math.round(avgOrders - currentShift.total_orders)} more orders would hit your typical volume.`
          : `Your average shift earns €${avgRevenue.toFixed(0)}. You need €${(avgRevenue - currentShift.total_revenue).toFixed(0)} more to hit your average. Focus on higher-margin items.`,
        stat: `${above ? '+' : ''}${pctDiff}% vs average`,
        statColor: above ? '#22c55e' : '#ef4444',
      })
    } else if (!currentShift) {
      if (shifts.length >= 3) {
        const avgRevenue = shifts.reduce((s,sh) => s + sh.total_revenue, 0) / shifts.length
        const bestShift  = shifts.reduce((a,b) => a.total_revenue > b.total_revenue ? a : b)
        results.push({
          icon: '📊', type: 'Shift Performance',
          headline: `Your average shift earns €${avgRevenue.toFixed(0)}`,
          detail: `Based on ${shifts.length} completed shifts. Your best ever was €${bestShift.total_revenue.toFixed(0)} at ${bestShift.location_name}. Open a shift to start tracking today.`,
          stat: `Best: €${bestShift.total_revenue.toFixed(0)}`, statColor: '#f59e0b',
        })
      }
    }

    // ── INSIGHT 4: Revenue opportunity — avg order value ──
    if (orderItems.length > 0 && shifts.length > 0) {
      const totalRevenue = shifts.reduce((s,sh) => s + sh.total_revenue, 0)
      const totalOrders  = shifts.reduce((s,sh) => s + sh.total_orders, 0)
      const avgOrderVal  = totalOrders > 0 ? totalRevenue / totalOrders : 0
      // Find most common drink sold
      const drinks = menuItems.filter(i => i.is_active)
      const drinkSales: Record<string,{name:string;emoji:string;margin:number}> = {}
      drinks.forEach(d => {
        const margin = d.price > 0 ? Math.round(((d.price - d.cost_price) / d.price) * 100) : 0
        if (margin >= 70) drinkSales[d.name] = { name: d.name, emoji: d.emoji, margin }
      })
      const topDrink = Object.values(drinkSales).sort((a,b) => b.margin - a.margin)[0]
      if (topDrink && avgOrderVal > 0) {
        results.push({
          icon: '💡', type: 'Revenue Opportunity',
          headline: `Add a ${topDrink.emoji} ${topDrink.name} to every wrap order`,
          detail: `Your average order is €${avgOrderVal.toFixed(2)}. Suggesting a drink on every food order is the single fastest way to lift that number. At ${topDrink.margin}% margin, every drink sold is nearly pure profit.`,
          stat: `${topDrink.margin}% margin on drinks`, statColor: '#f59e0b',
        })
      }
    }

    // ── INSIGHT 5: Best day of week overall ──
    if (shifts.length >= 5) {
      const dayRevenue: Record<string, { total: number; count: number }> = {}
      shifts.forEach(s => {
        const day = new Date(s.started_at).toLocaleDateString('en-US', { weekday: 'long' })
        if (!dayRevenue[day]) dayRevenue[day] = { total: 0, count: 0 }
        dayRevenue[day].total += s.total_revenue
        dayRevenue[day].count += 1
      })
      const sorted = Object.entries(dayRevenue)
        .filter(([,v]) => v.count >= 1)
        .sort((a,b) => (b[1].total/b[1].count) - (a[1].total/a[1].count))
      if (sorted.length >= 2) {
        const best  = sorted[0]
        const worst = sorted[sorted.length - 1]
        const bestAvg  = (best[1].total  / best[1].count).toFixed(0)
        const worstAvg = (worst[1].total / worst[1].count).toFixed(0)
        results.push({
          icon: '📅', type: 'Weekly Pattern',
          headline: `${best[0]} is your strongest day`,
          detail: `Averaging €${bestAvg} on ${best[0]}s vs €${worstAvg} on ${worst[0]}s. Schedule your best locations on ${best[0]} and consider closing or moving on ${worst[0]}s.`,
          stat: `€${bestAvg} avg on ${best[0]}s`, statColor: business.color,
        })
      }
    }

    // If not enough data yet
    if (results.length === 0) {
      setInsights([])
    } else {
      setInsights(results)
    }
    setLoading(false)
  }, [business.id, currentShift, menuItems])

  useEffect(() => { generate() }, [generate])

  const hasData = insights.length > 0

  return (
    <div className="ai-insights-overlay">
      <div className="ai-insights-topbar">
        <div className="ai-insights-topbar-left">
          <div className="ai-bolt-badge">⚡</div>
          <div>
            <div className="ai-insights-title">Smart Insights</div>
            <div className="ai-insights-sub">Powered by your real shift data</div>
          </div>
        </div>
        <button className="ai-close-btn" onClick={onClose}>← Back to POS</button>
      </div>

      <div className="ai-insights-body">
        {loading ? (
          <div style={{textAlign:'center',padding:'80px 20px',color:'#475569'}}>
            <div style={{fontSize:40,marginBottom:16,opacity:0.5}}>⚡</div>
            <div style={{fontWeight:700,fontSize:14,textTransform:'uppercase',letterSpacing:'0.1em'}}>Analysing your data…</div>
          </div>
        ) : !hasData ? (
          <div className="ai-no-data">
            <div className="ai-no-data-icon">⚡</div>
            <div className="ai-no-data-title">Not enough data yet</div>
            <div className="ai-no-data-sub">Complete 3 or more shifts and Smart Insights will start generating personalised recommendations from your real sales data.</div>
          </div>
        ) : (
          insights.map((ins, i) => (
            <div key={i} className="ai-insight-card">
              <div className="ai-insight-icon-wrap">{ins.icon}</div>
              <div className="ai-insight-body">
                <div className="ai-insight-type">{ins.type}</div>
                <div className="ai-insight-headline">{ins.headline}</div>
                <div className="ai-insight-detail">{ins.detail}</div>
                {ins.stat && (
                  <div className="ai-insight-stat" style={{color: ins.statColor || '#14b8a6', borderColor: `${ins.statColor || '#0d9488'}30`}}>
                    {ins.stat}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── LOCATION MANAGEMENT ─────────────────────────────────────
function LocationManagement({ business, onClose, onUpdated }: {
  business: Business; onClose: () => void; onUpdated: (locs: Location[]) => void
}) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editLoc, setEditLoc]     = useState<Location | null>(null)
  const [deleteLoc, setDeleteLoc] = useState<Location | null>(null)
  const [form, setForm]           = useState({ name: '', address: '' })
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState<string | null>(null)
  const [toastWarn, setToastWarn] = useState(false)

  const showToast = (msg: string, warn = false) => {
    setToast(msg); setToastWarn(warn); setTimeout(() => setToast(null), 2200)
  }

  const load = useCallback(async () => {
    const { data } = await db.from('locations').select('*').eq('truck_id', business.id).order('name')
    setLocations(data || []); setLoading(false)
  }, [business.id])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ name: '', address: '' }); setEditLoc(null); setShowForm(true) }
  const openEdit = (loc: Location) => { setForm({ name: loc.name, address: (loc as any).address || '' }); setEditLoc(loc); setShowForm(true) }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    if (editLoc) {
      await db.from('locations').update({ name: form.name.trim(), address: form.address.trim() || null }).eq('id', editLoc.id)
      showToast(`${form.name} updated`)
    } else {
      await db.from('locations').insert({ truck_id: business.id, name: form.name.trim(), address: form.address.trim() || null })
      showToast(`${form.name} added 📍`)
    }
    setShowForm(false); setEditLoc(null)
    await load()
    onUpdated(locations)
    setSaving(false)
  }

  const deleteLocation = async () => {
    if (!deleteLoc) return
    await db.from('locations').delete().eq('id', deleteLoc.id)
    showToast(`${deleteLoc.name} removed`, true)
    setDeleteLoc(null); await load()
  }

  return (
    <div className="loc-mgmt-overlay">
      {toast && <div className={`toast ${toastWarn ? 'toast-warn' : ''}`}>{toast}</div>}

      {/* Delete confirm */}
      {deleteLoc && (
        <div className="del-overlay">
          <div className="del-card">
            <div className="del-icon">📍</div>
            <div className="del-title">Remove {deleteLoc.name}?</div>
            <div className="del-sub">Past shifts at this location keep their records. You won't be able to select it for new shifts.</div>
            <div className="del-btns">
              <button className="del-cancel" onClick={() => setDeleteLoc(null)}>Cancel</button>
              <button className="del-confirm" onClick={deleteLocation}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="loc-form-overlay">
          <div className="loc-form-card">
            <div className="loc-form-title">{editLoc ? `✏️ Edit ${editLoc.name}` : '📍 Add Location'}</div>
            <div className="loc-form-field">
              <label className="loc-form-label">Spot Name *</label>
              <input className="loc-form-input" placeholder="e.g. Marktplatz, Bahnhof Nord" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="loc-form-field">
              <label className="loc-form-label">Address (optional)</label>
              <input className="loc-form-input" placeholder="e.g. Anger 1, 99084 Erfurt" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="loc-form-btns">
              <button className="loc-form-cancel" onClick={() => { setShowForm(false); setEditLoc(null) }}>Cancel</button>
              <button className="loc-form-save" style={{ background: business.color }} onClick={save} disabled={!form.name.trim() || saving}>
                {saving ? 'Saving…' : editLoc ? 'Save Changes' : 'Add Location'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="loc-mgmt-topbar">
        <div className="loc-mgmt-title">📍 Location Management</div>
        <div className="loc-mgmt-right">
          <button className="loc-mgmt-add-btn" style={{ background: business.color }} onClick={openAdd}>＋ Add Location</button>
          <button className="loc-mgmt-close-btn" onClick={onClose}>← Back to POS</button>
        </div>
      </div>

      {/* Body */}
      <div className="loc-mgmt-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📍</div>
            <div style={{ fontWeight: 700 }}>Loading locations…</div>
          </div>
        ) : locations.length === 0 ? (
          <div className="loc-empty">
            <div className="loc-empty-icon">📍</div>
            <div className="loc-empty-title">No locations yet</div>
            <div className="loc-empty-sub">Add your parking spots so you can tag each shift with where you traded.</div>
            <button style={{ background: business.color, padding: '12px 24px', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, color: 'white', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans,sans-serif' }} onClick={openAdd}>
              ＋ Add First Location
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              {locations.length} location{locations.length !== 1 ? 's' : ''} — tap Edit to rename, delete to remove
            </div>
            {locations.map(loc => (
              <div key={loc.id} className="loc-card">
                <div className="loc-card-icon">📍</div>
                <div className="loc-card-info">
                  <div className="loc-card-name">{loc.name}</div>
                  {(loc as any).address && <div className="loc-card-address">{(loc as any).address}</div>}
                </div>
                <div className="loc-card-actions">
                  <button className="loc-edit-btn" onClick={() => openEdit(loc)}>Edit</button>
                  <button className="loc-del-btn" onClick={() => setDeleteLoc(loc)}>🗑️</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── INVENTORY MODULE ─────────────────────────────────────────
function InventoryModule({ business, menuItems, onClose }: {
  business: Business; menuItems: MenuItem[]; onClose: () => void
}) {
  const [items, setItems]           = useState<InventoryItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editItem, setEditItem]     = useState<InventoryItem | null>(null)
  const [restockTarget, setRestockTarget] = useState<InventoryItem | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [toast, setToast]           = useState<string | null>(null)
  const [toastWarn, setToastWarn]   = useState(false)

  const showToast = (msg: string, warn = false) => {
    setToast(msg); setToastWarn(warn); setTimeout(() => setToast(null), 2200)
  }

  const load = useCallback(async () => {
    const { data } = await db.from('inventory').select('*').eq('truck_id', business.id).order('ingredient_name')
    setItems(data || []); setLoading(false)
  }, [business.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (form: Partial<InventoryItem>) => {
    if (editItem?.id) {
      await db.from('inventory').update({
        ingredient_name: form.ingredient_name, unit: form.unit,
        stock_qty: form.stock_qty, low_stock_alert: form.low_stock_alert,
        deduct_per_sale: form.deduct_per_sale, track_mode: form.track_mode,
        menu_item_id: form.menu_item_id || null,
      }).eq('id', editItem.id)
      showToast(`${form.ingredient_name} updated`)
    } else {
      await db.from('inventory').insert({
        truck_id: business.id, ingredient_name: form.ingredient_name,
        unit: form.unit, stock_qty: form.stock_qty,
        low_stock_alert: form.low_stock_alert, deduct_per_sale: form.deduct_per_sale,
        track_mode: form.track_mode, menu_item_id: form.menu_item_id || null,
      })
      showToast(`${form.ingredient_name} added to inventory 🎉`)
    }
    setShowForm(false); setEditItem(null); load()
  }

  const handleRestock = async () => {
    if (!restockTarget || !restockQty) return
    const qty = parseFloat(restockQty)
    if (isNaN(qty) || qty <= 0) return
    const newQty = restockTarget.stock_qty + qty
    await db.from('inventory').update({ stock_qty: newQty }).eq('id', restockTarget.id)
    await db.from('inventory_logs').insert({
      inventory_id: restockTarget.id, change_qty: qty, reason: 'restock'
    })
    showToast(`+${qty} ${restockTarget.unit} added to ${restockTarget.ingredient_name}`)
    setRestockTarget(null); setRestockQty(''); load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await db.from('inventory').delete().eq('id', deleteTarget.id)
    showToast(`${deleteTarget.ingredient_name} removed`, true)
    setDeleteTarget(null); load()
  }

  const lowItems   = items.filter(i => i.stock_qty <= i.low_stock_alert)
  const okItems    = items.filter(i => i.stock_qty > i.low_stock_alert)
  const stockPct   = (i: InventoryItem) => {
    const max = Math.max(i.stock_qty, i.low_stock_alert * 3, 1)
    return Math.min(100, Math.round((i.stock_qty / max) * 100))
  }
  const barColor = (i: InventoryItem) => i.stock_qty <= i.low_stock_alert ? '#ef4444' : i.stock_qty <= i.low_stock_alert * 1.5 ? '#f59e0b' : '#0d9488'

  return (
    <div className="inv-overlay">
      {toast && <div className={`toast ${toastWarn ? 'toast-warn' : ''}`}>{toast}</div>}

      {/* Restock modal */}
      {restockTarget && (
        <div className="restock-overlay">
          <div className="restock-card">
            <div className="restock-title">Restock {restockTarget.ingredient_name}</div>
            <div className="restock-sub">How much are you adding?</div>
            <div className="restock-current">Current stock: {restockTarget.stock_qty} {restockTarget.unit}</div>
            <input className="restock-input" type="number" placeholder="0" value={restockQty}
              onChange={e => setRestockQty(e.target.value)}
              autoFocus
            />
            <div className="restock-btns">
              <button className="restock-cancel" onClick={() => { setRestockTarget(null); setRestockQty('') }}>Cancel</button>
              <button className="restock-confirm" style={{ background: business.color }} onClick={handleRestock}
                disabled={!restockQty || parseFloat(restockQty) <= 0}>
                + Add {restockQty || '0'} {restockTarget.unit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="del-overlay">
          <div className="del-card">
            <div className="del-icon">🗑️</div>
            <div className="del-title">Remove {deleteTarget.ingredient_name}?</div>
            <div className="del-sub">This will remove it from inventory tracking. Past logs are kept.</div>
            <div className="del-btns">
              <button className="del-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="del-confirm" onClick={handleDelete}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <InventoryForm
          item={editItem}
          menuItems={menuItems}
          color={business.color}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditItem(null) }}
        />
      )}

      {/* Topbar */}
      <div className="inv-topbar">
        <div className="inv-topbar-title">📦 Inventory</div>
        <div className="inv-topbar-right">
          <button className="inv-add-btn" style={{ background: business.color }}
            onClick={() => { setEditItem(null); setShowForm(true) }}>
            ＋ Add Ingredient
          </button>
          <button className="inv-close-btn" onClick={onClose}>← Back to POS</button>
        </div>
      </div>

      <div className="inv-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
            <div style={{ fontWeight: 700 }}>Loading inventory…</div>
          </div>
        ) : items.length === 0 ? (
          <div className="inv-empty">
            <div className="inv-empty-icon">📦</div>
            <div className="inv-empty-title">No ingredients tracked yet</div>
            <div className="inv-empty-sub">Add your ingredients and link them to menu items. The system will deduct stock automatically as orders come in.</div>
            <button className="inv-empty-btn" style={{ background: business.color }}
              onClick={() => { setEditItem(null); setShowForm(true) }}>
              ＋ Add First Ingredient
            </button>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="inv-summary-bar">
              <div className="inv-summary-card">
                <span className="inv-summary-val" style={{ color: business.color }}>{items.length}</span>
                <span className="inv-summary-label">Ingredients</span>
              </div>
              <div className="inv-summary-card">
                <span className="inv-summary-val" style={{ color: '#22c55e' }}>{okItems.length}</span>
                <span className="inv-summary-label">Well stocked</span>
              </div>
              <div className="inv-summary-card">
                <span className="inv-summary-val" style={{ color: lowItems.length > 0 ? '#ef4444' : '#64748b' }}>{lowItems.length}</span>
                <span className="inv-summary-label">Low / Out</span>
              </div>
            </div>

            {/* Low stock first */}
            {lowItems.length > 0 && (
              <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 2 }}>
                ⚠️ Needs Attention
              </div>
            )}
            {lowItems.map(item => <InventoryCard key={item.id} item={item} color={business.color} stockPct={stockPct(item)} barColor={barColor(item)} menuItems={menuItems} onRestock={() => setRestockTarget(item)} onEdit={() => { setEditItem(item); setShowForm(true) }} onDelete={() => setDeleteTarget(item)} />)}

            {okItems.length > 0 && lowItems.length > 0 && (
              <div style={{ marginBottom: 6, marginTop: 8, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 2 }}>
                ✓ Well Stocked
              </div>
            )}
            {okItems.map(item => <InventoryCard key={item.id} item={item} color={business.color} stockPct={stockPct(item)} barColor={barColor(item)} menuItems={menuItems} onRestock={() => setRestockTarget(item)} onEdit={() => { setEditItem(item); setShowForm(true) }} onDelete={() => setDeleteTarget(item)} />)}
          </>
        )}
      </div>
    </div>
  )
}

function InventoryCard({ item, color, stockPct, barColor, menuItems, onRestock, onEdit, onDelete }: {
  item: InventoryItem; color: string; stockPct: number; barColor: string
  menuItems: MenuItem[]; onRestock: () => void; onEdit: () => void; onDelete: () => void
}) {
  const isLow   = item.stock_qty <= item.low_stock_alert
  const linked  = menuItems.find(m => m.id === item.menu_item_id)

  return (
    <div className={`inv-item-card ${isLow ? 'low' : 'ok'}`}>
      <div className="inv-item-hd">
        <div className="inv-item-name">{item.ingredient_name}</div>
        <div className="inv-item-badges">
          <span className="inv-unit-badge">{item.unit}</span>
          <span className="inv-mode-badge" style={{ background: item.track_mode === 'shift' ? 'rgba(13,148,136,0.1)' : 'rgba(139,92,246,0.1)', color: item.track_mode === 'shift' ? '#14b8a6' : '#a78bfa', border: `1px solid ${item.track_mode === 'shift' ? 'rgba(13,148,136,0.2)' : 'rgba(139,92,246,0.2)'}` }}>
            {item.track_mode === 'shift' ? 'Per shift' : 'Running'}
          </span>
          <span className="inv-status-badge" style={{ background: isLow ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: isLow ? '#ef4444' : '#22c55e', border: `1px solid ${isLow ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
            {isLow ? '⚠️ Low' : '✓ OK'}
          </span>
        </div>
      </div>

      <div className="inv-item-track">
        <div className="inv-track-hd">
          <span className="inv-track-qty" style={{ color: isLow ? '#ef4444' : '#f8fafc' }}>
            {item.stock_qty} {item.unit}
          </span>
          <span className="inv-track-alert">Alert at {item.low_stock_alert} {item.unit}</span>
        </div>
        <div className="inv-bar-track">
          <div className="inv-bar-fill" style={{ width: `${stockPct}%`, background: barColor }} />
        </div>
      </div>

      <div className="inv-item-meta">
        Deducts {item.deduct_per_sale} {item.unit} per sale
        {linked && ` · Linked to ${linked.emoji} ${linked.name}`}
      </div>

      <div className="inv-item-actions">
        <button className="inv-restock-btn" style={{ background: color }} onClick={onRestock}>+ Restock</button>
        <button className="inv-edit-btn" onClick={onEdit}>Edit</button>
        <button className="inv-del-btn" onClick={onDelete}>🗑️</button>
      </div>
    </div>
  )
}

function InventoryForm({ item, menuItems, color, onSave, onCancel }: {
  item: InventoryItem | null; menuItems: MenuItem[]
  color: string; onSave: (form: Partial<InventoryItem>) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<Partial<InventoryItem>>({
    ingredient_name: item?.ingredient_name || '',
    unit:            item?.unit            || 'portions',
    stock_qty:       item?.stock_qty       ?? 0,
    low_stock_alert: item?.low_stock_alert ?? 10,
    deduct_per_sale: item?.deduct_per_sale ?? 1,
    track_mode:      item?.track_mode      || 'shift',
    menu_item_id:    item?.menu_item_id    || '',
  })
  const [saving, setSaving] = useState(false)

  const UNITS = ['portions','kg','g','litres','ml','pcs','slices','bags']

  const save = async () => {
    if (!form.ingredient_name?.trim()) return
    setSaving(true); await onSave(form); setSaving(false)
  }

  return (
    <div className="inv-form-overlay">
      <div className="inv-form-card">
        <div className="inv-form-title">{item ? `✏️ Edit ${item.ingredient_name}` : '➕ Add Ingredient'}</div>

        <div className="inv-form-field">
          <label className="inv-form-label">Ingredient Name *</label>
          <input className="inv-form-input" placeholder="e.g. Chicken, Fries, Dough" value={form.ingredient_name || ''} onChange={e => setForm(f => ({ ...f, ingredient_name: e.target.value }))} />
        </div>

        <div className="inv-form-row">
          <div className="inv-form-field">
            <label className="inv-form-label">Unit</label>
            <select className="inv-form-select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="inv-form-field">
            <label className="inv-form-label">Deduct per Sale</label>
            <input className="inv-form-input" type="number" step="0.1" min="0" placeholder="1" value={form.deduct_per_sale || ''} onChange={e => setForm(f => ({ ...f, deduct_per_sale: parseFloat(e.target.value) || 0 }))} style={{ fontFamily: "'Space Grotesk',monospace" }} />
          </div>
        </div>

        <div className="inv-form-row">
          <div className="inv-form-field">
            <label className="inv-form-label">Starting Stock</label>
            <input className="inv-form-input" type="number" step="0.5" min="0" placeholder="0" value={form.stock_qty || ''} onChange={e => setForm(f => ({ ...f, stock_qty: parseFloat(e.target.value) || 0 }))} style={{ fontFamily: "'Space Grotesk',monospace" }} />
          </div>
          <div className="inv-form-field">
            <label className="inv-form-label">Low Stock Alert At</label>
            <input className="inv-form-input" type="number" step="0.5" min="0" placeholder="10" value={form.low_stock_alert || ''} onChange={e => setForm(f => ({ ...f, low_stock_alert: parseFloat(e.target.value) || 0 }))} style={{ fontFamily: "'Space Grotesk',monospace" }} />
          </div>
        </div>

        <div className="inv-form-field">
          <label className="inv-form-label">Tracking Mode</label>
          <div className="inv-mode-grid">
            <button className={`inv-mode-btn ${form.track_mode === 'shift' ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, track_mode: 'shift' }))}>
              Per Shift
              <div className="inv-mode-desc">Reset at start of each shift</div>
            </button>
            <button className={`inv-mode-btn ${form.track_mode === 'running' ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, track_mode: 'running' }))}>
              Running Total
              <div className="inv-mode-desc">Keeps deducting until restocked</div>
            </button>
          </div>
        </div>

        <div className="inv-form-field">
          <label className="inv-form-label">Linked Menu Item (optional)</label>
          <select className="inv-form-select" value={form.menu_item_id || ''} onChange={e => setForm(f => ({ ...f, menu_item_id: e.target.value }))}>
            <option value="">— Not linked —</option>
            {menuItems.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
          </select>
        </div>

        <div className="inv-form-btns">
          <button className="inv-form-cancel" onClick={onCancel}>Cancel</button>
          <button className="inv-form-save" style={{ background: color }} onClick={save}
            disabled={!form.ingredient_name?.trim() || saving}>
            {saving ? 'Saving…' : item ? 'Save Changes' : 'Add Ingredient'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN POS APP ─────────────────────────────────────────────
function POSApp({ session, business, onSwitch }: { session: Session; business: Business; onSwitch: () => void }) {
  const [screen, setScreen]         = useState<'loading'|'start-shift'|'pos'>('loading')
  const [locations, setLocations]   = useState<Location[]>([])
  const [shift, setShift]           = useState<Shift | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([])
  const [activeCat, setActiveCat]   = useState('all')
  const [order, setOrder]           = useState<OrderLine[]>([])
  const [orderNum, setOrderNum]     = useState(1)
  const [payMethod, setPayMethod]   = useState<'cash'|'card'>('card')
  const [toast, setToast]           = useState<string|null>(null)
  const [toastWarn, setToastWarn]   = useState(false)
  const [charging, setCharging]     = useState(false)
  const [showEndShift, setShowEndShift] = useState(false)
  const [showMenu, setShowMenu]         = useState(false)
  const [showDash, setShowDash]         = useState(false)
  const [showAI, setShowAI]             = useState(false)
  const [showInv, setShowInv]           = useState(false)
  const [showLoc, setShowLoc]           = useState(false)
  const [selectedLoc, setSelectedLoc]   = useState('')
  const [openCash, setOpenCash]         = useState('0')
  const [startingShift, setStartingShift] = useState(false)
  const [isOnline, setIsOnline]           = useState(navigator.onLine)
  const [queueCount, setQueueCount]       = useState(getQueue().length)

  const showToast = (msg: string, warn = false) => { setToast(msg); setToastWarn(warn); setTimeout(()=>setToast(null),2200) }

  useEffect(() => {
    const up = () => { setIsOnline(true); syncQueue() }
    const down = () => setIsOnline(false)
    window.addEventListener('online',up); window.addEventListener('offline',down)
    return () => { window.removeEventListener('online',up); window.removeEventListener('offline',down) }
  }, [])

  const syncQueue = useCallback(async () => {
    const queue = getQueue(); if(!queue.length) return; let synced=0
    for (const q of queue) {
      const { data: newOrder, error } = await db.from('orders').insert({ truck_id:q.business_id, shift_id:q.shift_id, order_number:q.order_number, status:'paid', subtotal:q.subtotal, tax_amount:q.tax_amount, total:q.total, cost_total:q.cost_total, profit:q.profit, payment_method:q.payment_method, paid_at:q.queued_at }).select().single()
      if (!error && newOrder) { await db.from('order_items').insert(q.items.map(i=>({order_id:newOrder.id,...i}))); await db.from('payments').insert({order_id:newOrder.id,method:q.payment_method,amount:q.total,status:'succeeded'}); synced++ }
    }
    if (synced>0) { clearQueue(); setQueueCount(0); showToast(`✓ ${synced} offline order${synced>1?'s':''} synced`) }
  }, [])

  const boot = useCallback(async () => {
    setScreen('loading')
    const {data:locs}  = await db.from('locations').select('*').eq('truck_id',business.id).order('name')
    const {data:cats}  = await db.from('menu_categories').select('*').eq('truck_id',business.id).order('sort_order')
    const {data:items} = await db.from('menu_items').select('*').eq('truck_id',business.id).order('sort_order')
    setLocations(locs||[]); setCategories(cats||[]); setMenuItems(items||[])
    const {data:openShifts} = await db.from('shifts').select('*, locations(name)').eq('truck_id',business.id).eq('status','open').order('started_at',{ascending:false}).limit(1)
    if (openShifts&&openShifts.length>0) {
      const s=openShifts[0]; setShift({...s,location_name:s.locations?.name||'Unknown'})
      const {data:lastOrder} = await db.from('orders').select('order_number').eq('truck_id',business.id).order('order_number',{ascending:false}).limit(1)
      setOrderNum(lastOrder&&lastOrder.length>0?lastOrder[0].order_number+1:1); setScreen('pos')
    } else { setScreen('start-shift') }
  }, [business.id])

  useEffect(()=>{boot()},[boot])

  const startShift = async () => {
    if(!selectedLoc) return; setStartingShift(true)
    const {data,error} = await db.from('shifts').insert({truck_id:business.id,location_id:selectedLoc,operator_id:session.user.id,status:'open',opening_cash:parseFloat(openCash)||0}).select('*, locations(name)').single()
    if(!error&&data){setShift({...data,location_name:data.locations?.name||'Unknown'});setScreen('pos')}
    setStartingShift(false)
  }

  const endShift = async () => {
    if(!shift) return
    await db.from('shifts').update({status:'closed',ended_at:new Date().toISOString()}).eq('id',shift.id)
    setShift(null);setOrder([]);setShowEndShift(false);setScreen('start-shift');setSelectedLoc('')
  }

  const addItem = (item: MenuItem) => {
    if(!item.is_active) return
    setOrder(prev => { const ex=prev.find(l=>l.menu_item_id===item.id); if(ex) return prev.map(l=>l.menu_item_id===item.id?{...l,qty:l.qty+1}:l); return [...prev,{menu_item_id:item.id,name:item.name,emoji:item.emoji,qty:1,unit_price:item.price,unit_cost:item.cost_price}] })
  }
  const changeQty = (id:string,delta:number) => { setOrder(prev=>prev.map(l=>l.menu_item_id===id?{...l,qty:l.qty+delta}:l).filter(l=>l.qty>0)) }

  const subtotal = order.reduce((s,l)=>s+l.unit_price*l.qty,0)
  const tax      = subtotal*(business.tax_rate||0.19)
  const total    = subtotal+tax
  const profit   = order.reduce((s,l)=>s+(l.unit_price-l.unit_cost)*l.qty,0)

  const charge = async () => {
    if(!order.length||!shift||charging) return; setCharging(true)
    const thisNum=orderNum; const now=new Date().toISOString()
    const itemRows=order.map(l=>({menu_item_id:l.menu_item_id,name:l.name,emoji:l.emoji,quantity:l.qty,unit_price:l.unit_price,unit_cost:l.unit_cost,line_total:parseFloat((l.unit_price*l.qty).toFixed(2)),line_profit:parseFloat(((l.unit_price-l.unit_cost)*l.qty).toFixed(2))}))
    const costTotal=parseFloat(order.reduce((s,l)=>s+l.unit_cost*l.qty,0).toFixed(2))
    if(!isOnline){
      addToQueue({id:crypto.randomUUID(),business_id:business.id,shift_id:shift.id,order_number:thisNum,subtotal:parseFloat(subtotal.toFixed(2)),tax_amount:parseFloat(tax.toFixed(2)),total:parseFloat(total.toFixed(2)),cost_total:costTotal,profit:parseFloat(profit.toFixed(2)),payment_method:payMethod,queued_at:now,items:itemRows})
      setQueueCount(getQueue().length);setShift(prev=>prev?{...prev,total_revenue:prev.total_revenue+total,total_orders:prev.total_orders+1}:prev)
      setOrderNum(n=>n+1);setOrder([]);showToast(`📦 Order #${thisNum} saved offline`,true);setCharging(false);return
    }
    const {data:newOrder,error:oErr} = await db.from('orders').insert({truck_id:business.id,shift_id:shift.id,order_number:thisNum,status:'paid',subtotal:parseFloat(subtotal.toFixed(2)),tax_amount:parseFloat(tax.toFixed(2)),total:parseFloat(total.toFixed(2)),cost_total:costTotal,profit:parseFloat(profit.toFixed(2)),payment_method:payMethod,paid_at:now,kitchen_status:'new'}).select().single()
    if(!oErr&&newOrder){
      await db.from('order_items').insert(itemRows.map(i=>({...i,order_id:newOrder.id})))
      await db.from('payments').insert({order_id:newOrder.id,method:payMethod,amount:parseFloat(total.toFixed(2)),status:'succeeded'})
      await db.from('shifts').update({total_revenue:parseFloat((shift.total_revenue+total).toFixed(2)),total_cost:parseFloat((shift.total_cost+costTotal).toFixed(2)),total_orders:shift.total_orders+1}).eq('id',shift.id)

      // ── Auto inventory deduction — use orderSnapshot (order state captured before clear) ──
      const orderSnapshot = [...order]
      const { data: invItems } = await db.from('inventory').select('*').eq('truck_id', business.id)
      if (invItems && invItems.length > 0) {
        const lowAlerts: string[] = []
        for (const invItem of invItems) {
          if (!invItem.menu_item_id) continue
          const linkedLines = orderSnapshot.filter(l => l.menu_item_id === invItem.menu_item_id)
          if (linkedLines.length === 0) continue
          const totalDeduct = linkedLines.reduce((s, l) => s + (l.qty * invItem.deduct_per_sale), 0)
          const newQty = Math.max(0, parseFloat((invItem.stock_qty - totalDeduct).toFixed(3)))
          await db.from('inventory').update({ stock_qty: newQty }).eq('id', invItem.id)
          await db.from('inventory_logs').insert({ inventory_id: invItem.id, change_qty: -totalDeduct, reason: 'sale', order_id: newOrder.id })
          if (newQty <= invItem.low_stock_alert) lowAlerts.push(invItem.ingredient_name)
        }
        if (lowAlerts.length > 0) setTimeout(() => showToast(`⚠️ Low stock: ${lowAlerts.join(', ')}`, true), 2400)
      }

      setShift(prev=>prev?{...prev,total_revenue:prev.total_revenue+total,total_orders:prev.total_orders+1}:prev)
      setOrderNum(n=>n+1);setOrder([]);showToast(`✓ Order #${thisNum} — €${total.toFixed(2)} ${payMethod==='cash'?'Cash':'Card'}`)
    }
    setCharging(false)
  }

  const filtered    = activeCat==='all' ? menuItems : menuItems.filter(i=>i.category_id===activeCat)
  const margin      = (item: MenuItem) => Math.round(((item.price-item.cost_price)/item.price)*100)
  const shiftProfit = shift ? shift.total_revenue-shift.total_cost : 0

  if(screen==='loading') return <Loading text="Loading your business…" />

  if(screen==='start-shift') return (
    <div className="app">
      <div className="shift-root">
        <div className="shift-card">
          <div style={{fontSize:32,marginBottom:12}}>{typeEmoji(business.business_type)}</div>
          <div className="shift-title">{business.name}</div>
          <div className="shift-sub" style={{marginBottom:6}}>Where are you opening today?</div>
          <button style={{background:'none',border:'none',color:'#64748b',fontSize:12,fontWeight:700,cursor:'pointer',marginBottom:24,padding:0,fontFamily:'Plus Jakarta Sans,sans-serif'}} onClick={onSwitch}>← Switch business</button>
          <span className="shift-label">Pick your location</span>
          <div className="loc-grid">{locations.map(loc=><button key={loc.id} className={`loc-btn ${selectedLoc===loc.id?'selected':''}`} style={selectedLoc===loc.id?{borderColor:business.color,background:`${business.color}18`}:{}} onClick={()=>setSelectedLoc(loc.id)}><span>📍</span> {loc.name}</button>)}</div>
          <div className="cash-row"><span className="shift-label">Opening Cash Float (€)</span><input className="cash-input" type="number" placeholder="0.00" value={openCash} onChange={e=>setOpenCash(e.target.value)} /></div>
          <button className="start-btn" style={{background:business.color}} onClick={startShift} disabled={!selectedLoc||startingShift}>{startingShift?'Starting…':'🚀 Open Shift'}</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app">
      {toast && <div className={`toast ${toastWarn?'toast-warn':''}`}>{toast}</div>}
      {showMenu && <MenuManagement business={business} categories={categories} menuItems={menuItems} onClose={()=>setShowMenu(false)} onUpdated={setMenuItems} />}
      {showDash && <Dashboard business={business} currentShift={shift} onClose={()=>setShowDash(false)} />}
      {showAI   && <AIInsights business={business} currentShift={shift} menuItems={menuItems} onClose={()=>setShowAI(false)} />}
      {showInv  && <InventoryModule business={business} menuItems={menuItems} onClose={()=>setShowInv(false)} />}
      {showLoc  && <LocationManagement business={business} onClose={()=>setShowLoc(false)} onUpdated={locs=>setLocations(locs)} />}
      {showEndShift&&shift&&<div className="modal-overlay"><div className="modal-card"><div className="modal-title">End Shift?</div><div className="modal-sub">Closing shift at {shift.location_name}.</div><div className="modal-kpis"><div className="modal-kpi"><span className="modal-kpi-val" style={{color:business.color}}>€{shift.total_revenue.toFixed(0)}</span><span className="modal-kpi-label">Revenue</span></div><div className="modal-kpi"><span className="modal-kpi-val" style={{color:'#22c55e'}}>€{shiftProfit.toFixed(0)}</span><span className="modal-kpi-label">Profit</span></div><div className="modal-kpi"><span className="modal-kpi-val" style={{color:'#f59e0b'}}>{shift.total_orders}</span><span className="modal-kpi-label">Orders</span></div></div><div className="modal-btns"><button className="modal-cancel" onClick={()=>setShowEndShift(false)}>Keep Going</button><button className="modal-confirm" onClick={endShift}>End Shift</button></div></div></div>}

      <div className="topbar">
        <div className="topbar-logo" onClick={onSwitch}><div className="topbar-s" style={{background:business.color}}>{typeEmoji(business.business_type)}</div><div className="topbar-name">{business.name}</div></div>
        <div className="topbar-right">
          {!isOnline?<div className="topbar-offline">📦 Offline</div>:<div className="topbar-shift-badge"><div className="topbar-dot"/>{shift?.location_name}</div>}
          <div className="topbar-orders">#{orderNum}</div>
          <button className={`topbar-icon-btn ${showDash?'active':''}`} onClick={()=>setShowDash(true)} title="Dashboard" style={showDash?{borderColor:business.color,background:`${business.color}18`}:{}}>📊</button>
          <button className={`topbar-icon-btn ${showAI?'active':''}`} onClick={()=>setShowAI(true)} title="AI Insights" style={showAI?{background:'#0d9488',borderColor:'#0d9488'}:{background:'#0f172a',borderColor:'#0d9488'}}>⚡</button>
          <button className={`topbar-icon-btn ${showInv?'active':''}`} onClick={()=>setShowInv(true)} title="Inventory" style={showInv?{borderColor:business.color,background:`${business.color}18`}:{}}>📦</button>
          <button className={`topbar-icon-btn ${showLoc?'active':''}`} onClick={()=>setShowLoc(true)} title="Locations" style={showLoc?{borderColor:business.color,background:`${business.color}18`}:{}}>📍</button>
          <button className={`topbar-icon-btn ${showMenu?'active':''}`} onClick={()=>setShowMenu(true)} title="Menu" style={showMenu?{borderColor:business.color,background:`${business.color}18`}:{}}>📋</button>
          <button className="switch-biz-btn" onClick={onSwitch}>Switch</button>
          <button className="end-shift-btn" onClick={()=>setShowEndShift(true)}>End Shift</button>
        </div>
      </div>

      {!isOnline&&queueCount>0&&<div className="offline-banner"><span className="offline-banner-text">📦 Offline — orders queued locally</span><span className="offline-banner-count">{queueCount} queued</span></div>}
      {isOnline&&queueCount>0&&<div className="offline-banner"><span className="offline-banner-text">🔄 Syncing offline orders…</span><span className="offline-banner-count">{queueCount} pending</span></div>}

      <div className="pos-body">
        <div className="menu-panel">
          <div className="cats-bar">
            <button className={`cat-chip ${activeCat==='all'?'active':''}`} style={activeCat==='all'?{background:business.color,borderColor:business.color}:{}} onClick={()=>setActiveCat('all')}>All</button>
            {categories.map(c=><button key={c.id} className={`cat-chip ${activeCat===c.id?'active':''}`} style={activeCat===c.id?{background:business.color,borderColor:business.color}:{}} onClick={()=>setActiveCat(c.id)}>{c.emoji} {c.name}</button>)}
          </div>
          <div className="menu-grid">
            {filtered.map(item=>(
              <div key={item.id} className={`menu-item ${!item.is_active?'soldout':''}`} onClick={()=>addItem(item)}>
                {!item.is_active&&<span className="item-soldout-badge">86'd</span>}
                <span className="item-margin">{margin(item)}%</span>
                {item.image_url?<img className="item-img" src={item.image_url} alt={item.name}/>:<span className="item-emoji">{item.emoji}</span>}
                <span className="item-name">{item.name}</span>
                <span className="item-price" style={{color:business.color}}>€{item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="order-panel">
          <div className="order-hd"><span className="order-hd-title">Order</span><span className="order-num-badge" style={{color:business.color,borderColor:`${business.color}40`,background:`${business.color}18`}}>#{orderNum}</span></div>
          <div className="order-lines">
            {order.length===0?<div className="order-empty"><span className="order-empty-icon">🛒</span><span className="order-empty-text">Tap items to add</span></div>:order.map(l=>(
              <div key={l.menu_item_id} className="order-line">
                <span className="ol-emoji">{l.emoji}</span><span className="ol-name">{l.name}</span>
                <div className="ol-qty"><button className="ol-qbtn" onClick={()=>changeQty(l.menu_item_id,-1)}>−</button><span className="ol-qnum">{l.qty}</span><button className="ol-qbtn" onClick={()=>changeQty(l.menu_item_id,1)}>+</button></div>
                <span className="ol-price" style={{color:business.color}}>€{(l.unit_price*l.qty).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="order-ft">
            {order.length>0&&<><div className="ord-row"><span>Subtotal</span><span>€{subtotal.toFixed(2)}</span></div><div className="ord-row"><span>MwSt. 19%</span><span>€{tax.toFixed(2)}</span></div></>}
            <div className="ord-total"><span className="ord-total-label">Total</span><span className="ord-total-amt" style={{color:business.color}}>€{total.toFixed(2)}</span></div>
            {order.length>0&&<div className="ord-profit">↑ +€{profit.toFixed(2)} profit this order</div>}
            <div className="pay-methods">
              <button className={`pay-btn ${payMethod==='cash'?'active':''}`} style={payMethod==='cash'?{borderColor:business.color,color:business.color,background:`${business.color}18`}:{}} onClick={()=>setPayMethod('cash')}>💵 Cash</button>
              <button className={`pay-btn ${payMethod==='card'?'active':''}`} style={payMethod==='card'?{borderColor:business.color,color:business.color,background:`${business.color}18`}:{}} onClick={()=>setPayMethod('card')}>💳 Card</button>
            </div>
            <button className="charge-btn" style={{background:order.length&&!charging?business.color:''}} onClick={charge} disabled={!order.length||charging}>{charging?'Saving…':order.length?`Charge €${total.toFixed(2)}`:'Add items'}</button>
            {order.length>0&&<button className="void-btn" onClick={()=>setOrder([])}>Void Order</button>}
          </div>
        </div>
      </div>

      <div className="ai-bar">
        <div className="ai-bar-label">Live</div>
        <div className="ai-cards">
          <div className="ai-card"><span className="ai-card-icon">💰</span><div className="ai-card-body"><span className="ai-card-label">Revenue</span><span className="ai-card-val" style={{color:business.color}}>€{(shift?.total_revenue||0).toFixed(2)}</span></div></div>
          <div className="ai-card"><span className="ai-card-icon">📈</span><div className="ai-card-body"><span className="ai-card-label">Profit</span><span className="ai-card-val" style={{color:'#22c55e'}}>€{shiftProfit.toFixed(2)}</span></div></div>
          <div className="ai-card"><span className="ai-card-icon">🧾</span><div className="ai-card-body"><span className="ai-card-label">Orders</span><span className="ai-card-val">{shift?.total_orders||0}</span></div></div>
          <div className="ai-card"><span className="ai-card-icon">{isOnline?'🤖':'📦'}</span><div className="ai-card-body"><span className="ai-card-label">{isOnline?'Status':'Offline'}</span><span className="ai-card-val" style={{color:isOnline?'#22c55e':'#f59e0b'}}>{isOnline?'Online':`${queueCount} queued`}</span></div></div>
        </div>
      </div>
    </div>
  )
}

// ─── BUSINESS PICKER ─────────────────────────────────────────
function BusinessPicker({ businesses, onSelect, onAdd, onSignOut }: { businesses: Business[]; onSelect: (b: Business) => void; onAdd: () => void; onSignOut: () => void }) {
  return (
    <div className="picker-root"><div className="picker-card">
      <div className="picker-hd"><div><div className="picker-title">Your Businesses</div><div className="picker-sub">Select one to open the POS</div></div><button className="picker-signout" onClick={onSignOut}>Sign out</button></div>
      <div className="biz-list">{businesses.map(b=><div key={b.id} className="biz-card" onClick={()=>onSelect(b)}><div className="biz-icon" style={{background:`${b.color}20`,border:`1.5px solid ${b.color}40`}}>{typeEmoji(b.business_type)}</div><div className="biz-info"><div className="biz-name">{b.name}</div><div className="biz-type">{BUSINESS_TYPES.find(t=>t.value===b.business_type)?.label||b.business_type}</div></div><div className="biz-arrow">›</div></div>)}</div>
      <button className="add-biz-btn" onClick={onAdd}>＋ Add another business</button>
    </div></div>
  )
}

function CreateBusiness({ userId, onCreated, onBack }: { userId: string; onCreated: (b: Business) => void; onBack?: () => void }) {
  const [name,setName]=useState(''); const [type,setType]=useState('food_truck'); const [color,setColor]=useState(BRAND_COLORS[0]); const [address,setAddress]=useState(''); const [saving,setSaving]=useState(false)
  const create = async () => {
    if(!name.trim()) return; setSaving(true)
    const slug=name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')+'-'+userId.slice(0,6)
    const {data:biz,error}=await db.from('trucks').insert({name:name.trim(),slug,owner_id:userId,business_type:type,color,address:address.trim()||null,currency:'EUR',tax_rate:0.19}).select().single()
    if(!error&&biz){
      const {data:cats}=await db.from('menu_categories').insert(SEED_CATS.map(c=>({...c,truck_id:biz.id}))).select()
      const catMap:Record<string,string>={}; cats.forEach((c:Category)=>{catMap[c.name]=c.id})
      await db.from('menu_items').insert(SEED_ITEMS.map(item=>({truck_id:biz.id,category_id:catMap[item.cat],name:item.name,emoji:item.emoji,price:item.price,cost_price:item.cost_price})))
      await db.from('locations').insert(SEED_LOCS.map(n=>({truck_id:biz.id,name:n}))); onCreated(biz)
    }
    setSaving(false)
  }
  return (
    <div className="create-root"><div className="create-card">
      <div className="create-title">Add a Business</div><div className="create-sub">Each business gets its own menu, locations, and shift history.</div>
      <div className="create-field"><label className="create-label">Business Name</label><input className="create-input" placeholder="StreetFoodFusion" value={name} onChange={e=>setName(e.target.value)} /></div>
      <div className="create-field"><label className="create-label">Business Type</label><div className="type-grid">{BUSINESS_TYPES.map(t=><button key={t.value} className={`type-btn ${type===t.value?'selected':''}`} onClick={()=>setType(t.value)}><span className="type-btn-emoji">{t.emoji}</span>{t.label}</button>)}</div></div>
      <div className="create-field"><label className="create-label">Brand Color</label><div className="color-row">{BRAND_COLORS.map(c=><div key={c} className={`color-dot ${color===c?'selected':''}`} style={{background:c}} onClick={()=>setColor(c)} />)}</div></div>
      <div className="create-field"><label className="create-label">Address (optional)</label><input className="create-input" placeholder="Anger 1, 99084 Erfurt" value={address} onChange={e=>setAddress(e.target.value)} /></div>
      <button className="create-btn" onClick={create} disabled={!name.trim()||saving} style={{background:color}}>{saving?'Creating…':'→ Create Business'}</button>
      {onBack&&<button className="back-btn" onClick={onBack}>← Back</button>}
    </div></div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]       = useState<Session | null>(null)
  const [loading, setLoading]       = useState(true)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selected, setSelected]     = useState<Business | null>(null)
  const [screen, setScreen]         = useState<'loading'|'picker'|'create'|'pos'>('loading')

  // ── KDS mode — if URL has ?kds, render kitchen display ──
  const isKDS = new URLSearchParams(window.location.search).has('kds')
  if (isKDS) return <><style>{css}</style><KDSRoot /></>

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session); if (!session) { setSelected(null); setScreen('loading') }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadBusinesses = useCallback(async (userId: string) => {
    setScreen('loading')
    const { data } = await db.from('trucks').select('*').eq('owner_id', userId).order('created_at')
    const list = data || []; setBusinesses(list)
    if (list.length === 0) setScreen('create')
    else if (list.length === 1) { setSelected(list[0]); setScreen('pos') }
    else setScreen('picker')
  }, [])

  useEffect(() => { if (session) loadBusinesses(session.user.id) }, [session, loadBusinesses])

  const handleSignOut = async () => {
    await supabase.auth.signOut(); setSelected(null); setBusinesses([]); setScreen('loading')
  }

  if (loading) return <><style>{css}</style><Loading /></>
  if (!session) return <><style>{css}</style><AuthScreen /></>

  return (
    <>
      <style>{css}</style>
      {screen === 'loading'  && <Loading text="Loading your businesses…" />}
      {screen === 'picker'   && <BusinessPicker businesses={businesses} onSelect={b=>{setSelected(b);setScreen('pos')}} onAdd={()=>setScreen('create')} onSignOut={handleSignOut} />}
      {screen === 'create'   && <CreateBusiness userId={session.user.id} onCreated={b=>{setBusinesses(prev=>[...prev,b]);setSelected(b);setScreen('pos')}} onBack={businesses.length>0?()=>setScreen('picker'):undefined} />}
      {screen === 'pos'      && selected && <POSApp session={session} business={selected} onSwitch={()=>businesses.length>1?setScreen('picker'):handleSignOut()} />}
    </>
  )
}

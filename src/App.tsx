import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
const db = supabase as any

const TRUCK_SLUG = import.meta.env.VITE_TRUCK_SLUG || 'streetfoodfusion'

// ─── TYPES ────────────────────────────────────────────────────
type Truck    = { id: string; name: string; color: string; tax_rate: number; business_type: string }
type Category = { id: string; name: string; emoji: string; sort_order: number }
type Item     = { id: string; name: string; emoji: string; description: string; price: number; cost_price: number; category_id: string; is_active: boolean; image_url?: string }
type CartLine = { item: Item; qty: number }

// ─── STYLES ───────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #0f172a; color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; min-height: 100vh; }

  /* ── TOPBAR ── */
  .c-topbar { background: #1e293b; border-bottom: 1px solid #334155; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
  .c-logo { display: flex; align-items: center; gap: 10px; }
  .c-logo-s { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: white; font-weight: 800; flex-shrink: 0; }
  .c-logo-name { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
  .c-logo-sub { font-size: 11px; color: #64748b; font-weight: 600; margin-top: -2px; }
  .c-status-badge { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 20px; }
  .c-status-open { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
  .c-status-closed { background: rgba(100,116,139,0.1); color: #64748b; border: 1px solid rgba(100,116,139,0.2); }
  .c-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  /* ── HERO ── */
  .c-hero { padding: 24px 16px 16px; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); }
  .c-hero-title { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 6px; }
  .c-hero-sub { font-size: 14px; color: #64748b; line-height: 1.5; }
  .c-hero-location { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; margin-top: 10px; }
  .c-hero-location-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  /* ── CATS ── */
  .c-cats { display: flex; gap: 8px; padding: 14px 16px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid #1e293b; position: sticky; top: 65px; background: #0f172a; z-index: 40; }
  .c-cats::-webkit-scrollbar { display: none; }
  .c-cat-btn { padding: 8px 16px; border-radius: 20px; border: 1px solid #334155; background: transparent; color: #64748b; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; white-space: nowrap; transition: all 0.12s; flex-shrink: 0; }
  .c-cat-btn:hover { border-color: #0d9488; color: #14b8a6; }
  .c-cat-btn.active { background: #0d9488; border-color: #0d9488; color: white; }

  /* ── MENU ── */
  .c-section { padding: 20px 16px 8px; }
  .c-section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .c-items { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
  .c-item { background: #1e293b; border: 1.5px solid #334155; border-radius: 16px; overflow: hidden; display: flex; align-items: stretch; transition: border-color 0.15s; }
  .c-item.soldout { opacity: 0.5; }
  .c-item-img { width: 90px; height: 90px; object-fit: cover; flex-shrink: 0; }
  .c-item-emoji-box { width: 90px; height: 90px; background: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 36px; flex-shrink: 0; }
  .c-item-body { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
  .c-item-name { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
  .c-item-desc { font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .c-item-foot { display: flex; align-items: center; justify-content: space-between; }
  .c-item-price { font-size: 16px; font-weight: 800; font-family: 'Space Grotesk', monospace; }
  .c-item-soldout-tag { font-size: 10px; font-weight: 700; color: #ef4444; background: rgba(239,68,68,0.1); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.2); }

  /* ── ADD BUTTON ── */
  .c-add-btn { width: 34px; height: 34px; border-radius: 10px; border: none; color: white; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.12s; flex-shrink: 0; font-weight: 300; }
  .c-add-btn:hover { filter: brightness(1.1); transform: scale(1.05); }
  .c-add-btn:active { transform: scale(0.96); }
  .c-qty-ctrl { display: flex; align-items: center; gap: 8px; }
  .c-qty-btn { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #f8fafc; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.1s; }
  .c-qty-btn:hover { border-color: #0d9488; }
  .c-qty-num { font-size: 15px; font-weight: 700; font-family: 'Space Grotesk', monospace; min-width: 20px; text-align: center; }

  /* ── FLOATING CART ── */
  .c-cart-bar { position: fixed; bottom: 20px; left: 16px; right: 16px; z-index: 100; }
  .c-cart-btn { width: 100%; padding: 16px 20px; border: none; border-radius: 16px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; justify-content: space-between; transition: all 0.15s; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
  .c-cart-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
  .c-cart-left { display: flex; align-items: center; gap: 10px; }
  .c-cart-badge { background: rgba(255,255,255,0.2); border-radius: 8px; padding: 3px 9px; font-size: 13px; font-weight: 800; }
  .c-cart-label { font-size: 16px; font-weight: 800; }
  .c-cart-total { font-size: 16px; font-weight: 800; font-family: 'Space Grotesk', monospace; }

  /* ── CART SHEET ── */
  .c-sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; flex-direction: column; justify-content: flex-end; animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .c-sheet { background: #1e293b; border-radius: 24px 24px 0 0; padding: 0 0 32px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; scrollbar-width: none; }
  .c-sheet::-webkit-scrollbar { display: none; }
  @keyframes slideUp { from{transform:translateY(30px);opacity:0} to{transform:none;opacity:1} }
  .c-sheet-handle { width: 40px; height: 4px; background: #334155; border-radius: 2px; margin: 14px auto 20px; }
  .c-sheet-title { font-size: 18px; font-weight: 800; padding: 0 20px 16px; border-bottom: 1px solid #334155; }
  .c-sheet-items { padding: 12px 20px; }
  .c-sheet-line { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(51,65,85,0.5); }
  .c-sheet-line:last-child { border-bottom: none; }
  .c-sheet-emoji { font-size: 22px; flex-shrink: 0; }
  .c-sheet-name { flex: 1; font-size: 14px; font-weight: 600; }
  .c-sheet-line-price { font-size: 14px; font-weight: 700; font-family: 'Space Grotesk', monospace; }
  .c-sheet-foot { padding: 16px 20px 0; }
  .c-sheet-totals { background: #0f172a; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
  .c-sheet-row { display: flex; justify-content: space-between; font-size: 13px; color: #64748b; font-family: 'Space Grotesk', monospace; margin-bottom: 6px; }
  .c-sheet-row:last-child { margin-bottom: 0; }
  .c-sheet-total-row { display: flex; justify-content: space-between; align-items: baseline; padding-top: 10px; border-top: 1px solid #334155; margin-top: 10px; }
  .c-sheet-total-label { font-size: 15px; font-weight: 800; color: #f8fafc; }
  .c-sheet-total-amt { font-size: 22px; font-weight: 800; font-family: 'Space Grotesk', monospace; }
  .c-checkout-btn { width: 100%; padding: 16px; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.15s; }
  .c-checkout-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
  .c-clear-btn { width: 100%; padding: 10px; background: transparent; border: 1px solid #334155; border-radius: 10px; color: #64748b; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; margin-top: 8px; transition: all 0.15s; }
  .c-clear-btn:hover { border-color: #ef4444; color: #ef4444; }

  /* ── CHECKOUT SCREEN ── */
  .c-checkout { min-height: 100vh; background: #0f172a; padding-bottom: 40px; }
  .c-checkout-topbar { background: #1e293b; border-bottom: 1px solid #334155; padding: 14px 16px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 50; }
  .c-back-btn { width: 36px; height: 36px; border-radius: 10px; background: #0f172a; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; color: #f8fafc; transition: all 0.15s; flex-shrink: 0; }
  .c-back-btn:hover { border-color: #0d9488; }
  .c-checkout-title { font-size: 17px; font-weight: 800; }
  .c-checkout-body { padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; }
  .c-section-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; }
  .c-section-hd { padding: 14px 16px; border-bottom: 1px solid #334155; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .c-section-body { padding: 14px 16px; }

  /* ── SLOTS ── */
  .c-slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .c-slot-btn { padding: 10px 8px; background: #0f172a; border: 1.5px solid #334155; border-radius: 10px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; text-align: center; transition: all 0.12s; }
  .c-slot-btn:hover { border-color: #0d9488; color: #14b8a6; }
  .c-slot-btn.selected { border-color: #0d9488; color: #f8fafc; background: rgba(13,148,136,0.1); }
  .c-slot-btn.full { opacity: 0.4; cursor: not-allowed; }
  .c-slot-btn.full:hover { border-color: #334155; color: #64748b; }
  .c-slot-sub { font-size: 9px; color: currentColor; opacity: 0.7; margin-top: 2px; }

  /* ── FORM ── */
  .c-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .c-field:last-child { margin-bottom: 0; }
  .c-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
  .c-input { padding: 13px 14px; background: #0f172a; border: 1.5px solid #334155; border-radius: 10px; font-size: 15px; font-weight: 500; color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; width: 100%; transition: border-color 0.15s; }
  .c-input::placeholder { color: #475569; }
  .c-input:focus { border-color: #0d9488; }

  /* ── AUTH TABS ── */
  .c-auth-tabs { display: flex; background: #0f172a; border-radius: 10px; padding: 4px; margin-bottom: 16px; }
  .c-auth-tab { flex: 1; padding: 8px; border: none; background: transparent; color: #64748b; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; border-radius: 7px; transition: all 0.15s; }
  .c-auth-tab.active { background: #1e293b; color: #f8fafc; }

  /* ── ORDER SUMMARY ── */
  .c-summary-line { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid rgba(51,65,85,0.4); }
  .c-summary-line:last-child { border-bottom: none; }
  .c-summary-name { color: #94a3b8; }
  .c-summary-price { font-family: 'Space Grotesk', monospace; font-weight: 600; }

  /* ── PLACE ORDER BTN ── */
  .c-place-btn { width: 100%; padding: 16px; border: none; border-radius: 14px; color: white; font-size: 16px; font-weight: 800; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.15s; }
  .c-place-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
  .c-place-btn:disabled { background: #334155 !important; color: #64748b; cursor: not-allowed; transform: none; filter: none; }

  /* ── CONFIRMATION ── */
  .c-confirm { min-height: 100vh; background: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; text-align: center; }
  .c-confirm-icon { width: 80px; height: 80px; border-radius: 50%; background: rgba(13,148,136,0.15); border: 2px solid #0d9488; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 24px; animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes popIn { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
  .c-confirm-title { font-size: 26px; font-weight: 800; margin-bottom: 8px; }
  .c-confirm-sub { font-size: 15px; color: #64748b; line-height: 1.6; margin-bottom: 28px; max-width: 300px; }
  .c-confirm-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 20px; width: 100%; max-width: 340px; margin-bottom: 24px; }
  .c-confirm-ref { font-size: 32px; font-weight: 800; font-family: 'Space Grotesk', monospace; margin-bottom: 8px; }
  .c-confirm-detail { font-size: 13px; color: #64748b; }
  .c-confirm-detail span { color: #f8fafc; font-weight: 600; }
  .c-new-order-btn { padding: 14px 28px; border: none; border-radius: 12px; color: white; font-size: 15px; font-weight: 800; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; }

  /* ── LOADING / EMPTY ── */
  .c-loading { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
  .c-loading-s { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 26px; color: white; animation: breathe 1.5s ease-in-out infinite; }
  @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
  .c-loading-text { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.1em; }
  .c-powered { font-size: 11px; color: #334155; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; text-align: center; padding: 20px 0 8px; }
  .c-powered span { color: #0d9488; }
  .c-error { text-align: center; padding: 60px 20px; }
  .c-error-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
  .c-error-title { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
  .c-error-sub { font-size: 14px; color: #64748b; }
`

// ─── APP ──────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<'menu'|'checkout'|'confirm'>('menu')
  const [truck, setTruck]   = useState<Truck | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems]   = useState<Item[]>([])
  const [cart, setCart]     = useState<CartLine[]>([])
  const [activeCat, setActiveCat] = useState('all')
  const [showCart, setShowCart]   = useState(false)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    const { data: truckData } = await db
      .from('trucks').select('*')
      .like('slug', `${TRUCK_SLUG}%`)
      .limit(1).single()

    if (!truckData) { setError('Truck not found'); setLoading(false); return }
    setTruck(truckData)

    const { data: cats } = await db.from('menu_categories').select('*').eq('truck_id', truckData.id).order('sort_order')
    setCategories(cats || [])

    const { data: menuItems } = await db.from('menu_items').select('*').eq('truck_id', truckData.id).order('sort_order')
    setItems(menuItems || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addToCart = (item: Item) => {
    if (!item.is_active) return
    setCart(prev => {
      const ex = prev.find(l => l.item.id === item.id)
      if (ex) return prev.map(l => l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { item, qty: 1 }]
    })
  }

  const changeQty = (id: string, delta: number) => {
    setCart(prev => prev.map(l => l.item.id === id ? { ...l, qty: l.qty + delta } : l).filter(l => l.qty > 0))
  }

  const cartQty   = cart.reduce((s, l) => s + l.qty, 0)
  const subtotal  = cart.reduce((s, l) => s + l.item.price * l.qty, 0)
  const tax       = subtotal * (truck?.tax_rate || 0.19)
  const total     = subtotal + tax
  const color     = truck?.color || '#0d9488'
  const filtered  = activeCat === 'all' ? items : items.filter(i => i.category_id === activeCat)
  const qtyFor    = (id: string) => cart.find(l => l.item.id === id)?.qty || 0

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="c-loading">
        <div className="c-loading-s" style={{ background: '#0d9488' }}>S</div>
        <div className="c-loading-text">Loading menu…</div>
      </div>
    </>
  )

  if (error) return (
    <>
      <style>{css}</style>
      <div className="c-error">
        <div className="c-error-icon">🚚</div>
        <div className="c-error-title">Truck not found</div>
        <div className="c-error-sub">Ask staff for the correct link.</div>
      </div>
    </>
  )

  if (screen === 'confirm') return (
    <>
      <style>{css}</style>
      <ConfirmScreen color={color} onNewOrder={() => { setCart([]); setScreen('menu') }} />
    </>
  )

  if (screen === 'checkout') return (
    <>
      <style>{css}</style>
      <CheckoutScreen
        truck={truck!}
        cart={cart}
        subtotal={subtotal}
        tax={tax}
        total={total}
        color={color}
        onBack={() => setScreen('menu')}
        onConfirm={() => setScreen('confirm')}
      />
    </>
  )

  return (
    <>
      <style>{css}</style>

      {/* Topbar */}
      <div className="c-topbar">
        <div className="c-logo">
          <div className="c-logo-s" style={{ background: color }}>{truck?.name?.[0] || 'S'}</div>
          <div>
            <div className="c-logo-name">{truck?.name}</div>
            <div className="c-logo-sub">Powered by Setzio</div>
          </div>
        </div>
        <div className={`c-status-badge c-status-open`}>
          <div className="c-status-dot" />
          Open
        </div>
      </div>

      {/* Hero */}
      <div className="c-hero">
        <div className="c-hero-title">What are you having? 🌯</div>
        <div className="c-hero-sub">Fresh made to order. Pick up at the truck.</div>
        <div className="c-hero-location">
          <div className="c-hero-location-dot" />
          <span style={{ color: '#94a3b8' }}>Order ahead · Skip the queue</span>
        </div>
      </div>

      {/* Category filter */}
      <div className="c-cats">
        <button className={`c-cat-btn ${activeCat === 'all' ? 'active' : ''}`}
          style={activeCat === 'all' ? { background: color, borderColor: color } : {}}
          onClick={() => setActiveCat('all')}>
          All
        </button>
        {categories.map(c => (
          <button key={c.id} className={`c-cat-btn ${activeCat === c.id ? 'active' : ''}`}
            style={activeCat === c.id ? { background: color, borderColor: color } : {}}
            onClick={() => setActiveCat(c.id)}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      {/* Menu items */}
      <div style={{ paddingBottom: cartQty > 0 ? 100 : 32 }}>
        {categories
          .filter(c => activeCat === 'all' || c.id === activeCat)
          .map(cat => {
            const catItems = filtered.filter(i => i.category_id === cat.id)
            if (catItems.length === 0) return null
            return (
              <div key={cat.id} className="c-section">
                <div className="c-section-title">
                  <span>{cat.emoji}</span> {cat.name}
                </div>
                <div className="c-items">
                  {catItems.map(item => {
                    const qty = qtyFor(item.id)
                    return (
                      <div key={item.id} className={`c-item ${!item.is_active ? 'soldout' : ''}`}>
                        {item.image_url
                          ? <img className="c-item-img" src={item.image_url} alt={item.name} />
                          : <div className="c-item-emoji-box">{item.emoji}</div>
                        }
                        <div className="c-item-body">
                          <div>
                            <div className="c-item-name">{item.name}</div>
                            {item.description && <div className="c-item-desc">{item.description}</div>}
                          </div>
                          <div className="c-item-foot">
                            <div className="c-item-price" style={{ color }}>{`€${item.price.toFixed(2)}`}</div>
                            {!item.is_active ? (
                              <span className="c-item-soldout-tag">86'd</span>
                            ) : qty === 0 ? (
                              <button className="c-add-btn" style={{ background: color }} onClick={() => addToCart(item)}>+</button>
                            ) : (
                              <div className="c-qty-ctrl">
                                <button className="c-qty-btn" onClick={() => changeQty(item.id, -1)}>−</button>
                                <span className="c-qty-num">{qty}</span>
                                <button className="c-qty-btn" style={{ borderColor: color }} onClick={() => addToCart(item)}>+</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        <div className="c-powered">Powered by <span>Setzio</span></div>
      </div>

      {/* Cart sheet */}
      {showCart && (
        <div className="c-sheet-overlay" onClick={() => setShowCart(false)}>
          <div className="c-sheet" onClick={e => e.stopPropagation()}>
            <div className="c-sheet-handle" />
            <div className="c-sheet-title">Your Order</div>
            <div className="c-sheet-items">
              {cart.map(l => (
                <div key={l.item.id} className="c-sheet-line">
                  <span className="c-sheet-emoji">{l.item.emoji}</span>
                  <span className="c-sheet-name">{l.item.name}</span>
                  <div className="c-qty-ctrl">
                    <button className="c-qty-btn" onClick={() => changeQty(l.item.id, -1)}>−</button>
                    <span className="c-qty-num">{l.qty}</span>
                    <button className="c-qty-btn" onClick={() => changeQty(l.item.id, 1)}>+</button>
                  </div>
                  <span className="c-sheet-line-price" style={{ color }}>{`€${(l.item.price * l.qty).toFixed(2)}`}</span>
                </div>
              ))}
            </div>
            <div className="c-sheet-foot">
              <div className="c-sheet-totals">
                <div className="c-sheet-row"><span>Subtotal</span><span>{`€${subtotal.toFixed(2)}`}</span></div>
                <div className="c-sheet-row"><span>MwSt. 19%</span><span>{`€${tax.toFixed(2)}`}</span></div>
                <div className="c-sheet-total-row">
                  <span className="c-sheet-total-label">Total</span>
                  <span className="c-sheet-total-amt" style={{ color }}>{`€${total.toFixed(2)}`}</span>
                </div>
              </div>
              <button className="c-checkout-btn" style={{ background: color }} onClick={() => { setShowCart(false); setScreen('checkout') }}>
                Proceed to Checkout →
              </button>
              <button className="c-clear-btn" onClick={() => { setCart([]); setShowCart(false) }}>Clear order</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating cart bar */}
      {cartQty > 0 && (
        <div className="c-cart-bar">
          <button className="c-cart-btn" style={{ background: color }} onClick={() => setShowCart(true)}>
            <div className="c-cart-left">
              <span className="c-cart-badge">{cartQty}</span>
              <span className="c-cart-label">View Order</span>
            </div>
            <span className="c-cart-total">{`€${total.toFixed(2)}`}</span>
          </button>
        </div>
      )}
    </>
  )
}

// ─── CHECKOUT SCREEN ──────────────────────────────────────────
function CheckoutScreen({ truck, cart, subtotal, tax, total, color, onBack, onConfirm }: {
  truck: Truck; cart: CartLine[]; subtotal: number; tax: number; total: number
  color: string; onBack: () => void; onConfirm: () => void
}) {
  const [authMode, setAuthMode] = useState<'guest'|'login'|'register'>('guest')
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<{ time: string; label: string; available: number; max: number }[]>([])
  const [placing, setPlacing]   = useState(false)
  const [error, setError]       = useState('')

  // Generate time slots — every 15 mins for next 2 hours from now
  useEffect(() => {
    const generated = []
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0)
    for (let i = 0; i < 8; i++) {
      const t = new Date(now.getTime() + i * 15 * 60000)
      generated.push({
        time: t.toISOString(),
        label: t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        available: 3,
        max: 3,
      })
    }
    setSlots(generated)
  }, [])

  const placeOrder = async () => {
    if (!name.trim() || !email.trim() || !selectedSlot) return
    setPlacing(true); setError('')

    try {
      // Create customer order
      const { data: order, error: oErr } = await db.from('customer_orders').insert({
        truck_id: truck.id,
        guest_name: name.trim(),
        guest_email: email.trim().toLowerCase(),
        pickup_time: selectedSlot,
        status: 'confirmed',
        total: parseFloat(total.toFixed(2)),
      }).select().single()

      if (oErr || !order) throw new Error(oErr?.message || 'Failed to place order')

      // Insert order items
      await db.from('customer_order_items').insert(
        cart.map(l => ({
          customer_order_id: order.id,
          menu_item_id: l.item.id,
          name: l.item.name,
          emoji: l.item.emoji,
          quantity: l.qty,
          unit_price: l.item.price,
          line_total: parseFloat((l.item.price * l.qty).toFixed(2)),
        }))
      )

      // Store order ref for confirmation screen
      localStorage.setItem('sff_last_order', JSON.stringify({
        id: order.id,
        name: name.trim(),
        email: email.trim(),
        pickup_time: selectedSlot,
        total: total.toFixed(2),
        items: cart.map(l => ({ name: l.item.name, qty: l.qty })),
      }))

      onConfirm()
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setPlacing(false)
  }

  const canPlace = name.trim() && email.trim() && selectedSlot && !placing

  return (
    <div className="c-checkout">
      <div className="c-checkout-topbar">
        <button className="c-back-btn" onClick={onBack}>←</button>
        <div className="c-checkout-title">Checkout</div>
      </div>

      <div className="c-checkout-body">

        {/* Order summary */}
        <div className="c-section-card">
          <div className="c-section-hd">Your Order</div>
          <div className="c-section-body">
            {cart.map(l => (
              <div key={l.item.id} className="c-summary-line">
                <span className="c-summary-name">{l.qty}× {l.item.name}</span>
                <span className="c-summary-price" style={{ color }}>{`€${(l.item.price * l.qty).toFixed(2)}`}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #334155', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
              <span style={{ fontFamily: "'Space Grotesk',monospace", fontWeight: 800, fontSize: 20, color }}>{`€${total.toFixed(2)}`}</span>
            </div>
          </div>
        </div>

        {/* Pickup time */}
        <div className="c-section-card">
          <div className="c-section-hd">Pick-up Time</div>
          <div className="c-section-body">
            <div className="c-slots">
              {slots.map(slot => (
                <button
                  key={slot.time}
                  className={`c-slot-btn ${selectedSlot === slot.time ? 'selected' : ''} ${slot.available === 0 ? 'full' : ''}`}
                  style={selectedSlot === slot.time ? { borderColor: color, background: `${color}18`, color: '#f8fafc' } : {}}
                  onClick={() => slot.available > 0 && setSelectedSlot(slot.time)}
                  disabled={slot.available === 0}
                >
                  {slot.label}
                  <div className="c-slot-sub">{slot.available > 0 ? `${slot.available} left` : 'Full'}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Your details */}
        <div className="c-section-card">
          <div className="c-section-hd">Your Details</div>
          <div className="c-section-body">
            <div className="c-auth-tabs">
              <button className={`c-auth-tab ${authMode === 'guest' ? 'active' : ''}`} onClick={() => setAuthMode('guest')}>Guest</button>
              <button className={`c-auth-tab ${authMode === 'login' ? 'active' : ''}`} onClick={() => setAuthMode('login')}>Sign In</button>
              <button className={`c-auth-tab ${authMode === 'register' ? 'active' : ''}`} onClick={() => setAuthMode('register')}>Register</button>
            </div>

            <div className="c-field">
              <label className="c-label">Your Name *</label>
              <input className="c-input" placeholder="Maria González" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="c-field">
              <label className="c-label">Email *</label>
              <input className="c-input" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            {authMode !== 'guest' && (
              <div className="c-field">
                <label className="c-label">Password</label>
                <input className="c-input" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} />
              </div>
            )}
            {authMode === 'guest' && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
                We'll send your order confirmation and pickup notification to this email.
              </div>
            )}
          </div>
        </div>

        {/* Pay */}
        <div className="c-section-card">
          <div className="c-section-hd">Payment</div>
          <div className="c-section-body">
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              💳 Pay at the truck when you collect. We'll hold your order until your pick-up time.
            </div>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 14 }}>
                {error}
              </div>
            )}
            <button className="c-place-btn" style={{ background: color }} onClick={placeOrder} disabled={!canPlace}>
              {placing ? 'Placing order…' : `Place Order · €${total.toFixed(2)}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── CONFIRMATION SCREEN ───────────────────────────────────────
function ConfirmScreen({ color, onNewOrder }: { color: string; onNewOrder: () => void }) {
  const raw  = localStorage.getItem('sff_last_order')
  const order = raw ? JSON.parse(raw) : null

  const pickupTime = order?.pickup_time
    ? new Date(order.pickup_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="c-confirm">
      <div className="c-confirm-icon">✓</div>
      <div className="c-confirm-title">Order Confirmed!</div>
      <div className="c-confirm-sub">
        We've got your order. Head to the truck at your pick-up time and we'll have it ready.
      </div>

      {order && (
        <div className="c-confirm-card">
          <div className="c-confirm-ref" style={{ color }}>#{order.id.slice(0, 6).toUpperCase()}</div>
          <div className="c-confirm-detail">Pick-up at <span>{pickupTime}</span></div>
          <div style={{ marginTop: 12, borderTop: '1px solid #334155', paddingTop: 12 }}>
            {order.items?.map((item: any, i: number) => (
              <div key={i} style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
                {item.qty}× {item.name}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, borderTop: '1px solid #334155', paddingTop: 12, fontSize: 15, fontWeight: 800, color, fontFamily: "'Space Grotesk',monospace" }}>
            Total: €{order.total}
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6, textAlign: 'center', maxWidth: 280 }}>
        A confirmation has been sent to <strong style={{ color: '#f8fafc' }}>{order?.email}</strong>
      </div>

      <button className="c-new-order-btn" style={{ background: color }} onClick={onNewOrder}>
        Start a New Order
      </button>

      <div className="c-powered" style={{ marginTop: 24 }}>Powered by <span>Setzio</span></div>
    </div>
  )
}

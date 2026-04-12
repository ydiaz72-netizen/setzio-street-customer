import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
const db = supabase as any
const TRUCK_SLUG = import.meta.env.VITE_TRUCK_SLUG || 'streetfoodfusion'

type Truck    = { id: string; name: string; color: string; tax_rate: number }
type Category = { id: string; name: string; emoji: string; sort_order: number }
type Item     = { id: string; name: string; emoji: string; description: string; price: number; category_id: string; is_active: boolean; image_url?: string }
type CartLine = { item: Item; qty: number }

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #fafaf5; color: #1c1917; font-family: 'Plus Jakarta Sans', sans-serif; min-height: 100vh; }

  .t { background: #ffffff; border-bottom: 1px solid #f0ede6; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
  .t-logo { display: flex; align-items: center; gap: 9px; }
  .t-s { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 15px; color: white; font-weight: 800; flex-shrink: 0; }
  .t-name { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.05em; color: #1c1917; line-height: 1; }
  .t-sub { font-size: 10px; color: #a8a29e; font-weight: 500; margin-top: 1px; }
  .t-open { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 5px 10px; border-radius: 20px; }
  .t-dot { width: 6px; height: 6px; border-radius: 50%; background: #16a34a; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .hero { background: #ffffff; padding: 20px 16px 16px; border-bottom: 1px solid #f0ede6; }
  .hero-title { font-family: 'Bebas Neue', sans-serif; font-size: 34px; letter-spacing: 0.03em; color: #1c1917; line-height: 0.95; margin-bottom: 8px; }
  .hero-sub { font-size: 13px; color: #78716c; line-height: 1.5; }
  .hero-tag { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; font-size: 12px; font-weight: 600; color: #0d9488; background: #f0fdfa; border: 1px solid #99f6e4; padding: 5px 10px; border-radius: 20px; }

  .cats { display: flex; gap: 7px; padding: 12px 16px; overflow-x: auto; scrollbar-width: none; background: #fafaf5; border-bottom: 1px solid #f0ede6; position: sticky; top: 57px; z-index: 40; }
  .cats::-webkit-scrollbar { display: none; }
  .cat { padding: 7px 14px; border-radius: 20px; border: 1.5px solid #e7e5e0; background: #ffffff; color: #78716c; font-size: 12px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; white-space: nowrap; transition: all 0.12s; flex-shrink: 0; }
  .cat:hover { border-color: #0d9488; color: #0d9488; }
  .cat.on { background: #0d9488; border-color: #0d9488; color: white; }

  .sec { padding: 18px 16px 6px; }
  .sec-title { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 0.05em; color: #44403c; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .items { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }

  .item { background: #ffffff; border-radius: 16px; overflow: hidden; display: flex; border: 1px solid #f0ede6; transition: border-color 0.15s, box-shadow 0.15s; }
  .item:hover { border-color: #d6d3cd; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .item.sold { opacity: 0.5; }
  .item-img { width: 88px; height: 88px; object-fit: cover; flex-shrink: 0; }
  .item-emoji { width: 88px; height: 88px; background: #fef9ef; display: flex; align-items: center; justify-content: center; font-size: 38px; flex-shrink: 0; }
  .item-body { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
  .item-name { font-size: 14px; font-weight: 700; color: #1c1917; margin-bottom: 3px; line-height: 1.3; }
  .item-desc { font-size: 11px; color: #a8a29e; line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .item-foot { display: flex; align-items: center; justify-content: space-between; }
  .item-price { font-size: 16px; font-weight: 800; color: #d97706; font-family: 'Space Grotesk', monospace; }
  .item-sold-tag { font-size: 10px; font-weight: 700; color: #ef4444; background: #fef2f2; padding: 3px 8px; border-radius: 6px; border: 1px solid #fecaca; }

  .add { width: 30px; height: 30px; border-radius: 9px; border: none; color: white; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.12s; font-weight: 300; line-height: 1; }
  .add:hover { filter: brightness(1.08); transform: scale(1.05); }
  .add:active { transform: scale(0.95); }
  .qty { display: flex; align-items: center; gap: 8px; }
  .qbtn { width: 28px; height: 28px; border-radius: 8px; border: 1.5px solid #e7e5e0; background: #fafaf5; color: #1c1917; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.1s; }
  .qbtn:hover { border-color: #0d9488; color: #0d9488; }
  .qnum { font-size: 14px; font-weight: 700; font-family: 'Space Grotesk', monospace; min-width: 18px; text-align: center; color: #1c1917; }

  .cart-bar { position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px 24px; background: linear-gradient(transparent, #fafaf5 35%); pointer-events: none; z-index: 100; }
  .cart-btn { width: 100%; padding: 15px 20px; border: none; border-radius: 16px; color: white; font-size: 15px; font-weight: 800; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; justify-content: space-between; transition: all 0.15s; pointer-events: all; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
  .cart-btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .cart-left { display: flex; align-items: center; gap: 10px; }
  .cart-badge { background: rgba(255,255,255,0.25); border-radius: 8px; padding: 3px 9px; font-size: 12px; font-weight: 800; }

  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; flex-direction: column; justify-content: flex-end; animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .sheet { background: #ffffff; border-radius: 24px 24px 0 0; max-height: 88vh; overflow-y: auto; animation: slideUp 0.25s ease; scrollbar-width: none; }
  .sheet::-webkit-scrollbar { display: none; }
  @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:none;opacity:1} }
  .sheet-handle { width: 36px; height: 4px; background: #e7e5e0; border-radius: 2px; margin: 14px auto 18px; }
  .sheet-title { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 0.04em; padding: 0 20px 14px; border-bottom: 1px solid #f0ede6; color: #1c1917; }
  .sheet-lines { padding: 10px 20px; }
  .sheet-line { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f5f4f1; }
  .sheet-line:last-child { border-bottom: none; }
  .sheet-emoji { font-size: 22px; flex-shrink: 0; }
  .sheet-name { flex: 1; font-size: 14px; font-weight: 600; color: #1c1917; }
  .sheet-price { font-size: 14px; font-weight: 700; font-family: 'Space Grotesk', monospace; color: #d97706; }
  .sheet-foot { padding: 14px 20px 32px; }
  .sheet-totals { background: #fafaf5; border-radius: 12px; padding: 14px; margin-bottom: 14px; border: 1px solid #f0ede6; }
  .sheet-row { display: flex; justify-content: space-between; font-size: 13px; color: #78716c; font-family: 'Space Grotesk', monospace; margin-bottom: 5px; }
  .sheet-row:last-child { margin-bottom: 0; }
  .sheet-total-row { display: flex; justify-content: space-between; align-items: baseline; padding-top: 10px; border-top: 1px solid #e7e5e0; margin-top: 10px; }
  .sheet-total-label { font-size: 15px; font-weight: 800; color: #1c1917; }
  .sheet-total-amt { font-size: 22px; font-weight: 800; font-family: 'Space Grotesk', monospace; color: #d97706; }
  .sheet-checkout { width: 100%; padding: 15px; border: none; border-radius: 14px; color: white; font-size: 15px; font-weight: 800; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.15s; }
  .sheet-checkout:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .sheet-clear { width: 100%; padding: 10px; background: transparent; border: 1.5px solid #e7e5e0; border-radius: 12px; color: #78716c; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; margin-top: 8px; transition: all 0.15s; }
  .sheet-clear:hover { border-color: #ef4444; color: #ef4444; }

  .co { min-height: 100vh; background: #fafaf5; padding-bottom: 40px; }
  .co-top { background: #ffffff; border-bottom: 1px solid #f0ede6; padding: 14px 16px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 50; }
  .co-back { width: 36px; height: 36px; border-radius: 10px; background: #fafaf5; border: 1.5px solid #e7e5e0; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; color: #44403c; transition: all 0.15s; flex-shrink: 0; }
  .co-back:hover { border-color: #0d9488; color: #0d9488; }
  .co-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.04em; color: #1c1917; }
  .co-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  .card { background: #ffffff; border: 1px solid #f0ede6; border-radius: 16px; overflow: hidden; }
  .card-hd { padding: 13px 16px; border-bottom: 1px solid #f5f4f1; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #a8a29e; }
  .card-body { padding: 14px 16px; }

  .slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .slot { padding: 10px 6px; background: #fafaf5; border: 1.5px solid #e7e5e0; border-radius: 10px; font-size: 13px; font-weight: 700; color: #78716c; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; text-align: center; transition: all 0.12s; }
  .slot:hover { border-color: #0d9488; color: #0d9488; }
  .slot.on { border-color: #0d9488; color: #ffffff; background: #0d9488; }
  .slot.full { opacity: 0.4; cursor: not-allowed; }
  .slot-sub { font-size: 9px; opacity: 0.7; margin-top: 2px; }

  .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
  .field:last-child { margin-bottom: 0; }
  .flabel { font-size: 11px; font-weight: 700; color: #78716c; text-transform: uppercase; letter-spacing: 0.06em; }
  .finput { padding: 13px 14px; background: #fafaf5; border: 1.5px solid #e7e5e0; border-radius: 10px; font-size: 15px; font-weight: 500; color: #1c1917; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; width: 100%; transition: border-color 0.15s; }
  .finput::placeholder { color: #c4bfb9; }
  .finput:focus { border-color: #0d9488; background: #f0fdfa; }

  .auth-tabs { display: flex; background: #fafaf5; border-radius: 10px; padding: 3px; margin-bottom: 14px; border: 1px solid #f0ede6; }
  .auth-tab { flex: 1; padding: 8px; border: none; background: transparent; color: #78716c; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; border-radius: 7px; transition: all 0.15s; }
  .auth-tab.on { background: #ffffff; color: #1c1917; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }

  .sum-line { display: flex; justify-content: space-between; font-size: 13px; padding: 7px 0; border-bottom: 1px solid #f5f4f1; }
  .sum-line:last-child { border-bottom: none; }
  .sum-name { color: #78716c; }
  .sum-price { font-family: 'Space Grotesk', monospace; font-weight: 600; color: #d97706; }

  .place-btn { width: 100%; padding: 15px; border: none; border-radius: 14px; color: white; font-size: 15px; font-weight: 800; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.15s; }
  .place-btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .place-btn:disabled { background: #d4d0cb !important; color: #a8a29e; cursor: not-allowed; transform: none; filter: none; }
  .pay-note { background: #fafaf5; border-radius: 10px; padding: 12px; font-size: 12px; color: #78716c; line-height: 1.6; border: 1px solid #f0ede6; margin-bottom: 14px; }
  .err-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; font-size: 13px; color: #b91c1c; margin-bottom: 12px; }

  .confirm { min-height: 100vh; background: #fafaf5; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; text-align: center; }
  .confirm-icon { width: 80px; height: 80px; border-radius: 50%; background: #f0fdfa; border: 2px solid #0d9488; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 24px; animation: pop 0.4s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes pop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
  .confirm-title { font-family: 'Bebas Neue', sans-serif; font-size: 34px; letter-spacing: 0.04em; color: #1c1917; margin-bottom: 8px; }
  .confirm-sub { font-size: 14px; color: #78716c; line-height: 1.6; margin-bottom: 24px; max-width: 280px; }
  .confirm-card { background: #ffffff; border: 1px solid #f0ede6; border-radius: 16px; padding: 20px; width: 100%; max-width: 320px; margin-bottom: 20px; }
  .confirm-ref { font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 0.06em; margin-bottom: 6px; }
  .confirm-time { font-size: 14px; color: #78716c; margin-bottom: 12px; font-family: 'Plus Jakarta Sans', sans-serif; }
  .confirm-items { border-top: 1px solid #f0ede6; padding-top: 12px; }
  .confirm-item { font-size: 13px; color: #78716c; padding: 3px 0; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
  .confirm-total { border-top: 1px solid #f0ede6; margin-top: 12px; padding-top: 12px; font-size: 16px; font-weight: 800; font-family: 'Space Grotesk', monospace; color: #d97706; text-align: right; }
  .confirm-email { font-size: 13px; color: #78716c; margin-bottom: 24px; max-width: 280px; line-height: 1.6; font-family: 'Plus Jakarta Sans', sans-serif; }
  .new-order-btn { padding: 14px 32px; border: none; border-radius: 14px; color: white; font-size: 15px; font-weight: 800; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.15s; }
  .new-order-btn:hover { filter: brightness(1.06); }

  .loading { min-height: 100vh; background: #fafaf5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
  .loading-s { width: 52px; height: 52px; border-radius: 14px; background: #0d9488; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 26px; color: white; animation: breathe 1.5s ease-in-out infinite; }
  @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
  .loading-text { font-size: 13px; font-weight: 700; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Plus Jakarta Sans', sans-serif; }
  .powered { font-size: 11px; color: #c4bfb9; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; text-align: center; padding: 20px 0 12px; font-family: 'Plus Jakarta Sans', sans-serif; }
  .powered span { color: #0d9488; }
`

export default function App() {
  const [screen, setScreen]       = useState<'menu'|'checkout'|'confirm'>('menu')
  const [truck, setTruck]         = useState<Truck | null>(null)
  const [cats, setCats]           = useState<Category[]>([])
  const [items, setItems]         = useState<Item[]>([])
  const [cart, setCart]           = useState<CartLine[]>([])
  const [activeCat, setActiveCat] = useState('all')
  const [showCart, setShowCart]   = useState(false)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    const { data: t } = await db.from('trucks').select('*').like('slug', `${TRUCK_SLUG}%`).limit(1).single()
    if (!t) { setError('not found'); setLoading(false); return }
    setTruck(t)
    const { data: c } = await db.from('menu_categories').select('*').eq('truck_id', t.id).order('sort_order')
    setCats(c || [])
    const { data: i } = await db.from('menu_items').select('*').eq('truck_id', t.id).order('sort_order')
    setItems(i || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const add = (item: Item) => {
    if (!item.is_active) return
    setCart(prev => { const ex = prev.find(l => l.item.id === item.id); if (ex) return prev.map(l => l.item.id === item.id ? { ...l, qty: l.qty+1 } : l); return [...prev, { item, qty: 1 }] })
  }
  const chg = (id: string, d: number) => setCart(prev => prev.map(l => l.item.id===id ? { ...l, qty: l.qty+d } : l).filter(l => l.qty > 0))

  const totalQty = cart.reduce((s,l) => s+l.qty, 0)
  const sub      = cart.reduce((s,l) => s+l.item.price*l.qty, 0)
  const tax      = sub*(truck?.tax_rate||0.19)
  const total    = sub+tax
  const color    = truck?.color||'#0d9488'
  const filtered = activeCat==='all' ? items : items.filter(i => i.category_id===activeCat)
  const qtyFor   = (id: string) => cart.find(l => l.item.id===id)?.qty||0

  if (loading) return <><style>{css}</style><div className="loading"><div className="loading-s">S</div><div className="loading-text">Loading menu…</div></div></>
  if (error)   return <><style>{css}</style><div className="loading"><div style={{fontSize:48,marginBottom:16}}>🚚</div><div style={{fontWeight:700,color:'#44403c',fontFamily:'Plus Jakarta Sans,sans-serif'}}>Truck not found</div></div></>
  if (screen==='confirm') return <><style>{css}</style><ConfirmScreen color={color} onNew={() => { setCart([]); setScreen('menu') }} /></>
  if (screen==='checkout') return <><style>{css}</style><CheckoutScreen truck={truck!} cart={cart} sub={sub} tax={tax} total={total} color={color} onBack={() => setScreen('menu')} onConfirm={() => setScreen('confirm')} /></>

  return (
    <>
      <style>{css}</style>

      <div className="t">
        <div className="t-logo">
          <div className="t-s" style={{ background: color }}>{truck?.name?.[0]||'S'}</div>
          <div><div className="t-name">{truck?.name}</div><div className="t-sub">Powered by Setzio</div></div>
        </div>
        <div className="t-open"><div className="t-dot"/>Open</div>
      </div>

      <div className="hero">
        <div className="hero-title">What are you<br/>having today? 🌯</div>
        <div className="hero-sub">Fresh made to order — skip the queue, order ahead.</div>
        <div className="hero-tag">📍 Pick up at the truck · No waiting</div>
      </div>

      <div className="cats">
        <button className={`cat ${activeCat==='all'?'on':''}`} style={activeCat==='all'?{background:color,borderColor:color}:{}} onClick={() => setActiveCat('all')}>All</button>
        {cats.map(c => <button key={c.id} className={`cat ${activeCat===c.id?'on':''}`} style={activeCat===c.id?{background:color,borderColor:color}:{}} onClick={() => setActiveCat(c.id)}>{c.emoji} {c.name}</button>)}
      </div>

      <div style={{ paddingBottom: totalQty>0 ? 96 : 32 }}>
        {cats.filter(c => activeCat==='all'||c.id===activeCat).map(cat => {
          const catItems = filtered.filter(i => i.category_id===cat.id)
          if (!catItems.length) return null
          return (
            <div key={cat.id} className="sec">
              <div className="sec-title">{cat.emoji} {cat.name}</div>
              <div className="items">
                {catItems.map(item => {
                  const q = qtyFor(item.id)
                  return (
                    <div key={item.id} className={`item ${!item.is_active?'sold':''}`}>
                      {item.image_url ? <img className="item-img" src={item.image_url} alt={item.name}/> : <div className="item-emoji">{item.emoji}</div>}
                      <div className="item-body">
                        <div>
                          <div className="item-name">{item.name}</div>
                          {item.description && <div className="item-desc">{item.description}</div>}
                        </div>
                        <div className="item-foot">
                          <div className="item-price">€{item.price.toFixed(2)}</div>
                          {!item.is_active ? <span className="item-sold-tag">86'd</span>
                            : q===0 ? <button className="add" style={{background:color}} onClick={() => add(item)}>+</button>
                            : <div className="qty"><button className="qbtn" onClick={() => chg(item.id,-1)}>−</button><span className="qnum">{q}</span><button className="qbtn" style={{borderColor:color,color}} onClick={() => add(item)}>+</button></div>
                          }
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        <div className="powered">Powered by <span>Setzio</span></div>
      </div>

      {showCart && (
        <div className="overlay" onClick={() => setShowCart(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle"/>
            <div className="sheet-title">Your Order</div>
            <div className="sheet-lines">
              {cart.map(l => (
                <div key={l.item.id} className="sheet-line">
                  <span className="sheet-emoji">{l.item.emoji}</span>
                  <span className="sheet-name">{l.item.name}</span>
                  <div className="qty"><button className="qbtn" onClick={() => chg(l.item.id,-1)}>−</button><span className="qnum">{l.qty}</span><button className="qbtn" onClick={() => chg(l.item.id,1)}>+</button></div>
                  <span className="sheet-price">€{(l.item.price*l.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="sheet-foot">
              <div className="sheet-totals">
                <div className="sheet-row"><span>Subtotal</span><span>€{sub.toFixed(2)}</span></div>
                <div className="sheet-row"><span>MwSt. 19%</span><span>€{tax.toFixed(2)}</span></div>
                <div className="sheet-total-row"><span className="sheet-total-label">Total</span><span className="sheet-total-amt">€{total.toFixed(2)}</span></div>
              </div>
              <button className="sheet-checkout" style={{background:color}} onClick={() => { setShowCart(false); setScreen('checkout') }}>Checkout · €{total.toFixed(2)} →</button>
              <button className="sheet-clear" onClick={() => { setCart([]); setShowCart(false) }}>Clear order</button>
            </div>
          </div>
        </div>
      )}

      {totalQty > 0 && (
        <div className="cart-bar">
          <button className="cart-btn" style={{background:color}} onClick={() => setShowCart(true)}>
            <div className="cart-left"><span className="cart-badge">{totalQty}</span><span>View Order</span></div>
            <span style={{fontFamily:"'Space Grotesk',monospace",fontWeight:800}}>€{total.toFixed(2)}</span>
          </button>
        </div>
      )}
    </>
  )
}

function CheckoutScreen({ truck, cart, sub, tax, total, color, onBack, onConfirm }: {
  truck: Truck; cart: CartLine[]; sub: number; tax: number; total: number
  color: string; onBack: () => void; onConfirm: () => void
}) {
  const [authMode, setAuthMode] = useState<'guest'|'login'|'register'>('guest')
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [slot, setSlot]   = useState('')
  const [slots, setSlots] = useState<{time:string;label:string;avail:number}[]>([])
  const [placing, setPlacing] = useState(false)
  const [err, setErr]         = useState('')

  useEffect(() => {
    const out = []
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes()/15)*15,0,0)
    for (let i=0;i<8;i++) {
      const t = new Date(now.getTime()+i*15*60000)
      out.push({ time:t.toISOString(), label:t.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}), avail:3 })
    }
    setSlots(out)
  }, [])

  const place = async () => {
    if (!name.trim()||!email.trim()||!slot) return
    setPlacing(true); setErr('')
    try {
      const { data: order, error: oErr } = await db.from('customer_orders').insert({
        truck_id: truck.id, guest_name: name.trim(), guest_email: email.trim().toLowerCase(),
        pickup_time: slot, status: 'confirmed', total: parseFloat(total.toFixed(2)),
      }).select().single()
      if (oErr||!order) throw new Error(oErr?.message||'Failed to place order')
      await db.from('customer_order_items').insert(cart.map(l => ({
        customer_order_id: order.id, menu_item_id: l.item.id, name: l.item.name,
        emoji: l.item.emoji, quantity: l.qty, unit_price: l.item.price,
        line_total: parseFloat((l.item.price*l.qty).toFixed(2)),
      })))
      localStorage.setItem('sff_order', JSON.stringify({
        id: order.id, name: name.trim(), email: email.trim(),
        pickup_time: slot, total: total.toFixed(2),
        items: cart.map(l => ({ name: l.item.name, qty: l.qty })),
      }))
      onConfirm()
    } catch(e:any) { setErr(e.message||'Something went wrong. Please try again.') }
    setPlacing(false)
  }

  return (
    <div className="co">
      <div className="co-top">
        <button className="co-back" onClick={onBack}>←</button>
        <div className="co-title">Checkout</div>
      </div>
      <div className="co-body">
        <div className="card">
          <div className="card-hd">Your Order</div>
          <div className="card-body">
            {cart.map(l => <div key={l.item.id} className="sum-line"><span className="sum-name">{l.qty}× {l.item.name}</span><span className="sum-price">€{(l.item.price*l.qty).toFixed(2)}</span></div>)}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',borderTop:'1.5px solid #f0ede6',marginTop:10,paddingTop:10}}>
              <span style={{fontWeight:800,fontSize:15,color:'#1c1917'}}>Total</span>
              <span style={{fontFamily:"'Space Grotesk',monospace",fontWeight:800,fontSize:20,color:'#d97706'}}>€{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">Pick-up Time</div>
          <div className="card-body">
            <div className="slots">
              {slots.map(s => <button key={s.time} className={`slot ${slot===s.time?'on':''} ${s.avail===0?'full':''}`} style={slot===s.time?{background:color,borderColor:color}:{}} onClick={() => s.avail>0&&setSlot(s.time)} disabled={s.avail===0}>{s.label}<div className="slot-sub">{s.avail>0?`${s.avail} left`:'Full'}</div></button>)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">Your Details</div>
          <div className="card-body">
            <div className="auth-tabs">
              {(['guest','login','register'] as const).map(m => <button key={m} className={`auth-tab ${authMode===m?'on':''}`} onClick={() => setAuthMode(m)}>{m==='guest'?'Guest':m==='login'?'Sign In':'Register'}</button>)}
            </div>
            <div className="field"><label className="flabel">Your Name *</label><input className="finput" placeholder="Maria González" value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="field"><label className="flabel">Email *</label><input className="finput" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
            {authMode!=='guest' && <div className="field"><label className="flabel">Password</label><input className="finput" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} /></div>}
            {authMode==='guest' && <div style={{fontSize:12,color:'#a8a29e',marginTop:6,lineHeight:1.6}}>We'll send your order confirmation to this email.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-hd">Payment</div>
          <div className="card-body">
            <div className="pay-note">💳 Pay at the truck when you collect. Your order is held until your pick-up time — no payment needed now.</div>
            {err && <div className="err-box">{err}</div>}
            <button className="place-btn" style={{background:color}} onClick={place} disabled={!name.trim()||!email.trim()||!slot||placing}>
              {placing?'Placing order…':`Place Order · €${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfirmScreen({ color, onNew }: { color: string; onNew: () => void }) {
  const raw   = localStorage.getItem('sff_order')
  const order = raw ? JSON.parse(raw) : null
  const time  = order?.pickup_time ? new Date(order.pickup_time).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}) : '—'
  return (
    <div className="confirm">
      <div className="confirm-icon">✓</div>
      <div className="confirm-title">Order Confirmed!</div>
      <div className="confirm-sub">We've got your order. Head to the truck at your pick-up time — we'll have it ready and waiting.</div>
      {order && (
        <div className="confirm-card">
          <div className="confirm-ref" style={{color}}>#{order.id.slice(0,6).toUpperCase()}</div>
          <div className="confirm-time">Pick up at <strong>{time}</strong></div>
          <div className="confirm-items">{order.items?.map((it:any,i:number) => <div key={i} className="confirm-item">{it.qty}× {it.name}</div>)}</div>
          <div className="confirm-total">€{order.total}</div>
        </div>
      )}
      <div className="confirm-email">Confirmation sent to <strong style={{color:'#1c1917'}}>{order?.email}</strong></div>
      <button className="new-order-btn" style={{background:color}} onClick={onNew}>Start a New Order</button>
      <div className="powered" style={{marginTop:20}}>Powered by <span>Setzio</span></div>
    </div>
  )
}

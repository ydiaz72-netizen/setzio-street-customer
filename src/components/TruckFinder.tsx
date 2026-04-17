import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
const db = supabase as any

type Truck = {
  id: string
  name: string
  slug: string
  color: string
  city: string | null
  country: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  is_active: boolean
}

type UserLocation = {
  city: string
  country: string
  latitude: number
  longitude: number
}

export default function TruckFinder() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [gpsPermission, setGpsPermission] = useState<'pending' | 'granted' | 'denied'>('pending')

  // Step 1: Get user location via IP
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        setUserLocation({
          city: data.city || 'Unknown',
          country: data.country_name || 'Unknown',
          latitude: data.latitude || 0,
          longitude: data.longitude || 0
        })
      })
      .catch(() => {
        setUserLocation({
          city: 'Unknown',
          country: 'Unknown',
          latitude: 0,
          longitude: 0
        })
      })
  }, [])

  // Step 2: Load all active trucks
  useEffect(() => {
    const loadTrucks = async () => {
      const { data } = await db
        .from('trucks')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
      setTrucks(data || [])
      setLoading(false)
    }
    loadTrucks()
  }, [])

  // Step 3: Ask for GPS permission (optional upgrade)
  const requestGPS = () => {
    if (!navigator.geolocation) {
      setGpsPermission('denied')
      return
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        setUserLocation(prev => ({
          ...prev!,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }))
        setGpsPermission('granted')
      },
      () => setGpsPermission('denied')
    )
  }

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Sort trucks by relevance
  const sortedTrucks = [...trucks].sort((a, b) => {
    if (!userLocation) return 0

    // If GPS granted, sort by distance
    if (gpsPermission === 'granted' && a.latitude && a.longitude && b.latitude && b.longitude) {
      const distA = calculateDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude)
      const distB = calculateDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
      return distA - distB
    }

    // Otherwise, prioritize same city
    const cityMatchA = a.city?.toLowerCase() === userLocation.city.toLowerCase()
    const cityMatchB = b.city?.toLowerCase() === userLocation.city.toLowerCase()
    
    if (cityMatchA && !cityMatchB) return -1
    if (!cityMatchA && cityMatchB) return 1
    return 0
  })

  const getDistance = (truck: Truck): string | null => {
    if (!userLocation || !truck.latitude || !truck.longitude) return null
    if (gpsPermission !== 'granted') return null

    const dist = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      truck.latitude,
      truck.longitude
    )

    return dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-s">S</div>
        <div className="loading-text">Finding trucks...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf5', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #f0ede6',
        padding: '20px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 28,
          letterSpacing: '0.04em',
          color: '#1c1917',
          marginBottom: 6
        }}>
          Find Your Truck 🚚
        </div>
        {userLocation && (
          <div style={{ fontSize: 13, color: '#78716c' }}>
            📍 {userLocation.city}, {userLocation.country}
          </div>
        )}
      </div>

      {/* GPS Upgrade Banner */}
      {gpsPermission === 'pending' && (
        <div style={{
          margin: '16px 16px 0',
          background: '#f0fdfa',
          border: '1px solid #99f6e4',
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0d9488', marginBottom: 3 }}>
              📍 Share your location?
            </div>
            <div style={{ fontSize: 11, color: '#78716c', lineHeight: 1.5 }}>
              Get exact distances to trucks near you
            </div>
          </div>
          <button
            onClick={requestGPS}
            style={{
              background: '#0d9488',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            Allow
          </button>
        </div>
      )}

      {/* Truck List */}
      <div style={{ padding: '16px' }}>
        {sortedTrucks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 40,
            color: '#a8a29e',
            fontSize: 14
          }}>
            No trucks available right now
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedTrucks.map(truck => {
              const distance = getDistance(truck)
              return (
                <a
                  key={truck.id}
                  href={`/${truck.slug}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #f0ede6',
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#d6d3cd'
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#f0ede6'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Truck Icon */}
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: truck.color || '#0d9488',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    color: 'white',
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    {truck.name[0]}
                  </div>

                  {/* Truck Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: '#1c1917',
                      marginBottom: 4
                    }}>
                      {truck.name}
                    </div>
                    
                    {distance && (
                      <div style={{
                        fontSize: 12,
                        color: '#0d9488',
                        fontWeight: 600,
                        marginBottom: 3
                      }}>
                        📍 {distance} away
                      </div>
                    )}

                    {truck.address && (
                      <div style={{
                        fontSize: 11,
                        color: '#a8a29e',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {truck.address}
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div style={{
                    fontSize: 20,
                    color: '#d6d3cd',
                    flexShrink: 0
                  }}>
                    →
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>

      <div className="powered" style={{ marginTop: 20 }}>
        Powered by <span style={{ color: '#0d9488' }}>Setzio</span>
      </div>
    </div>
  )
}

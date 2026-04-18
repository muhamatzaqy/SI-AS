'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Profile } from '@/types'

export function useUser() {
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
        setUser(profile)
      }
      setLoading(false)
    }
    fetchUser()
  }, []) // eslint-disable-line
  return { user, loading }
}

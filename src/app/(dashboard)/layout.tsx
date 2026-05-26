import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight">InkDeck</span>
        <span className="text-sm text-muted-foreground">{user.email}</span>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { setupAdminApp } from '../../lib/push'
import { Btn, Card, ErrorText, Field, Shell, inputCls } from '../../components/ui'
import { Logo } from '../../components/Decor'
import Phrases from '../../components/Phrases'

export default function Login() {
  useEffect(() => { setupAdminApp() }, [])
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)

  // already signed in on this device? go straight in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav('/admin', { replace: true }) })
  }, [nav])

  async function submit(e) {
    e.preventDefault()
    if (!email.trim() || !password) { setTried(true); return }
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setErr('Wrong email or password.')
    nav('/admin', { replace: true })
  }
  return (
    <Shell hideHeader>
      <div className="pop-in relative flex justify-center pt-14">
        <div className="logo-glow pointer-events-none absolute -top-10 size-[22rem] rounded-full" />
        <span className="relative"><Logo size="md" /></span>
      </div>
      <h1 className="sr-only">Nailtech login</h1>
      <Phrases className="mb-6 mt-4" />
      <Card>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-center text-xs text-cream/60">You stay signed in on this device until you tap Sign out.</p>
        <Field label="Email" error={tried && !email.trim() ? 'Please enter your email.' : ''}><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
        <Field label="Password" error={tried && !password ? 'Please enter your password.' : ''}><input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <ErrorText>{err}</ErrorText>
        <Btn type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Btn>
      </form>
      </Card>
    </Shell>
  )
}

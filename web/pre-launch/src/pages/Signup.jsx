import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './Auth.module.css'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'client',
  })
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) {
      setErrMsg('Password must be at least 8 characters.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setErrMsg('')

    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role: form.role,
        },
      },
    })

    if (error) {
      setErrMsg(error.message)
      setStatus('error')
    } else {
      setStatus('success')
      setTimeout(() => navigate('/dashboard'), 1500)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>SwingBy</Link>
        <Link to="/login" className={styles.navLink}>Already have an account? Log in</Link>
      </nav>

      <div className={styles.container}>
        <div className={styles.card}>
          {status === 'success' ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>✓</div>
              <h3>Account created!</h3>
              <p>Check your email to confirm your account, then you'll be redirected.</p>
            </div>
          ) : (
            <>
              <div className={styles.cardHeader}>
                <h1>Create your account</h1>
                <p>Join SwingBy and be first when we launch.</p>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>First name</label>
                    <input
                      type="text"
                      name="first_name"
                      value={form.first_name}
                      onChange={handleChange}
                      placeholder="First"
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Last name</label>
                    <input
                      type="text"
                      name="last_name"
                      value={form.last_name}
                      onChange={handleChange}
                      placeholder="Last"
                      required
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label>Password</label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min. 8 characters"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label>I am a...</label>
                  <select name="role" value={form.role} onChange={handleChange}>
                    <option value="client">Client — looking for services</option>
                    <option value="business_owner">Business — offering services</option>
                  </select>
                </div>

                {status === 'error' && (
                  <div className={styles.errorMsg}>{errMsg}</div>
                )}

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Creating account...' : 'Create account →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

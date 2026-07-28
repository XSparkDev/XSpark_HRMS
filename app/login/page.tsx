"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { XSparkLogo } from "@/components/xspark-logo"
import { Mail, Lock, Eye, EyeOff, User, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Demo login accounts for testing
// These accounts should exist in your Supabase Auth system
const DEMO_ACCOUNTS = [
  {
    id: "employee",
    label: "Employee",
    email: "hehop16671@keevle.com",
    password: "SecurePass123!",
    role: "employee",
    icon: User,
    color: "text-blue-600",
  },
  {
    id: "supervisor",
    label: "Supervisor",
    email: "wegecev800@gyknife.com",
    password: "SecurePass123!",
    role: "supervisor",
    icon: Shield,
    color: "text-indigo-600",
  },
  {
    id: "super_admin",
    label: "Super Admin",
    email: "hobixe4894@juhxs.com",
    password: "SecurePass123!",
    role: "super_admin",
    icon: Shield,
    color: "text-red-600",
  },
  {
    id: "admin",
    label: "Admin",
    email: "seveta4223@delaeb.com",
    password: "SecurePass123!",
    role: "admin",
    icon: Shield,
    color: "text-purple-600",
  },
]

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedQuickLogin, setSelectedQuickLogin] = useState<string>("")

  useEffect(() => {
    // Ensure logout/login doesn't land on a scrolled position
    window.scrollTo(0, 0)
  }, [])

  const handleQuickLogin = async (accountId: string) => {
    const account = DEMO_ACCOUNTS.find((acc) => acc.id === accountId)
    if (!account) return

    // Prevent multiple simultaneous logins
    if (loading) return

    setEmail(account.email)
    setPassword(account.password)
    setSelectedQuickLogin(accountId)
    setError("")
    setLoading(true)

    try {
      await performLogin(account.email, account.password)
    } catch (err) {
      // Error handled in performLogin
      setLoading(false)
    }
  }

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      })

      const json = await res.json()

      if (!res.ok || !json?.success) {
        const message = json?.error || 'Login failed. Please check your credentials.'
        setError(message)
        toast({
          variant: 'destructive',
          title: 'Login failed',
          description: message,
        })
        return
      }

      // Store session data
      const session = json?.data?.session
      const user = json?.data?.user
      const employee = json?.data?.employee

      if (session) {
        try {
          localStorage.setItem('xspark_session', JSON.stringify(session))
        } catch {}
      }
      if (user) {
        try {
          localStorage.setItem('xspark_user', JSON.stringify(user))
        } catch {}
      }
      if (employee) {
        try {
          localStorage.setItem('xspark_employee', JSON.stringify(employee))
        } catch {}
      }

      // Show success message
      const account = DEMO_ACCOUNTS.find(acc => acc.email === loginEmail)
      toast({
        title: 'Login successful',
        description: account 
          ? `Welcome, ${account.label}! Redirecting to system selector...` 
          : 'Redirecting to system selector...',
      })

      // Small delay to show success message, then redirect to system selector
      setTimeout(() => {
        router.push('/system-selector')
      }, 500)
    } catch (err) {
      const errorMessage = 'Unable to reach server. Please check your connection and try again.'
      setError(errorMessage)
      toast({
        variant: 'destructive',
        title: 'Connection error',
        description: errorMessage,
      })
      throw err
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await performLogin(email, password)
    } catch (err) {
      // Error already handled in performLogin
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-white to-[#F0F4F8] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl space-y-8 animate-fade-in-up">
        {/* Logo and Header */}
        <div className="text-center">
          <XSparkLogo className="h-16 w-auto mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-[#25294B]">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">Sign in to access your HR & Asset Management dashboard</p>
        </div>

        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Login Form */}
          <Card className="shadow-xl border border-gray-200">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Login</CardTitle>
              <CardDescription>Enter your credentials to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                      disabled={loading}
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Remember me
                    </label>
                  </div>
                  <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90" 
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Demo Accounts - Simplified */}
          <Card className="shadow-xl border border-gray-200">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-lg">Quick Login</CardTitle>
              <CardDescription className="text-xs">Click to login with demo accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {DEMO_ACCOUNTS.map((account) => {
                const IconComponent = account.icon
                const isLoggingIn = loading && selectedQuickLogin === account.id
                return (
                  <Button
                    key={account.id}
                    type="button"
                    variant="outline"
                    className={`w-full justify-start h-auto py-2.5 transition-all hover:shadow-md hover:border-primary/40 ${
                      isLoggingIn ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleQuickLogin(account.id)}
                    disabled={loading}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {isLoggingIn ? (
                        <div className="h-4 w-4 shrink-0 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <IconComponent className={`h-4 w-4 ${account.color} shrink-0`} />
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm">{account.label}</div>
                        <div className="text-xs text-muted-foreground">{account.email}</div>
                      </div>
                    </div>
                  </Button>
                )
              })}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Password: <span className="font-mono">SecurePass123!</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Security Notice */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p className="flex items-center justify-center gap-2">
            <Lock className="h-4 w-4 text-[#25294B]" />
            <span>Secured with bank-level encryption</span>
          </p>
          <p>POPIA Compliant • ISO 27001 Certified</p>
        </div>
      </div>
    </div>
  )
}

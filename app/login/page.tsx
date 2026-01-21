"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { XSparkLogo } from "@/components/xspark-logo"
import { getDefaultRouteForRole } from "@/lib/auth"
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from "lucide-react"

// Demo users removed – real authentication is now used

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError("")
    setLoading(true)

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
        const message = json?.error || 'Login failed'
        setError(message)
        setLoading(false)
        return
      }

      // Optionally persist session/token if returned
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

      const defaultRoute =
        json?.data?.defaultRoute || getDefaultRouteForRole(user?.role)
      router.push(defaultRoute)
    } catch (err) {
      setError('Unable to reach server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    await performLogin(email, password)
  }

  // Quick login removed – real authentication only

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in-up">
        {/* Back to Home */}
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        {/* Logo */}
        <div className="text-center">
          <XSparkLogo className="h-16 w-auto mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-navy">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">Sign in to access your HR dashboard</p>
        </div>

        {/* Login Form */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Login</CardTitle>
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
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Remember me
                  </label>
                </div>
                <Link href="#" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>

              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}

              <Button type="submit" className="w-full gradient-primary text-white" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Login for Testing */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">Quick Login (Testing)</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setEmail("hehop16671@keevle.com")
                setPassword("SecurePass123!")
                performLogin("hehop16671@keevle.com", "SecurePass123!")
              }}
              disabled={loading}
            >
              Employee
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setEmail("seveta4223@delaeb.com")
                setPassword("SecurePass123!")
                performLogin("seveta4223@delaeb.com", "SecurePass123!")
              }}
              disabled={loading}
            >
              Admin
            </Button>
          </div>
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

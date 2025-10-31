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
import { ArrowLeft } from "lucide-react"

// Mock users for demonstration
const mockUsers = [
  { email: "employee@xspark.com", password: "demo123", role: "employee", name: "John Doe" },
  { email: "juniorhr@xspark.com", password: "demo123", role: "junior_hr", name: "Sarah Smith" },
  { email: "hrmanager@xspark.com", password: "demo123", role: "hr_manager", name: "Michael Johnson" },
  { email: "admin@xspark.com", password: "demo123", role: "super_admin", name: "Admin User" },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
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

      router.push('/dashboard')
    } catch (err) {
      setError('Unable to reach server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (userEmail: string) => {
    const user = mockUsers.find((u) => u.email === userEmail)
    if (user) {
      setEmail(user.email)
      setPassword(user.password)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#A6206A]/10 via-background to-[#C9234A]/10 flex items-center justify-center p-4">
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
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
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

        {/* Demo Accounts */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Demo Accounts</CardTitle>
            <CardDescription className="text-xs">Click to auto-fill credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {mockUsers.map((user) => (
              <Button
                key={user.email}
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs bg-transparent"
                onClick={() => quickLogin(user.email)}
              >
                <span className="font-semibold mr-2">{user.role.replace("_", " ").toUpperCase()}:</span>
                {user.email}
              </Button>
            ))}
            <p className="text-xs text-muted-foreground mt-2">Password for all: demo123</p>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="text-center text-xs text-muted-foreground">
          <p>🔒 Secured with bank-level encryption</p>
          <p className="mt-1">POPIA Compliant • ISO 27001 Certified</p>
        </div>
      </div>
    </div>
  )
}

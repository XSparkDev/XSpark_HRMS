import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { XSparkLogo } from "@/components/xspark-logo"
import {
  Shield,
  Users,
  User,
  UserCog,
  Star,
  Crown,
  Calendar,
  FolderLock,
  MessageSquare,
  ClipboardList,
  Lock,
  CheckCircle2,
  ArrowRight,
  Play,
} from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <XSparkLogo className="h-10 w-auto" />
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-navy">
                Log In
              </Button>
            </Link>
            <Link href="/login">
              <Button className="gradient-primary text-white">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#A6206A]/5 via-transparent to-[#C9234A]/5" />
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in-up">
            <h1 className="text-5xl md:text-7xl font-bold text-navy leading-tight text-balance">
              Streamline Your HR Operations with <span className="gradient-text">X Spark HRMS</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto text-pretty">
              Manage employees, automate leave requests, track documents, and empower your team - all in one secure
              platform
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="gradient-primary text-white text-lg px-8 py-6">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2 bg-transparent">
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Security Banner */}
      <section className="bg-navy py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-white/90 text-sm md:text-base">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <span>Bank-Level Security</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>POPIA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span>Role-Based Access Control</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-navy">Everything You Need to Manage Your Team</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed for modern HR management
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-transparent hover:border-l-[#A6206A]"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center text-white">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-navy">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-navy">How It Works</h2>
            <p className="text-xl text-muted-foreground">Get started in four simple steps</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Progress line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#A6206A] to-[#C9234A] hidden md:block" />

              <div className="space-y-12">
                {steps.map((step, index) => (
                  <div key={index} className="relative flex gap-6 items-start">
                    <div className="flex-shrink-0 w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {index + 1}
                    </div>
                    <div className="flex-1 pt-2">
                      <h3 className="text-2xl font-bold text-navy mb-2">{step.title}</h3>
                      <p className="text-muted-foreground text-lg">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* User Roles Showcase */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-navy">Built for Every Role</h2>
            <p className="text-xl text-muted-foreground">Tailored experiences for each user type</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((role, index) => (
              <Card key={index} className="text-center hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 space-y-4">
                  <div
                    className={`w-16 h-16 mx-auto rounded-full ${role.gradient} flex items-center justify-center text-white text-2xl font-bold`}
                  >
                    {role.icon}
                  </div>
                  <h3 className="text-xl font-bold text-navy">{role.title}</h3>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left">
                    {role.capabilities.map((cap, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-20 px-4 bg-navy text-white">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold">Enterprise-Grade Security</h2>
            <p className="text-xl text-white/80">Your data is protected with industry-leading security measures</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {securityFeatures.map((feature, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">{feature.title}</h3>
                  <p className="text-white/70 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card className="gradient-primary text-white">
            <CardContent className="p-12 text-center space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold">Ready to Transform Your HR?</h2>
              <p className="text-xl text-white/90 max-w-2xl mx-auto">
                Join hundreds of companies already using X Spark HRMS to streamline their operations
              </p>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="secondary"
                  className="text-lg px-8 py-6 bg-white text-navy hover:bg-white/90"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <XSparkLogo className="h-12 w-auto mb-4 brightness-0 invert" />
              <p className="text-white/70 text-sm">
                Appsolutely Software - Empowering businesses with innovative HR solutions
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  <Link href="#" className="hover:text-white">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Security
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  <Link href="#" className="hover:text-white">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Support
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  <Link href="#" className="hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    POPIA Compliance
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-sm text-white/70">
            <p>&copy; 2025 X Spark - Appsolutely Software. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

const features = [
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Role-Based Access Control",
    description: "Secure multi-level permissions for every user type with granular access controls",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Employee Management",
    description: "Centralized employee records with role-based visibility and comprehensive profiles",
  },
  {
    icon: <Calendar className="h-6 w-6" />,
    title: "Smart Leave System",
    description: "Automated leave tracking compliant with SA labour laws and real-time balance updates",
  },
  {
    icon: <FolderLock className="h-6 w-6" />,
    title: "Document Management",
    description: "Encrypted document storage with audit trails and version control",
  },
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: "AI Assistant",
    description: "24/7 AI chatbot for instant HR queries and intelligent support escalation",
  },
  {
    icon: <ClipboardList className="h-6 w-6" />,
    title: "Comprehensive Audit Logging",
    description: "Every action tracked with timestamp, user ID, and complete change history",
  },
]

const steps = [
  {
    title: "Secure Login",
    description: "Single sign-on for all user types with bank-level encryption",
  },
  {
    title: "Role Assignment",
    description: "System automatically checks permissions and assigns appropriate access",
  },
  {
    title: "Access Your Dashboard",
    description: "Role-specific interface loads with personalized features and data",
  },
  {
    title: "Work Securely",
    description: "All actions logged, encrypted, and compliant with data protection regulations",
  },
]

const roles = [
  {
    icon: <User className="h-8 w-8" />,
    title: "Employee",
    gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
    capabilities: ["View own profile", "Request leave", "Upload documents", "Access payslips"],
  },
  {
    icon: <UserCog className="h-8 w-8" />,
    title: "Junior HR",
    gradient: "bg-gradient-to-br from-green-500 to-green-600",
    capabilities: ["View employee profiles", "Approve leave requests", "Verify documents", "Generate reports"],
  },
  {
    icon: <Star className="h-8 w-8" />,
    title: "HR Manager",
    gradient: "gradient-primary",
    capabilities: ["Full employee management", "Edit all profiles", "Manage permissions", "Access all reports"],
  },
  {
    icon: <Crown className="h-8 w-8" />,
    title: "Super Admin",
    gradient: "bg-gradient-to-br from-red-500 to-amber-500",
    capabilities: ["Complete system access", "View audit logs", "Manage all users", "System configuration"],
  },
]

const securityFeatures = [
  {
    icon: <Lock className="h-6 w-6" />,
    title: "Supabase Authentication",
    description: "Industry-standard auth with secure token management",
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Row-Level Security",
    description: "Database-level access control for maximum protection",
  },
  {
    icon: <CheckCircle2 className="h-6 w-6" />,
    title: "End-to-End Encryption",
    description: "All data encrypted in transit and at rest",
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: "Two-Factor Authentication",
    description: "Optional 2FA for enhanced account security",
  },
  {
    icon: <ClipboardList className="h-6 w-6" />,
    title: "Complete Audit Trails",
    description: "Every action logged with full change history",
  },
  {
    icon: <CheckCircle2 className="h-6 w-6" />,
    title: "POPIA Compliance",
    description: "Fully compliant with South African data protection laws",
  },
]

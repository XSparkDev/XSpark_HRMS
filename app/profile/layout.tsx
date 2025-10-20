import { DashboardLayout } from "@/components/dashboard-layout"

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}

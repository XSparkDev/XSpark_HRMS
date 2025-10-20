import { DashboardLayout } from "@/components/dashboard-layout"

export default function EmployeesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}

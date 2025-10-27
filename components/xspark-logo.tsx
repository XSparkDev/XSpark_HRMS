import Image from "next/image"

export function XSparkLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/X Spark Logo Final-01.png"
      alt="Xspark Logo"
      width={400}
      height={200}
      className={`object-contain ${className}`}
      priority
    />
  )
}

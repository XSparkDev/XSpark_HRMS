import Image from "next/image"

export function XSparkLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/real comppony photo.png"
      alt="Xspark Logo"
      width={400}
      height={200}
      className={`object-contain ${className}`}
      priority
    />
  )
}

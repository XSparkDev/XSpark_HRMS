import Image from "next/image"

export function XSparkLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <div className="inline-block bg-transparent">
      <Image
        src="/Screenshot 2025-11-14 at 14.53.35.png"
        alt="XSpark logo"
        width={600}
        height={550}
        className={`object-contain bg-transparent ${className}`}
        priority
      />
    </div>
  )
}

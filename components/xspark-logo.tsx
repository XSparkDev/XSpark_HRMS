import Image from "next/image"

export function XSparkLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <div className={`relative inline-block bg-transparent overflow-hidden ${className}`}>
      <Image
        src="/Screenshot 2025-11-14 at 14.53.35.png"
        alt="XSpark logo"
        fill
        sizes="(max-width: 768px) 240px, 320px"
        className="object-contain bg-transparent"
        priority
      />
    </div>
  )
}

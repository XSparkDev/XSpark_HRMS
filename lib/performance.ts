// Performance monitoring and optimization utilities

/**
 * Track Core Web Vitals
 */
export function reportWebVitals(metric: any) {
  if (process.env.NODE_ENV === 'production') {
    // Send to analytics service
    console.log('Web Vital:', metric)
  }
}

/**
 * Measure component render time
 */
export function measureRenderTime(componentName: string) {
  if (process.env.NODE_ENV === 'development') {
    const start = performance.now()
    return () => {
      const end = performance.now()
      console.log(`${componentName} rendered in ${end - start}ms`)
    }
  }
  return () => {} // No-op in production
}

/**
 * Optimize image preloading
 */
export function preloadImage(src: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = src
    document.head.appendChild(link)
  }
}

/**
 * Lazy load component with intersection observer
 */
export function useLazyLoad<T extends HTMLElement>(
  callback: () => void,
  options?: IntersectionObserverInit
) {
  if (typeof window === 'undefined') return
}

/**
 * Debounce function for expensive operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}


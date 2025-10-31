// SWR Configuration for API Caching and Performance Optimization

export const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: false,
  dedupingInterval: 2000,
  focusThrottleInterval: 5000,
}

export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('An error occurred while fetching the data.')
  }
  return res.json()
}


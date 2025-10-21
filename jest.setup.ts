// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_STORAGE_BUCKET = 'test-bucket'

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
      listBuckets: jest.fn(),
      createBucket: jest.fn(),
    },
    auth: {
      getSession: jest.fn(),
    },
  },
  storageConfig: {
    bucket: 'test-bucket',
    buckets: {
      employeeDocuments: 'employee-documents',
      contracts: 'contracts',
      payslips: 'payslips',
      profilePictures: 'profile-pictures',
      supportingDocuments: 'supporting-documents',
    },
  },
  testDatabaseConnection: jest.fn(),
  testStorageConnection: jest.fn(),
  initializeSupabase: jest.fn(),
}))

// Global test utilities
global.console = {
  ...console,
  // Suppress console logs during tests (optional)
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  error: jest.fn(),
}

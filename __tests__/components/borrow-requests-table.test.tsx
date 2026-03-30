/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BorrowRequestsTable, type BorrowRequest } from '@/components/borrow-requests-table'

// Mock fetch
global.fetch = jest.fn()

// Mock useToast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}))

// Mock getCurrentUser
jest.mock('@/lib/auth', () => ({
  getCurrentUser: () => ({
    id: 'supervisor-id',
    employeeId: 'SUP-001',
    role: 'supervisor',
  }),
}))

describe('BorrowRequestsTable', () => {
  const mockRequests: BorrowRequest[] = [
    {
      id: 'borrow-1',
      employeeName: 'John Doe',
      employeeId: 'EMP-001',
      deviceName: 'MacBook Pro',
      deviceId: 'device-1',
      assetTag: 'DEV-001',
      borrowDate: '2026-02-02T00:00:00Z',
      purpose: 'Development work',
      status: 'pending',
      createdAt: '2026-02-02T00:00:00Z',
    },
    {
      id: 'borrow-2',
      employeeName: 'Jane Smith',
      employeeId: 'EMP-002',
      deviceName: 'iPad Pro',
      deviceId: 'device-2',
      assetTag: 'DEV-002',
      borrowDate: '2026-02-01T00:00:00Z',
      purpose: 'Testing',
      status: 'pending',
      createdAt: '2026-02-01T00:00:00Z',
    },
  ]

  const mockBorrowsResponse = {
    success: true,
    data: [
      {
        borrow_id: 'borrow-1',
        device_id: 'device-1',
        borrowed_by: 'employee-1',
        borrow_date: '2026-02-02T00:00:00Z',
        notes: 'Development work',
        is_borrowed: false,
      },
      {
        borrow_id: 'borrow-2',
        device_id: 'device-2',
        borrowed_by: 'employee-2',
        borrow_date: '2026-02-01T00:00:00Z',
        notes: 'Testing',
        is_borrowed: false,
      },
    ],
    meta: { count: 2, limit: 100, offset: null },
  }

  const mockDevicesResponse = {
    success: true,
    data: [
      {
        device_id: 'device-1',
        asset_tag: 'DEV-001',
        model: 'MacBook Pro',
        brand: 'Apple',
        device_type: 'Laptop',
      },
      {
        device_id: 'device-2',
        asset_tag: 'DEV-002',
        model: 'iPad Pro',
        brand: 'Apple',
        device_type: 'Tablet',
      },
    ],
  }

  const mockEmployeesResponse = {
    success: true,
    data: [
      {
        id: 'employee-1',
        employee_id: 'EMP-001',
        name: 'John Doe',
      },
      {
        id: 'employee-2',
        employee_id: 'EMP-002',
        name: 'Jane Smith',
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Default mock implementation - use immediate resolution
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/borrows?isBorrowed=false')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBorrowsResponse),
        })
      }
      if (url.includes('/api/devices')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDevicesResponse),
        })
      }
      if (url.includes('/api/employees')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEmployeesResponse),
        })
      }
      if (url.includes('/api/borrows/') && url.includes('?action=')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {}, message: 'Success' }),
        })
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })
  })

  describe('Rendering', () => {
    it('should render loading state when fetching', async () => {
      // Override the default mock for this test only
      const neverResolve = new Promise(() => {}) // Never resolves
      ;(global.fetch as jest.Mock).mockImplementationOnce(() => neverResolve)

      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Loading requests...')).toBeInTheDocument()
      })
    })

    it('should render empty state when no requests', async () => {
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/borrows?isBorrowed=false')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: [], meta: { count: 0 } }),
          })
        }
        if (url.includes('/api/devices') || url.includes('/api/employees')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: [] }),
          })
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} />)

      // Wait for loading to finish
      await waitFor(
        () => {
          expect(screen.queryByText('Loading requests...')).not.toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      // Then check for empty state
      await waitFor(
        () => {
          expect(screen.getByText('No pending borrow requests')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })

    it('should render requests table when data is available', async () => {
      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} />)

      // Wait for loading to finish
      await waitFor(
        () => {
          expect(screen.queryByText('Loading requests...')).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Then check for data
      await waitFor(
        () => {
          expect(screen.getByText('John Doe')).toBeInTheDocument()
          expect(screen.getByText('Jane Smith')).toBeInTheDocument()
          expect(screen.getByText('MacBook Pro')).toBeInTheDocument()
          expect(screen.getByText('iPad Pro')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    it('should display correct request information', async () => {
      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} />)

      // Wait for loading to finish
      await waitFor(
        () => {
          expect(screen.queryByText('Loading requests...')).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Then check for data
      await waitFor(
        () => {
          expect(screen.getByText('EMP-001')).toBeInTheDocument()
          expect(screen.getByText('EMP-002')).toBeInTheDocument()
          expect(screen.getByText('DEV-001')).toBeInTheDocument()
          expect(screen.getByText('DEV-002')).toBeInTheDocument()
          expect(screen.getByText('Development work')).toBeInTheDocument()
          expect(screen.getByText('Testing')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Actions', () => {
    it('should call onApprove when approve is clicked', async () => {
      const onApprove = jest.fn().mockResolvedValue(undefined)

      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} onApprove={onApprove} />)

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByText('Loading requests...')).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(screen.getByText('John Doe')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Find and click the actions menu - look for MoreVertical icon button
      const moreButtons = screen.getAllByRole('button').filter((btn) => {
        const svg = btn.querySelector('svg')
        return svg && svg.getAttribute('class')?.includes('lucide-more-vertical')
      })
      
      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0])
      }

      await waitFor(
        () => {
          const approveButton = screen.getByText('Approve')
          fireEvent.click(approveButton)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(onApprove).toHaveBeenCalledWith('borrow-1')
        },
        { timeout: 3000 }
      )
    })

    it('should call onReject when reject is clicked', async () => {
      const onReject = jest.fn().mockResolvedValue(undefined)
      window.prompt = jest.fn().mockReturnValue('Not available')

      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} onReject={onReject} />)

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByText('Loading requests...')).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(screen.getByText('John Doe')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Find and click the actions menu
      const moreButtons = screen.getAllByRole('button').filter((btn) => {
        const svg = btn.querySelector('svg')
        return svg && svg.getAttribute('class')?.includes('lucide-more-vertical')
      })
      
      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0])
      }

      await waitFor(
        () => {
          const rejectButton = screen.getByText('Reject')
          fireEvent.click(rejectButton)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(onReject).toHaveBeenCalledWith('borrow-1', 'Not available')
        },
        { timeout: 3000 }
      )
    })

    it('should use default approve handler when onApprove is not provided', async () => {
      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} />)

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByText('Loading requests...')).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(screen.getByText('John Doe')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Find and click the actions menu
      const moreButtons = screen.getAllByRole('button').filter((btn) => {
        const svg = btn.querySelector('svg')
        return svg && svg.getAttribute('class')?.includes('lucide-more-vertical')
      })
      
      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0])
      }

      await waitFor(
        () => {
          const approveButton = screen.getByText('Approve')
          fireEvent.click(approveButton)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/borrows/borrow-1?action=approve'),
            expect.objectContaining({
              method: 'PATCH',
            })
          )
        },
        { timeout: 3000 }
      )
    })

    it('should refresh data after approval', async () => {
      const onApprove = jest.fn().mockResolvedValue(undefined)

      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} onApprove={onApprove} />)

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByText('Loading requests...')).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(screen.getByText('John Doe')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      const initialFetchCount = (global.fetch as jest.Mock).mock.calls.length

      // Find and click the actions menu
      const moreButtons = screen.getAllByRole('button').filter((btn) => {
        const svg = btn.querySelector('svg')
        return svg && svg.getAttribute('class')?.includes('lucide-more-vertical')
      })
      
      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0])
      }

      await waitFor(
        () => {
          const approveButton = screen.getByText('Approve')
          fireEvent.click(approveButton)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          // Should have fetched again after approval
          expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialFetchCount)
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle API fetch errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('No pending borrow requests')).toBeInTheDocument()
      })
    })

    it('should handle invalid API response format', async () => {
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/borrows?isBorrowed=false')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: false, data: null }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        })
      })

      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('No pending borrow requests')).toBeInTheDocument()
      })
    })

    it('should handle approval errors', async () => {
      ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/borrows/') && url.includes('?action=approve')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: () => Promise.resolve({ success: false, error: 'Approval failed' }),
          })
        }
        if (url.includes('/api/borrows?isBorrowed=false')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBorrowsResponse),
          })
        }
        if (url.includes('/api/devices') || url.includes('/api/employees')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockDevicesResponse),
          })
        }
      })

      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      // Find and click the actions menu
      const actionButtons = screen.getAllByRole('button', { name: '' })
      const moreButton = actionButtons.find((btn) => btn.querySelector('svg'))
      if (moreButton) {
        fireEvent.click(moreButton)
      }

      await waitFor(() => {
        const approveButton = screen.getByText('Approve')
        fireEvent.click(approveButton)
      })

      // Should still show the table (error handled gracefully)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })
  })

  describe('Refresh', () => {
    it('should refresh data when refresh button is clicked', async () => {
      render(<BorrowRequestsTable open={true} onOpenChange={jest.fn()} />)

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByText('Loading requests...')).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(screen.getByText('John Doe')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      const initialFetchCount = (global.fetch as jest.Mock).mock.calls.length

      const refreshButton = screen.getByText('Refresh')
      fireEvent.click(refreshButton)

      await waitFor(
        () => {
          expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialFetchCount)
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Dialog', () => {
    it('should call onOpenChange when close button is clicked', async () => {
      const onOpenChange = jest.fn()

      render(<BorrowRequestsTable open={true} onOpenChange={onOpenChange} />)

      await waitFor(
        () => {
          const closeButtons = screen.getAllByText('Close')
          // Get the button in the footer, not the sr-only span
          const footerCloseButton = closeButtons.find((btn) => btn.tagName === 'BUTTON')
          if (footerCloseButton) {
            fireEvent.click(footerCloseButton)
            expect(onOpenChange).toHaveBeenCalledWith(false)
          }
        },
        { timeout: 3000 }
      )
    })

    it('should not render when open is false', () => {
      render(<BorrowRequestsTable open={false} onOpenChange={jest.fn()} />)

      expect(screen.queryByText('Pending Borrow Requests')).not.toBeInTheDocument()
    })
  })
})

/**
 * Resource Condition Utilities
 * 
 * This file provides utilities for working with resource condition values
 * that match the database CHECK constraint exactly.
 */

// Allowed condition values based on database CHECK constraint
// These must match exactly (case-sensitive) with the database constraint
export const ALLOWED_CONDITION_VALUES = [
  'excellent',
  'good',
  'fair',
  'poor',
  'damaged',
  'unusable'
] as const

export type AllowedCondition = typeof ALLOWED_CONDITION_VALUES[number]

// Display labels for condition values (for UI)
export const CONDITION_LABELS: Record<AllowedCondition, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
  unusable: 'Unusable'
}

// Normalize condition value to match database constraint
// Maps common variations to allowed values
export function normalizeCondition(value: string | null | undefined): AllowedCondition | null {
  if (!value) return null
  
  const normalized = value.toLowerCase().trim()
  
  // Direct match
  if (ALLOWED_CONDITION_VALUES.includes(normalized as AllowedCondition)) {
    return normalized as AllowedCondition
  }
  
  // Map common variations to allowed values
  const mapping: Record<string, AllowedCondition> = {
    'excellent': 'excellent',
    'good': 'good',
    'fair': 'fair',
    'poor': 'poor',
    'bad': 'poor', // Map "Bad" to "poor"
    'damaged': 'damaged',
    'unusable': 'unusable',
    'broken': 'damaged',
    'needs repair': 'damaged',
    'repair': 'damaged',
    'maintenance': 'damaged',
    'out of order': 'unusable',
    'not working': 'unusable',
  }
  
  const mapped = mapping[normalized]
  if (mapped) {
    return mapped
  }
  
  // Return null if no match found (should be caught by validation)
  return null
}

// Validate if a condition value is allowed
export function isValidCondition(value: string | null | undefined): value is AllowedCondition {
  if (!value) return false
  return ALLOWED_CONDITION_VALUES.includes(value.toLowerCase().trim() as AllowedCondition)
}

// Get display label for a condition value
export function getConditionLabel(value: AllowedCondition | string | null | undefined): string {
  if (!value) return 'Not specified'
  const normalized = normalizeCondition(value)
  if (!normalized) return value
  return CONDITION_LABELS[normalized]
}







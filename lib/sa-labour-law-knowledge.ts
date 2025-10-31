// South African Labour Law Knowledge Base
// This file contains structured knowledge for the HR assistant to reference

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  act: string
  section?: string
  keywords: string[]
  category: 'leave' | 'disciplinary' | 'safety' | 'rights' | 'conduct' | 'general'
}

export const saLabourLawKnowledge: KnowledgeEntry[] = [
  {
    id: 'bcea-annual-leave',
    title: 'Annual Leave Entitlement',
    content: 'According to Section 20 of the Basic Conditions of Employment Act (Act 75 of 1997), employees are entitled to at least 21 consecutive days of annual leave per annual leave cycle. Annual leave accrues from the first day of employment at a rate of one day for every 17 days worked, or 1.25 days per month.',
    act: 'BCEA (Act 75 of 1997)',
    section: 'Section 20',
    keywords: ['annual leave', 'vacation', 'holiday', 'leave entitlement', 'bcea'],
    category: 'leave'
  },
  {
    id: 'bcea-sick-leave',
    title: 'Sick Leave Entitlement',
    content: 'According to Section 22 of the Basic Conditions of Employment Act (Act 75 of 1997), employees are entitled to paid sick leave equal to the number of days they would normally work during a six-week period during each leave cycle. For most employees, this equals 30 days sick leave over a 36-month period.',
    act: 'BCEA (Act 75 of 1997)',
    section: 'Section 22',
    keywords: ['sick leave', 'medical leave', 'illness', 'bcea'],
    category: 'leave'
  },
  {
    id: 'bcea-maternity-leave',
    title: 'Maternity Leave',
    content: 'According to Section 25 of the Basic Conditions of Employment Act (Act 75 of 1997), pregnant employees are entitled to at least four consecutive months of maternity leave. The employee is entitled to payment as determined by the Minister of Labour, and may not be dismissed during maternity leave.',
    act: 'BCEA (Act 75 of 1997)',
    section: 'Section 25',
    keywords: ['maternity leave', 'pregnancy', 'birth', 'maternal leave', 'bcea'],
    category: 'leave'
  },
  {
    id: 'lra-unfair-dismissal',
    title: 'Protection Against Unfair Dismissal',
    content: 'According to Section 188 of the Labour Relations Act (Act 66 of 1995), a dismissal is unfair if it is not effected for a fair reason and in accordance with a fair procedure. This includes: substantively fair reasons (misconduct, incapacity, operational requirements) and procedurally fair process (notification, opportunity to respond, hearing, representation).',
    act: 'LRA (Act 66 of 1995)',
    section: 'Section 188',
    keywords: ['unfair dismissal', 'termination', 'fair dismissal', 'dismissal procedure', 'lra'],
    category: 'disciplinary'
  },
  {
    id: 'lra-disciplinary-procedure',
    title: 'Fair Disciplinary Procedure',
    content: 'According to the Labour Relations Act (Act 66 of 1995), disciplinary procedures must include: written notification of allegations with reasonable time to prepare (minimum 48 hours), opportunity to present case, right to representation, unbiased chairperson, written outcome with reasons, and right to appeal. Progressive discipline should be applied (verbal → written → final warning).',
    act: 'LRA (Act 66 of 1995)',
    section: 'Section 188',
    keywords: ['disciplinary', 'disciplinary procedure', 'hearing', 'misconduct', 'lra'],
    category: 'disciplinary'
  },
  {
    id: 'ohsa-right-refuse',
    title: 'Right to Refuse Dangerous Work',
    content: 'According to Section 13 of the Occupational Health and Safety Act (Act 85 of 1993), an employee may refuse to perform work which he or she reasonably believes is unsafe or unhealthy. The employee must report the danger immediately and the employer must investigate and take corrective action.',
    act: 'OHSA (Act 85 of 1993)',
    section: 'Section 13',
    keywords: ['safety', 'dangerous work', 'unsafe', 'health and safety', 'ohsa'],
    category: 'safety'
  },
  {
    id: 'ohsa-employer-duties',
    title: 'Employer Health and Safety Duties',
    content: 'According to Section 8 of the Occupational Health and Safety Act (Act 85 of 1993), every employer must: provide and maintain safe working conditions, ensure plant and machinery are safe, ensure safe use, handling, storage and transport of substances, provide information and training, conduct risk assessments, appoint safety committees, and investigate all accidents or incidents.',
    act: 'OHSA (Act 85 of 1993)',
    section: 'Section 8',
    keywords: ['employer duties', 'safety obligations', 'safety requirements', 'ohsa'],
    category: 'safety'
  },
  {
    id: 'eea-discrimination',
    title: 'Prohibition of Unfair Discrimination',
    content: 'According to Section 6 of the Employment Equity Act (Act 55 of 1998), no person may unfairly discriminate against any employee on grounds of race, gender, sex, pregnancy, marital status, family responsibility, ethnic or social origin, colour, sexual orientation, age, disability, religion, conscience, belief, political opinion, culture, language and birth.',
    act: 'EEA (Act 55 of 1998)',
    section: 'Section 6',
    keywords: ['discrimination', 'fairness', 'equity', 'eea'],
    category: 'rights'
  },
  {
    id: 'bcea-working-hours',
    title: 'Standard Working Hours',
    content: 'According to Section 9 of the Basic Conditions of Employment Act (Act 75 of 1997), ordinary hours of work must not exceed 45 hours per week, or 9 hours per day if working five days or less per week, or 8 hours per day if working more than 5 days per week. Maximum 12 hours per day including overtime.',
    act: 'BCEA (Act 75 of 1997)',
    section: 'Section 9',
    keywords: ['working hours', 'overtime', 'standard hours', 'bcea'],
    category: 'rights'
  },
  {
    id: 'bcea-overtime',
    title: 'Overtime Compensation',
    content: 'According to Section 10 of the Basic Conditions of Employment Act (Act 75 of 1997), overtime must be paid at one-and-a-half times the normal wage rate. Work on Sundays attracts double time unless the employee ordinarily works on Sundays, in which case it is paid at one-and-a-half times.',
    act: 'BCEA (Act 75 of 1997)',
    section: 'Section 10',
    keywords: ['overtime', 'overtime pay', 'compensation', 'bcea'],
    category: 'rights'
  },
  {
    id: 'lra-ccma',
    title: 'CCMA Dispute Resolution',
    content: 'According to the Labour Relations Act (Act 66 of 1995), the Commission for Conciliation, Mediation and Arbitration (CCMA) provides free dispute resolution services. Disputes must be referred within 30 days. The process includes conciliation (attempt to resolve) and if unsuccessful, arbitration. Unfair dismissal disputes are automatically arbitrated if not settled.',
    act: 'LRA (Act 66 of 1995)',
    keywords: ['ccma', 'dispute', 'mediation', 'arbitration', 'lra'],
    category: 'disciplinary'
  },
  {
    id: 'eea-pay-equity',
    title: 'Equal Remuneration',
    content: 'According to Section 6 of the Employment Equity Act (Act 55 of 1998), employees performing work of equal value must receive equal remuneration, unless the difference is justified on fair grounds. This applies regardless of race, gender, or other prohibited grounds.',
    act: 'EEA (Act 55 of 1998)',
    section: 'Section 6',
    keywords: ['pay equity', 'equal pay', 'remuneration', 'wage equality', 'eea'],
    category: 'rights'
  }
]

/**
 * Search the knowledge base for relevant entries based on keywords
 */
export function searchKnowledgeBase(query: string): KnowledgeEntry[] {
  const lowerQuery = query.toLowerCase()
  
  return saLabourLawKnowledge.filter(entry => 
    entry.keywords.some(keyword => lowerQuery.includes(keyword.toLowerCase())) ||
    entry.title.toLowerCase().includes(lowerQuery) ||
    entry.content.toLowerCase().includes(lowerQuery) ||
    entry.act.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get knowledge entry by ID
 */
export function getKnowledgeById(id: string): KnowledgeEntry | undefined {
  return saLabourLawKnowledge.find(entry => entry.id === id)
}

/**
 * Format a knowledge response with citations
 */
export function formatKnowledgeResponse(entry: KnowledgeEntry): string {
  let citation = entry.act
  if (entry.section) {
    citation = `${entry.section} of the ${entry.act}`
  }
  
  return `${entry.content}\n\n📖 Reference: ${citation}`
}

/**
 * Check if query matches specific categories
 */
export function getCategoryFromQuery(query: string): string | null {
  const lowerQuery = query.toLowerCase()
  
  if (lowerQuery.includes('leave') || lowerQuery.includes('vacation') || lowerQuery.includes('holiday')) {
    return 'leave'
  }
  if (lowerQuery.includes('disciplinary') || lowerQuery.includes('warning') || lowerQuery.includes('dismissal')) {
    return 'disciplinary'
  }
  if (lowerQuery.includes('safety') || lowerQuery.includes('health') || lowerQuery.includes('hazard')) {
    return 'safety'
  }
  if (lowerQuery.includes('rights') || lowerQuery.includes('entitle') || lowerQuery.includes('wage') || lowerQuery.includes('pay')) {
    return 'rights'
  }
  if (lowerQuery.includes('conduct') || lowerQuery.includes('policy') || lowerQuery.includes('workplace behavior')) {
    return 'conduct'
  }
  
  return null
}


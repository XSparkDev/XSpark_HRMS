import fs from 'fs';
import path from 'path';

/**
 * Chatbot Reference Utility
 * 
 * This utility provides functions to load and reference knowledge base documents
 * from the chatbot-reference folder for use in AI chatbot context.
 */

export interface ReferenceDocument {
  name: string;
  filename: string;
  content: string;
  metadata?: {
    title?: string;
    description?: string;
    category?: string;
  };
}

export interface ReferenceContext {
  documents: ReferenceDocument[];
  query: string;
  relevantSections: ReferenceDocument[];
}

// Path to the chatbot reference folder
// In Next.js, process.cwd() returns the project root
const REFERENCE_FOLDER = path.join(process.cwd(), 'chatbot-reference');

// Document metadata mapping
const DOCUMENT_METADATA: Record<string, { title: string; description: string; category: string }> = {
  'Disciplinary.md': {
    title: 'Disciplinary Guide on Disciplinary and Incapacity Matters',
    description: 'Comprehensive guide on disciplinary procedures, incapacity matters, and termination procedures for public service employees in South Africa',
    category: 'Disciplinary & Procedures'
  },
  'basic-employee-condition.md': {
    title: 'Basic Conditions of Employment Act',
    description: 'South African Basic Conditions of Employment Act 75 of 1997 covering working time, leave, remuneration, termination, and employee rights',
    category: 'Employment Law'
  },
  'workplace-conduct.md': {
    title: 'Workplace Conduct and Employment Equity',
    description: 'Guidelines on eliminating unfair discrimination, implementing affirmative action, and managing workplace conduct throughout the employment lifecycle',
    category: 'Workplace Conduct & Equity'
  },
  'safety-rules.md': {
    title: 'Occupational Health and Safety Rules',
    description: 'Occupational Health and Safety Act requirements, workplace safety policies, responsibilities, and procedures for maintaining safe work environments',
    category: 'Health & Safety'
  }
};

/**
 * Load a specific reference document by filename
 */
export function loadReferenceDocument(filename: string): ReferenceDocument | null {
  try {
    const filePath = path.join(REFERENCE_FOLDER, filename);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`Reference document not found: ${filename}`);
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const metadata = DOCUMENT_METADATA[filename] || {
      title: filename.replace('.md', ''),
      description: `Reference document: ${filename}`,
      category: 'General'
    };

    return {
      name: filename.replace('.md', ''),
      filename,
      content,
      metadata
    };
  } catch (error) {
    console.error(`Error loading reference document ${filename}:`, error);
    return null;
  }
}

/**
 * Load all reference documents from the chatbot-reference folder
 */
export function loadAllReferenceDocuments(): ReferenceDocument[] {
  try {
    if (!fs.existsSync(REFERENCE_FOLDER)) {
      console.warn(`Reference folder not found: ${REFERENCE_FOLDER}`);
      return [];
    }

    const files = fs.readdirSync(REFERENCE_FOLDER);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    const documents: ReferenceDocument[] = [];

    for (const file of mdFiles) {
      const doc = loadReferenceDocument(file);
      if (doc) {
        documents.push(doc);
      }
    }

    return documents;
  } catch (error) {
    console.error('Error loading reference documents:', error);
    return [];
  }
}

/**
 * Search for relevant content in reference documents based on a query
 */
export function searchReferenceDocuments(
  query: string,
  documents: ReferenceDocument[] = loadAllReferenceDocuments()
): ReferenceDocument[] {
  const searchTerms = query.toLowerCase().split(/\s+/);
  
  return documents
    .map(doc => {
      const content = doc.content.toLowerCase();
      const title = doc.metadata?.title?.toLowerCase() || '';
      const description = doc.metadata?.description?.toLowerCase() || '';
      
      // Calculate relevance score
      let score = 0;
      
      searchTerms.forEach(term => {
        // Title matches are weighted highest
        if (title.includes(term)) score += 10;
        // Description matches are weighted medium
        if (description.includes(term)) score += 5;
        // Content matches are weighted lower
        const contentMatches = (content.match(new RegExp(term, 'g')) || []).length;
        score += Math.min(contentMatches, 3);
      });

      return { ...doc, relevanceScore: score };
    })
    .filter(doc => (doc as any).relevanceScore > 0)
    .sort((a, b) => (b as any).relevanceScore - (a as any).relevanceScore)
    .map(({ relevanceScore, ...doc }) => doc);
}

/**
 * Get context from reference documents for a specific query
 * This is useful for building AI prompt context
 */
export function getReferenceContext(query: string, maxDocuments: number = 3): ReferenceContext {
  const allDocuments = loadAllReferenceDocuments();
  const relevantSections = searchReferenceDocuments(query, allDocuments).slice(0, maxDocuments);

  return {
    documents: allDocuments,
    query,
    relevantSections
  };
}

/**
 * Format reference documents for use in AI prompts
 */
export function formatReferencesForPrompt(context: ReferenceContext): string {
  if (context.relevantSections.length === 0) {
    return 'No relevant reference documents found for this query.';
  }

  let formatted = 'RELEVANT REFERENCE DOCUMENTS:\n\n';
  
  context.relevantSections.forEach((doc, index) => {
    formatted += `--- REFERENCE ${index + 1}: ${doc.metadata?.title || doc.name} ---\n`;
    if (doc.metadata?.description) {
      formatted += `Description: ${doc.metadata.description}\n`;
    }
    if (doc.metadata?.category) {
      formatted += `Category: ${doc.metadata.category}\n`;
    }
    
    // Include first 2000 characters of content (adjust as needed)
    const contentPreview = doc.content.slice(0, 2000);
    formatted += `\nContent Preview:\n${contentPreview}`;
    if (doc.content.length > 2000) {
      formatted += '\n... (content truncated)';
    }
    formatted += '\n\n';
  });

  return formatted;
}

/**
 * Get a specific document by name (case-insensitive)
 */
export function getDocumentByName(name: string): ReferenceDocument | null {
  const allDocuments = loadAllReferenceDocuments();
  const normalizedName = name.toLowerCase().trim();
  
  return allDocuments.find(
    doc => doc.name.toLowerCase() === normalizedName || 
           doc.filename.toLowerCase() === `${normalizedName}.md`
  ) || null;
}

/**
 * Get documents by category
 */
export function getDocumentsByCategory(category: string): ReferenceDocument[] {
  const allDocuments = loadAllReferenceDocuments();
  const normalizedCategory = category.toLowerCase().trim();
  
  return allDocuments.filter(
    doc => doc.metadata?.category?.toLowerCase() === normalizedCategory
  );
}

/**
 * List all available reference documents with their metadata
 */
export function listAvailableReferences(): Array<{ name: string; title: string; description: string; category: string }> {
  const documents = loadAllReferenceDocuments();
  
  return documents.map(doc => ({
    name: doc.name,
    title: doc.metadata?.title || doc.name,
    description: doc.metadata?.description || 'No description available',
    category: doc.metadata?.category || 'General'
  }));
}


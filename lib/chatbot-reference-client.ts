/**
 * Client-side utility for chatbot reference documents
 * 
 * This provides browser-safe functions to fetch and use reference documents
 * from the API endpoint.
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

/**
 * Fetch all reference documents from the API
 */
export async function fetchAllReferences(): Promise<ReferenceDocument[]> {
  try {
    const response = await fetch('/api/chatbot/references');
    if (!response.ok) {
      throw new Error('Failed to fetch reference documents');
    }
    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error('Error fetching reference documents:', error);
    return [];
  }
}

/**
 * Fetch a specific reference document by filename
 */
export async function fetchReference(filename: string): Promise<ReferenceDocument | null> {
  try {
    const response = await fetch(`/api/chatbot/references?filename=${encodeURIComponent(filename)}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch reference document');
    }
    const data = await response.json();
    return data.document || null;
  } catch (error) {
    console.error('Error fetching reference document:', error);
    return null;
  }
}

/**
 * Search reference documents based on a query
 */
export async function searchReferences(query: string): Promise<ReferenceDocument[]> {
  try {
    const response = await fetch(
      `/api/chatbot/references?search=${encodeURIComponent(query)}`
    );
    if (!response.ok) {
      throw new Error('Failed to search reference documents');
    }
    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error('Error searching reference documents:', error);
    return [];
  }
}

/**
 * Get references by category
 */
export async function getReferencesByCategory(category: string): Promise<ReferenceDocument[]> {
  try {
    const response = await fetch(
      `/api/chatbot/references?category=${encodeURIComponent(category)}`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch reference documents by category');
    }
    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error('Error fetching reference documents by category:', error);
    return [];
  }
}

/**
 * Get reference context for a query (combines search and formatting)
 */
export async function getReferenceContext(query: string, maxDocuments: number = 3): Promise<ReferenceContext> {
  const allDocuments = await fetchAllReferences();
  const relevantSections = await searchReferences(query);
  
  return {
    documents: allDocuments,
    query,
    relevantSections: relevantSections.slice(0, maxDocuments)
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
    
    // Include first 2000 characters of content (adjust as needed for token limits)
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
 * Get relevant references for a user query and format for chatbot context
 */
export async function getFormattedReferenceContext(query: string, maxDocuments: number = 3): Promise<string> {
  const context = await getReferenceContext(query, maxDocuments);
  return formatReferencesForPrompt(context);
}

/**
 * List all available reference categories
 */
export async function getAvailableCategories(): Promise<string[]> {
  const documents = await fetchAllReferences();
  const categories = new Set<string>();
  
  documents.forEach(doc => {
    if (doc.metadata?.category) {
      categories.add(doc.metadata.category);
    }
  });
  
  return Array.from(categories);
}

/**
 * List all available references with metadata
 */
export async function listAvailableReferences(): Promise<Array<{ name: string; title: string; description: string; category: string }>> {
  const documents = await fetchAllReferences();
  
  return documents.map(doc => ({
    name: doc.name,
    title: doc.metadata?.title || doc.name,
    description: doc.metadata?.description || 'No description available',
    category: doc.metadata?.category || 'General'
  }));
}


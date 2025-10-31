import { NextRequest, NextResponse } from 'next/server';
import { loadAllReferenceDocuments, loadReferenceDocument, searchReferenceDocuments } from '@/lib/chatbot-reference';

/**
 * GET /api/chatbot/references
 * 
 * Get all reference documents or search for specific ones
 * 
 * Query params:
 * - search: Search query to filter documents
 * - filename: Get a specific document by filename
 * - category: Filter by category
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const filename = searchParams.get('filename');
    const category = searchParams.get('category');

    // Get specific document by filename
    if (filename) {
      const doc = loadReferenceDocument(filename);
      if (!doc) {
        return NextResponse.json(
          { error: `Document not found: ${filename}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ document: doc });
    }

    // Get all documents
    let documents = loadAllReferenceDocuments();

    // Filter by category
    if (category) {
      documents = documents.filter(
        doc => doc.metadata?.category?.toLowerCase() === category.toLowerCase()
      );
    }

    // Search documents
    if (search) {
      documents = searchReferenceDocuments(search, documents);
    }

    return NextResponse.json({
      documents,
      count: documents.length
    });
  } catch (error) {
    console.error('Error fetching reference documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reference documents' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getRequest } from '@/lib/http/fetcher';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid addon ID' },
        { status: 400 }
      );
    }

    // Fetch addon details from Directus (get all fields to avoid permission issues)
    const response = await getRequest<{ 
      data: any 
    }>(`/items/addons/${encodeURIComponent(id)}`);

    const addon = response?.data;
    
    if (!addon) {
      return NextResponse.json(
        { error: 'Addon not found' },
        { status: 404 }
      );
    }

    // Debug: Log available fields to understand the structure
    console.log('Available addon fields:', Object.keys(addon));

    // Try different possible description fields that might exist
    // Check all possible field names that could contain description
    const description = addon.description || 
                       addon.addon_description || 
                       addon.details ||
                       addon.summary ||
                       addon.info ||
                       addon.notes ||
                       addon.content ||
                       addon.text ||
                       addon.about ||
                       addon.explanation ||
                       addon.overview ||
                       null;

    return NextResponse.json({
      id: addon.id,
      name: addon.name,
      description: description
    });

  } catch (error) {
    console.error('Error fetching addon description:', error);
    return NextResponse.json(
      { error: 'Failed to fetch addon description' },
      { status: 500 }
    );
  }
}

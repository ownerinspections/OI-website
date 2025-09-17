import { NextRequest, NextResponse } from 'next/server';
import { getRequest } from '@/lib/http/fetcher';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    
    if (!serviceId || isNaN(Number(serviceId))) {
      return NextResponse.json(
        { error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    // Fetch service details from Directus
    const response = await getRequest<{ 
      data: any 
    }>(`/items/services/${encodeURIComponent(serviceId)}`);

    const service = response?.data;
    
    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: service
    });

  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}

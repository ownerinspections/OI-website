import { NextRequest, NextResponse } from 'next/server';
import { getRequest } from '@/lib/http/fetcher';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; stageNumber: string }> }
) {
  try {
    const { serviceId, stageNumber } = await params;
    
    if (!serviceId || isNaN(Number(serviceId))) {
      return NextResponse.json(
        { error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    if (!stageNumber || isNaN(Number(stageNumber))) {
      return NextResponse.json(
        { error: 'Invalid stage number' },
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

    // Find the stage in the service stages array
    const stages = service.stages || [];
    const stage = stages.find((s: any) => 
      String(s.stage_number) === String(stageNumber)
    );

    if (!stage) {
      return NextResponse.json(
        { error: 'Stage not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      service_id: service.id,
      stage_number: stage.stage_number,
      stage_name: stage.stage_name || `Stage ${stage.stage_number}`,
      description: stage.stage_description || null
    });

  } catch (error) {
    console.error('Error fetching stage description:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stage description' },
      { status: 500 }
    );
  }
}

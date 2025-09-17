import { redirect } from "next/navigation";

export default async function ConstructionstagesBookingStep({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
    // TODO: Implement construction-stages booking logic
    return (
        <div className="container">
            <div className="card">
                <h1>Booking Step - Coming Soon</h1>
                <p>This construction-stages booking step is not yet implemented.</p>
            </div>
        </div>
    );
}
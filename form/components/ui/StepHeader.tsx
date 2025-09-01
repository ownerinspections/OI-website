import type { ReactNode } from "react";

export default function StepHeader({ children }: { children: ReactNode }) {
    return (
        <h2 className="step-header">
            {children}
        </h2>
    );
}



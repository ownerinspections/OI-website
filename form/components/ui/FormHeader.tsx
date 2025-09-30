import type { ReactNode } from "react";

type FormHeaderProps = {
    rightTitle?: string;
    rightSubtitle?: ReactNode;
    rightMeta?: Array<{ label: string; value?: string | number | null | undefined }>;
};

export default function FormHeader({ rightTitle, rightSubtitle, rightMeta }: FormHeaderProps) {
    return (
        <div className="form-header">
            <div className="form-header-left">
                {rightTitle && <div className="form-header-right-title">{rightTitle}</div>}
                {rightSubtitle && <div className="form-header-right-subtitle">{rightSubtitle}</div>}
            </div>
            {Array.isArray(rightMeta) && rightMeta.length > 0 && (
                <div className="form-header-right-meta">
                    {rightMeta.map((m, idx) => (
                        <div key={idx} className="form-header-meta-item">
                            <span className="label">{m.label}</span>
                            <span className="value">{m.value ?? "-"}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}



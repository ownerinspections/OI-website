import Image from "next/image";
import type { ReactNode } from "react";
import { fetchCompanyInfo } from "@/lib/actions/invoices/createInvoice";

type FormHeaderProps = {
    rightTitle?: string;
    rightSubtitle?: ReactNode;
    rightMeta?: Array<{ label: string; value?: string | number | null | undefined }>;
    logoWidth?: number;
    logoHeight?: number;
};

export default async function FormHeader({ rightTitle, rightSubtitle, rightMeta, logoWidth, logoHeight }: FormHeaderProps) {
    const company = await fetchCompanyInfo();

    return (
        <div className="form-header">
            <div className="form-header-left">
                <div className="form-header-brand">
                    <div className="form-header-logo" style={logoWidth || logoHeight ? { width: logoWidth, height: logoHeight } : { width: 200, height: 56 }}>
                        <Image src="/images/logo.png" alt="Company logo" fill sizes="200px" style={{ objectFit: "contain" }} priority />
                    </div>
                    <div className="form-header-company">
                        <div className="form-header-contacts">
                            {company?.phone && (
                                <div className="contact-row">
                                    <Image src="/images/socialmedia-icons/Phone.png" alt="Phone" width={16} height={16} />
                                    <span>{company.phone}</span>
                                </div>
                            )}
                            {company?.email && (
                                <div className="contact-row">
                                    <Image src="/images/socialmedia-icons/Massage.png" alt="Email" width={16} height={16} />
                                    <span>{company.email}</span>
                                </div>
                            )}
                            {company?.url && (
                                <div className="contact-row">
                                    <Image src="/images/socialmedia-icons/Web.png" alt="Website" width={16} height={16} />
                                    <span>{company.url}</span>
                                </div>
                            )}
                            {/* Address intentionally omitted from header */}
                        </div>
                    </div>
                </div>
            </div>
            <div className="form-header-right">
                {rightTitle && <div className="form-header-right-title">{rightTitle}</div>}
                {rightSubtitle && <div className="form-header-right-subtitle">{rightSubtitle}</div>}
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
        </div>
    );
}



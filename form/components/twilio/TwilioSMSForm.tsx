"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import TextFieldNoAutocomplete from "@/components/ui/fields/TextFieldNoAutocomplete";
import { submitUpdatePhone } from "@/lib/actions/contacts/submitUpdatePhone";
import { submitSendVerificationCode } from "@/lib/actions/twilio/sendVerificationCode";
import { submitVerifyCode } from "@/lib/actions/twilio/verifyCode";
import AlreadyVerified from "@/components/twilio/AlreadyVerified";
import PreviousButton from "@/components/ui/controls/PreviousButton";
import NextButton from "@/components/ui/controls/NextButton";
import InfoBox from "@/components/ui/messages/InfoBox";
import SuccessBox from "@/components/ui/messages/SuccessBox";
import ErrorBox from "@/components/ui/messages/ErrorBox";
import WarningBox from "@/components/ui/messages/WarningBox";
import { getStepUrl, getRouteTypeFromServiceType } from "@/lib/config/service-routing";

type Props = { phone?: string; contactId?: string; dealId?: string; propertyId?: string; quoteId?: string; userId?: string; redirectSeconds?: number; serviceType?: string };

export default function TwilioSMSForm({ phone, contactId, dealId, propertyId, quoteId, userId, redirectSeconds = 3, serviceType }: Props) {
	const router = useRouter();
	const [isEditing, setIsEditing] = useState<boolean>(false);
	const [currentPhone, setCurrentPhone] = useState<string | undefined>(phone);
	const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
	const [lastAppliedPhone, setLastAppliedPhone] = useState<string | undefined>(undefined);
	const [updateSuccess, setUpdateSuccess] = useState<string | undefined>(undefined);
	const [isCodeSent, setIsCodeSent] = useState<boolean>(false);
	const [codeError, setCodeError] = useState<string | undefined>(undefined);
	const [codeInput, setCodeInput] = useState<string>("");
	const [sendGateError, setSendGateError] = useState<string>("");
	const [sendError, setSendError] = useState<string | undefined>(undefined);
	const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
	const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
	const [codeExpired, setCodeExpired] = useState<boolean>(false);
	const [verifiedTo, setVerifiedTo] = useState<string | null>(null);

	const headerStyle: React.CSSProperties = { marginBottom: 12 };
	const cardStyle: React.CSSProperties = { minHeight: 88 };
	const phoneStyle: React.CSSProperties = { fontSize: 20, fontWeight: 500, letterSpacing: 0.25 };
	const actionsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12 };
	const footerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginTop: 24, gap: 8 };

	// Styles to mirror AuPhoneField for read-only view
	const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, color: "var(--color-text-secondary)", fontSize: 14 };
	const wrapperStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		border: "1px solid var(--color-light-gray)",
		borderRadius: 6,
		background: "var(--color-white)",
		height: "var(--field-height)",
		overflow: "hidden",
		boxSizing: "border-box",
	};
	const prefixStyle: React.CSSProperties = {
		padding: "0 12px",
		background: "var(--color-pale-gray)",
		borderRight: "1px solid var(--color-light-gray)",
		color: "var(--color-text-secondary)",
		height: "100%",
		display: "flex",
		alignItems: "center",
	};
	const readonlyValueStyle: React.CSSProperties = {
		flex: 1,
		height: "100%",
		padding: "0 12px",
		display: "flex",
		alignItems: "center",
		color: "var(--color-text-primary)",
	};
	const errorStyle: React.CSSProperties = { color: "var(--color-error)", fontSize: 12, marginTop: 6 };
	const successStyle: React.CSSProperties = { color: "var(--color-success)", fontSize: 12, marginTop: 6 };
	const infoStyle: React.CSSProperties = { color: "var(--color-info)", fontSize: 12, marginBottom: 8 };
	const sandboxStyle: React.CSSProperties = { color: "var(--color-dark-gray)", fontSize: 12, marginTop: 4 };


	const [updateState, updateAction] = useActionState(submitUpdatePhone, {} as any);
	const [sendState, sendAction] = useActionState(submitSendVerificationCode, {} as any);
	const [verifyState, verifyAction] = useActionState(submitVerifyCode, {} as any);

	// Debug logs for action state changes
	useEffect(() => {
		if (updateState) console.log("[updateState]", updateState);
	}, [updateState]);
	useEffect(() => {
		if (sendState) console.log("[sendState]", sendState);
	}, [sendState]);
	useEffect(() => {
		if (verifyState) console.log("[verifyState]", verifyState);
	}, [verifyState]);

	useEffect(() => {
		if (updateState && updateState.success && updateState.phone) {
			if (updateState.phone !== lastAppliedPhone) {
				setCurrentPhone(updateState.phone);
				setIsEditing(false);
				setPhoneError(undefined);
				setLastAppliedPhone(updateState.phone);
				setUpdateSuccess("Phone number updated successfully");
			}
			return;
		}
		if (isEditing && updateState && updateState.errors && updateState.errors.phone) {
			setPhoneError(updateState.errors.phone);
			setUpdateSuccess(undefined);
		}
	}, [updateState, isEditing, lastAppliedPhone]);

	useEffect(() => {
		// Phone validation errors
		if (sendState && sendState.errors && sendState.errors.phone) {
			setIsEditing(true);
			setPhoneError(sendState.errors.phone);
			setSendError(undefined);
			return;
		}
		// Successful send transitions to code entry and starts cooldown
		if (sendState && sendState.success) {
			setIsEditing(false);
			setIsCodeSent(true);
			setPhoneError(undefined);
			setSendError(undefined);
			setCodeExpired(false);
			setCooldownUntil(Date.now() + 60_000);
			return;
		}
		// General failure from backend (no field errors)
		if (sendState && sendState.success === false && !sendState.errors) {
			setSendError("Failed to send verification code");
		}
	}, [sendState]);

	// Countdown ticker
	useEffect(() => {
		if (!cooldownUntil) {
			setRemainingSeconds(0);
			return;
		}
		const until = cooldownUntil as number;
		function computeRemaining(): number {
			const ms = until - Date.now();
			return Math.max(0, Math.ceil(ms / 1000));
		}
		setRemainingSeconds(computeRemaining());
		const id = setInterval(() => {
			const next = computeRemaining();
			setRemainingSeconds(next);
			if (next <= 0) {
				clearInterval(id);
				setCooldownUntil(null);
				setCodeExpired(true);
			}
		}, 1000);
		return () => clearInterval(id);
	}, [cooldownUntil]);

	useEffect(() => {
		if (verifyState && verifyState.errors) {
			setCodeError(verifyState.errors.code);
		}
		if (verifyState && verifyState.success) {
			// Refresh the server-rendered page so header status reflects "Verified"
			try { router.refresh(); } catch {}
			const params = new URLSearchParams();
			// Required order: userId, contactId, dealId, propertyId, quoteId
			if (userId) params.set("userId", String(userId));
			if (contactId) params.set("contactId", String(contactId));
			if (dealId) params.set("dealId", String(dealId));
			const nextObj: any = (verifyState as any).next || {};
			if (nextObj && nextObj.propertyId) {
				params.set("propertyId", String(nextObj.propertyId));
			} else if (propertyId) {
				params.set("propertyId", String(propertyId));
			}
			if (nextObj && nextObj.quoteId) params.set("quoteId", String(nextObj.quoteId));
			else if (quoteId) params.set("quoteId", String(quoteId));
			
			// Determine the service-specific quote page to redirect to
			let quoteUrl = "/steps/04-quote"; // fallback to generic quote page
			if (serviceType) {
				const routeType = getRouteTypeFromServiceType(serviceType);
				if (routeType !== "generic") {
					quoteUrl = getStepUrl(4, routeType);
				}
				params.set("serviceType", serviceType);
			}
			
			const url = `${quoteUrl}?${params.toString()}`;
			setVerifiedTo(url);
		}
	}, [verifyState, dealId, contactId, propertyId, quoteId, userId, router, serviceType]);

	function formatDisplayPhone(e164?: string): string {
		if (!e164) return "-";
		const digits = e164.replace(/\D+/g, "");
		if (digits.length === 11 && digits.startsWith("61")) {
			const local = digits.slice(2); // 9 digits
			const a = local.slice(0, 1); // 4
			const b = local.slice(1, 4);
			const c = local.slice(4, 7);
			const d = local.slice(7, 9);
			return `+61 ${a}${b ? " " + b : ""}${c ? " " + c : ""}${d ? " " + d : ""}`;
		}
		return e164;
	}

	function formatLocalFromE164(e164?: string): string {
		if (!e164) return "";
		const digits = e164.replace(/\D+/g, "");
		if (digits.length === 11 && digits.startsWith("61")) {
			const local = digits.slice(2); // 9 digits starting with 4
			const parts = [local.slice(0, 3), local.slice(3, 6), local.slice(6, 9)].filter(Boolean);
			return parts.join(" ");
		}
		return "";
	}

	const displayPhone = useMemo(() => formatDisplayPhone(currentPhone), [currentPhone]);

	const prevHref = useMemo(() => {
		const params = new URLSearchParams();
		// Required order: userId, contactId, dealId, propertyId, quoteId
		if (userId) params.set("userId", String(userId));
		if (contactId) params.set("contactId", String(contactId));
		if (dealId) params.set("dealId", String(dealId));
		if (propertyId) params.set("propertyId", String(propertyId));
		if (quoteId) params.set("quoteId", String(quoteId));
		const qs = params.toString();
		return qs ? `/steps/02-property?${qs}` : "/steps/02-property";
	}, [dealId, contactId, propertyId, quoteId, userId]);



	// Debug handlers
	function handleSendSubmit(e: React.FormEvent<HTMLFormElement>) {
		console.log("[send] onSubmit", { phone: currentPhone, local: formatLocalFromE164(currentPhone), contactId, dealId, propertyId });
	}
	function handleVerifySubmit(e: React.FormEvent<HTMLFormElement>) {
		console.log("[verify] onSubmit", { phone: currentPhone, contactId, dealId, propertyId });
	}
	function handleSendClick() {
		console.log("[send] button clicked");
	}
	function handleResendClick() {
		console.log("[resend] button clicked");
	}
	function handleVerifyClick() {
		console.log("[verify] button clicked");
	}

	// Button click handlers
	function handleChangeNumberClick() {
		console.log("[change number] clicked");
		setIsEditing(true);
		setUpdateSuccess(undefined);
		setSendError(undefined);
		setSendGateError("");
	}

	function handleVerifyAndSendClick(e: React.MouseEvent<HTMLButtonElement>) {
		if (!currentPhone) {
			e.preventDefault();
			setSendGateError("Please verify your phone");
		} else {
			setSendGateError("");
			handleSendClick();
		}
	}

	function handleBackToPhoneClick() {
		setIsCodeSent(false);
		setCodeError(undefined);
	}

	function handleCancelEditClick() {
		console.log("[cancel edit] clicked");
		setIsEditing(false);
		setPhoneError(undefined);
	}

	function handleVerifyPhoneClick(e: React.MouseEvent<HTMLButtonElement>) {
		e.preventDefault();
		setSendGateError("Please verify your phone");
	}

 

	if (verifiedTo) {
		return <AlreadyVerified to={verifiedTo} seconds={redirectSeconds} />;
	}

	return (
		<>
			{/* Step title is provided by the step page header */}
			{!isEditing ? (
					!isCodeSent ? (
						<form action={sendAction} onSubmit={handleSendSubmit} noValidate style={{ width: "100%", maxWidth: 420, textAlign: "left", margin: "0 auto" }}>
							<div style={labelStyle}>Phone Number</div>
							<div style={wrapperStyle} aria-live="polite">
								<div style={prefixStyle}>+61</div>
								<div style={readonlyValueStyle}>{formatLocalFromE164(currentPhone) || "4xx xxx xxx"}</div>
							</div>
							{/* success/error moved below actions for unified messaging position */}
							{/* Hidden inputs for send action */}
							<input type="hidden" name="phone" value={currentPhone ?? ""} />
							<input type="hidden" name="phone_local" value={formatLocalFromE164(currentPhone)} />
							<input type="hidden" name="contact_id" value={contactId ?? ""} />
							<input type="hidden" name="deal_id" value={dealId ?? ""} />
							<input type="hidden" name="property_id" value={propertyId ?? ""} />
							<input type="hidden" name="user_id" value={userId ?? ""} />

							<div style={{ ...actionsStyle }}>
								<button className="button-secondary button-secondary--outlined" type="button" style={{ width: "50%" }} onClick={handleChangeNumberClick}>Change number</button>
								<button className="button-primary button-primary--outlined" type="submit" onClick={handleVerifyAndSendClick} style={{ width: "50%" }}>Verify & send code</button>
							</div>
							{updateSuccess ? (
								<SuccessBox style={{ marginTop: 12 }}>
									{updateSuccess}
								</SuccessBox>
							) : null}
							{sendError ? (
								<ErrorBox style={{ marginTop: 12 }}>
									{sendError}
								</ErrorBox>
							) : null}
							{sendGateError ? (
								<ErrorBox style={{ marginTop: 12 }}>
									{sendGateError}
								</ErrorBox>
							) : null}
						</form>
					) : (
						<form id="verify-code-form" action={verifyAction} onSubmit={handleVerifySubmit} noValidate style={{ width: "100%", maxWidth: 420, textAlign: "left", margin: "0 auto" }}>
							{/* Code input replaces phone field */}
							<TextFieldNoAutocomplete name="code" label="Verification code" placeholder="Enter code" inputMode="numeric" pattern="^\\d{4,8}$" maxLength={8} error={codeError} value={codeInput} onChange={(e) => setCodeInput(e.currentTarget.value)} required />
							{/* Hidden inputs for actions */}
							<input type="hidden" name="phone" value={currentPhone ?? ""} />
							<input type="hidden" name="phone_local" value={formatLocalFromE164(currentPhone)} />
							<input type="hidden" name="contact_id" value={contactId ?? ""} />
							<input type="hidden" name="deal_id" value={dealId ?? ""} />
							<input type="hidden" name="property_id" value={propertyId ?? ""} />
							<input type="hidden" name="user_id" value={userId ?? ""} />

							{/* Info and expiry moved below actions to align with send error position */}

							<div style={{ ...actionsStyle }}>
								<button className="button-secondary button-secondary--outlined" type="button" style={{ width: "50%" }} onClick={handleBackToPhoneClick}>Back to phone</button>
								{codeExpired ? (
									<button className="button-primary button-primary--outlined" type="submit" formNoValidate formAction={sendAction as any} onClick={handleResendClick} style={{ width: "50%" }}>Resend code</button>
								) : (
									<button className="button-primary button-primary--outlined" type="button" style={{ width: "50%" }} disabled aria-disabled>Code sent</button>
								)}
							</div>
							{/* Info and expiry placed under the buttons */}
							{isCodeSent && (
								remainingSeconds > 0 ? (
									<InfoBox style={{ marginTop: 12 }}>
										Verification code expires in {remainingSeconds}s
									</InfoBox>
								) : codeExpired ? (
									<WarningBox style={{ marginTop: 12 }}>
										Code has expired. Please request a new one.
									</WarningBox>
								) : (
									<InfoBox style={{ marginTop: 12 }}>
										Verification code sent
									</InfoBox>
								)
							)}
							{/* Footer moved outside to keep consistent positioning */}
						</form>
					)
				) : (
					<form id="update-phone-form" action={updateAction} noValidate style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
						<input type="hidden" name="contact_id" value={contactId ?? ""} />
						<AuPhoneField name="phone" label="New Phone Number" defaultValue={currentPhone} required error={phoneError} />
						<div style={{ ...actionsStyle }}>
							<button className="button-secondary button-secondary--outlined" type="button" style={{ width: "50%" }} onClick={handleCancelEditClick}>Cancel</button>
							<button className="button-primary button-primary--outlined" type="submit" style={{ width: "50%" }}>Update number</button>
						</div>
					</form>
				)}
			<div style={footerStyle}>
				<PreviousButton href={prevHref} />
				{isCodeSent ? (
					<NextButton label="Verify phone" form="verify-code-form" />
				) : (
					<NextButton label="Verify phone" form="verify-code-form" onClick={handleVerifyPhoneClick} />
				)}
			</div>
		</>
	);
}

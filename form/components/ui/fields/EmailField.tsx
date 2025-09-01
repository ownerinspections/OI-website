import TextField from "./TextField";

type EmailFieldProps = {
	name: string;
	label?: string;
	defaultValue?: string;
	value?: string;
	error?: string;
	required?: boolean;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

export default function EmailField({ name, label = "Email", defaultValue, value, error, required, onChange }: EmailFieldProps) {
	return (
		<TextField
			name={name}
			label={label}
			defaultValue={value === undefined ? defaultValue : undefined}
			value={value}
			onChange={onChange}
			type="email"
			autoComplete="email"
			inputMode="email"
			error={error}
			required={required}
		/>
	);
}

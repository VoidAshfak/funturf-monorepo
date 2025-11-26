import ErrorTooltip from "./ErrorTooltip";

export default function InputField({ children, errors }) {
    const name = children.props.name;

    const fieldError = name ? name.split('.').reduce((acc, key) => acc?.[key], errors) : null;

    return (
        <div className="relative">
            {children}
            {fieldError && (
                <span className="absolute top-1/2 -translate-y-1/2 right-3">
                    <ErrorTooltip message={fieldError?.message} />
                </span>
            )}
        </div>
    )
}
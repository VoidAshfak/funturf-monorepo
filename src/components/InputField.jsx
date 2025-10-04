import ErrorTooltip from "./ErrorTooltip";

export default function InputField({ children, errors }) {
    const name = children.props.name;
    return (
        <div className="relative">
            {children}
            {errors?.[name] && (
                <span className="absolute top-1/2 -translate-y-1/2 right-3">
                    <ErrorTooltip message={errors?.[name]?.message} />
                </span>
            )}
        </div>
    )
}
type BrandMarkProps = {
  className?: string;
  label?: string;
};

export function BrandMark({ className = "", label = "My Little Company" }: BrandMarkProps) {
  return (
    <span aria-label={label} className={`mlc-mark ${className}`} role="img">
      <span className="mlc-fragment mlc-fragment-north-west" />
      <span className="mlc-fragment mlc-fragment-north-east" />
      <span className="mlc-fragment mlc-fragment-south-west" />
      <span className="mlc-fragment mlc-fragment-south-east" />
    </span>
  );
}

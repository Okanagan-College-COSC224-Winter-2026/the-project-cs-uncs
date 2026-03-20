type HeaderTitleProps = {
  title?: string | null;
  loading?: boolean;
  fallback?: string;
};

export default function HeaderTitle(props: HeaderTitleProps) {
  const loading = Boolean(props.loading);
  const fallback = props.fallback ?? '';

  const resolvedTitle = (props.title ?? '').trim();
  const displayText = loading ? 'Loading…' : (resolvedTitle || fallback);

  return <span className={loading ? 'HeaderTitle HeaderTitle--loading' : 'HeaderTitle'}>{displayText}</span>;
}

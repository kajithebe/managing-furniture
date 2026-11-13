export default function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  const classes = ['rounded-card border border-line bg-surface p-5', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
// "Chair MP-00126, Chair MP-00127": item names with the code in the code font (S9 pop-up, S10).
export default function ItemNames({ items }) {
  return items.map((item, index) => (
    <span key={item.id}>
      {index > 0 && ', '}
      {item.name} <span className="font-mono">{item.code}</span>
    </span>
  ));
}

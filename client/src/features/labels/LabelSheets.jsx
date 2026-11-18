// A4 label sheets for M8 "Print labels". The same sheets are the preview on screen and what
// gets printed: on paper each sheet is exactly 210 × 297 mm, one sheet per page.
// Every size inside a sheet is in cqw (1 % of the sheet's width), so a sheet looks the same
// small in the preview card and at 210 mm on paper.

// Layout per "Labels per sheet" option: columns × rows, QR size and text sizes.
// A sheet is 141.4cqw high (297 / 210). Minus 8cqw padding and the 1cqw gaps, one row is
// 15.8cqw high with 8 rows, 21.4cqw with 6 rows and 32.6cqw with 4 rows; the QR is the row
// height minus the label's padding.
const LAYOUTS = {
  items: {
    24: { cols: 3, rows: 8, qr: '13cqw', code: '1.9cqw', text: '1.4cqw' },
    12: { cols: 2, rows: 6, qr: '18.5cqw', code: '2.8cqw', text: '2cqw' },
  },
  rooms: {
    12: { cols: 2, rows: 6, qr: '18.5cqw', name: '4.2cqw', text: '1.6cqw' },
    4: { cols: 1, rows: 4, qr: '29.5cqw', name: '8cqw', text: '3cqw' },
  },
};

// [a, b, c, d, e] with 2 per sheet → [[a, b], [c, d], [e]]
function toSheets(labels, perSheet) {
  const sheets = [];
  for (let start = 0; start < labels.length; start += perSheet) {
    sheets.push(labels.slice(start, start + perSheet));
  }
  return sheets;
}

// QR left, text right.
function LabelBox({ qrImage, alt, size, children }) {
  return (
    <div className="flex min-h-0 items-center gap-[1.5cqw] overflow-hidden rounded-[0.5cqw] border border-line p-[1cqw]">
      <img src={qrImage} alt={alt} className="shrink-0" style={{ width: size, height: size }} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// M8 item label: "MP-00123", "Chair", "Home: D569"
function ItemLabel({ label, layout }) {
  return (
    <LabelBox qrImage={label.qrImage} alt={`QR code for ${label.code}`} size={layout.qr}>
      <p className="font-mono font-semibold text-ink" style={{ fontSize: layout.code }}>
        {label.code}
      </p>
      <p className="truncate text-muted" style={{ fontSize: layout.text }}>
        {label.name}
      </p>
      <p className="truncate text-muted" style={{ fontSize: layout.text }}>
        Home: {label.homeRoom.name}
      </p>
    </LabelBox>
  );
}

// M8 room door label: "D569", "Karaportti · Building D"
function RoomLabel({ label, layout }) {
  return (
    <LabelBox qrImage={label.qrImage} alt={`QR code for room ${label.name}`} size={layout.qr}>
      <p className="truncate font-mono font-semibold text-ink" style={{ fontSize: layout.name }}>
        {label.name}
      </p>
      <p className="truncate text-muted" style={{ fontSize: layout.text }}>
        {label.campus.name} · Building {label.building.name}
      </p>
    </LabelBox>
  );
}

function Sheet({ type, labels, layout }) {
  const Label = type === 'items' ? ItemLabel : RoomLabel;

  return (
    // The sheet is the size container for the cqw units inside it.
    <div
      className="aspect-[210/297] w-full border border-line bg-surface print:h-[297mm] print:w-[210mm] print:break-inside-avoid print:border-0 print:[&:not(:last-child)]:break-after-page"
      style={{ containerType: 'inline-size' }}
    >
      <div
        className="grid h-full gap-[1cqw] p-[4cqw]"
        style={{
          gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
        }}
      >
        {labels.map((label) => (
          <Label key={type === 'items' ? label.code : label.id} label={label} layout={layout} />
        ))}
      </div>
    </div>
  );
}

// One A4 sheet per `perSheet` labels; an empty sheet while nothing is selected.
export default function LabelSheets({ type, labels, perSheet }) {
  const layout = LAYOUTS[type][perSheet];
  const sheets = labels.length > 0 ? toSheets(labels, perSheet) : [[]];

  return (
    <div className="flex flex-col gap-4 print:block">
      {sheets.map((sheetLabels, index) => (
        <Sheet key={index} type={type} labels={sheetLabels} layout={layout} />
      ))}
    </div>
  );
}

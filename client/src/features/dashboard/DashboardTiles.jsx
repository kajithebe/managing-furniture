import Tile from '../../components/ui/Tile.jsx';

// "9,812" as on M1.
const numberFormat = new Intl.NumberFormat('en-US');

// The four M1 number tiles. Each tile opens the list it counts (01 › Dashboard).
// TODO(MF-28): the Items page reads ?status= from the URL, so "On loan now" opens the
// filtered list (needs team agreement with Abhinav).
const TILES = [
  { key: 'waitingForApproval', label: 'Waiting for approval', to: '/mod/requests' },
  { key: 'notYetReturned', label: 'Not yet returned', to: '/mod/overdue' },
  { key: 'onLoanNow', label: 'On loan now', to: '/mod/items?status=ON_LOAN' },
  { key: 'totalItems', label: 'Total items', to: '/mod/items' },
];

export default function DashboardTiles({ tiles }) {
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {TILES.map((tile) => (
        <li key={tile.key}>
          <Tile label={tile.label} value={numberFormat.format(tiles[tile.key])} to={tile.to} />
        </li>
      ))}
    </ul>
  );
}

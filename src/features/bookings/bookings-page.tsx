import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search } from 'lucide-react';

const BOOKINGS = [
  { id: 'BK-00421', guest: { firstName: 'Marco', lastName: 'Rossi' }, property: 'Villa Serena', checkIn: '2025-06-12', checkOut: '2025-06-18', nights: 6, total: 1500, status: 'confirmed', platform: 'Airbnb' },
  { id: 'BK-00422', guest: { firstName: 'Anna', lastName: 'Bianchi' }, property: 'Casa Blu', checkIn: '2025-06-20', checkOut: '2025-06-25', nights: 5, total: 975, status: 'pending', platform: 'Booking.com' },
  { id: 'BK-00423', guest: { firstName: 'Luca', lastName: 'Ferrari' }, property: 'Apt Roma Centro', checkIn: '2025-06-22', checkOut: '2025-06-26', nights: 4, total: 480, status: 'checked-in', platform: 'Direct' },
  { id: 'BK-00420', guest: { firstName: 'Sofia', lastName: 'Greco' }, property: 'Villa Serena', checkIn: '2025-06-01', checkOut: '2025-06-07', nights: 6, total: 1500, status: 'checked-out', platform: 'Airbnb' },
  { id: 'BK-00419', guest: { firstName: 'Paolo', lastName: 'Conti' }, property: 'Palazzo Venezia', checkIn: '2025-05-20', checkOut: '2025-05-24', nights: 4, total: 1280, status: 'confirmed', platform: 'VRBO' },
  { id: 'BK-00418', guest: { firstName: 'Elena', lastName: 'Ricci' }, property: 'Trullo Alberobello', checkIn: '2025-05-10', checkOut: '2025-05-14', nights: 4, total: 640, status: 'cancelled', platform: 'Expedia' },
];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  confirmed: 'default',
  pending: 'secondary',
  'checked-in': 'outline',
  'checked-out': 'outline',
  cancelled: 'destructive',
};

const TABS = ['all', 'confirmed', 'pending', 'checked-in', 'checked-out', 'cancelled'];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Booking = typeof BOOKINGS[number];

function BookingDetail({ booking, onBack }: { booking: Booking; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{booking.id}</h2>
          <p className="text-sm text-muted-foreground">{booking.platform}</p>
        </div>
        <div className="ml-auto">
          <Badge variant={STATUS_VARIANT[booking.status] ?? 'secondary'} className="capitalize">
            {booking.status}
          </Badge>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Guest Information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{booking.guest.firstName} {booking.guest.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium">{booking.platform}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Booking Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Property</span>
              <span className="font-medium">{booking.property}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Check-in</span>
              <span className="font-medium">{formatDate(booking.checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Check-out</span>
              <span className="font-medium">{formatDate(booking.checkOut)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nights</span>
              <span className="font-medium">{booking.nights}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Total</span>
              <span className="font-bold text-primary">€{booking.total.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function BookingsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Booking | null>(null);

  const filtered = BOOKINGS.filter((b) => {
    const matchesTab = activeTab === 'all' || b.status === activeTab;
    const matchesSearch =
      search === '' ||
      `${b.guest.firstName} ${b.guest.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      b.property.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Bookings" description="Manage all your property bookings" />

        {selected ? (
          <BookingDetail booking={selected} onBack={() => setSelected(null)} />
        ) : (
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* Tabs */}
              <div className="flex flex-wrap gap-1 border-b pb-3">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                      activeTab === tab
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bookings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {['ID', 'Guest', 'Property', 'Check-in', 'Check-out', 'Nights', 'Total', 'Platform', 'Status', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr
                        key={b.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelected(b)}
                      >
                        <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
                        <td className="px-4 py-3 font-medium">{b.guest.firstName} {b.guest.lastName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.property}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(b.checkIn)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(b.checkOut)}</td>
                        <td className="px-4 py-3 text-center">{b.nights}</td>
                        <td className="px-4 py-3 font-medium">€{b.total.toLocaleString()}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.platform}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'} className="capitalize">
                            {b.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(b); }}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                          No bookings found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

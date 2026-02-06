const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://medpqabiozetwuphwygz.supabase.co',
  'sb_publishable_g_crEMcNsvLF9Q6gPwsSJw_ySwd9vlt'
);

(async () => {
  const { data: snapshots, error } = await supabase
    .from('review_snapshots')
    .select('hotel_id, fetched_at, platform, rating')
    .order('fetched_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!snapshots || snapshots.length === 0) {
    console.log('No snapshots found');
    return;
  }

  // Group by hotel
  const byHotel = {};
  snapshots.forEach(s => {
    if (!byHotel[s.hotel_id]) byHotel[s.hotel_id] = [];
    byHotel[s.hotel_id].push(s);
  });

  console.log('Hotel snapshots summary:\n');
  Object.keys(byHotel).forEach(hotelId => {
    const snaps = byHotel[hotelId];
    const uniqueDates = [...new Set(snaps.map(s => s.fetched_at.split('T')[0]))];
    console.log(`Hotel ${hotelId.substring(0, 8)}...`);
    console.log(`  Total snapshots: ${snaps.length}`);
    console.log(`  Unique dates: ${uniqueDates.length}`);
    console.log(`  Oldest: ${snaps[snaps.length - 1].fetched_at}`);
    console.log(`  Newest: ${snaps[0].fetched_at}`);
    console.log('');
  });

  console.log('\n=== Current Issue ===');
  console.log('All snapshots are from TODAY (same date)');
  console.log('The time filters (7d, 30d, 90d) will show the same data');
  console.log('because there is no historical data spanning multiple days.\n');

  console.log('=== Solution: Create Test Data ===');
  console.log('We can create snapshots with backdated timestamps to test the filters.');

  process.exit(0);
})();

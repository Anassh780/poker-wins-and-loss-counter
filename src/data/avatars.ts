export interface AvatarItem {
  id: string;
  url: string;
  name: string;
  category: string;
}

export const AVATAR_CATEGORIES = ['Sci-Fi & Cyber', 'Supercars', 'Organic Wildlife', 'Hollywood & People', 'Landscapes & Travel'];

// High-resolution reliable photos
export const AVATARS: AvatarItem[] = [
  // ── Sci-Fi & Cyber ──
  { id: 'sf1', name: 'Iron Man Mark V', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?w=300&h=300&fit=crop' },
  { id: 'sf2', name: 'Iron Core', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1608889175250-c3b0c1667d3a?w=300&h=300&fit=crop' },
  { id: 'sf3', name: 'Cyberpunk Helmet', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=300&h=300&fit=crop' },
  { id: 'sf4', name: 'Darth Vader', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1546561892-65bf811416b9?w=300&h=300&fit=crop' },
  { id: 'sf5', name: 'Stormtrooper', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1478479405421-ce83c92fb3ba?w=300&h=300&fit=crop' },
  { id: 'sf6', name: 'Neon Glitch', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&h=300&fit=crop' },
  { id: 'sf7', name: 'Matrix Hacker', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&h=300&fit=crop' },
  { id: 'sf8', name: 'Space Explorer', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1614729939124-032f0b5609ce?w=300&h=300&fit=crop' },
  { id: 'sf9', name: 'Cyborg Eye', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=300&h=300&fit=crop' },
  { id: 'sf10', name: 'Robotics', category: 'Sci-Fi & Cyber', url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=300&h=300&fit=crop' },

  // ── Hollywood & People ──
  { id: 'p1', name: 'Agent', category: 'Hollywood & People', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop' },
  { id: 'p2', name: 'Starlet', category: 'Hollywood & People', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop' },
  { id: 'p3', name: 'Maverick', category: 'Hollywood & People', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop' },
  { id: 'p4', name: 'Hitman', category: 'Hollywood & People', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop' },
  { id: 'p5', name: 'Heroine', category: 'Hollywood & People', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop' },
  { id: 'p6', name: 'Cinematic', category: 'Hollywood & People', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop' },
  { id: 'p7', name: 'Director', category: 'Hollywood & People', url: 'https://images.unsplash.com/photo-1504257432389-523431e15ce5?w=300&h=300&fit=crop' },
  { id: 'p8', name: 'Rogue', category: 'Hollywood & People', url: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=300&h=300&fit=crop' },

  // ── Supercars ──
  { id: 'c1', name: 'Porsche 911', category: 'Supercars', url: 'https://images.unsplash.com/photo-1503376760367-115f8a000494?w=300&h=300&fit=crop' },
  { id: 'c2', name: 'Ferrari Red', category: 'Supercars', url: 'https://images.unsplash.com/photo-1583121274945-8120d9fce173?w=300&h=300&fit=crop' },
  { id: 'c3', name: 'Lambo V12', category: 'Supercars', url: 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=300&h=300&fit=crop' },
  { id: 'c4', name: 'McLaren', category: 'Supercars', url: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=300&h=300&fit=crop' },
  { id: 'c5', name: 'Aston Martin', category: 'Supercars', url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=300&h=300&fit=crop' },
  { id: 'c6', name: 'Mustang GT', category: 'Supercars', url: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=300&h=300&fit=crop' },
  { id: 'c7', name: 'Audi R8', category: 'Supercars', url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=300&h=300&fit=crop' },
  { id: 'c8', name: 'Nissan GTR', category: 'Supercars', url: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=300&h=300&fit=crop' },

  // ── Organic Wildlife ──
  { id: 'w1', name: 'Bengal Tiger', category: 'Organic Wildlife', url: 'https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=300&h=300&fit=crop' },
  { id: 'w2', name: 'Alpha Lion', category: 'Organic Wildlife', url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=300&h=300&fit=crop' },
  { id: 'w3', name: 'Bald Eagle', category: 'Organic Wildlife', url: 'https://images.unsplash.com/photo-1611002214172-792c1f90b59a?w=300&h=300&fit=crop' },
  { id: 'w4', name: 'White Wolf', category: 'Organic Wildlife', url: 'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=300&h=300&fit=crop' },
  { id: 'w5', name: 'Great White', category: 'Organic Wildlife', url: 'https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=300&h=300&fit=crop' },
  { id: 'w6', name: 'Black Panther', category: 'Organic Wildlife', url: 'https://images.unsplash.com/photo-1610884814349-f53ebdbbf3e4?w=300&h=300&fit=crop' },
  { id: 'w7', name: 'Wild Elephant', category: 'Organic Wildlife', url: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=300&h=300&fit=crop' },
  { id: 'w8', name: 'Cobra', category: 'Organic Wildlife', url: 'https://images.unsplash.com/photo-1534360662234-bc2c80cda0df?w=300&h=300&fit=crop' },

  // ── Landscapes & Travel ──
  { id: 'l1', name: 'Neon City', category: 'Landscapes & Travel', url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=300&h=300&fit=crop' },
  { id: 'l2', name: 'Glacier', category: 'Landscapes & Travel', url: 'https://images.unsplash.com/photo-1518457607834-6e8d80c183c5?w=300&h=300&fit=crop' },
  { id: 'l3', name: 'Desert Dunes', category: 'Landscapes & Travel', url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=300&h=300&fit=crop' },
  { id: 'l4', name: 'Deep Space', category: 'Landscapes & Travel', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=300&h=300&fit=crop' },
  { id: 'l7', name: 'Volcano Core', category: 'Landscapes & Travel', url: 'https://images.unsplash.com/photo-1481261314995-188b896dfa26?w=300&h=300&fit=crop' },
  { id: 'l8', name: 'Tokyo Street', category: 'Landscapes & Travel', url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=300&h=300&fit=crop' },
  { id: 'l9', name: 'Aurora', category: 'Landscapes & Travel', url: 'https://images.unsplash.com/photo-1531366936337-77cf5e08ca1a?w=300&h=300&fit=crop' },
];

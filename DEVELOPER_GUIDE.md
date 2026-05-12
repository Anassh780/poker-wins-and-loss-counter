# CyberTrack Premium - Developer Guide

## 🏗️ Architecture Overview

### Component Structure
```
App (Main State Manager)
├── Setup Screen
│   └── Player count selection
├── Game Screen
│   ├── PlayerSetup (Add/Edit players)
│   ├── Leaderboard (Main visual element)
│   ├── PlayerControls (Win/Loss buttons)
│   └── PlayerCard (Individual stats grid)
└── Result Screen
    ├── ResultCard (Beautiful result display)
    └── Export/Share Buttons

```

### Data Flow
```
User Action (Click Button)
    ↓
State Update (useState)
    ↓
Player Data Modified
    ↓
Save to localStorage
    ↓
Component Re-render
    ↓
UI Updates (Animations)
```

## 📁 Project Structure

### `/src/types/index.ts`
TypeScript interfaces for type safety:
- `Player`: Individual player data
- `GameSession`: Session management
- `MatchResult`: Game outcome tracking
- `ApiResponse`: Standardized API responses

### `/src/components/`
React components (all functional):

**PlayerCard.tsx**
- Display individual player statistics
- Props: player, rank, showActions, callbacks
- Features: Rank badge, win rate bar, stats display

**Leaderboard.tsx**
- Main competitive ranking display
- Props: players, sortBy
- Features: Sort buttons, animations, responsive grid

**ResultCard.tsx**
- Beautiful match end summary
- Props: players, winner, duration
- Features: Winner spotlight, top 3 rankings, medal badges

**PlayerSetup.tsx**
- Add/edit player information
- Props: onAddPlayer, initialPlayer, isEditing
- Features: Avatar upload, form validation, image preview

**PlayerControls.tsx**
- Quick action buttons for game management
- Props: players, action callbacks
- Features: Win/Loss buttons, Edit/Delete, Reset

### `/src/utils/`

**imageExport.ts**
- Client-side image export functions
- `downloadImage()`: Save as PNG
- `copyToClipboard()`: Copy to clipboard
- `shareToWhatsApp()`: WhatsApp share link
- Helper functions for formatting and styling

**api.ts**
- API calls for backend integration (optional)
- Session management
- Player statistics
- Leaderboard queries
- Fallback localStorage sync

### `/src/App.tsx`
Main application component handling:
- View state management (setup/game/result)
- Player data management
- Game session tracking
- Event handlers for all actions

## 🎨 Styling System

### Tailwind Configuration
Colors (in `tailwind.config.js`):
```js
cyberpunk: {
  dark: '#0a0e27',
  darker: '#050a15',
  accent: '#00d9ff',      // Cyan
  accent2: '#ff006e',     // Pink
  accent3: '#8338ec',     // Purple
  accent4: '#ffbe0b',     // Yellow
}
```

### Custom CSS Classes
- `.glass`: Frosted glass effect
- `.glow-cyan`, `.glow-pink`, `.glow-purple`: Neon glows
- `.gradient-text`: Multicolor text gradient
- `.animate-glow`, `.animate-slide-in`: Animations

### Responsive Breakpoints
- **Mobile**: Default (< 640px)
- **Tablet**: `md:` (640px - 1024px)
- **Desktop**: `lg:` (1024px+)

## 🔄 State Management

### useState Hooks Used
```tsx
// App.tsx
const [view, setView] = useState<View>('setup')           // All: 'setup' | 'game' | 'result'
const [playerCount, setPlayerCount] = useState<number>(2) // Num of players
const [players, setPlayers] = useState<Player[]>([])      // Player array
const [editingPlayer, setEditingPlayer] = useState(null)  // Editing form data
const [showPlayerSetup, setShowPlayerSetup] = useState()  // Show/hide setup form
const [sessionStartTime, setSessionStartTime] = useState() // Game start time
const [winner, setWinner] = useState<Player | null>(null) // Match winner
```

### Local Storage
```tsx
// Save on change
useEffect(() => {
  localStorage.setItem('cybertrack-players', JSON.stringify(players))
}, [players])

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('cybertrack-players')
  if (saved) setPlayers(JSON.parse(saved))
}, [])
```

## 🎯 Key Functions

### Player Management
```tsx
// Add new player
handleAddPlayer(playerData) → Creates new Player object → Updates state

// Update player
handleEditPlayer(player) → Sets editingPlayer → Shows form with data

// Delete player
handleDeletePlayer(playerId) → Filters players array

// Reset player stats
handleResetStats(playerId?) → Sets wins/losses to 0
```

### Game Actions
```tsx
// Log win
handleAddWin(playerId) → Increments wins → Updates leaderboard

// Log loss  
handleAddLoss(playerId) → Increments losses → Updates leaderboard

// End game
handleEndGame() → Sorts players → Shows result card

// New game
handleResetGame() → Clears state → Goes to setup screen
```

### Utilities
```tsx
// Calculate win percentage
calculateWinRate(wins, losses) → Number (0-100)

// Get rank badge emoji
getRankBadge(rank) → String ('👑' | '⭐' | '✨' | '•')

// Export result card
downloadImage(elementId, filename) → PNG download

// Copy to clipboard
copyToClipboard(elementId) → Blob copy

// Share to WhatsApp
shareToWhatsApp(text) → Opens WhatsApp web
```

## 🚀 Building & Deployment

### Development
```bash
npm run dev        # Local dev server with hot reload
```

### Production Build
```bash
npm run build      # Optimized production build
npm run preview    # Test production build locally
```

### Build Output
```
dist/
├── index.html     # Entry point
├── assets/
│   ├── index-*.js
│   └── index-*.css
└── ...
```

## 🔧 Configuration Files

### `vite.config.ts`
- React plugin for HMR
- Build optimization settings

### `tailwind.config.js`
- Color palette customization
- Custom animations/effects
- Typography settings

### `tsconfig.json`
- TypeScript compilation settings
- Module resolution
- Strict type checking

### `package.json`
- Dependencies management
- Build scripts
- Project metadata

## 📦 Dependencies

### Core
- `react@^19.2.4`: UI framework
- `react-dom@^19.2.4`: DOM rendering

### Styling
- `tailwindcss@^3.4.0`: CSS utility framework
- `postcss@^8.4.33`: CSS processing
- `autoprefixer@^10.4.17`: Vendor prefixes

### Features
- `html2canvas@^1.4.1`: Image export
- `axios@^1.6.0`: HTTP client (for API)
- `date-fns@^3.0.0`: Date formatting

### Dev Tools
- `typescript@~6.0.2`: Type checking
- `vite@^8.0.4`: Build tool
- `eslint@^9.39.4`: Code linting

## 🧩 Adding New Features

### Add a New Component
1. Create file in `src/components/MyComponent.tsx`
2. Use TypeScript interfaces from `src/types/`
3. Style with Tailwind classes
4. Export from `src/components/index.ts`
5. Import and use in App.tsx

Example:
```tsx
// src/components/Toast.tsx
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
}

export const Toast: React.FC<ToastProps> = ({ message, type }) => {
  return (
    <div className={`glass-dark p-4 ${type === 'error' ? 'glow-pink' : 'glow-cyan'}`}>
      {message}
    </div>
  );
};
```

### Add a New Utility
1. Create file in `src/utils/myUtil.ts`
2. Export named functions
3. Add TypeScript types
4. Import in components

Example:
```tsx
// src/utils/analytics.ts
export const trackEvent = (eventName: string, data?: any) => {
  console.log(`Event: ${eventName}`, data);
  // Send to analytics service
};
```

### Add API Integration
1. Create endpoints in `src/utils/api.ts`
2. Update `.env` with API_URL
3. Add error handling
4. Use in components with try/catch

Example:
```tsx
// src/utils/api.ts
export const fetchLeaderboard = async () => {
  const response = await api.get('/leaderboard');
  return response.data.data;
};

// In component
const [leaderboard, setLeaderboard] = useState([]);

useEffect(() => {
  fetchLeaderboard().then(setLeaderboard).catch(console.error);
}, []);
```

## 🐛 Debugging Tips

### Check Browser Console
- `F12` or `Cmd+Option+I`
- View errors and warnings
- Check network tab for API calls

### React DevTools
- Install React DevTools browser extension
- Inspect component hierarchy
- Check props and state

### Tailwind IntelliSense
- Install Tailwind CSS IntelliSense VS Code extension
- Get class name suggestions
- Hover for documentation

### Testing Components
```tsx
// Add temporary debug info
console.log('Players:', players);
console.log('SortedPlayers:', sortedPlayers);
console.log('SessionDuration:', sessionDuration);

// Temporarily remove functions to isolate issues
// onClick={() => console.log('clicked')}
```

## 📊 Performance Optimization

### Already Implemented
- React.FC for component typing
- Proper key usage in lists
- Memoization in calculations
- Local storage caching
- CSS animations (GPU accelerated)

### Potential Improvements
- Add React.memo for expensive components
- Implement useMemo for heavy calculations
- Lazy load images
- Code splitting for large features
- Service Workers for offline support

## 🔐 Security Considerations

### Current Features
- Local storage only (no sensitive data)
- Client-side image processing
- No authentication required

### Future Improvements
- Implement backend authentication
- Validate user inputs server-side
- Add CORS protection
- Encrypt sensitive data
- Add rate limiting

## 📱 Mobile Optimization

### Responsive Design
- Mobile-first approach
- Flexible grid layouts
- Touch-friendly buttons (min 44px)
- Optimized font sizes

### Performance
- Minimal JS bundles
- Efficient re-renders
- Optimized images
- Smooth animations

## 🎊 Testing Checklist

### Feature Testing
- [ ] Add players with all 2-8 counts
- [ ] Upload various image formats
- [ ] Edit player names and avatars
- [ ] Log wins and losses
- [ ] Check leaderboard updates
- [ ] Sort by different metrics
- [ ] End game and view result card
- [ ] Export as image
- [ ] Download image
- [ ] Share to WhatsApp
- [ ] Reset stats
- [ ] Start new game

### UI Testing
- [ ] Desktop view (1920x1080)
- [ ] Tablet view (768x1024)
- [ ] Mobile view (375x667)
- [ ] Mobile landscape
- [ ] All browsers (Chrome, Safari, Firefox, Edge)

### Edge Cases
- [ ] No players added
- [ ] Single player
- [ ] All players with same stats
- [ ] Player with no avatar
- [ ] Very long player names
- [ ] Rapid wins/losses clicking
- [ ] Page refresh during game
- [ ] Browser storage full

## 📚 Additional Resources

- React Docs: https://react.dev
- TypeScript Docs: https://www.typescriptlang.org
- Tailwind CSS: https://tailwindcss.com
- Vite Docs: https://vitejs.dev
- html2canvas: https://html2canvas.hertzen.com

---

**Happy developing! If you create awesome features, share them! 🚀⚡**

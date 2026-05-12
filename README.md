# 🎮 CyberTrack Premium - Multiplayer Win/Loss Tracker

A premium cyberpunk-style multiplayer win/loss tracker web app with real-time leaderboards, beautiful result cards, and image export functionality.

## ✨ Features

### 🏆 Live Leaderboard
- **Always Visible**: Main visual centerpiece with continuous updates
- **Real-time Rankings**: Auto-updates as player stats change
- **Multiple Sort Options**: By wins, win rate, or total matches played
- **Top 3 Highlights**: Trophy badges with special visual effects for leaders
- **Animated Transitions**: Smooth rank changes and visual feedback
- **Responsive Design**: Works on desktop and mobile seamlessly

### 👥 Player Management
- **2-8 Player Matches**: Flexible player count selection
- **Avatar Uploads**: Drag & drop or click to upload player avatars
- **Player Editing**: Edit names and avatars anytime
- **Quick Actions**: One-click win/loss logging for each player
- **Profile Cards**: Individual stat cards with visual design

### 📊 Statistics Tracking
- **Win/Loss Records**: Track total wins and losses
- **Win Rate %**: Calculated win percentage
- **Match Count**: Total games played
- **Rank Position**: Real-time ranking updates
- **Performance Trends**: Visual indicators of player performance

### 📸 Result Cards & Export
- **Beautiful Result Cards**: Premium cyberpunk-designed match end summary
- **Copy as Image**: One-click copy to clipboard
- **Download PNG**: Save results to your device
- **WhatsApp Share**: Directly share results to WhatsApp
- **Social Media Ready**: Designed to look amazing when shared

### 🎨 Premium Cyberpunk Design
- **Dark Theme**: Beautiful dark cyberpunk aesthetic with neon accents
- **Glassmorphism**: Modern frosted glass effect panels
- **Neon Glow Effects**: Cyan, purple, and pink glowing elements
- **Smooth Animations**: Polished transitions and micro-interactions
- **Professional UI**: Competitive gaming platform aesthetic
- **Custom Typography**: High-tech digital fonts

### 💾 Data Persistence
- **Local Storage**: Player data saved to browser storage
- **Offline Support**: Works without internet connection
- **Session Management**: Continue games anytime
- **Reset Options**: Clear stats when needed

## 📋 How to Use

### Starting a Game
1. Open the app and select the number of players (2-8)
2. Add each player with their name and avatar
3. Start tracking wins and losses

### During Game
1. Use the quick action buttons to log wins/losses
2. Watch the live leaderboard update in real-time
3. View individual player stat cards
4. Edit player info anytime

### Ending a Game
1. Click "END GAME & Show Results"
2. View the beautiful result card
3. Export as image or share to WhatsApp
4. Continue playing or start a new game

## 🛠️ Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite**: Ultra-fast build tool
- **Tailwind CSS**: Utility-first styling with custom cyberpunk theme
- **html2canvas**: Client-side image export
- **Axios**: HTTP client for API calls

### Styling
- Custom Tailwind CSS theme with cyberpunk colors
- Neon glow effects and animations
- Responsive grid layouts
- Mobile-first design

### Features
- TypeScript for type safety
- Component-based architecture
- Custom hooks for state management
- Local storage for persistence
- Real-time UI updates

## 📦 Project Structure

```
swap/
├── src/
│   ├── types/           # TypeScript interfaces
│   ├── components/      # React components
│   │   ├── PlayerCard.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── ResultCard.tsx
│   │   ├── PlayerSetup.tsx
│   │   ├── PlayerControls.tsx
│   │   └── index.ts
│   ├── utils/          # Utility functions
│   │   ├── imageExport.ts
│   │   └── api.ts
│   ├── App.tsx         # Main app component
│   ├── index.css       # Global styles & Tailwind
│   └── main.tsx        # React entry point
├── public/             # Static assets
├── tailwind.config.js  # Tailwind configuration
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies

```

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

The app will open at `http://localhost:5173/`

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Linting
```bash
npm run lint
```

## 🎯 Key Screens

### 1. Setup Screen
- Player count selection (2-8)
- Features showcase
- Clean, professional entry point

### 2. Game Screen
- Left sidebar: Player setup and controls
- Center/Right: Dominant live leaderboard
- Below: Individual player stat cards
- Quick actions for wins/losses

### 3. Result Screen
- Beautiful result card with winner spotlight
- Top 3 rankings with medals
- Export and share buttons
- Option to continue or start new game

## 🎨 Design Features

### Cyberpunk Aesthetic
- Color Scheme: Dark blues, purples, pinks, cyans
- Effects: Glows, shadows, gradients
- Typography: Bold, digital-style fonts
- Layout: Clean, modern, competitive gaming vibe

### UI Elements
- **Glass Panels**: Frosted glass effect with transparency
- **Neon Borders**: Glowing borders with animations
- **Gradient Buttons**: Multi-color gradient backgrounds
- **Progress Bars**: Smooth animated win rate indicators
- **Rank Badges**: Special designs for top 3 players
- **Responsive Grid**: Auto-adjusting layout for all screen sizes

## 🎮 Player Actions

### Win/Loss Logging
- Click "+Win" or "+Loss" buttons
- Instant leaderboard update
- Visual feedback with smooth animations
- Stats immediately reflected

### Player Management
- Add/Edit/Delete players
- Upload custom avatars
- Edit player names
- Reset individual or all stats

### Game Controls
- Start new match
- End current session
- Export results
- Share results

## 📱 Responsive Design

### Desktop
- Full-width leaderboard view
- 3-4 player cards per row
- Persistent controls sidebar
- Optimal for 1080p+ displays

### Tablet
- Flexible 2-3 column layouts
- Touch-friendly buttons
- Adjusted font sizes
- Scrollable leaderboard

### Mobile
- Single column layout
- Large touch targets
- Vertical scrolling
- Optimized for small screens

## 🔄 Leaderboard Sorting

### Sort Options
1. **By Wins** (Default): Most competitive metric
2. **By Win Rate**: Percentage-based ranking
3. **By Matches**: Most active players first

### Dynamic Updates
- Real-time sorting after each action
- Smooth animation of rank changes
- Maintains visual hierarchy

## 📊 Statistics Display

### Player Stats
- Total Wins (green)
- Total Losses (red)
- Win Rate % (purple)
- Matches Played (gray)
- Current Rank (gold for top 3)

### Result Cards
- Winner spotlight with stats
- Full leaderboard ranking
- Top 3 player performance
- Session timestamp

## 🔐 Data Storage

### Local Storage
- Players data saved automatically
- No server required for offline use
- Data persists across sessions
- Easy to backup and restore

### Session Management
- Game session tracking
- Session duration calculation
- Match result history
- Persistent leaderboard

## 🎯 Future Enhancements

- Cloud sync & accounts
- Global leaderboards
- Tournament mode
- Statistics analytics
- Player profiles
- Achievement badges
- Custom themes
- Dark/Light mode toggle

## 📄 License

Built as a premium gaming analytics tool.

## 🚀 Performance

- **Fast Load Time**: Optimized Vite build
- **Smooth Animations**: 60fps transitions
- **Real-time Updates**: Instant leaderboard sync
- **Mobile Optimized**: Responsive at all breakpoints
- **Lightweight**: Minimal dependencies

## 💡 Tips

1. **Use Custom Avatars**: Upload team logos or player photos for visual appeal
2. **Check Win Rate**: Percentage matters! Win rate is often more meaningful than raw wins
3. **Share Results**: Export and share after important matches
4. **Reset Carefully**: Use reset after tournament ends to start fresh
5. **Mobile Friendly**: Works great on phones for tracking games anywhere

## 🎮 Game Scenarios

Perfect for:
- Esports tournaments
- Gaming team tracking
- Friendly competitions
- Sports leagues (scoreboard)
- Sales team competitions
- Fantasy league tracking
- Any multiplayer competitive activity

---

**Made with ⚡ CyberTrack Premium - Your Competitive Edge**
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

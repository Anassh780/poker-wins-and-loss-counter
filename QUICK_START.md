# CyberTrack Premium - Quick Start Guide

## 🚀 First Time Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

The app will be available at: **http://localhost:5173/**

## 🎮 First Game

### Step 1: Select Players
- Choose 2-8 players (2 players recommended for first try)
- Click the number button to start

### Step 2: Add Players
- Enter player names
- Optionally upload avatar images (JPG/PNG)
- Click "Add Player" for each person

### Step 3: Track Games
- Use **+Win** button to log a win
- Use **+Loss** button to log a loss
- Watch the leaderboard update in real-time!

### Step 4: End Game
- Click **"END GAME & Show Results"** when finished
- View the beautiful result card
- Export as image or share to WhatsApp

## 📊 Understanding the Leaderboard

### Main Display
```
🥇 Player Name  |  Wins  |  Losses  |  Win Rate  |  Games
```

### Sorting Options
- **Wins**: Sort by total wins (default)
- **Win Rate**: Sort by percentage (%)
- **Matches**: Sort by games played

### Color Coding
- 🥇 **Yellow**: #1 ranked player
- 🥈 **Silver**: #2 ranked player  
- 🥉 **Orange**: #3 ranked player
- **Cyan Glow**: Other players

## 🎨 UI Features

### Player Cards
- Avatar with initials fallback
- Win/Loss/Rate stats
- Win rate progress bar
- Rank badge

### Result Card
- Winner spotlight with stats
- Top 3 rankings with medals
- All player final stats
- Beautiful cyberpunk design

### Export Options
- 📋 **Copy as Image**: Copy to clipboard
- ⬇️ **Download Image**: Save as PNG file
- 💬 **Share to WhatsApp**: Direct share link

## 💡 Tips & Tricks

### 1. Use Custom Avatars
Upload player photos or team logos for visual impact

### 2. Track Win Rate
Win rate is often more important than raw wins
- 100% = Perfect record
- 50% = Even record  
- <33% = Struggling

### 3. Final Leaderboard
After each game, the final rankings persist
- Great for tournaments
- Easy to see seasonal records

### 4. Mobile Friendly
Works great on phones:
- Tap to add wins/losses
- Responsive leaderboard
- Full export functionality

### 5. Data Persistence
All data saved locally:
- Works offline
- Data survives page refresh
- Reset manually when needed

## 🎯 Keyboard Shortcuts

- **Enter** on player name: Submit player
- **Click avatar box**: Upload image
- **Quick buttons**: Win/Loss/Edit/Delete

## 🔄 Resetting

### Reset Single Player Stats
- Click ⟲ in player controls
- Confirm reset

### Reset All Stats  
- Click "⟲ Reset All Stats"
- Confirm to clear all stats

### Start New Game
- Click "← New Game"
- Select new player count
- Add players again

## 📱 Mobile Tips

1. **Landscape Mode**: Better for leaderboard view
2. **Tap Buttons**: All buttons are touch-friendly
3. **Scroll Down**: See individual player cards
4. **Share on Mobile**: WhatsApp share opens app directly

## 🎮 Common Scenarios

### Tournament Mode
1. Set player count (for tournament bracket)
2. Track wins/losses for each match
3. Export final results
4. Share on social media

### Team Practice
1. Daily tracking of team performance
2. Individual player stats
3. Team win rate improvements
4. Motivation through leaderboards

### Friendly Competition
1. Quick setup, start tracking
2. Real-time updates
3. Fun visual design
4. Easy result sharing

## ⚙️ Settings

### Themes
- Default: Premium Cyberpunk Dark
- (Light mode coming soon)

### Display
- Auto-responsive to screen size
- Desktop: 3-4 column grid
- Mobile: Single column

## 🆘 Troubleshooting

### Data Not Saving
- Check browser's local storage is enabled
- Clear cache if having issues
- Try incognito/private mode

### Images Not Uploading
- Check file format (JPG/PNG)
- Ensure file size < 5MB
- Try different image

### Leaderboard Not Updating
- Refresh page
- Check for browser errors (F12)
- Try clearing browser cache

### Export Not Working
- Ensure pop-ups not blocked
- Check browser permissions
- Try different browser

## 🌐 Browser Support

Works best on:
- Chrome/Chromium ✅
- Firefox ✅  
- Safari ✅
- Edge ✅
- Mobile browsers ✅

## 💾 Data Management

### Local Storage
- Stores player data
- ~50KB per game session
- Multiple games supported
- Manual reset only

### Exporting Data
- Result cards as PNG
- Share via WhatsApp
- Download to device

## 🎨 Customization

### Add Your Logo
- Edit `src/App.tsx` line with "⚡ CYBERTRACK ⚡"
- Or add custom image

### Change Colors
- Edit `tailwind.config.js`
- Modify `cyberpunk` colors
- Rebuild with `npm run build`

## 📈 Future Features

- Player accounts & profiles
- Global leaderboards
- Tournament brackets
- Advanced analytics
- Mobile app (iOS/Android)

## 🤝 Support

For issues or suggestions:
1. Check this guide first
2. Try clearing browser cache
3. Report bugs with details
4. Request features anytime

---

**Enjoy tracking your wins and losses with CyberTrack Premium! ⚡🎮**

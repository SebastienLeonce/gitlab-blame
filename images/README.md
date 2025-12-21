# Images Folder

This folder contains visual assets for the VS Code Marketplace listing.

## Required Images

### 1. screenshot-hover.png
**Purpose**: Show the git blame hover with MR/PR link
**Requirements**:
- Screenshot of VS Code with hover tooltip visible
- Should show:
  - Blame information (author, date, message, SHA)
  - Clickable MR/PR link (e.g., "View Merge Request #123")
  - Clear, readable text
- Recommended size: 800x600 or larger
- Format: PNG with good compression

**How to create**:
1. Open VS Code with extension installed
2. Open a file in a GitLab or GitHub repository
3. Hover over a line that has an associated MR/PR
4. Take screenshot when hover tooltip appears
5. Crop to focus on the hover tooltip
6. Save as `screenshot-hover.png`

### 2. demo.gif
**Purpose**: Animated demo of the extension in action
**Requirements**:
- Show complete workflow:
  1. Hover over line
  2. See MR/PR link appear
  3. Click link
  4. Browser opens to MR/PR page
- Duration: 5-10 seconds
- Size: Keep under 5MB for marketplace
- Format: GIF or MP4 (GIF preferred for marketplace)

**How to create**:
1. Use screen recording tool (e.g., LICEcap, ScreenToGif, Kap)
2. Record the workflow described above
3. Keep recording short and focused
4. Export as GIF
5. Optimize file size if needed
6. Save as `demo.gif`

## Tools

**Screenshot tools**:
- macOS: Cmd+Shift+4 (native)
- Windows: Snipping Tool / Snip & Sketch
- Linux: GNOME Screenshot / Flameshot

**GIF recording tools**:
- [LICEcap](https://www.cockos.com/licecap/) (Windows/macOS)
- [ScreenToGif](https://www.screentogif.com/) (Windows)
- [Kap](https://getkap.co/) (macOS)
- [Peek](https://github.com/phw/peek) (Linux)

## Current Status

- [ ] screenshot-hover.png - **PLACEHOLDER** (TODO: Create actual screenshot)
- [ ] demo.gif - **PLACEHOLDER** (TODO: Create actual GIF)

# Bonsai Viewer - Installation Guide

## 📦 Download

Go to the [**Releases page**](https://github.com/yourusername/ViewBox/releases) and download the latest version for your platform.

---

## 🍎 macOS Installation

### Download
- `ViewBox-x.x.x-mac-universal.dmg` (works on Intel and Apple Silicon)

### Installation Steps

1. **Download and open the `.dmg` file**
2. **Drag the app to your Applications folder**
3. **⚠️ IMPORTANT - First Launch:**
   - **DO NOT double-click the app** (it won't work)
   - **Right-click** (or Control+Click) on the app
   - Select **"Open"** from the menu
   - Click **"Open"** in the security dialog that appears
   
4. **Subsequent launches:** You can now double-click normally!

### Why This Extra Step?

This app is **not notarized** with an Apple Developer certificate (costs $99/year). This is standard for open-source projects distributed via GitHub.

**The app is safe** - you can:
- ✅ Review the [source code](https://github.com/yourusername/ViewBox)
- ✅ Build it yourself (see Building from Source below)
- ✅ Check it has been downloaded by other users

### Troubleshooting macOS

**"App is damaged and can't be opened"**
```bash
# Run this in Terminal:
xattr -cr /Applications/ViewBox.app
```

**Still won't open?**
1. System Settings → Privacy & Security
2. Scroll to "Security" section
3. You should see "ViewBox was blocked..."
4. Click "Open Anyway"

---

## 🪟 Windows Installation

### Download
- `ViewBox-x.x.x-win-x64.exe` (installer)
- `ViewBox-x.x.x-win-x64.zip` (portable, no installation)

### Installation Steps (Installer)

1. **Download and run the `.exe` file**
2. **⚠️ If Windows Defender SmartScreen appears:**
   ```
   Windows protected your PC
   Microsoft Defender SmartScreen prevented an unrecognized app
   ```
   - Click **"More info"**
   - Click **"Run anyway"**

3. **Follow the installation wizard**
4. **App will be installed** to `C:\Program Files\ViewBox`

### Portable Version (No Installation)

1. Download the `.zip` file
2. Extract it anywhere
3. Run `ViewBox.exe`
4. Same SmartScreen warning applies (click "More info" → "Run anyway")

### Why This Warning?

This app is **not code-signed** (costs $60-400/year). This is standard for open-source GitHub projects.

**The app is safe** - Windows SmartScreen shows this for ALL unsigned apps, even safe ones.

**SmartScreen will learn** - After ~100 downloads, the warning reduces/disappears.

### Troubleshooting Windows

**"This app can't run on your PC"**
- You need Windows 10/11 (64-bit)
- Download the x64 version, not ARM

**Antivirus blocking?**
- Add an exception for the app
- This is common for unsigned Electron apps

---

## 🐧 Linux Installation

### Download Options
- `ViewBox-x.x.x-linux-x64.AppImage` (universal, recommended)
- `ViewBox-x.x.x-linux-amd64.deb` (Debian/Ubuntu)

### AppImage (Universal)

```bash
# 1. Download the AppImage
wget https://github.com/yourusername/ViewBox/releases/download/v1.0.0/ViewBox-1.0.0-linux-x64.AppImage

# 2. Make it executable
chmod +x ViewBox-*.AppImage

# 3. Run it
./ViewBox-*.AppImage
```

**No installation needed!** Just download and run.

### Debian/Ubuntu (.deb)

```bash
# Download the .deb file, then:
sudo dpkg -i ViewBox-*.deb

# If dependencies missing:
sudo apt-get install -f

# Run from terminal:
ViewBox

# Or find it in your applications menu
```

### Troubleshooting Linux

**AppImage won't run?**
```bash
# Install FUSE (if not already installed)
sudo apt install libfuse2

# Or run with --no-sandbox
./ViewBox-*.AppImage --no-sandbox
```

**Missing libraries?**
```bash
# Ubuntu/Debian
sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1

# Fedora
sudo dnf install gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-atk libdrm mesa-libgbm
```

---

## 🔧 Building from Source

Don't trust pre-built binaries? Build it yourself!

### Prerequisites
- Node.js 22or higher
- npm (comes with Node.js)
- Git

### Build Steps

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/ViewBox.git
cd ViewBox

# 2. Install dependencies
npm install

# 3. Build for your platform

# macOS:
npm run build:mac
# Output: release/ViewBox-x.x.x-mac-universal.dmg

# Windows:
npm run build:win
# Output: release/ViewBox-x.x.x-win-x64.exe

# Linux:
npm run build:linux
# Output: release/ViewBox-x.x.x-linux-x64.AppImage

# 4. Install/run the built app
```

### Development Mode

```bash
# Run without building
npm install
npm run dev

# App will open with hot-reload enabled
```

---

## 🆘 Still Having Issues?

### Check GitHub Issues
[Search existing issues](https://github.com/yourusername/ViewBox/issues) or create a new one.

### Common Solutions

**"App crashes on startup"**
- Delete app settings:
  - macOS: `~/Library/Application Support/ViewBox`
  - Windows: `%APPDATA%\ViewBox`
  - Linux: `~/.config/ViewBox`

**"Can't open project files"**
- Make sure you have read permissions for the folder
- Try running app as administrator (Windows) or with sudo (Linux)

**"IFC files won't load"**
- Check file isn't corrupted
- Try with a different IFC file
- Check console for errors (View → Toggle Developer Tools)

---

## 🔐 Security & Privacy

### Is This App Safe?

✅ **Open Source** - All code is visible on GitHub  
✅ **No Telemetry** - Doesn't send any data anywhere  
✅ **Local Processing** - All files processed on your computer  
✅ **No Internet Required** - Works completely offline  


**You can verify safety by:**
1. Reading the source code
2. Building from source yourself
3. Checking GitHub stars/community trust

---

## 📊 System Requirements

### Minimum
- **CPU:** Dual-core processor (2 GHz+)
- **RAM:** 4 GB
- **Storage:** 200 MB free space
- **OS:** 
  - macOS 10.13+ (High Sierra)
  - Windows 10/11 (64-bit)
  - Ubuntu 18.04+ / Debian 10+

### Recommended
- **CPU:** Quad-core processor (3 GHz+)
- **RAM:** 8 GB or more
- **Storage:** 500 MB free space
- **Display:** 1920×1080 or higher

---

## 🆕 Updating

### Check for Updates
1. Go to [Releases page](https://github.com/yourusername/ViewBox/releases)
2. Download the latest version
3. Install over the existing version

### Auto-Update (Future Feature)
Currently not implemented. Manual updates only.

---

## 📝 License

[Your License Here - e.g., MIT, GPL, etc.]

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

---

**Questions?** [Open an issue](https://github.com/yourusername/ViewBox/issues/new) or [start a discussion](https://github.com/yourusername/ViewBox/discussions).
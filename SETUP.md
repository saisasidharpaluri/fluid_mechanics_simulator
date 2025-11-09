# Quick Setup Guide

## Running the Simulation

### Option 1: Using Python (Recommended)

1. Open PowerShell in this directory
2. Run: `python -m http.server 8000`
3. Open browser to: `http://localhost:8000`

### Option 2: Using VS Code Live Server

1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"

### Option 3: Using Node.js

1. Run: `npx http-server`
2. Open the URL shown in the terminal

## First Time Setup

The project requires **NO BUILD STEP** and **NO DEPENDENCIES** to install!

All libraries are loaded from CDN:

- Three.js (r128) - loaded from CDN in index.html

## What to Expect

When you open the simulation, you should see:

1. ✅ A dark 3D scene with a wireframe box
2. ✅ ~10,000 blue particles falling and settling
3. ✅ A control panel on the left with sliders
4. ✅ FPS counter and statistics

## Quick Actions to Try

1. **Watch the fluid settle** (particles fall and stabilize)
2. **Click "Drop Sphere"** to add a sphere that displaces fluid
3. **Click "Drop Cube"** to add a cube
4. **Drag mouse** to rotate the camera
5. **Scroll** to zoom in/out
6. **Adjust sliders** to change physics parameters in real-time

## Understanding the Parameters

### Best Starting Values (already set as defaults)

- **Particles**: 10,000 (good balance of performance/visuals)
- **Rest Density**: 1000 (water-like)
- **Stiffness**: 2000 (medium pressure response)
- **Viscosity**: 0.3 (slightly viscous)
- **Gravity**: -9.8 (Earth gravity)

### Experimental Adjustments

**For more viscous fluid (honey-like):**

- Viscosity: 0.8 - 1.0

**For bouncier fluid:**

- Stiffness: 4000+
- Damping: 0.3

**For more particles (if you have a good GPU):**

- Particles: 25,000 - 50,000
- Note: May reduce FPS

**For faster simulation:**

- Time Step: 0.005 - 0.008
- Warning: May become unstable

## Troubleshooting

### Simulation doesn't start

- Check browser console (F12) for errors
- Make sure you're running a local server (not opening file:// directly)
- Verify your browser supports WebGL

### Particles are invisible

- They may be outside the view - wait a few seconds for them to fall
- Try clicking "Reset Simulation"

### Low FPS (below 30)

- Reduce particle count to 5,000
- Close other browser tabs
- Update graphics drivers

### Particles exploding everywhere

- Click "Reset Simulation"
- Reduce Time Step to 0.002
- Reduce Stiffness to 1000

## Browser Compatibility

✅ **Works Best In:**

- Chrome/Edge (Chromium) - Best performance
- Firefox - Good performance
- Safari - Good performance

❌ **May Not Work:**

- Very old browsers (pre-2018)
- Browsers without WebGL support

## Performance Tips

1. **Start with default settings** (10,000 particles)
2. **Monitor FPS** in the stats panel
3. **Increase particle count gradually** if FPS is good
4. **Disable other applications** for best performance

## Common Questions

**Q: Why do particles look like they're jittering?**
A: This is normal SPH behavior. Try increasing viscosity or rest density.

**Q: Can I save my settings?**
A: Currently no, but you can note your favorite values and adjust sliders.

**Q: Why does it take time to settle?**
A: Real fluid physics! The particles need to find equilibrium. This can take 5-10 seconds.

**Q: The rigid bodies fall through the fluid too fast**
A: This is realistic! The fluid density is lower than the rigid body. Try increasing particle count for more resistance.

## Have Fun!

Experiment with the parameters and see how different values create different fluid behaviors. This is a real physics simulation - every parameter matters!

**Pro tip:** Drop several spheres in quick succession to create waves and splashes! 🌊

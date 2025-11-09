# Quick Reference Card

## 🚀 One-Line Start

```bash
python -m http.server 8000
```

Then open: http://localhost:8000

## ⌨️ Keyboard Shortcuts

| Key            | Action          |
| -------------- | --------------- |
| `H`            | Toggle UI Panel |
| `Space`        | Pause/Resume    |
| `Click + Drag` | Rotate Camera   |
| `Scroll`       | Zoom In/Out     |

## 🎮 Best Default Settings

```javascript
Particles:     10,000
Rest Density:  1,000
Stiffness:     2,000
Viscosity:     0.3
Gravity:       -9.8
Time Step:     0.003
Particle Size: 0.15
```

## 🧪 Fun Experiments

### Honey-like Fluid

```
Viscosity: 0.9
Rest Density: 1500
```

### Bouncy Water

```
Stiffness: 4000
Damping: 0.3
```

### Slow Motion

```
Gravity: -3.0
Time Step: 0.002
```

### Gas Simulation

```
Rest Density: 100
Stiffness: 500
Viscosity: 0.05
```

### Extreme Particles (if GPU is strong)

```
Particles: 50,000
Time Step: 0.002
```

## 🐛 Quick Fixes

| Problem             | Solution                      |
| ------------------- | ----------------------------- |
| Particles exploding | Reduce Time Step to 0.002     |
| Low FPS             | Reduce Particles to 5,000     |
| Particles invisible | Wait 5 seconds or click Reset |
| Simulation frozen   | Check browser console (F12)   |
| Jittery motion      | Increase Viscosity to 0.6     |

## 📊 Performance Guide

| Particles | Expected FPS | GPU Requirement |
| --------- | ------------ | --------------- |
| 1,000     | 60 FPS       | Any modern GPU  |
| 10,000    | 60 FPS       | Mid-range GPU   |
| 25,000    | 40-60 FPS    | Good GPU        |
| 50,000    | 20-40 FPS    | High-end GPU    |

## 🎨 Visual Quality Tips

### Best Looking Settings

```
Particles: 25,000
Particle Size: 0.12
Viscosity: 0.4
```

### Performance Mode

```
Particles: 5,000
Particle Size: 0.2
Time Step: 0.005
```

## 🔧 File Structure at a Glance

```
📁 Project Root
├── 🌐 index.html          Main page
├── 🎮 main.js             App logic
├── ⚡ ParticleSystem.js   GPU simulation
├── 🎲 RigidBody.js        Physics objects
├── 🎨 shaders.js          GLSL shaders
├── 📖 README.md           Full documentation
├── ⚙️ SETUP.md            Setup guide
├── 📘 TECHNICAL.md        Technical details
├── 📋 CHANGELOG.md        Version history
└── ▶️ start.bat           Quick launcher
```

## 🧮 Physics Parameter Meanings

| Parameter            | What it Does                       | Real-World Analogy         |
| -------------------- | ---------------------------------- | -------------------------- |
| **Rest Density**     | Target fluid density               | Water = 1000 kg/m³         |
| **Stiffness**        | How much fluid resists compression | Higher = less compressible |
| **Viscosity**        | Fluid thickness                    | Water = 0.3, Honey = 0.9   |
| **Gravity**          | Downward acceleration              | Earth = -9.8 m/s²          |
| **Time Step**        | Simulation speed                   | Smaller = more accurate    |
| **Smoothing Radius** | Particle influence range           | Larger = smoother          |

## 💡 Cool Things to Try

1. **Wave Machine**

   - Set Particles to 20,000
   - Drop 5 spheres in a row
   - Watch waves propagate!

2. **Particle Fountain**

   - Set Gravity to -5.0
   - Drop a sphere from top
   - See particles splash up!

3. **Dense Fluid**

   - Set Rest Density to 2000
   - Set Stiffness to 5000
   - Heavy, thick fluid!

4. **Zero Gravity**

   - Set Gravity to 0.0
   - Watch particles float!

5. **Rapid Fire**
   - Click "Drop Cube" 10 times fast
   - Particle chaos!

## 📸 Screenshot Moments

Best times to capture:

- 3 seconds: Particles mid-fall
- 7 seconds: Settling with waves
- After dropping sphere: Impact splash
- After 3+ objects: Complex interactions

## 🎯 What to Show Professors

1. ✅ GPU acceleration (check compute time in stats)
2. ✅ Real physics equations (see TECHNICAL.md)
3. ✅ Custom shader implementation
4. ✅ Scalability (adjust particle count live)
5. ✅ Interactive elements (rigid bodies)

## 📝 Quick Debug Checklist

- [ ] Running on local server (not file://)
- [ ] Browser supports WebGL
- [ ] Console shows no errors
- [ ] FPS > 10
- [ ] Particles visible in scene
- [ ] UI panel responsive
- [ ] Camera controls working

## 🌟 Impressive Features to Highlight

1. **Fully GPU-Accelerated**: Not using CPU for physics
2. **Custom GLSL Shaders**: Hand-written compute kernels
3. **Real SPH Algorithm**: Industry-standard method
4. **Real-time Parameter Tuning**: No restart needed
5. **Scalable**: 1K to 50K particles
6. **Interactive**: Rigid body coupling

## 📚 Quick Learning Path

1. **Day 1**: Run it, play with parameters
2. **Day 2**: Read SETUP.md and README.md
3. **Day 3**: Study main.js structure
4. **Day 4**: Understand ParticleSystem.js
5. **Day 5**: Analyze shaders.js (GLSL)
6. **Day 6**: Read TECHNICAL.md
7. **Day 7**: Experiment with modifications

## 🎓 Exam/Presentation Talking Points

- "GPU-accelerated using render-to-texture technique"
- "Implements SPH algorithm with Poly6, Spiky, and Viscosity kernels"
- "Supports up to 50,000 particles at real-time framerates"
- "Custom GLSL compute shaders for parallel computation"
- "Rigid body interaction with collision response"
- "All physics runs on GPU, Three.js only for rendering"

## 🔗 Important Equations (for reference)

### Density

```
ρᵢ = Σⱼ m_j * W_poly6(|xᵢ - x_j|, h)
```

### Pressure

```
p = k(ρ - ρ₀)
f_p = -Σⱼ m_j * (pᵢ/ρᵢ² + p_j/ρⱼ²) * ∇W_spiky
```

### Viscosity

```
f_v = μ * Σⱼ m_j * (v_j - vᵢ)/ρⱼ * ∇²W_viscosity
```

## 🏁 Success Criteria

You've successfully understood the project if you can:

- [ ] Explain what SPH is
- [ ] Describe the render-to-texture technique
- [ ] Identify the GPU compute pipeline
- [ ] Modify shader parameters
- [ ] Explain the three kernel functions
- [ ] Discuss performance trade-offs

---

**Print this page for quick reference during demos!**

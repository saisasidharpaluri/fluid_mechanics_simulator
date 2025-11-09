# Technical Documentation - GPU-Accelerated SPH Fluid Simulator

## System Architecture

### Overview

This is a fully GPU-accelerated particle-based fluid simulator using the Smoothed-Particle Hydrodynamics (SPH) method. The entire physics simulation runs on the GPU using custom GLSL shaders, with Three.js used only for scene setup and final rendering.

## Core Components

### 1. ParticleSystem.js

**Responsibility**: Manages GPU textures and compute pipeline for particle physics

#### Key Features:

- **Data Textures**: Stores particle data in floating-point RGBA textures

  - Position texture (RGBA): x, y, z position + active flag
  - Velocity texture (RGBA): vx, vy, vz velocity + unused
  - Density texture (R): particle density
  - Acceleration texture (RGB): ax, ay, az acceleration

- **Ping-Pong Rendering**: Uses double-buffering for iterative computation
  - Read from one texture while writing to another
  - Swap buffers each frame
  - Prevents race conditions in GPU computation

#### Texture Layout:

```
Texture Size: ceil(sqrt(numParticles)) × ceil(sqrt(numParticles))
Example: 10,000 particles = 100×100 texture

Each pixel represents one particle:
[0,0] = Particle 0
[0,1] = Particle 1
...
[99,99] = Particle 9,999
```

#### Compute Pipeline:

```
1. Density Pass
   Input: Position texture
   Output: Density texture

2. Forces Pass
   Input: Position, Velocity, Density textures
   Output: Acceleration texture

3. Velocity Update Pass
   Input: Velocity, Acceleration textures
   Output: New Velocity texture

4. Position Update Pass
   Input: Position, Velocity, Acceleration textures
   Output: New Position texture
```

### 2. shaders.js

**Responsibility**: GLSL compute shaders for GPU physics calculations

#### Density Shader

```glsl
// Poly6 Kernel: W(r,h) = 315/(64πh⁹) * (h² - r²)³
```

- Iterates through all particles (O(n²) currently)
- Computes density at each particle
- Uses Poly6 smoothing kernel (optimal for density)

#### Forces Shader

```glsl
// Pressure: f_p = -∇p
// Viscosity: f_v = μ∇²v
```

- Computes pressure using equation of state: `p = k(ρ - ρ₀)`
- Uses Spiky kernel gradient for pressure forces
- Uses Viscosity Laplacian kernel for damping
- Combines forces with gravity

#### Integration Shader

```glsl
// Velocity Verlet Integration
// v_{n+1} = v_n + a_n * dt
// x_{n+1} = x_n + v_{n+1} * dt
```

- Updates particle positions and velocities
- Handles boundary collisions with damping
- Handles rigid body collisions (sphere and cube)
- Applies constraint forces

### 3. RigidBody.js

**Responsibility**: Manages interactive rigid bodies (spheres and cubes)

#### Collision Detection:

- **Sphere-Particle**: Distance check with radius
- **Box-Particle**: AABB (Axis-Aligned Bounding Box) test

#### Collision Response:

- Reflects particle velocity along normal
- Applies damping coefficient
- Pushes particle out of penetration

### 4. main.js

**Responsibility**: Application initialization and scene management

#### Scene Setup:

- Three.js scene with camera and lights
- Boundary box visualization
- Ground plane with grid
- Particle rendering system

#### Update Loop:

```javascript
1. Update rigid body physics (CPU)
2. Update particle physics (GPU via ParticleSystem)
3. Render scene (GPU via Three.js)
4. Update statistics
```

## SPH Algorithm Deep Dive

### Smoothing Kernels

#### Why Different Kernels?

Each kernel is optimized for specific calculations:

1. **Poly6 Kernel** (Density):

   ```
   W(r,h) = 315/(64πh⁹) * (h² - r²)³   if 0 ≤ r ≤ h
   ```

   - Smooth and continuous
   - Good for scalar quantities (density)
   - Computationally efficient

2. **Spiky Kernel Gradient** (Pressure):

   ```
   ∇W(r,h) = -45/(πh⁶) * (h-r)² * r̂   if 0 ≤ r ≤ h
   ```

   - Sharp gradient near origin
   - Prevents particle clustering
   - Used for pressure forces

3. **Viscosity Laplacian Kernel** (Viscosity):
   ```
   ∇²W(r,h) = 45/(πh⁶) * (h-r)   if 0 ≤ r ≤ h
   ```
   - Smooth Laplacian
   - No singularities
   - Used for viscosity damping

### Physics Equations

#### 1. Density Calculation

```
ρᵢ = Σⱼ m_j * W(|xᵢ - x_j|, h)
```

Where:

- ρᵢ = density at particle i
- m_j = mass of neighbor j
- W = Poly6 kernel
- h = smoothing radius

#### 2. Pressure Force

```
f_pressure,i = -Σⱼ m_j * (pᵢ/ρᵢ² + p_j/ρⱼ²) * ∇W(xᵢ - x_j, h)

p = k(ρ - ρ₀)
```

Where:

- p = pressure
- k = stiffness constant
- ρ₀ = rest density

#### 3. Viscosity Force

```
f_viscosity,i = μ * Σⱼ m_j * (v_j - vᵢ)/ρⱼ * ∇²W(xᵢ - x_j, h)
```

Where:

- μ = viscosity coefficient

#### 4. Time Integration

```
aᵢ = (f_pressure + f_viscosity)/ρᵢ + g
vᵢ^{n+1} = vᵢ^n + aᵢ * dt
xᵢ^{n+1} = xᵢ^n + vᵢ^{n+1} * dt
```

### Boundary Conditions

#### Hard Boundaries (Current Implementation):

```glsl
if (pos.y < boundMin.y) {
    pos.y = boundMin.y;
    vel.y = -vel.y * damping;
}
```

- Simple position correction
- Velocity reflection with damping
- Fast but can be unstable

#### Potential Improvements:

- Ghost particles outside boundaries
- Penalty forces near boundaries
- Distance field-based collisions

## Performance Analysis

### Computational Complexity

#### Current Implementation:

- **Density Calculation**: O(n²) - each particle checks all others
- **Force Calculation**: O(n²) - same
- **Integration**: O(n) - independent per particle
- **Total per frame**: O(n²)

#### With Spatial Hashing (Future):

- **Grid Construction**: O(n)
- **Neighbor Search**: O(n\*k) where k = average neighbors (≈27 cells)
- **Total per frame**: O(n)
- **Expected speedup**: 10-100x for large n

### Memory Usage

For 10,000 particles:

- Position Texture: 100×100×4×4 bytes = 160 KB
- Velocity Texture: 100×100×4×4 bytes = 160 KB
- Density Texture: 100×100×4×4 bytes = 160 KB
- Acceleration Texture: 100×100×4×4 bytes = 160 KB
- **Total GPU Memory**: ~640 KB + double buffering = ~1.3 MB

For 50,000 particles:

- Texture size: 224×224 (rounded up)
- **Total GPU Memory**: ~6.4 MB

### GPU vs CPU Performance

**GPU Advantages:**

- Parallel processing of all particles simultaneously
- High memory bandwidth for texture reads
- Optimized floating-point operations

**CPU Equivalent:**

- 10,000 particles @ O(n²) = 100M operations per frame
- At 60 FPS = 6 billion operations per second
- Impossible on single-threaded CPU

**GPU Implementation:**

- Same 100M operations
- Processed in parallel across thousands of cores
- Achievable at 60+ FPS

## Optimization Opportunities

### 1. Spatial Grid Hashing (High Priority)

**Current**: O(n²) neighbor search
**With Grid**: O(n) with small constant

Implementation:

```javascript
// Hash function
hash(x,y,z) = ((x*73856093) ^ (y*19349663) ^ (z*83492791)) % tableSize

// Build grid (GPU compute shader)
for each particle:
    cell = floor(position / smoothingRadius)
    insert into hash table

// Neighbor search (GPU compute shader)
for each particle:
    for each of 27 neighboring cells:
        check particles in cell
```

### 2. Texture Compression

- Use RGB instead of RGBA where possible
- Pack multiple values into single texture
- Reduces bandwidth

### 3. LOD (Level of Detail)

- Use fewer particles far from camera
- Increase time step for distant particles
- Maintain visual quality while improving performance

### 4. Compute Shaders (WebGL 2.0)

- Use actual compute shaders instead of fragment shaders
- Better for non-rendering GPU computation
- More efficient memory access patterns

## Known Limitations

### 1. Neighbor Search

- Current O(n²) limits to ~50K particles
- Spatial hashing would enable 500K+ particles

### 2. Surface Tension

- Not currently implemented
- Would require additional kernel calculations
- Needed for realistic droplets and bubbles

### 3. Two-Way Coupling

- Rigid bodies don't feel fluid forces (one-way coupling)
- Fluid pushes objects, but objects don't push back
- Would require force accumulation on rigid bodies

### 4. Incompressibility

- SPH allows some compressibility
- More advanced methods (PCISPH, IISPH) enforce incompressibility
- Trade-off: speed vs accuracy

## Browser Compatibility

### Required WebGL Extensions:

```javascript
OES_texture_float; // Float textures (critical)
OES_texture_float_linear; // Float texture filtering (optional)
WEBGL_color_buffer_float; // Float render targets (critical)
```

### Fallback Strategy:

If float textures not supported:

- Use half-float (OES_texture_half_float)
- Reduce precision but maintain compatibility
- Lower particle counts

## Future Enhancements

### 1. Advanced SPH Methods

- **PCISPH** (Predictive-Corrective Incompressible SPH)
- **IISPH** (Implicit Incompressible SPH)
- **DFSPH** (Divergence-Free SPH)

### 2. Visual Improvements

- Screen-space fluid rendering
- Marching cubes for surface mesh
- Refraction and caustics
- Foam and spray particles

### 3. Performance

- Spatial grid hashing
- GPU sort for grid cells
- Multi-resolution particles
- Adaptive time stepping

### 4. Interaction

- Mouse-based forces (attraction/repulsion)
- Wind forces
- Temperature simulation
- Multiple fluid types

## Debugging Tips

### Visualizing GPU Textures

```javascript
// Read texture data back to CPU
const pixels = new Float32Array(textureSize * textureSize * 4);
renderer.readRenderTargetPixels(
  renderTarget,
  0,
  0,
  textureSize,
  textureSize,
  pixels
);
console.log("Particle 0 position:", pixels[0], pixels[1], pixels[2]);
```

### Common Issues

**Particles disappear:**

- Check texture initialization
- Verify ping-pong buffer swapping
- Ensure active flags are set

**Particles explode:**

- Time step too large
- Stiffness too high
- Density calculation error
- Check kernel functions

**Low performance:**

- Too many particles for GPU
- Inefficient shader loops
- Missing GPU extensions

## References & Papers

1. **Müller et al. (2003)** - "Particle-Based Fluid Simulation for Interactive Applications"

   - Original SPH for graphics paper
   - Defines Poly6, Spiky, and Viscosity kernels

2. **Kelager (2006)** - "Lagrangian Fluid Dynamics Using Smoothed Particle Hydrodynamics"

   - Comprehensive SPH tutorial
   - Implementation details

3. **Harada et al. (2007)** - "Smoothed Particle Hydrodynamics on GPUs"

   - GPU acceleration techniques
   - Spatial hashing on GPU

4. **Macklin & Müller (2013)** - "Position Based Fluids"
   - Modern alternative to SPH
   - Better incompressibility

## Conclusion

This simulator demonstrates:

- ✅ GPU-accelerated physics computation
- ✅ Real-time fluid simulation with SPH
- ✅ Interactive rigid body coupling
- ✅ Efficient render-to-texture pipeline
- ✅ Modern web graphics techniques

It serves as an excellent educational project for understanding:

- Computer graphics programming
- Computational fluid dynamics
- GPU programming with GLSL
- WebGL and Three.js
- Numerical methods and physics simulation

---

**Implementation Status**: Fully functional with room for optimization
**Educational Value**: High - covers graphics, physics, and GPU programming
**Performance**: 60 FPS @ 10K particles on modern GPU

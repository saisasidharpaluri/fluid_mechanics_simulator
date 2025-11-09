// ParticleSystem.js
// CPU-based SPH particle simulation with GPU rendering
// Compatible with all browsers - no float textures required

class ParticleSystem {
    constructor(numParticles, params) {
        this.numParticles = numParticles;
        this.params = params;
        
        console.log(`Particle System: ${numParticles} particles (CPU-based SPH)`);
        
        // Initialize particle data arrays
        this.initParticleArrays();
        
        // Create particle rendering geometry
        this.createParticleGeometry();
    }
    
    initParticleArrays() {
        // Create arrays for particle data
        this.positions = new Float32Array(this.numParticles * 3);
        this.velocities = new Float32Array(this.numParticles * 3);
        this.densities = new Float32Array(this.numParticles);
        this.pressures = new Float32Array(this.numParticles);
        this.forces = new Float32Array(this.numParticles * 3);
        
        // Initialize particles in a cube formation
        const spacing = 0.3;
        const cubeSize = Math.ceil(Math.pow(this.numParticles, 1/3));
        const offset = (cubeSize * spacing) / 2;
        
        for (let i = 0; i < this.numParticles; i++) {
            const x = (i % cubeSize) * spacing - offset;
            const y = Math.floor(i / (cubeSize * cubeSize)) * spacing + 5.0;
            const z = Math.floor((i % (cubeSize * cubeSize)) / cubeSize) * spacing - offset;
            
            this.positions[i * 3 + 0] = x + (Math.random() - 0.5) * 0.1;
            this.positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.1;
            this.positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.1;
            
            this.velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.5;
            this.velocities[i * 3 + 1] = 0.0;
            this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        }
        
        console.log('✓ Particle arrays initialized');
    }
    
    createParticleGeometry() {
        // Create buffer geometry for particles
        this.particleGeometry = new THREE.BufferGeometry();
        
        // Position attribute (will be updated each frame)
        const positionAttribute = new THREE.BufferAttribute(this.positions, 3);
        positionAttribute.setUsage(THREE.DynamicDrawUsage);
        this.particleGeometry.setAttribute('position', positionAttribute);
        
        // Color attribute based on velocity
        this.colors = new Float32Array(this.numParticles * 3);
        const colorAttribute = new THREE.BufferAttribute(this.colors, 3);
        colorAttribute.setUsage(THREE.DynamicDrawUsage);
        this.particleGeometry.setAttribute('color', colorAttribute);
        
        // Create particle material
        this.particleMaterial = new THREE.PointsMaterial({
            size: this.params.particleSize,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });
        
        // Create points mesh
        this.particles = new THREE.Points(this.particleGeometry, this.particleMaterial);
        
        console.log('✓ Particle geometry created');
    }
    
    // SPH Kernel functions
    poly6Kernel(r, h) {
        if (r >= 0 && r <= h) {
            const term = h * h - r * r;
            return 315.0 / (64.0 * Math.PI * Math.pow(h, 9)) * term * term * term;
        }
        return 0.0;
    }
    
    spikyGradient(rx, ry, rz, h) {
        const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
        if (r > 0 && r <= h) {
            const coef = -45.0 / (Math.PI * Math.pow(h, 6));
            const term = (h - r) * (h - r) / r;
            return [coef * term * rx, coef * term * ry, coef * term * rz];
        }
        return [0, 0, 0];
    }
    
    viscosityLaplacian(r, h) {
        if (r >= 0 && r <= h) {
            return 45.0 / (Math.PI * Math.pow(h, 6)) * (h - r);
        }
        return 0.0;
    }
    
    // Compute density for all particles
    computeDensity() {
        const h = this.params.smoothingRadius;
        const mass = this.params.particleMass;
        
        for (let i = 0; i < this.numParticles; i++) {
            const ix = this.positions[i * 3 + 0];
            const iy = this.positions[i * 3 + 1];
            const iz = this.positions[i * 3 + 2];
            
            let density = 0;
            
            // Check all neighbors
            for (let j = 0; j < this.numParticles; j++) {
                const jx = this.positions[j * 3 + 0];
                const jy = this.positions[j * 3 + 1];
                const jz = this.positions[j * 3 + 2];
                
                const dx = ix - jx;
                const dy = iy - jy;
                const dz = iz - jz;
                const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (r < h) {
                    density += mass * this.poly6Kernel(r, h);
                }
            }
            
            this.densities[i] = density;
            this.pressures[i] = this.params.stiffness * (density - this.params.restDensity);
        }
    }
    
    // Compute forces for all particles
    computeForces() {
        const h = this.params.smoothingRadius;
        const mass = this.params.particleMass;
        
        // Reset forces
        this.forces.fill(0);
        
        for (let i = 0; i < this.numParticles; i++) {
            const ix = this.positions[i * 3 + 0];
            const iy = this.positions[i * 3 + 1];
            const iz = this.positions[i * 3 + 2];
            
            const ivx = this.velocities[i * 3 + 0];
            const ivy = this.velocities[i * 3 + 1];
            const ivz = this.velocities[i * 3 + 2];
            
            const density_i = this.densities[i];
            const pressure_i = this.pressures[i];
            
            let fx = 0, fy = 0, fz = 0;
            
            // Check all neighbors
            for (let j = 0; j < this.numParticles; j++) {
                if (i === j) continue;
                
                const jx = this.positions[j * 3 + 0];
                const jy = this.positions[j * 3 + 1];
                const jz = this.positions[j * 3 + 2];
                
                const jvx = this.velocities[j * 3 + 0];
                const jvy = this.velocities[j * 3 + 1];
                const jvz = this.velocities[j * 3 + 2];
                
                const dx = ix - jx;
                const dy = iy - jy;
                const dz = iz - jz;
                const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (r < h) {
                    const density_j = this.densities[j];
                    const pressure_j = this.pressures[j];
                    
                    // Pressure force
                    const grad = this.spikyGradient(dx, dy, dz, h);
                    const pressureTerm = mass * (pressure_i / (density_i * density_i) + 
                                                  pressure_j / (density_j * density_j));
                    fx -= pressureTerm * grad[0];
                    fy -= pressureTerm * grad[1];
                    fz -= pressureTerm * grad[2];
                    
                    // Viscosity force
                    const lap = this.viscosityLaplacian(r, h);
                    const viscosityTerm = this.params.viscosity * mass / density_j * lap;
                    fx += viscosityTerm * (jvx - ivx);
                    fy += viscosityTerm * (jvy - ivy);
                    fz += viscosityTerm * (jvz - ivz);
                }
            }
            
            // Add gravity (always use constant fluid gravity)
            fy += this.params.fluidGravity * density_i;
            
            // Store forces
            this.forces[i * 3 + 0] = fx;
            this.forces[i * 3 + 1] = fy;
            this.forces[i * 3 + 2] = fz;
        }
    }
    
    // Integrate positions and velocities
    integrate(dt, rigidBodies) {
        for (let i = 0; i < this.numParticles; i++) {
            const density = this.densities[i];
            if (density < 1.0) continue; // Skip particles with very low density
            
            // Update velocity
            const ax = this.forces[i * 3 + 0] / density;
            const ay = this.forces[i * 3 + 1] / density;
            const az = this.forces[i * 3 + 2] / density;
            
            this.velocities[i * 3 + 0] += ax * dt;
            this.velocities[i * 3 + 1] += ay * dt;
            this.velocities[i * 3 + 2] += az * dt;
            
            // Update position
            this.positions[i * 3 + 0] += this.velocities[i * 3 + 0] * dt;
            this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
            this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
            
            // Boundary collisions
            this.handleBoundaryCollision(i);
            
            // Rigid body collisions
            if (rigidBodies) {
                this.handleRigidBodyCollisions(i, rigidBodies);
            }
        }
    }
    
    handleBoundaryCollision(i) {
        const damping = this.params.damping;
        const bMin = this.params.boundMin;
        const bMax = this.params.boundMax;
        
        // Bottom - strong collision to prevent falling through
        if (this.positions[i * 3 + 1] < bMin.y) {
            this.positions[i * 3 + 1] = bMin.y;
            this.velocities[i * 3 + 1] = Math.abs(this.velocities[i * 3 + 1]) * damping; // Bounce up
            this.velocities[i * 3 + 0] *= 0.95; // Friction
            this.velocities[i * 3 + 2] *= 0.95;
        }
        
        // Top
        if (this.positions[i * 3 + 1] > bMax.y) {
            this.positions[i * 3 + 1] = bMax.y;
            this.velocities[i * 3 + 1] = -Math.abs(this.velocities[i * 3 + 1]) * damping; // Push down
        }
        
        // X boundaries
        if (this.positions[i * 3 + 0] < bMin.x) {
            this.positions[i * 3 + 0] = bMin.x;
            this.velocities[i * 3 + 0] = Math.abs(this.velocities[i * 3 + 0]) * damping;
        }
        if (this.positions[i * 3 + 0] > bMax.x) {
            this.positions[i * 3 + 0] = bMax.x;
            this.velocities[i * 3 + 0] = -Math.abs(this.velocities[i * 3 + 0]) * damping;
        }
        
        // Z boundaries
        if (this.positions[i * 3 + 2] < bMin.z) {
            this.positions[i * 3 + 2] = bMin.z;
            this.velocities[i * 3 + 2] = Math.abs(this.velocities[i * 3 + 2]) * damping;
        }
        if (this.positions[i * 3 + 2] > bMax.z) {
            this.positions[i * 3 + 2] = bMax.z;
            this.velocities[i * 3 + 2] = -Math.abs(this.velocities[i * 3 + 2]) * damping;
        }
    }
    
    handleRigidBodyCollisions(i, rigidBodies) {
        const px = this.positions[i * 3 + 0];
        const py = this.positions[i * 3 + 1];
        const pz = this.positions[i * 3 + 2];
        
        for (const body of rigidBodies) {
            const dx = px - body.position.x;
            const dy = py - body.position.y;
            const dz = pz - body.position.z;
            
            if (body.type === 'sphere' || body.type === 'cylinder' || body.type === 'torus') {
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const radius = body.size.x;
                
                if (dist < radius && dist > 0) {
                    // Push particle out
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const nz = dz / dist;
                    
                    this.positions[i * 3 + 0] = body.position.x + nx * radius;
                    this.positions[i * 3 + 1] = body.position.y + ny * radius;
                    this.positions[i * 3 + 2] = body.position.z + nz * radius;
                    
                    // Reflect velocity
                    const dot = this.velocities[i * 3 + 0] * nx + 
                               this.velocities[i * 3 + 1] * ny + 
                               this.velocities[i * 3 + 2] * nz;
                    
                    if (dot < 0) {
                        this.velocities[i * 3 + 0] -= 2 * dot * nx;
                        this.velocities[i * 3 + 1] -= 2 * dot * ny;
                        this.velocities[i * 3 + 2] -= 2 * dot * nz;
                        
                        this.velocities[i * 3 + 0] *= this.params.damping;
                        this.velocities[i * 3 + 1] *= this.params.damping;
                        this.velocities[i * 3 + 2] *= this.params.damping;
                    }
                }
            } else if (body.type === 'cube') {
                const halfX = body.size.x * 0.5;
                const halfY = body.size.y * 0.5;
                const halfZ = body.size.z * 0.5;
                
                if (Math.abs(dx) < halfX && Math.abs(dy) < halfY && Math.abs(dz) < halfZ) {
                    // Inside cube - push out along closest axis
                    const penX = halfX - Math.abs(dx);
                    const penY = halfY - Math.abs(dy);
                    const penZ = halfZ - Math.abs(dz);
                    
                    const minPen = Math.min(penX, penY, penZ);
                    
                    if (minPen === penX) {
                        const sign = dx > 0 ? 1 : -1;
                        this.positions[i * 3 + 0] = body.position.x + sign * halfX;
                        this.velocities[i * 3 + 0] = Math.abs(this.velocities[i * 3 + 0]) * sign * this.params.damping;
                    } else if (minPen === penY) {
                        const sign = dy > 0 ? 1 : -1;
                        this.positions[i * 3 + 1] = body.position.y + sign * halfY;
                        this.velocities[i * 3 + 1] = Math.abs(this.velocities[i * 3 + 1]) * sign * this.params.damping;
                    } else {
                        const sign = dz > 0 ? 1 : -1;
                        this.positions[i * 3 + 2] = body.position.z + sign * halfZ;
                        this.velocities[i * 3 + 2] = Math.abs(this.velocities[i * 3 + 2]) * sign * this.params.damping;
                    }
                }
            }
        }
    }
    
    updateColors() {
        // Get base color from params (default to blue if not set)
        const baseColor = this.params.fluidColor || '#4fc3f7';
        const color = new THREE.Color(baseColor);
        
        for (let i = 0; i < this.numParticles; i++) {
            const vx = this.velocities[i * 3 + 0];
            const vy = this.velocities[i * 3 + 1];
            const vz = this.velocities[i * 3 + 2];
            const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            
            // Vary brightness based on speed
            const speedFactor = Math.min(speed / 10.0, 1.0);
            const brightness = 0.6 + speedFactor * 0.4; // Range from 0.6 to 1.0
            
            this.colors[i * 3 + 0] = color.r * brightness;
            this.colors[i * 3 + 1] = color.g * brightness;
            this.colors[i * 3 + 2] = color.b * brightness;
        }
    }
    
    update(renderer, rigidBodies) {
        const startTime = performance.now();
        
        // SPH algorithm steps
        this.computeDensity();
        this.computeForces();
        this.integrate(this.params.timeStep, rigidBodies);
        this.updateColors();
        
        // Update geometry
        this.particleGeometry.attributes.position.needsUpdate = true;
        this.particleGeometry.attributes.color.needsUpdate = true;
        
        // Update material
        this.particleMaterial.size = this.params.particleSize;
        
        return performance.now() - startTime;
    }
    
    reset() {
        // Reinitialize particle arrays
        this.initParticleArrays();
        this.particleGeometry.attributes.position.needsUpdate = true;
        console.log('✓ Particles reset');
    }
}

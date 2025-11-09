// GPU Shaders for SPH Fluid Simulation
// All physics computation runs on the GPU using custom GLSL shaders

const Shaders = {
    // Vertex shader for compute passes (renders to texture)
    computeVert: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    // Density calculation shader
    // Computes the density at each particle based on neighboring particles
    densityFrag: `
        uniform sampler2D positions;
        uniform sampler2D velocities;
        uniform float particleMass;
        uniform float smoothingRadius;
        uniform vec2 resolution;
        
        varying vec2 vUv;
        
        const float PI = 3.14159265359;
        
        // Poly6 kernel for density calculation
        float poly6Kernel(float r, float h) {
            if (r >= 0.0 && r <= h) {
                float term = h * h - r * r;
                return 315.0 / (64.0 * PI * pow(h, 9.0)) * term * term * term;
            }
            return 0.0;
        }
        
        void main() {
            vec3 pos = texture2D(positions, vUv).xyz;
            float density = 0.0;
            
            // Iterate through all particles to find neighbors
            for (float y = 0.0; y < resolution.y; y += 1.0) {
                for (float x = 0.0; x < resolution.x; x += 1.0) {
                    vec2 coord = vec2(x, y) / resolution;
                    vec3 otherPos = texture2D(positions, coord).xyz;
                    
                    vec3 diff = pos - otherPos;
                    float dist = length(diff);
                    
                    if (dist < smoothingRadius) {
                        density += particleMass * poly6Kernel(dist, smoothingRadius);
                    }
                }
            }
            
            gl_FragColor = vec4(density, 0.0, 0.0, 1.0);
        }
    `,

    // Pressure and viscosity forces shader
    forcesFrag: `
        uniform sampler2D positions;
        uniform sampler2D velocities;
        uniform sampler2D densities;
        uniform float particleMass;
        uniform float smoothingRadius;
        uniform float restDensity;
        uniform float stiffness;
        uniform float viscosity;
        uniform vec2 resolution;
        uniform vec3 gravity;
        uniform vec3 boundMin;
        uniform vec3 boundMax;
        uniform float damping;
        
        varying vec2 vUv;
        
        const float PI = 3.14159265359;
        
        // Spiky kernel gradient for pressure forces
        vec3 spikyGradient(vec3 r, float h) {
            float dist = length(r);
            if (dist > 0.0 && dist <= h) {
                float coef = -45.0 / (PI * pow(h, 6.0));
                float term = h - dist;
                return coef * term * term * normalize(r);
            }
            return vec3(0.0);
        }
        
        // Viscosity Laplacian kernel
        float viscosityLaplacian(float r, float h) {
            if (r >= 0.0 && r <= h) {
                return 45.0 / (PI * pow(h, 6.0)) * (h - r);
            }
            return 0.0;
        }
        
        void main() {
            vec3 pos = texture2D(positions, vUv).xyz;
            vec3 vel = texture2D(velocities, vUv).xyz;
            float density = texture2D(densities, vUv).x;
            
            vec3 pressureForce = vec3(0.0);
            vec3 viscosityForce = vec3(0.0);
            
            // Calculate pressure from density
            float pressure = stiffness * (density - restDensity);
            
            // Iterate through all particles to find neighbors
            for (float y = 0.0; y < resolution.y; y += 1.0) {
                for (float x = 0.0; x < resolution.x; x += 1.0) {
                    vec2 coord = vec2(x, y) / resolution;
                    
                    if (coord == vUv) continue;
                    
                    vec3 otherPos = texture2D(positions, coord).xyz;
                    vec3 otherVel = texture2D(velocities, coord).xyz;
                    float otherDensity = texture2D(densities, coord).x;
                    
                    vec3 diff = pos - otherPos;
                    float dist = length(diff);
                    
                    if (dist < smoothingRadius && dist > 0.0) {
                        float otherPressure = stiffness * (otherDensity - restDensity);
                        
                        // Pressure force (Spiky kernel)
                        vec3 gradW = spikyGradient(diff, smoothingRadius);
                        pressureForce -= particleMass * (pressure / (density * density) + 
                                         otherPressure / (otherDensity * otherDensity)) * gradW;
                        
                        // Viscosity force
                        float lapW = viscosityLaplacian(dist, smoothingRadius);
                        viscosityForce += particleMass * (otherVel - vel) / otherDensity * lapW;
                    }
                }
            }
            
            viscosityForce *= viscosity;
            
            // Total acceleration
            vec3 acceleration = (pressureForce + viscosityForce) / density + gravity;
            
            gl_FragColor = vec4(acceleration, 1.0);
        }
    `,

    // Integration shader - updates positions and velocities
    integrationFrag: `
        uniform sampler2D positions;
        uniform sampler2D velocities;
        uniform sampler2D accelerations;
        uniform float dt;
        uniform vec3 boundMin;
        uniform vec3 boundMax;
        uniform float damping;
        uniform int numRigidBodies;
        uniform vec3 rigidBodyPositions[10];
        uniform vec3 rigidBodySizes[10];
        uniform int rigidBodyTypes[10]; // 0 = sphere, 1 = cube
        
        varying vec2 vUv;
        
        vec3 handleBoundaryCollision(vec3 pos, vec3 vel) {
            vec3 newVel = vel;
            
            // Bottom boundary
            if (pos.y < boundMin.y) {
                pos.y = boundMin.y;
                newVel.y = -newVel.y * damping;
            }
            
            // Top boundary
            if (pos.y > boundMax.y) {
                pos.y = boundMax.y;
                newVel.y = -newVel.y * damping;
            }
            
            // Left/Right boundaries
            if (pos.x < boundMin.x) {
                pos.x = boundMin.x;
                newVel.x = -newVel.x * damping;
            }
            if (pos.x > boundMax.x) {
                pos.x = boundMax.x;
                newVel.x = -newVel.x * damping;
            }
            
            // Front/Back boundaries
            if (pos.z < boundMin.z) {
                pos.z = boundMin.z;
                newVel.z = -newVel.z * damping;
            }
            if (pos.z > boundMax.z) {
                pos.z = boundMax.z;
                newVel.z = -newVel.z * damping;
            }
            
            return newVel;
        }
        
        vec3 handleRigidBodyCollision(vec3 pos, vec3 vel, int bodyIdx) {
            vec3 bodyPos = rigidBodyPositions[bodyIdx];
            vec3 bodySize = rigidBodySizes[bodyIdx];
            int bodyType = rigidBodyTypes[bodyIdx];
            
            vec3 diff = pos - bodyPos;
            vec3 newVel = vel;
            
            if (bodyType == 0) {
                // Sphere collision
                float radius = bodySize.x; // x component stores radius
                float dist = length(diff);
                
                if (dist < radius && dist > 0.0) {
                    vec3 normal = normalize(diff);
                    pos = bodyPos + normal * radius;
                    
                    // Reflect velocity
                    float dotProduct = dot(vel, normal);
                    if (dotProduct < 0.0) {
                        newVel = vel - 2.0 * dotProduct * normal;
                        newVel *= damping;
                    }
                }
            } else if (bodyType == 1) {
                // Cube collision (AABB)
                vec3 halfSize = bodySize * 0.5;
                vec3 localPos = diff;
                vec3 absLocal = abs(localPos);
                
                if (absLocal.x < halfSize.x && absLocal.y < halfSize.y && absLocal.z < halfSize.z) {
                    // Inside cube - push out along closest axis
                    vec3 penetration = halfSize - absLocal;
                    float minPen = min(min(penetration.x, penetration.y), penetration.z);
                    
                    vec3 normal = vec3(0.0);
                    if (minPen == penetration.x) {
                        normal.x = localPos.x > 0.0 ? 1.0 : -1.0;
                        pos.x = bodyPos.x + normal.x * halfSize.x;
                    } else if (minPen == penetration.y) {
                        normal.y = localPos.y > 0.0 ? 1.0 : -1.0;
                        pos.y = bodyPos.y + normal.y * halfSize.y;
                    } else {
                        normal.z = localPos.z > 0.0 ? 1.0 : -1.0;
                        pos.z = bodyPos.z + normal.z * halfSize.z;
                    }
                    
                    // Reflect velocity
                    float dotProduct = dot(vel, normal);
                    if (dotProduct < 0.0) {
                        newVel = vel - 2.0 * dotProduct * normal;
                        newVel *= damping;
                    }
                }
            }
            
            return newVel;
        }
        
        void main() {
            vec3 pos = texture2D(positions, vUv).xyz;
            vec3 vel = texture2D(velocities, vUv).xyz;
            vec3 acc = texture2D(accelerations, vUv).xyz;
            
            // Velocity Verlet integration
            vec3 newVel = vel + acc * dt;
            vec3 newPos = pos + newVel * dt;
            
            // Handle boundary collisions
            newVel = handleBoundaryCollision(newPos, newVel);
            
            // Handle rigid body collisions
            for (int i = 0; i < 10; i++) {
                if (i >= numRigidBodies) break;
                newVel = handleRigidBodyCollision(newPos, newVel, i);
            }
            
            // Update position after collision response
            newPos = pos + newVel * dt;
            
            gl_FragColor = vec4(newPos, 1.0);
        }
    `,

    // Velocity update shader
    velocityUpdateFrag: `
        uniform sampler2D velocities;
        uniform sampler2D accelerations;
        uniform float dt;
        
        varying vec2 vUv;
        
        void main() {
            vec3 vel = texture2D(velocities, vUv).xyz;
            vec3 acc = texture2D(accelerations, vUv).xyz;
            
            vec3 newVel = vel + acc * dt;
            
            gl_FragColor = vec4(newVel, 1.0);
        }
    `,

    // Particle rendering vertex shader
    particleVert: `
        uniform sampler2D positions;
        uniform sampler2D velocities;
        uniform float particleSize;
        uniform vec2 resolution;
        
        attribute float particleIndex;
        
        varying vec3 vVelocity;
        varying vec3 vPosition;
        
        void main() {
            // Calculate UV coordinates from particle index
            float y = floor(particleIndex / resolution.x);
            float x = mod(particleIndex, resolution.x);
            vec2 uv = (vec2(x, y) + 0.5) / resolution;
            
            vec3 pos = texture2D(positions, uv).xyz;
            vec3 vel = texture2D(velocities, uv).xyz;
            
            vVelocity = vel;
            vPosition = pos;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            // Size attenuation based on distance
            gl_PointSize = particleSize * 100.0 / -mvPosition.z;
        }
    `,

    // Particle rendering fragment shader
    particleFrag: `
        varying vec3 vVelocity;
        varying vec3 vPosition;
        
        void main() {
            // Create circular particles
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            if (dist > 0.5) discard;
            
            // Color based on velocity magnitude
            float speed = length(vVelocity);
            vec3 color;
            
            if (speed < 2.0) {
                color = mix(vec3(0.2, 0.4, 0.8), vec3(0.3, 0.6, 1.0), speed / 2.0);
            } else if (speed < 5.0) {
                color = mix(vec3(0.3, 0.6, 1.0), vec3(0.4, 0.8, 1.0), (speed - 2.0) / 3.0);
            } else {
                color = mix(vec3(0.4, 0.8, 1.0), vec3(1.0, 1.0, 1.0), min((speed - 5.0) / 5.0, 1.0));
            }
            
            // Add depth shading
            float depth = smoothstep(0.0, 0.5, dist);
            color *= (1.0 - depth * 0.3);
            
            // Fresnel-like rim lighting
            float rim = 1.0 - dist * 2.0;
            rim = pow(rim, 2.0);
            color += vec3(0.3, 0.5, 0.7) * rim * 0.5;
            
            gl_FragColor = vec4(color, 1.0 - depth * 0.2);
        }
    `
};

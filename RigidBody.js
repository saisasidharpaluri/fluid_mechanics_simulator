// RigidBody.js
// Manages rigid bodies (spheres and cubes) that interact with the fluid

class RigidBody {
    constructor(type, position, size, scene, scale = 1.0, rotationX = 0, rotationY = 0, rotationZ = 0, density = 2700) {
        this.type = type; // 'sphere' or 'cube'
        this.position = position.clone();
        this.size = size.clone();
        this.baseSize = size.clone(); // Store original size
        this.scale = scale; // Store scale factor
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.angularVelocity = new THREE.Vector3(0, 0, 0); // Rotation speed around each axis
        this.physicalRotation = new THREE.Euler(0, 0, 0); // Physics-based rotation
        this.scene = scene;
        this.rotationX = rotationX; // X-axis rotation in degrees (-720 to 720) - user-set initial rotation
        this.rotationY = rotationY; // Y-axis rotation in degrees (-720 to 720)
        this.rotationZ = rotationZ; // Z-axis rotation in degrees (-720 to 720)
        this.density = density; // Object density in kg/m³
        
        console.log(`Creating ${type} at`, position, `with rotations: X=${rotationX}, Y=${rotationY}, Z=${rotationZ}, density=${density}`);
        
        this.createMesh();
        this.setScale(scale);
        this.setRotation(rotationX, rotationY, rotationZ);
    }
    
    setScale(scale) {
        this.scale = scale;
        this.mesh.scale.setScalar(scale);
        // Update physics size to match visual scale
        this.size = this.baseSize.clone().multiplyScalar(scale);
    }
    
    setRotation(xDegrees, yDegrees, zDegrees) {
        this.rotationX = xDegrees;
        this.rotationY = yDegrees;
        this.rotationZ = zDegrees;
        
        // Convert to radians and apply to mesh
        this.mesh.rotation.x = (xDegrees * Math.PI) / 180;
        this.mesh.rotation.y = (yDegrees * Math.PI) / 180;
        this.mesh.rotation.z = (zDegrees * Math.PI) / 180;
    }
    
    setRotationAngle(angleDegrees) {
        // Legacy method for backward compatibility - sets Y rotation
        this.setRotation(0, angleDegrees, 0);
    }
    
    createMesh() {
        let geometry;
        let color;
        
        if (this.type === 'sphere') {
            geometry = new THREE.SphereGeometry(this.size.x, 32, 32);
            color = 0xff6b6b; // Red
        } else if (this.type === 'cube') {
            geometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
            color = 0x4ecdc4; // Cyan
        } else if (this.type === 'cylinder') {
            geometry = new THREE.CylinderGeometry(this.size.x, this.size.x, this.size.y, 32);
            color = 0xffd93d; // Yellow
        } else if (this.type === 'torus') {
            geometry = new THREE.TorusGeometry(this.size.x, this.size.y, 16, 32);
            color = 0xa8e6cf; // Light green
        } else if (this.type === 'cone') {
            geometry = new THREE.ConeGeometry(this.size.x, this.size.y, 32);
            color = 0x9b59b6; // Purple
        } else if (this.type === 'boat') {
            // Create boat shape using cylinder (hull-like)
            geometry = new THREE.CylinderGeometry(this.size.x * 0.6, this.size.x, this.size.y, 32);
            geometry.scale(1, 1, this.size.z / this.size.x); // Make it elongated
            color = 0x8B4513; // Brown (wood)
        } else if (this.type === 'hollow-sphere') {
            geometry = new THREE.SphereGeometry(this.size.x, 32, 32);
            color = 0xe74c3c; // Red-orange
        } else if (this.type === 'hollow-cube') {
            geometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
            color = 0x95a5a6; // Gray
        } else if (this.type === 'hollow-cylinder') {
            geometry = new THREE.CylinderGeometry(this.size.x, this.size.x, this.size.y, 32);
            color = 0x34495e; // Dark gray
        } else {
            geometry = new THREE.SphereGeometry(this.size.x, 32, 32);
            color = 0xff6b6b;
        }
        
        // Determine if object is hollow
        const isHollow = this.type.includes('hollow');
        
        const material = new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: isHollow ? 0.4 : 0.7,
            shininess: 100,
            specular: 0x444444,
            side: isHollow ? THREE.DoubleSide : THREE.FrontSide
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        this.scene.add(this.mesh);
    }
    
    checkObjectCollisions(allBodies) {
        // Check collision with other rigid bodies
        allBodies.forEach(other => {
            if (other === this) return; // Don't collide with self
            
            const diff = new THREE.Vector3().subVectors(this.position, other.position);
            const distance = diff.length();
            
            if (distance < 0.001) return; // Avoid division by zero
            
            // Calculate effective radius for this object
            let thisRadius, otherRadius;
            
            if (this.type === 'sphere' || this.type === 'torus' || this.type === 'hollow-sphere') {
                thisRadius = this.size.x;
            } else if (this.type === 'cylinder' || this.type === 'cone' || this.type === 'hollow-cylinder' || this.type === 'boat') {
                thisRadius = this.size.x * 1.2; // Slightly larger for better collision
            } else {
                // For boxes, use diagonal as approximate radius
                thisRadius = this.size.length() * 0.6; // Better approximation
            }
            
            // Calculate effective radius for other object
            if (other.type === 'sphere' || other.type === 'torus' || other.type === 'hollow-sphere') {
                otherRadius = other.size.x;
            } else if (other.type === 'cylinder' || other.type === 'cone' || other.type === 'hollow-cylinder' || other.type === 'boat') {
                otherRadius = other.size.x * 1.2;
            } else {
                otherRadius = other.size.length() * 0.6;
            }
            
            const minDistance = thisRadius + otherRadius;
            
            // If objects are overlapping or very close
            if (distance < minDistance) {
                // Normalize the collision normal
                const normal = diff.clone().normalize();
                
                // Calculate overlap
                const overlap = minDistance - distance;
                
                // Separate objects completely to prevent penetration
                // Move both objects apart based on their relative velocities
                const totalVel = this.velocity.length() + other.velocity.length();
                const thisRatio = totalVel > 0 ? this.velocity.length() / totalVel : 0.5;
                const otherRatio = 1 - thisRatio;
                
                this.position.add(normal.clone().multiplyScalar(overlap * thisRatio));
                other.position.add(normal.clone().multiplyScalar(-overlap * otherRatio));
                
                // Calculate relative velocity
                const relativeVel = new THREE.Vector3().subVectors(this.velocity, other.velocity);
                const velocityAlongNormal = relativeVel.dot(normal);
                
                // Apply collision response (always, not just when moving toward each other)
                // This prevents objects from sticking together
                if (velocityAlongNormal < 0 || overlap > 0.1) {
                    // Coefficient of restitution (bounciness)
                    const restitution = 0.4;
                    
                    // Calculate impulse scalar
                    const j = -(1 + restitution) * velocityAlongNormal;
                    
                    // Apply impulse to both objects (equal and opposite)
                    const impulse = normal.clone().multiplyScalar(j * 0.5);
                    this.velocity.add(impulse);
                    other.velocity.sub(impulse);
                    
                    // Apply friction (perpendicular to collision normal)
                    const tangent = relativeVel.clone().sub(normal.clone().multiplyScalar(velocityAlongNormal));
                    const frictionMagnitude = tangent.length() * 0.3;
                    
                    if (frictionMagnitude > 0.001) {
                        const friction = tangent.normalize().multiplyScalar(-frictionMagnitude * 0.5);
                        this.velocity.add(friction);
                        other.velocity.sub(friction);
                    }
                    
                    // Reduce angular velocity on collision
                    this.angularVelocity.multiplyScalar(0.7);
                    other.angularVelocity.multiplyScalar(0.7);
                    
                    // Add some torque from the collision
                    const torqueAxis = new THREE.Vector3().crossVectors(normal, relativeVel);
                    this.angularVelocity.add(torqueAxis.multiplyScalar(0.01));
                }
            }
        });
    }
    
    update(dt, gravity, boundMin, boundMax, damping, fluidDensity = 1000, allBodies = []) {
        // Calculate buoyancy force based on fluid density and object density
        // Lower density fluids (like air: 1.2) provide less buoyancy, objects fall faster
        // Higher density fluids (like mercury: 13600) provide more buoyancy, objects fall slower
        // Lower density objects (like wood: 600) float more easily
        // Higher density objects (like lead: 11340) sink faster
        const buoyancyFactor = fluidDensity / this.density; // 0 to 1+ range
        const effectiveGravity = gravity * (1 - buoyancyFactor * 0.8); // Reduce gravity by buoyancy
        
        // Apply effective gravity (accounts for buoyancy)
        this.velocity.y += effectiveGravity * dt;
        
        // Apply fluid drag (higher viscosity = more drag)
        const dragFactor = Math.min(fluidDensity / 1000, 2); // Normalize around water
        this.velocity.multiplyScalar(1 - (0.01 * dragFactor * dt * 60)); // Drag force
        
        // Update position
        this.position.add(this.velocity.clone().multiplyScalar(dt));
        
        // Check collisions with other rigid bodies
        this.checkObjectCollisions(allBodies);
        
        // Update angular velocity and physical rotation
        // Apply angular damping (objects slow down rotation over time)
        this.angularVelocity.multiplyScalar(0.98);
        
        // Update physical rotation based on angular velocity
        this.physicalRotation.x += this.angularVelocity.x * dt;
        this.physicalRotation.y += this.angularVelocity.y * dt;
        this.physicalRotation.z += this.angularVelocity.z * dt;
        
        // Boundary collisions
        let radius, halfSize, effectiveRadius;
        
        if (this.type === 'sphere' || this.type === 'torus' || this.type === 'hollow-sphere') {
            radius = this.size.x;
        } else if (this.type === 'cylinder' || this.type === 'cone' || this.type === 'hollow-cylinder' || this.type === 'boat') {
            radius = this.size.x;
        } else {
            // For boxes, calculate effective radius based on rotation
            halfSize = this.size.clone().multiplyScalar(0.5);
            
            // Calculate the maximum extent of the rotated box
            // This ensures the collision boundary contains the entire rotated object
            const totalRotation = new THREE.Euler(
                (this.rotationX * Math.PI) / 180 + this.physicalRotation.x,
                (this.rotationY * Math.PI) / 180 + this.physicalRotation.y,
                (this.rotationZ * Math.PI) / 180 + this.physicalRotation.z
            );
            
            // Get the 8 corners of the box
            const corners = [
                new THREE.Vector3(-halfSize.x, -halfSize.y, -halfSize.z),
                new THREE.Vector3(halfSize.x, -halfSize.y, -halfSize.z),
                new THREE.Vector3(-halfSize.x, halfSize.y, -halfSize.z),
                new THREE.Vector3(halfSize.x, halfSize.y, -halfSize.z),
                new THREE.Vector3(-halfSize.x, -halfSize.y, halfSize.z),
                new THREE.Vector3(halfSize.x, -halfSize.y, halfSize.z),
                new THREE.Vector3(-halfSize.x, halfSize.y, halfSize.z),
                new THREE.Vector3(halfSize.x, halfSize.y, halfSize.z)
            ];
            
            // Rotate corners and find min/max extents
            let minY = Infinity, maxY = -Infinity;
            let minX = Infinity, maxX = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;
            
            corners.forEach(corner => {
                corner.applyEuler(totalRotation);
                minY = Math.min(minY, corner.y);
                maxY = Math.max(maxY, corner.y);
                minX = Math.min(minX, corner.x);
                maxX = Math.max(maxX, corner.x);
                minZ = Math.min(minZ, corner.z);
                maxZ = Math.max(maxZ, corner.z);
            });
            
            effectiveRadius = {
                y: Math.max(Math.abs(minY), Math.abs(maxY)),
                x: Math.max(Math.abs(minX), Math.abs(maxX)),
                z: Math.max(Math.abs(minZ), Math.abs(maxZ))
            };
        }
        
        // Bottom - solid objects have minimal bounce
        if (this.type === 'sphere' || this.type === 'torus' || this.type === 'hollow-sphere') {
            // Spheres and torus - no face alignment needed, they're round
            if (this.position.y - radius < boundMin.y) {
                this.position.y = boundMin.y + radius;
                
                // Apply torque based on horizontal velocity when hitting ground
                const impactForce = Math.abs(this.velocity.y);
                if (impactForce > 0.1) {
                    this.angularVelocity.x += this.velocity.z * 0.3;
                    this.angularVelocity.z -= this.velocity.x * 0.3;
                }
                
                this.velocity.y = -this.velocity.y * 0.2; // Minimal bounce for solid objects
                this.velocity.x *= 0.8; // More friction
                this.velocity.z *= 0.8;
                
                // Angular friction when touching ground
                this.angularVelocity.multiplyScalar(0.85);
            }
        } else if (this.type === 'cylinder' || this.type === 'cone' || this.type === 'hollow-cylinder' || this.type === 'boat') {
            // Cylinders and cones - align to stand upright or lay flat
            if (this.position.y - radius < boundMin.y) {
                this.position.y = boundMin.y + radius;
                
                const impactForce = Math.abs(this.velocity.y);
                if (impactForce > 0.1) {
                    this.angularVelocity.x += this.velocity.z * 0.3;
                    this.angularVelocity.z -= this.velocity.x * 0.3;
                }
                
                this.velocity.y = -this.velocity.y * 0.2;
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
                this.angularVelocity.multiplyScalar(0.85);
                
                // Auto-align cylinders to stable positions
                const isMovingSlowly = this.velocity.length() < 0.5 && Math.abs(this.angularVelocity.length()) < 1.0;
                if (isMovingSlowly) {
                    const totalRotX = (this.rotationX * Math.PI) / 180 + this.physicalRotation.x;
                    const totalRotZ = (this.rotationZ * Math.PI) / 180 + this.physicalRotation.z;
                    
                    // Snap to upright (0°) or laying down (90°)
                    const snapAngle = Math.PI / 2;
                    const targetRotX = Math.round(totalRotX / snapAngle) * snapAngle;
                    const targetRotZ = Math.round(totalRotZ / snapAngle) * snapAngle;
                    
                    const alignSpeed = 0.1;
                    this.physicalRotation.x += (targetRotX - totalRotX) * alignSpeed;
                    this.physicalRotation.z += (targetRotZ - totalRotZ) * alignSpeed;
                    this.angularVelocity.multiplyScalar(0.5);
                }
            }
        } else {
            // Cubes and boxes - use effective radius based on rotation
            if (this.position.y - effectiveRadius.y < boundMin.y) {
                this.position.y = boundMin.y + effectiveRadius.y;
                
                // Apply torque based on horizontal velocity when hitting ground
                const impactForce = Math.abs(this.velocity.y);
                if (impactForce > 0.1) {
                    // Create torque from horizontal velocity
                    this.angularVelocity.x += this.velocity.z * 0.5;
                    this.angularVelocity.z -= this.velocity.x * 0.5;
                }
                
                this.velocity.y = -this.velocity.y * 0.2; // Minimal bounce
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
                
                // Strong angular friction when touching ground - helps objects settle
                this.angularVelocity.multiplyScalar(0.7);
                
                // Auto-align to nearest face when touching ground and moving slowly
                const isMovingSlowly = this.velocity.length() < 0.5 && Math.abs(this.angularVelocity.length()) < 1.0;
                if (isMovingSlowly) {
                    // Get current total rotation
                    const totalRotX = (this.rotationX * Math.PI) / 180 + this.physicalRotation.x;
                    const totalRotY = (this.rotationY * Math.PI) / 180 + this.physicalRotation.y;
                    const totalRotZ = (this.rotationZ * Math.PI) / 180 + this.physicalRotation.z;
                    
                    // Snap to nearest 90-degree angle (flat face)
                    const snapAngle = Math.PI / 2; // 90 degrees
                    const targetRotX = Math.round(totalRotX / snapAngle) * snapAngle;
                    const targetRotY = Math.round(totalRotY / snapAngle) * snapAngle;
                    const targetRotZ = Math.round(totalRotZ / snapAngle) * snapAngle;
                    
                    // Smoothly rotate toward target
                    const alignSpeed = 0.1;
                    this.physicalRotation.x += (targetRotX - totalRotX) * alignSpeed;
                    this.physicalRotation.y += (targetRotY - totalRotY) * alignSpeed;
                    this.physicalRotation.z += (targetRotZ - totalRotZ) * alignSpeed;
                    
                    // Dampen angular velocity during alignment
                    this.angularVelocity.multiplyScalar(0.5);
                    
                    // Recalculate effective radius after rotation adjustment
                    const newTotalRotation = new THREE.Euler(
                        (this.rotationX * Math.PI) / 180 + this.physicalRotation.x,
                        (this.rotationY * Math.PI) / 180 + this.physicalRotation.y,
                        (this.rotationZ * Math.PI) / 180 + this.physicalRotation.z
                    );
                    
                    const corners = [
                        new THREE.Vector3(-halfSize.x, -halfSize.y, -halfSize.z),
                        new THREE.Vector3(halfSize.x, -halfSize.y, -halfSize.z),
                        new THREE.Vector3(-halfSize.x, halfSize.y, -halfSize.z),
                        new THREE.Vector3(halfSize.x, halfSize.y, -halfSize.z),
                        new THREE.Vector3(-halfSize.x, -halfSize.y, halfSize.z),
                        new THREE.Vector3(halfSize.x, -halfSize.y, halfSize.z),
                        new THREE.Vector3(-halfSize.x, halfSize.y, halfSize.z),
                        new THREE.Vector3(halfSize.x, halfSize.y, halfSize.z)
                    ];
                    
                    let newMinY = Infinity;
                    corners.forEach(corner => {
                        corner.applyEuler(newTotalRotation);
                        newMinY = Math.min(newMinY, corner.y);
                    });
                    
                    const newEffectiveRadiusY = Math.abs(newMinY);
                    
                    // Adjust position to prevent sinking
                    if (this.position.y - newEffectiveRadiusY < boundMin.y) {
                        this.position.y = boundMin.y + newEffectiveRadiusY;
                    }
                }
            }
        }
        
        // Top
        if (this.type === 'sphere' || this.type === 'cylinder' || this.type === 'torus' || this.type === 'cone' || this.type === 'hollow-sphere' || this.type === 'hollow-cylinder' || this.type === 'boat') {
            if (this.position.y + radius > boundMax.y) {
                this.position.y = boundMax.y - radius;
                this.velocity.y = -this.velocity.y * 0.2;
            }
        } else {
            if (this.position.y + effectiveRadius.y > boundMax.y) {
                this.position.y = boundMax.y - effectiveRadius.y;
                this.velocity.y = -this.velocity.y * 0.2;
            }
        }
        
        // Sides (X axis)
        if (this.type === 'sphere' || this.type === 'cylinder' || this.type === 'torus' || this.type === 'cone' || this.type === 'hollow-sphere' || this.type === 'hollow-cylinder' || this.type === 'boat') {
            if (this.position.x - radius < boundMin.x) {
                this.position.x = boundMin.x + radius;
                this.angularVelocity.z += this.velocity.y * 0.2; // Add torque from vertical velocity
                this.velocity.x = -this.velocity.x * 0.3;
            }
            if (this.position.x + radius > boundMax.x) {
                this.position.x = boundMax.x - radius;
                this.angularVelocity.z -= this.velocity.y * 0.2;
                this.velocity.x = -this.velocity.x * 0.3;
            }
        } else {
            if (this.position.x - effectiveRadius.x < boundMin.x) {
                this.position.x = boundMin.x + effectiveRadius.x;
                this.angularVelocity.z += this.velocity.y * 0.3;
                this.velocity.x = -this.velocity.x * 0.3;
            }
            if (this.position.x + effectiveRadius.x > boundMax.x) {
                this.position.x = boundMax.x - effectiveRadius.x;
                this.angularVelocity.z -= this.velocity.y * 0.3;
                this.velocity.x = -this.velocity.x * 0.3;
            }
        }
        
        // Sides (Z axis)
        if (this.type === 'sphere' || this.type === 'cylinder' || this.type === 'torus' || this.type === 'cone' || this.type === 'hollow-sphere' || this.type === 'hollow-cylinder' || this.type === 'boat') {
            if (this.position.z - radius < boundMin.z) {
                this.position.z = boundMin.z + radius;
                this.angularVelocity.x -= this.velocity.y * 0.2; // Add torque from vertical velocity
                this.velocity.z = -this.velocity.z * 0.3;
            }
            if (this.position.z + radius > boundMax.z) {
                this.position.z = boundMax.z - radius;
                this.angularVelocity.x += this.velocity.y * 0.2;
                this.velocity.z = -this.velocity.z * 0.3;
            }
        } else {
            if (this.position.z - effectiveRadius.z < boundMin.z) {
                this.position.z = boundMin.z + effectiveRadius.z;
                this.angularVelocity.x -= this.velocity.y * 0.3;
                this.velocity.z = -this.velocity.z * 0.3;
            }
            if (this.position.z + effectiveRadius.z > boundMax.z) {
                this.position.z = boundMax.z - effectiveRadius.z;
                this.angularVelocity.x += this.velocity.y * 0.3;
                this.velocity.z = -this.velocity.z * 0.3;
            }
        }
        
        // Update mesh position
        // Update mesh position to match physics position
        this.mesh.position.copy(this.position);
        
        // Combine user-set rotation with physics-based rotation
        // User-set rotation (from sliders) + dynamic rotation (from physics)
        this.mesh.rotation.x = (this.rotationX * Math.PI) / 180 + this.physicalRotation.x;
        this.mesh.rotation.y = (this.rotationY * Math.PI) / 180 + this.physicalRotation.y;
        this.mesh.rotation.z = (this.rotationZ * Math.PI) / 180 + this.physicalRotation.z;
    }
    
    remove() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
